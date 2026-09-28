-- Migration: 20260928040000_dono_profissional_e_visibilidade_busca.sql
-- Descrição:
-- 1. Atualiza RPC criar_barbearia_com_dono para cadastrar o dono automaticamente como profissional (com horário pendente).
-- 2. Cria função auxiliar barbearia_possui_horarios_ativos.
-- 3. Atualiza RPC buscar_barbearias_com_distancia para ocultar barbearias sem horário de trabalho ativo na busca do cliente.
-- 4. Realiza backfill de profissionais para donos de barbearias já existentes.

-- 1. Função auxiliar para verificar se a barbearia tem ao menos um profissional com horário semanal ativo
CREATE OR REPLACE FUNCTION public.barbearia_possui_horarios_ativos(p_barbearia_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.profissionais p
        JOIN public.jornadas_profissionais jp ON jp.profissional_id = p.id
        WHERE p.barbearia_id = p_barbearia_id
          AND p.ativo = true
          AND jp.ativo = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.barbearia_possui_horarios_ativos TO anon, authenticated;

-- 2. Atualizar RPC criar_barbearia_com_dono
CREATE OR REPLACE FUNCTION public.criar_barbearia_com_dono(
    p_nome TEXT,
    p_slug TEXT,
    p_telefone TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_endereco TEXT DEFAULT NULL,
    p_bairro TEXT DEFAULT NULL,
    p_cidade TEXT DEFAULT NULL,
    p_estado TEXT DEFAULT NULL,
    p_cep TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_barbearia_id UUID;
    v_nome_dono TEXT;
    v_email_dono TEXT;
    v_telefone_dono TEXT;
    v_foto_dono TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Obter dados do usuário dono em public.usuarios ou metadados de autenticação
    SELECT COALESCE(u.nome, (auth.jwt() -> 'user_metadata' ->> 'nome'), 'Dono'),
           COALESCE(u.email, (auth.jwt() ->> 'email'), p_email),
           COALESCE(u.telefone, (auth.jwt() -> 'user_metadata' ->> 'telefone'), p_telefone),
           u.foto_url
    INTO v_nome_dono, v_email_dono, v_telefone_dono, v_foto_dono
    FROM public.usuarios u
    WHERE u.id = auth.uid();

    IF v_nome_dono IS NULL OR TRIM(v_nome_dono) = '' THEN
        v_nome_dono := 'Dono';
    END IF;

    -- Inserir barbearia com trial de 30 dias
    INSERT INTO public.barbearias (
        nome, slug, telefone, email, endereco, bairro, cidade, estado, cep,
        status_assinatura, trial_inicio, trial_fim, onboarding_concluido
    )
    VALUES (
        p_nome, p_slug, p_telefone, p_email, p_endereco, p_bairro, p_cidade, p_estado, p_cep,
        'trial', timezone('utc'::text, now()), timezone('utc'::text, now()) + interval '30 days', false
    )
    RETURNING id INTO v_barbearia_id;

    -- Vincular o usuário como Dono na equipe
    INSERT INTO public.membros_barbearia (barbearia_id, usuario_id, papel, ativo)
    VALUES (v_barbearia_id, auth.uid(), 'dono', true);

    -- Auto-cadastro: criar o dono como profissional da barbearia (com horários de trabalho pendentes)
    INSERT INTO public.profissionais (
        barbearia_id,
        usuario_id,
        nome,
        email,
        telefone,
        foto_url,
        ativo
    )
    VALUES (
        v_barbearia_id,
        auth.uid(),
        v_nome_dono,
        v_email_dono,
        v_telefone_dono,
        v_foto_dono,
        true
    );

    RETURN v_barbearia_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.criar_barbearia_com_dono TO authenticated;

-- 3. Atualizar RPC buscar_barbearias_com_distancia
-- Exige que a barbearia esteja ativa E possua pelo menos um profissional com horário ativo
CREATE OR REPLACE FUNCTION public.buscar_barbearias_com_distancia(
    p_latitude NUMERIC DEFAULT NULL,
    p_longitude NUMERIC DEFAULT NULL,
    p_busca_nome TEXT DEFAULT NULL,
    p_raio_km NUMERIC DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    nome TEXT,
    slug TEXT,
    logo_url TEXT,
    telefone TEXT,
    endereco TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    cep TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    distancia_km NUMERIC,
    preco_corte NUMERIC,
    menor_preco NUMERIC,
    maior_preco NUMERIC,
    media_nota NUMERIC,
    total_avaliacoes BIGINT,
    total_servicos BIGINT,
    servicos JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.nome,
        b.slug,
        b.logo_url,
        b.telefone,
        b.endereco,
        b.bairro,
        b.cidade,
        b.estado,
        b.cep,
        b.latitude,
        b.longitude,
        public.calcular_distancia_km(p_latitude, p_longitude, b.latitude, b.longitude) AS distancia_km,
        COALESCE((
            SELECT s.preco FROM public.servicos s
            WHERE s.barbearia_id = b.id AND s.ativo = true AND (s.nome ILIKE '%corte%' OR s.nome ILIKE '%cabelo%')
            ORDER BY s.preco ASC LIMIT 1
        ), NULL) AS preco_corte,
        (
            SELECT MIN(s.preco) FROM public.servicos s
            WHERE s.barbearia_id = b.id AND s.ativo = true AND s.preco > 0
        ) AS menor_preco,
        (
            SELECT MAX(s.preco) FROM public.servicos s
            WHERE s.barbearia_id = b.id AND s.ativo = true AND s.preco > 0
        ) AS maior_preco,
        COALESCE((
            SELECT ROUND(AVG(a.nota)::numeric, 1) FROM public.avaliacoes a
            WHERE a.barbearia_id = b.id
        ), 0.0) AS media_nota,
        COALESCE((
            SELECT COUNT(a.id) FROM public.avaliacoes a
            WHERE a.barbearia_id = b.id
        ), 0::bigint) AS total_avaliacoes,
        COALESCE((
            SELECT COUNT(s.id) FROM public.servicos s
            WHERE s.barbearia_id = b.id AND s.ativo = true
        ), 0::bigint) AS total_servicos,
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'preco', s.preco, 'ativo', s.ativo))
            FROM public.servicos s
            WHERE s.barbearia_id = b.id AND s.ativo = true
        ), '[]'::jsonb) AS servicos
    FROM public.barbearias b
    WHERE b.ativa = true
      AND public.barbearia_possui_horarios_ativos(b.id) = true
      AND (
          p_busca_nome IS NULL
          OR b.nome ILIKE '%' || p_busca_nome || '%'
      )
      AND (
          p_raio_km IS NULL
          OR p_latitude IS NULL
          OR p_longitude IS NULL
          OR b.latitude IS NULL
          OR b.longitude IS NULL
          OR public.calcular_distancia_km(p_latitude, p_longitude, b.latitude, b.longitude) <= p_raio_km
      )
    ORDER BY
        CASE WHEN p_latitude IS NOT NULL AND b.latitude IS NOT NULL THEN
            public.calcular_distancia_km(p_latitude, p_longitude, b.latitude, b.longitude)
        ELSE NULL END ASC NULLS LAST,
        b.nome ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.buscar_barbearias_com_distancia TO anon, authenticated;

-- 4. Backfill: Donos existentes que ainda não são profissionais
INSERT INTO public.profissionais (barbearia_id, usuario_id, nome, email, telefone, foto_url, ativo)
SELECT mb.barbearia_id,
       mb.usuario_id,
       COALESCE(u.nome, 'Dono'),
       u.email,
       u.telefone,
       u.foto_url,
       true
FROM public.membros_barbearia mb
JOIN public.usuarios u ON u.id = mb.usuario_id
LEFT JOIN public.profissionais p ON p.barbearia_id = mb.barbearia_id AND p.usuario_id = mb.usuario_id
WHERE mb.papel = 'dono'
  AND mb.ativo = true
  AND p.id IS NULL;
