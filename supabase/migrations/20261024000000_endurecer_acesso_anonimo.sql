-- Endurecimento de acesso, parte 1 (compatível com os apps já publicados):
-- fecha RPCs `SECURITY DEFINER` que não conferiam quem estava chamando, tira o acesso
-- anônimo às funções internas e remove policies abertas demais (convites, indicações,
-- upload anônimo). A parte 2 restringe a leitura anônima de tabelas e depende do deploy
-- dos apps com colunas explícitas e das RPCs de convite/cupom.

-- ============================================================================
-- 1. Helper: chamada feita pela chave de serviço (webhooks e jobs de backend)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.eh_service_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(auth.role(), '') = 'service_role';
$$;

-- eh_admin() devolvia NULL (e não false) para quem não é admin; "IF NOT eh_admin()" nunca
-- disparava. Agora é sempre booleano.
CREATE OR REPLACE FUNCTION public.eh_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE(
        auth.uid() IS NOT NULL AND (
            auth.jwt() ->> 'email' = 'admin@barzzo.com.br'
            OR auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
            OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'claims_admin')::boolean, false)
        ),
        false
    );
$$;

-- ============================================================================
-- 2. RPCs sem verificação de autorização
-- ============================================================================

-- Mudança de status: equipe da barbearia (qualquer membro ativo), o próprio cliente
-- (somente para cancelar uma reserva futura) ou o backend.
CREATE OR REPLACE FUNCTION public.atualizar_status_agendamento(p_agendamento_id uuid, p_novo_status text)
RETURNS agendamentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_agendamento public.agendamentos;
    v_status_atual TEXT;
BEGIN
    SELECT * INTO v_agendamento
    FROM public.agendamentos
    WHERE id = p_agendamento_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agendamento % não encontrado.', p_agendamento_id;
    END IF;

    IF NOT public.eh_service_role() THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Usuário não autenticado.';
        END IF;
        IF NOT public.usuario_eh_membro_equipe(v_agendamento.barbearia_id, auth.uid())
           AND NOT (
               v_agendamento.cliente_id = auth.uid()
               AND p_novo_status = 'cancelado'
               AND v_agendamento.inicio_previsto > now()
           ) THEN
            RAISE EXCEPTION 'Usuário não autorizado a alterar este agendamento.';
        END IF;
    END IF;

    v_status_atual := v_agendamento.status;

    -- Validar máquina de estados finita
    IF v_status_atual = 'concluido' OR v_status_atual = 'cancelado' OR v_status_atual = 'nao_compareceu' THEN
        RAISE EXCEPTION 'Não é permitido alterar o status de um agendamento finalizado (%).', v_status_atual;
    END IF;

    IF v_status_atual = 'pendente' AND p_novo_status NOT IN ('confirmado', 'cancelado') THEN
        RAISE EXCEPTION 'Transição inválida de pendente para %.', p_novo_status;
    END IF;

    IF v_status_atual = 'confirmado' AND p_novo_status NOT IN ('em_atendimento', 'cancelado', 'nao_compareceu', 'confirmado') THEN
        RAISE EXCEPTION 'Transição inválida de confirmado para %.', p_novo_status;
    END IF;

    IF v_status_atual = 'em_atendimento' AND p_novo_status NOT IN ('concluido', 'cancelado') THEN
        RAISE EXCEPTION 'Transição inválida de em_atendimento para %.', p_novo_status;
    END IF;

    -- Aplicar marcas de tempo reais
    IF p_novo_status = 'em_atendimento' AND v_agendamento.inicio_real IS NULL THEN
        UPDATE public.agendamentos
        SET status = p_novo_status,
            inicio_real = timezone('utc'::text, now()),
            atualizado_em = timezone('utc'::text, now())
        WHERE id = p_agendamento_id
        RETURNING * INTO v_agendamento;
    ELSIF p_novo_status = 'concluido' THEN
        UPDATE public.agendamentos
        SET status = p_novo_status,
            fim_real = timezone('utc'::text, now()),
            atualizado_em = timezone('utc'::text, now())
        WHERE id = p_agendamento_id
        RETURNING * INTO v_agendamento;
    ELSE
        UPDATE public.agendamentos
        SET status = p_novo_status,
            atualizado_em = timezone('utc'::text, now())
        WHERE id = p_agendamento_id
        RETURNING * INTO v_agendamento;
    END IF;

    RETURN v_agendamento;
