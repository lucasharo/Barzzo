-- Única diferença de funcionalidade entre os planos: a quantidade de filiais.
--   Solo e Pro: somente a própria unidade.
--   Growth:     matriz + 1 filial.
--   Rede:       filiais ilimitadas.
-- Profissionais e demais recursos não variam por plano (os limites de profissionais ficam como estão).

ALTER TABLE public.planos
    ADD COLUMN IF NOT EXISTS limite_filiais INTEGER CHECK (limite_filiais IS NULL OR limite_filiais >= 0);

COMMENT ON COLUMN public.planos.limite_filiais IS 'Filiais permitidas além da matriz; 0 = nenhuma; NULL = ilimitadas.';

UPDATE public.planos SET limite_filiais = 0 WHERE identificador IN ('solo', 'pro');
UPDATE public.planos SET limite_filiais = 1 WHERE identificador = 'growth';
UPDATE public.planos SET limite_filiais = NULL WHERE identificador = 'rede';

-- A vitrine passa a dizer o que de fato difere: os recursos do produto são os mesmos em todos os planos.
UPDATE public.planos SET recursos = jsonb_build_array('1 profissional', 'Agendamentos ilimitados', 'Todas as funcionalidades',
    'Marketplace Barzzo', 'Lembretes in-app', '1 unidade'
) WHERE identificador = 'solo';

UPDATE public.planos SET recursos = jsonb_build_array('Até 5 profissionais', 'Agendamentos ilimitados', 'Todas as funcionalidades',
    'Marketplace Barzzo', 'Lembretes in-app', '1 unidade'
) WHERE identificador = 'pro';

UPDATE public.planos SET recursos = jsonb_build_array('Até 15 profissionais', 'Agendamentos ilimitados', 'Todas as funcionalidades',
    'Matriz + 1 filial', 'Suporte prioritário'
) WHERE identificador = 'growth';

UPDATE public.planos SET recursos = jsonb_build_array('Profissionais ilimitados', 'Agendamentos ilimitados', 'Todas as funcionalidades',
    'Matriz e filiais ilimitadas', 'Gerente de contas dedicado'
) WHERE identificador = 'rede';

-- ============================================================================
-- criar_filial: respeita o limite de filiais do plano da matriz
-- ============================================================================

