-- Migration: 20260929000002_corrigir_conflitos_schema.sql
-- Descrição: Corrige 2 conflitos identificados entre migrações locais e o banco remoto:
--   1. Remove overload antigo da RPC processar_confirmacao_pagamento_assinatura (5 args)
--      que causa ambiguidade com a versão atual de 6 args
--   2. Recria buscar_barbearias_com_distancia garantindo foto_capa_url no retorno
--      (o cache PostgREST pode não ter a versão mais recente)

-- 1. Remover a versão antiga de processar_confirmacao_pagamento_assinatura (5 argumentos)
--    A versão atual tem 6 args (incluindo p_mp_subscription_id DEFAULT NULL)
DROP FUNCTION IF EXISTS public.processar_confirmacao_pagamento_assinatura(
    UUID, UUID, TEXT, NUMERIC, TEXT
);

-- Garantir que apenas a versão com 6 args (+ DEFAULT) exista e esteja atualizada
CREATE OR REPLACE FUNCTION public.processar_confirmacao_pagamento_assinatura(
    p_barbearia_id UUID,
    p_plano_id UUID,
    p_ciclo TEXT,
    p_valor NUMERIC(10,2),
    p_mp_payment_id TEXT DEFAULT NULL,
    p_mp_subscription_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_assinatura_id UUID;
    v_meses_adicionar INTEGER;
    v_data_inicio TIMESTAMPTZ := timezone('utc'::text, now());
    v_data_fim TIMESTAMPTZ;
BEGIN
    -- Idempotência: verificar se payment já foi registrado
    IF p_mp_payment_id IS NOT NULL THEN
        SELECT id INTO v_assinatura_id
        FROM public.assinaturas
        WHERE mercado_pago_payment_id = p_mp_payment_id;

        IF FOUND THEN
            RETURN v_assinatura_id;
        END IF;
    END IF;

    -- Idempotência: verificar se preapproval/subscription já está ativo
    IF p_mp_subscription_id IS NOT NULL THEN
        SELECT id INTO v_assinatura_id
        FROM public.assinaturas
        WHERE mercado_pago_subscription_id = p_mp_subscription_id AND status = 'ativa';

        IF FOUND THEN
            RETURN v_assinatura_id;
        END IF;
    END IF;

    -- Determinar vigência
    IF p_ciclo = 'semestral' THEN
        v_meses_adicionar := 6;
    ELSE
        v_meses_adicionar := 1;
    END IF;

    v_data_fim := v_data_inicio + (v_meses_adicionar || ' months')::INTERVAL;

    -- Inserir assinatura ativa
    INSERT INTO public.assinaturas (
        barbearia_id, plano_id, ciclo, status, data_inicio, data_fim,
        mercado_pago_payment_id, mercado_pago_subscription_id, valor
    )
    VALUES (
        p_barbearia_id, p_plano_id, p_ciclo, 'ativa', v_data_inicio, v_data_fim,
        p_mp_payment_id, p_mp_subscription_id, p_valor
    )
    RETURNING id INTO v_assinatura_id;

    -- Atualizar status da barbearia para ativo
    UPDATE public.barbearias
    SET status_assinatura = 'ativo',
        atualizado_em = timezone('utc'::text, now())
    WHERE id = p_barbearia_id;

    -- Auditoria
    INSERT INTO public.logs_auditoria (
        usuario_id, barbearia_id, acao, entidade, entidade_id, dados_novos
    )
    VALUES (
        auth.uid(),
        p_barbearia_id,
        'ativar_assinatura',
        'assinaturas',
        v_assinatura_id,
        jsonb_build_object(
            'plano_id', p_plano_id,
            'ciclo', p_ciclo,
            'valor', p_valor,
            'mp_payment_id', p_mp_payment_id,
            'mp_subscription_id', p_mp_subscription_id,
            'data_fim', v_data_fim
        )
    );

    RETURN v_assinatura_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.processar_confirmacao_pagamento_assinatura TO authenticated, service_role;

-- 2. Recriar buscar_barbearias_com_distancia garantindo foto_capa_url no resultado
--    (força atualização do cache PostgREST da assinatura da função)
DROP FUNCTION IF EXISTS public.buscar_barbearias_com_distancia(NUMERIC, NUMERIC, TEXT, NUMERIC);

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
    foto_capa_url TEXT,
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
        COALESCE(
            (
                SELECT gf.foto_url FROM public.galeria_fotos gf
                WHERE gf.barbearia_id = b.id AND gf.destaque_capa = true
                ORDER BY gf.created_at DESC LIMIT 1
            ),
            (
                SELECT gf.foto_url FROM public.galeria_fotos gf
                WHERE gf.barbearia_id = b.id
                ORDER BY gf.ordem ASC, gf.created_at ASC LIMIT 1
            ),
            b.logo_url
        ) AS foto_capa_url,
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
            WHERE s.barbearia_id = b.id AND s.ativo = true
              AND (s.nome ILIKE '%corte%' OR s.nome ILIKE '%cabelo%')
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
            SELECT jsonb_agg(jsonb_build_object(
                'id', s.id, 'nome', s.nome, 'preco', s.preco, 'ativo', s.ativo
            ))
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