END;
$function$;

-- Reagendamento: somente a equipe da barbearia; o novo profissional precisa ser dela.
CREATE OR REPLACE FUNCTION public.reagendar_agendamento(
    p_agendamento_id uuid,
    p_novo_inicio timestamp with time zone,
    p_novo_fim timestamp with time zone,
    p_novo_profissional_id uuid DEFAULT NULL::uuid
)
RETURNS agendamentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_agendamento public.agendamentos;
    v_prof_id UUID;
BEGIN
    SELECT * INTO v_agendamento
    FROM public.agendamentos
    WHERE id = p_agendamento_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agendamento não encontrado.';
    END IF;

    IF NOT public.eh_service_role() THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Usuário não autenticado.';
        END IF;
        IF NOT public.usuario_eh_membro_equipe(v_agendamento.barbearia_id, auth.uid()) THEN
            RAISE EXCEPTION 'Usuário não autorizado a reagendar este atendimento.';
        END IF;
    END IF;

    IF v_agendamento.status IN ('concluido', 'cancelado', 'nao_compareceu') THEN
        RAISE EXCEPTION 'Não é possível reagendar um atendimento com status %.', v_agendamento.status;
    END IF;

    IF p_novo_inicio >= p_novo_fim THEN
        RAISE EXCEPTION 'Horário de início deve ser anterior ao término.';
    END IF;

    v_prof_id := COALESCE(p_novo_profissional_id, v_agendamento.profissional_id);

    IF NOT EXISTS (
        SELECT 1 FROM public.profissionais p
        WHERE p.id = v_prof_id
          AND p.barbearia_id = v_agendamento.barbearia_id
          AND p.ativo = true
    ) THEN
        RAISE EXCEPTION 'Profissional inválido para esta barbearia.';
    END IF;

    -- Atualiza os horários (a restrição de exclusão GiST garantirá atomicamente a não-sobreposição)
    UPDATE public.agendamentos
    SET profissional_id = v_prof_id,
        inicio_previsto = p_novo_inicio,
        fim_previsto = p_novo_fim,
        status = 'confirmado',
        atualizado_em = timezone('utc'::text, now())
    WHERE id = p_agendamento_id
    RETURNING * INTO v_agendamento;

    RETURN v_agendamento;
EXCEPTION
    WHEN exclusion_violation THEN
        RAISE EXCEPTION 'O profissional selecionado já possui um agendamento conflitante neste horário.';
END;
$function$;