CREATE OR REPLACE FUNCTION public.criar_filial(
    p_matriz_id uuid,
    p_nome text,
    p_slug text,
    p_telefone text DEFAULT NULL,
    p_email text DEFAULT NULL,
    p_endereco text DEFAULT NULL,
    p_bairro text DEFAULT NULL,
    p_cidade text DEFAULT NULL,
    p_estado text DEFAULT NULL,
    p_cep text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_matriz public.barbearias%ROWTYPE;
    v_plano public.planos%ROWTYPE;
    v_total_filiais INTEGER;
    v_filial_id UUID;
    v_nome_dono TEXT;
    v_email_dono TEXT;
    v_telefone_dono TEXT;
    v_foto_dono TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Trava a matriz: duas criações simultâneas não ultrapassam o limite do plano.
    SELECT * INTO v_matriz FROM public.barbearias WHERE id = p_matriz_id FOR UPDATE;
    IF NOT FOUND OR v_matriz.matriz_id IS NOT NULL THEN
        RAISE EXCEPTION 'Matriz inválida.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.membros_barbearia m
        WHERE m.barbearia_id = p_matriz_id
          AND m.usuario_id = auth.uid()
          AND m.papel = 'dono'
          AND m.ativo = true
    ) THEN
        RAISE EXCEPTION 'Somente o dono da matriz pode cadastrar filiais.';
    END IF;

    SELECT p.* INTO v_plano
    FROM public.assinaturas a
    JOIN public.planos p ON p.id = a.plano_id
    WHERE a.barbearia_id = p_matriz_id
      AND a.status = 'ativa'
      AND a.data_fim > timezone('utc'::text, now())
    ORDER BY a.data_fim DESC
    LIMIT 1;

    IF NOT FOUND OR v_matriz.status_assinatura <> 'ativo' THEN
        RAISE EXCEPTION 'O cadastro de filiais exige uma assinatura ativa dos planos Growth ou Rede.';
    END IF;

    IF v_plano.limite_filiais IS NOT NULL THEN
        IF v_plano.limite_filiais = 0 THEN
            RAISE EXCEPTION 'O % não inclui filiais. Faça upgrade para o Growth ou o Rede.', v_plano.nome;
        END IF;

        SELECT COUNT(*) INTO v_total_filiais FROM public.barbearias WHERE matriz_id = p_matriz_id;
        IF v_total_filiais >= v_plano.limite_filiais THEN
            RAISE EXCEPTION 'O % inclui % filial(is) e o limite já foi atingido. Faça upgrade para o Rede para filiais ilimitadas.',
                v_plano.nome, v_plano.limite_filiais;
        END IF;
    END IF;

    SELECT COALESCE(u.nome, 'Dono'), COALESCE(u.email, p_email), COALESCE(u.telefone, p_telefone), u.foto_url
    INTO v_nome_dono, v_email_dono, v_telefone_dono, v_foto_dono
    FROM public.usuarios u
    WHERE u.id = auth.uid();

    INSERT INTO public.barbearias (
        nome, slug, telefone, email, endereco, bairro, cidade, estado, cep,
        status_assinatura, trial_inicio, trial_fim, onboarding_concluido, matriz_id
    )
    VALUES (
        p_nome, p_slug, p_telefone, p_email, p_endereco, p_bairro, p_cidade, p_estado, p_cep,
        v_matriz.status_assinatura, v_matriz.trial_inicio, v_matriz.trial_fim, false, p_matriz_id
    )
    RETURNING id INTO v_filial_id;

    INSERT INTO public.membros_barbearia (barbearia_id, usuario_id, papel, ativo)
    VALUES (v_filial_id, auth.uid(), 'dono', true);

    INSERT INTO public.profissionais (barbearia_id, usuario_id, nome, email, telefone, foto_url, ativo)
    VALUES (v_filial_id, auth.uid(), COALESCE(v_nome_dono, 'Dono'), v_email_dono, v_telefone_dono, v_foto_dono, true);

    RETURN v_filial_id;
END;
$$;

-- ============================================================================
-- obter_unidades_do_usuario: devolve também o que o plano permite
-- ============================================================================

DROP FUNCTION IF EXISTS public.obter_unidades_do_usuario();

CREATE FUNCTION public.obter_unidades_do_usuario()
RETURNS TABLE (
    id uuid,
    nome text,
    slug text,
    bairro text,
    cidade text,
    estado text,
    matriz_id uuid,
    papel text,
    status_assinatura text,
    plano text,
    plano_permite_filiais boolean,
    limite_filiais integer,
    total_filiais integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    WITH base AS (
        SELECT b.*, m.papel, m.criado_em AS membro_desde, COALESCE(b.matriz_id, b.id) AS raiz
        FROM public.membros_barbearia m
        JOIN public.barbearias b ON b.id = m.barbearia_id
        WHERE m.usuario_id = auth.uid()
          AND m.ativo = true
    )
    SELECT
        b.id, b.nome, b.slug, b.bairro, b.cidade, b.estado, b.matriz_id, b.papel, b.status_assinatura,
        pl.identificador AS plano,
        (pl.id IS NOT NULL AND (pl.limite_filiais IS NULL OR pl.limite_filiais > 0)) AS plano_permite_filiais,
        pl.limite_filiais,
        (SELECT COUNT(*)::integer FROM public.barbearias f WHERE f.matriz_id = b.raiz) AS total_filiais
    FROM base b
    LEFT JOIN LATERAL (
        SELECT p.*
        FROM public.assinaturas a
        JOIN public.planos p ON p.id = a.plano_id
        WHERE a.barbearia_id = b.raiz
          AND a.status = 'ativa'
          AND a.data_fim > timezone('utc'::text, now())
        ORDER BY a.data_fim DESC
        LIMIT 1
    ) pl ON true
    ORDER BY (b.matriz_id IS NOT NULL), b.membro_desde ASC;
$$;

REVOKE ALL ON FUNCTION public.obter_unidades_do_usuario() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_unidades_do_usuario() TO authenticated, service_role;
