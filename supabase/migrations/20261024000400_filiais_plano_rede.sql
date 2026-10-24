-- Filiais no plano Rede: uma conta pode ter várias unidades (matriz + filiais). A filial nasce
-- ativa e herda a assinatura da matriz, sem cobrança própria. Ao mesmo tempo, fecha dois
-- caminhos que deixariam qualquer barbearia se auto-conceder assinatura (o que tornaria o
-- recurso "gestão de unidades" gratuito para todos).

-- ============================================================================
-- 1. Cobrança só pelo backend
-- ============================================================================

-- Membros da barbearia podiam inserir e alterar linhas de assinatura. O app só lê; as gravações
-- vêm do webhook e das rotas de servidor (chave de serviço, que ignora a RLS).
DROP POLICY IF EXISTS "Membros gestores podem atualizar assinaturas" ON public.assinaturas;
DROP POLICY IF EXISTS "Membros gestores podem inserir assinaturas" ON public.assinaturas;

-- A policy de atualização da barbearia permitia ao dono alterar qualquer coluna, inclusive
-- status da assinatura e fim do trial. Colunas de cobrança e vínculo de rede só mudam pelo
-- backend (funções SECURITY DEFINER, chave de serviço) ou pelo Admin.
CREATE OR REPLACE FUNCTION public.proteger_cobranca_barbearia()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF current_user IN ('authenticated', 'anon')
       AND NOT COALESCE(public.eh_admin(), false)
       AND (
            NEW.status_assinatura IS DISTINCT FROM OLD.status_assinatura
            OR NEW.trial_inicio IS DISTINCT FROM OLD.trial_inicio
            OR NEW.trial_fim IS DISTINCT FROM OLD.trial_fim
            OR NEW.ativa IS DISTINCT FROM OLD.ativa
            OR NEW.recorrencia_ativa IS DISTINCT FROM OLD.recorrencia_ativa
            OR NEW.mercado_pago_customer_id IS DISTINCT FROM OLD.mercado_pago_customer_id
            OR NEW.mercado_pago_card_id IS DISTINCT FROM OLD.mercado_pago_card_id
            OR NEW.mercado_pago_card_last_four IS DISTINCT FROM OLD.mercado_pago_card_last_four
            OR NEW.mercado_pago_card_brand IS DISTINCT FROM OLD.mercado_pago_card_brand
            OR NEW.matriz_id IS DISTINCT FROM OLD.matriz_id
       ) THEN
        RAISE EXCEPTION 'Dados de assinatura e de rede não podem ser alterados diretamente.';
    END IF;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. Vínculo matriz -> filiais
-- ============================================================================

ALTER TABLE public.barbearias
    ADD COLUMN IF NOT EXISTS matriz_id UUID REFERENCES public.barbearias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_barbearias_matriz ON public.barbearias (matriz_id) WHERE matriz_id IS NOT NULL;

DROP TRIGGER IF EXISTS trigger_proteger_cobranca_barbearia ON public.barbearias;
CREATE TRIGGER trigger_proteger_cobranca_barbearia
    BEFORE UPDATE ON public.barbearias
    FOR EACH ROW EXECUTE FUNCTION public.proteger_cobranca_barbearia();

-- A situação da assinatura da matriz vale para todas as filiais.
CREATE OR REPLACE FUNCTION public.propagar_assinatura_para_filiais()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.barbearias
    SET status_assinatura = NEW.status_assinatura,
        trial_inicio = NEW.trial_inicio,
        trial_fim = NEW.trial_fim
    WHERE matriz_id = NEW.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_propagar_assinatura_filiais ON public.barbearias;
CREATE TRIGGER trigger_propagar_assinatura_filiais
    AFTER UPDATE OF status_assinatura, trial_inicio, trial_fim ON public.barbearias
    FOR EACH ROW
    WHEN (
        NEW.matriz_id IS NULL
        AND (
            OLD.status_assinatura IS DISTINCT FROM NEW.status_assinatura
            OR OLD.trial_inicio IS DISTINCT FROM NEW.trial_inicio
            OR OLD.trial_fim IS DISTINCT FROM NEW.trial_fim
        )
    )
    EXECUTE FUNCTION public.propagar_assinatura_para_filiais();

-- ============================================================================
-- 3. RPCs de unidades
-- ============================================================================

-- Unidades em que o usuário é membro ativo, com o plano vigente da matriz (ou da própria barbearia).
CREATE OR REPLACE FUNCTION public.obter_unidades_do_usuario()
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
    plano text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        b.id, b.nome, b.slug, b.bairro, b.cidade, b.estado, b.matriz_id, m.papel, b.status_assinatura,
        (
            SELECT p.identificador
            FROM public.assinaturas a
            JOIN public.planos p ON p.id = a.plano_id
            WHERE a.barbearia_id = COALESCE(b.matriz_id, b.id)
              AND a.status = 'ativa'
              AND a.data_fim > timezone('utc'::text, now())
            ORDER BY a.data_fim DESC
            LIMIT 1
        ) AS plano
    FROM public.membros_barbearia m
    JOIN public.barbearias b ON b.id = m.barbearia_id
    WHERE m.usuario_id = auth.uid()
      AND m.ativo = true
    ORDER BY (b.matriz_id IS NOT NULL), m.criado_em ASC;
$$;

-- Cria uma filial da matriz informada. Exige: dono da matriz, matriz com assinatura ativa do plano Rede.
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
    v_filial_id UUID;
    v_nome_dono TEXT;
    v_email_dono TEXT;
    v_telefone_dono TEXT;
    v_foto_dono TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    SELECT * INTO v_matriz FROM public.barbearias WHERE id = p_matriz_id;
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

    IF v_matriz.status_assinatura <> 'ativo' OR NOT EXISTS (
        SELECT 1
        FROM public.assinaturas a
        JOIN public.planos p ON p.id = a.plano_id
        WHERE a.barbearia_id = p_matriz_id
          AND a.status = 'ativa'
          AND a.data_fim > timezone('utc'::text, now())
          AND p.identificador = 'rede'
    ) THEN
        RAISE EXCEPTION 'O cadastro de filiais está disponível apenas no plano Rede com assinatura ativa.';
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
-- 4. Privilégios
-- ============================================================================

REVOKE ALL ON FUNCTION public.proteger_cobranca_barbearia() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.propagar_assinatura_para_filiais() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.obter_unidades_do_usuario() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.criar_filial(uuid, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_unidades_do_usuario() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.criar_filial(uuid, text, text, text, text, text, text, text, text, text) TO authenticated, service_role;