-- Extensão de trial: somente o Admin do Barzzo.
CREATE OR REPLACE FUNCTION public.conceder_extensao_trial(p_barbearia_id uuid, p_dias integer, p_motivo text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_trial_fim_atual TIMESTAMPTZ;
    v_novo_trial_fim TIMESTAMPTZ;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    IF NOT COALESCE(public.eh_admin(), false) THEN
        RAISE EXCEPTION 'Somente o Admin do Barzzo pode conceder extensão de trial.';
    END IF;

    IF p_dias <= 0 OR p_dias > 365 THEN
        RAISE EXCEPTION 'Quantidade de dias deve estar entre 1 e 365.';
    END IF;

    SELECT trial_fim INTO v_trial_fim_atual
    FROM public.barbearias
    WHERE id = p_barbearia_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Barbearia não encontrada.';
    END IF;

    -- Se o trial já expirou, estender a partir de agora; se ainda está ativo, somar ao fim atual
    IF v_trial_fim_atual > timezone('utc'::text, now()) THEN
        v_novo_trial_fim := v_trial_fim_atual + (p_dias || ' days')::INTERVAL;
    ELSE
        v_novo_trial_fim := timezone('utc'::text, now()) + (p_dias || ' days')::INTERVAL;
    END IF;

    UPDATE public.barbearias
    SET trial_fim = v_novo_trial_fim,
        status_assinatura = 'trial',
        atualizado_em = timezone('utc'::text, now())
    WHERE id = p_barbearia_id;

    INSERT INTO public.beneficios_assinatura (
        barbearia_id, tipo, dias_concedidos, motivo, concedido_por
    )
    VALUES (
        p_barbearia_id, 'extensao_trial', p_dias, p_motivo, auth.uid()
    );

    INSERT INTO public.logs_auditoria (
        usuario_id, barbearia_id, acao, entidade, entidade_id, dados_anteriores, dados_novos
    )
    VALUES (
        auth.uid(),
        p_barbearia_id,
        'conceder_extensao_trial',
        'barbearias',
        p_barbearia_id,
        jsonb_build_object('trial_fim_anterior', v_trial_fim_atual),
        jsonb_build_object('novo_trial_fim', v_novo_trial_fim, 'dias', p_dias, 'motivo', p_motivo)
    );

    RETURN true;
END;
$function$;

-- Métricas globais do negócio: somente Admin.
CREATE OR REPLACE FUNCTION public.obter_metricas_admin_global()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_total_barbearias INTEGER := 0;
    v_barbearias_ativas INTEGER := 0;
    v_barbearias_trial INTEGER := 0;
    v_total_assinantes INTEGER := 0;
    v_mrr_estimado NUMERIC(10,2) := 0.00;
    v_total_agendamentos INTEGER := 0;
    v_total_usuarios INTEGER := 0;
BEGIN
    IF NOT COALESCE(public.eh_admin(), false) THEN
        RAISE EXCEPTION 'Acesso restrito ao Admin do Barzzo.';
    END IF;

    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status_assinatura = 'ativa'),
        COUNT(*) FILTER (WHERE status_assinatura = 'trial')
    INTO
        v_total_barbearias,
        v_barbearias_ativas,
        v_barbearias_trial
    FROM public.barbearias;

    SELECT
        COUNT(*),
        COALESCE(
            SUM(
                CASE
                    WHEN ciclo = 'semestral' THEN ROUND(valor / 6.0, 2)
                    ELSE valor
                END
            ),
            0.00
        )
    INTO
        v_total_assinantes,
        v_mrr_estimado
    FROM public.assinaturas
    WHERE status = 'ativa';

    SELECT COUNT(*) INTO v_total_agendamentos FROM public.agendamentos;
    SELECT COUNT(*) INTO v_total_usuarios FROM public.usuarios;

    RETURN jsonb_build_object(
        'total_barbearias', v_total_barbearias,
        'barbearias_ativas', v_barbearias_ativas,
        'barbearias_trial', v_barbearias_trial,
        'total_assinantes', v_total_assinantes,
        'mrr_estimado', v_mrr_estimado,
        'total_agendamentos', v_total_agendamentos,
        'total_usuarios', v_total_usuarios
    );
END;
$function$;

-- Métricas de um cliente: equipe da barbearia, e o cliente precisa ser dela.
CREATE OR REPLACE FUNCTION public.obter_metricas_cliente_crm(p_barbearia_id uuid, p_cliente_id uuid, p_usuario_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(total_agendamentos bigint, concluidos bigint, cancelados bigint, no_shows bigint, total_gasto_centavos numeric, ultimo_atendimento timestamp with time zone, profissional_mais_frequente_nome text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
    IF NOT public.usuario_eh_membro(p_barbearia_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado aos dados deste cliente.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.clientes_barbearia c
        WHERE c.id = p_cliente_id AND c.barbearia_id = p_barbearia_id
    ) THEN
        RAISE EXCEPTION 'Cliente não encontrado nesta barbearia.';
    END IF;

    RETURN QUERY
    WITH ags AS (
        SELECT
            a.id,
            a.status,
            a.inicio_previsto,
            a.preco_total,
            a.profissional_id,
            p.nome AS prof_nome
        FROM public.agendamentos a
        LEFT JOIN public.profissionais p ON p.id = a.profissional_id
        WHERE a.barbearia_id = p_barbearia_id
          AND (
              (p_usuario_id IS NOT NULL AND a.cliente_id = p_usuario_id)
              OR (
                  a.cliente_telefone IS NOT NULL
                  AND a.cliente_telefone = (
                      SELECT c.telefone FROM public.clientes_barbearia c WHERE c.id = p_cliente_id
                  )
              )
          )
    ),
    prof_freq AS (
        SELECT prof_nome, COUNT(*) as qtd
        FROM ags
        WHERE prof_nome IS NOT NULL AND status = 'concluido'
        GROUP BY prof_nome
        ORDER BY qtd DESC
        LIMIT 1
    )
    SELECT
        COUNT(*)::BIGINT AS total_agendamentos,
        COUNT(*) FILTER (WHERE status = 'concluido')::BIGINT AS concluidos,
        COUNT(*) FILTER (WHERE status = 'cancelado')::BIGINT AS cancelados,
        COUNT(*) FILTER (WHERE status = 'nao_compareceu')::BIGINT AS no_shows,
        COALESCE(SUM(preco_total) FILTER (WHERE status = 'concluido'), 0) * 100 AS total_gasto_centavos,
        MAX(inicio_previsto) FILTER (WHERE status = 'concluido') AS ultimo_atendimento,
        (SELECT prof_nome FROM prof_freq) AS profissional_mais_frequente_nome
    FROM ags;
END;
$function$;

-- Ativação de assinatura: apenas o backend (webhook do Mercado Pago, chave de serviço).
-- Sem isso, qualquer pessoa ativaria um plano pago sem pagar.
CREATE OR REPLACE FUNCTION public.processar_confirmacao_pagamento_assinatura(
    p_barbearia_id uuid,
    p_plano_id uuid,
    p_ciclo text,
    p_valor numeric,
    p_mp_payment_id text DEFAULT NULL::text,
    p_mp_subscription_id text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_assinatura_id UUID;
    v_meses_adicionar INTEGER;
    v_data_inicio TIMESTAMPTZ := timezone('utc'::text, now());
    v_data_fim TIMESTAMPTZ;
BEGIN
    IF NOT public.eh_service_role() THEN
        RAISE EXCEPTION 'Operação restrita ao processamento de pagamentos.';
    END IF;

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

    IF p_ciclo = 'semestral' THEN
        v_meses_adicionar := 6;
    ELSE
        v_meses_adicionar := 1;
    END IF;

    v_data_fim := v_data_inicio + (v_meses_adicionar || ' months')::INTERVAL;

    INSERT INTO public.assinaturas (
        barbearia_id, plano_id, ciclo, status, data_inicio, data_fim,
        mercado_pago_payment_id, mercado_pago_subscription_id, valor
    )
    VALUES (
        p_barbearia_id, p_plano_id, p_ciclo, 'ativa', v_data_inicio, v_data_fim,
        p_mp_payment_id, p_mp_subscription_id, p_valor
    )
    RETURNING id INTO v_assinatura_id;

    UPDATE public.barbearias
    SET status_assinatura = 'ativo',
        atualizado_em = timezone('utc'::text, now())
    WHERE id = p_barbearia_id;

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
$function$;

-- ============================================================================
-- 3. Leituras públicas por código (sem listar tudo)
-- ============================================================================

-- Convite: só quem tem o token vê os dados mínimos para decidir se aceita.
CREATE OR REPLACE FUNCTION public.obter_convite_por_token(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT jsonb_build_object(
        'id', c.id,
        'papel', c.papel,
        'email', c.email,
        'status', c.status,
        'expira_em', c.expira_em,
        'profissional', jsonb_build_object('nome', p.nome),
        'barbearia', jsonb_build_object('nome', b.nome, 'slug', b.slug, 'logo_url', b.logo_url)
    )
    FROM public.convites_profissionais c
    JOIN public.profissionais p ON p.id = c.profissional_id
    JOIN public.barbearias b ON b.id = c.barbearia_id
    WHERE c.token = p_token
    LIMIT 1;
$$;

-- Cupom: devolve só o cupom ativo do código informado, com as regras.
CREATE OR REPLACE FUNCTION public.obter_cupom_por_codigo(p_barbearia_id uuid, p_codigo text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT to_jsonb(c) || jsonb_build_object(
        'regras',
        COALESCE(
            (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.prioridade ASC)
             FROM public.cupons_regras r
             WHERE r.cupom_id = c.id AND r.ativo = true),
            '[]'::jsonb
        )
    )
    FROM public.cupons c
    WHERE c.barbearia_id = p_barbearia_id
      AND UPPER(c.codigo) = UPPER(TRIM(p_codigo))
      AND c.ativo = true
    LIMIT 1;
$$;

DROP POLICY IF EXISTS "Leitura de convite por token" ON public.convites_profissionais;
DROP POLICY IF EXISTS "Clientes inserem indicacao ao agendar" ON public.indicacoes;

-- Upload anônimo temporário no bucket de capas.
DROP POLICY IF EXISTS "TEMP upload capas barbearias" ON storage.objects;

-- ============================================================================
-- 4. Policies que dependem de login deixam de valer para o papel público
-- ============================================================================

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname IN ('public', 'storage')
          AND roles = '{public}'
          AND policyname <> 'Qualquer pessoa pode visualizar produtos ativos'
          AND (
              COALESCE(qual, '') || ' ' || COALESCE(with_check, '')
          ) ~ '(auth\.uid\(\)|auth\.role\(\)|usuario_eh_|eh_admin\()'
    LOOP
        EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- Funções novas não ficam executáveis por anon/PUBLIC por padrão.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ============================================================================
-- 6. Funções: ninguém executa por padrão; liberar só o necessário
-- ============================================================================

-- Remove EXECUTE de PUBLIC e anon em todas as funções do schema e devolve, de forma
-- explícita, o que authenticated e service_role já tinham (sem reabrir o que a Task 11
-- havia fechado).
DO $$
DECLARE
    f RECORD;
    v_auth BOOLEAN;
    v_svc BOOLEAN;
BEGIN
    FOR f IN
        SELECT p.oid, p.oid::regprocedure AS assinatura
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
        WHERE n.nspname = 'public' AND p.prokind = 'f' AND d.objid IS NULL
    LOOP
        v_auth := has_function_privilege('authenticated', f.oid, 'EXECUTE');
        v_svc := has_function_privilege('service_role', f.oid, 'EXECUTE');
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.assinatura);
        IF v_auth THEN
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.assinatura);
        END IF;
        IF v_svc THEN
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.assinatura);
        END IF;
    END LOOP;
END $$;

-- Públicas (visitante sem login): busca de barbearias, horários livres, convite e cupom por código.
DO $$
DECLARE
    f RECORD;
BEGIN
    FOR f IN
        SELECT p.oid::regprocedure AS assinatura
        FROM pg_proc p
        WHERE p.pronamespace = 'public'::regnamespace
          AND p.proname IN (
              'buscar_barbearias_com_distancia',
              'buscar_horarios_disponiveis',
              'obter_convite_por_token',
              'obter_cupom_por_codigo'
          )
    LOOP
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f.assinatura);
    END LOOP;
END $$;

-- Somente backend (chave de serviço) ou gatilhos: nenhum usuário logado chama diretamente.
DO $$
DECLARE
    f RECORD;
BEGIN
    FOR f IN
        SELECT p.oid::regprocedure AS assinatura
        FROM pg_proc p
        WHERE p.pronamespace = 'public'::regnamespace
          AND p.proname IN (
              'processar_confirmacao_pagamento_assinatura',
              'sincronizar_cliente_agendamento',
              'funcao_ao_criar_usuario_auth',
              'lidar_com_novo_usuario',
              'funcao_atualizar_timestamp',
              'rls_auto_enable',
              'calcular_distancia_km',
              'buscar_barbearias_marketplace'
          )
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f.assinatura);
    END LOOP;
END $$;

-- ============================================================================
-- 7. search_path fixo nas funções SECURITY DEFINER que ainda não tinham
-- ============================================================================

DO $$
DECLARE
    f RECORD;
BEGIN
    FOR f IN
        SELECT p.oid::regprocedure AS assinatura
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
        WHERE n.nspname = 'public' AND p.prokind = 'f' AND d.objid IS NULL
          AND (p.prosecdef OR p.proname IN ('calcular_distancia_km', 'proteger_snapshot_comercial_agendamento'))
          AND NOT EXISTS (
              SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%'
          )
    LOOP
        EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', f.assinatura);
    END LOOP;
END $$;
