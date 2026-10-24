-- Influenciadores do Barzzo (globais), aceitos pelas barbearias.
--   * O influenciador se cadastra sozinho e cria o próprio cupom, com 5% de comissão, pendente de aprovação do Admin.
--   * O cliente recebe 15% no primeiro atendimento (histórico global do Barzzo) e 5% nos demais.
--   * O Admin aprova e altera comissão, descontos e situação.
--   * A barbearia liga "aceitar influenciadores do Barzzo"; o cupom só vale nas que aceitaram e a barbearia paga a comissão.

-- ============================================================================
-- 1. Estrutura
-- ============================================================================

ALTER TABLE public.barbearias
    ADD COLUMN IF NOT EXISTS aceita_influenciadores_barzzo BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.barbearias.aceita_influenciadores_barzzo IS
    'Quando verdadeiro, os cupons aprovados de influenciadores do Barzzo valem nesta barbearia e ela paga a comissão.';

-- Influenciador global: sem barbearia, com conta própria.
ALTER TABLE public.influenciadores ALTER COLUMN barbearia_id DROP NOT NULL;
ALTER TABLE public.influenciadores
    DROP CONSTRAINT IF EXISTS influenciadores_barbearia_ou_usuario_check,
    ADD CONSTRAINT influenciadores_barbearia_ou_usuario_check
        CHECK (barbearia_id IS NOT NULL OR usuario_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_influenciadores_global_por_usuario
    ON public.influenciadores (usuario_id) WHERE barbearia_id IS NULL;

-- Cupom global: sem barbearia, com aprovação do Admin.
ALTER TABLE public.cupons ALTER COLUMN barbearia_id DROP NOT NULL;
ALTER TABLE public.cupons
    ADD COLUMN IF NOT EXISTS status_aprovacao TEXT NOT NULL DEFAULT 'aprovado';
ALTER TABLE public.cupons
    DROP CONSTRAINT IF EXISTS cupons_status_aprovacao_check,
    ADD CONSTRAINT cupons_status_aprovacao_check CHECK (status_aprovacao IN ('pendente', 'aprovado', 'rejeitado')),
    DROP CONSTRAINT IF EXISTS cupons_global_sem_barbearia_check,
    ADD CONSTRAINT cupons_global_sem_barbearia_check CHECK ((origem = 'BARZZO_GLOBAL') = (barbearia_id IS NULL));
CREATE UNIQUE INDEX IF NOT EXISTS idx_cupons_global_codigo_unico
    ON public.cupons (UPPER(codigo)) WHERE barbearia_id IS NULL;

-- A barbearia vê (e paga) os influenciadores globais que geraram comissão nela.
-- Função SECURITY DEFINER para não entrar em recursão com a policy de comissões.
CREATE OR REPLACE FUNCTION public.usuario_paga_comissao_do_influenciador(p_influenciador_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.comissoes_influenciadores c
        WHERE c.influenciador_id = p_influenciador_id
          AND public.usuario_eh_membro_equipe(c.barbearia_id, auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.usuario_paga_comissao_do_influenciador(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usuario_paga_comissao_do_influenciador(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Barbearias veem influenciadores globais com comissao" ON public.influenciadores;
CREATE POLICY "Barbearias veem influenciadores globais com comissao"
    ON public.influenciadores FOR SELECT TO authenticated
    USING (barbearia_id IS NULL AND public.usuario_paga_comissao_do_influenciador(id));

-- ============================================================================
-- 2. Validação do cupom pelo código (usada pelo Cliente)
-- ============================================================================

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
    WHERE UPPER(c.codigo) = UPPER(TRIM(p_codigo))
      AND c.ativo = true
      AND (
          c.barbearia_id = p_barbearia_id
          OR (
              c.origem = 'BARZZO_GLOBAL'
              AND c.status_aprovacao = 'aprovado'
              AND EXISTS (
                  SELECT 1 FROM public.barbearias b
                  WHERE b.id = p_barbearia_id AND b.aceita_influenciadores_barzzo = true
              )
          )
      )
    ORDER BY (c.barbearia_id = p_barbearia_id) DESC NULLS LAST
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.obter_cupom_por_codigo(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_cupom_por_codigo(uuid, text) TO anon, authenticated, service_role;

-- ============================================================================
-- 3. Confirmação atômica do uso do cupom (agora aceita o cupom global)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.registrar_uso_cupom(p_barbearia_id uuid, p_cupom_id uuid, p_agendamento_id uuid, p_cliente_id uuid, p_codigo text, p_influenciador_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_agendamento public.agendamentos%ROWTYPE;
    v_cupom public.cupons%ROWTYPE;
    v_regra public.cupons_regras%ROWTYPE;
    v_influenciador public.influenciadores%ROWTYPE;
    v_total_anterior_barbearia INTEGER;
    v_total_anterior_global INTEGER;
    v_total_usos INTEGER;
    v_usos_cliente INTEGER;
    v_limite_cliente_por_faixa BOOLEAN;
    v_bruto NUMERIC(10,2);
    v_elegivel NUMERIC(10,2);
    v_desconto NUMERIC(10,2);
    v_liquido NUMERIC(10,2);
    v_comissao NUMERIC(10,2);
    v_codigo TEXT := UPPER(TRIM(p_codigo));
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_cliente_id THEN
        IF NOT public.usuario_eh_membro_equipe(p_barbearia_id, auth.uid()) THEN
            RAISE EXCEPTION 'Usuário não autorizado a confirmar este cupom.';
        END IF;
    END IF;

    SELECT * INTO v_agendamento
    FROM public.agendamentos
    WHERE id = p_agendamento_id
      AND barbearia_id = p_barbearia_id
      AND cliente_id = p_cliente_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agendamento não encontrado para confirmar o cupom.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.cupons_utilizacoes u
        WHERE u.agendamento_id = p_agendamento_id
          AND u.status IN ('reservado', 'consumido')
    ) OR v_agendamento.cupom_id IS NOT NULL THEN
        RETURN;
    END IF;

    -- O cupom da própria barbearia tem prioridade; depois vale o cupom de influenciador do Barzzo.
    IF p_cupom_id IS NOT NULL THEN
        SELECT * INTO v_cupom FROM public.cupons
        WHERE id = p_cupom_id
          AND (barbearia_id = p_barbearia_id OR (origem = 'BARZZO_GLOBAL' AND barbearia_id IS NULL))
        FOR UPDATE;
    ELSE
        SELECT * INTO v_cupom FROM public.cupons
        WHERE barbearia_id = p_barbearia_id AND UPPER(codigo) = v_codigo FOR UPDATE;
        IF NOT FOUND THEN
            SELECT * INTO v_cupom FROM public.cupons
            WHERE origem = 'BARZZO_GLOBAL' AND barbearia_id IS NULL AND UPPER(codigo) = v_codigo FOR UPDATE;
        END IF;
    END IF;

    IF NOT FOUND OR v_cupom.ativo = false THEN
        RAISE EXCEPTION 'Cupom não encontrado ou inativo.';
    END IF;
    IF UPPER(v_cupom.codigo) <> v_codigo THEN
        RAISE EXCEPTION 'O código informado não corresponde ao cupom selecionado.';
    END IF;
    IF timezone('utc'::text, now()) < v_cupom.data_inicio
       OR (v_cupom.data_fim IS NOT NULL AND timezone('utc'::text, now()) > v_cupom.data_fim) THEN
        RAISE EXCEPTION 'Este cupom está fora do período de validade.';
    END IF;

    IF v_cupom.origem = 'BARZZO_GLOBAL' THEN
        IF v_cupom.status_aprovacao <> 'aprovado' THEN
            RAISE EXCEPTION 'Este cupom ainda não foi aprovado.';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.barbearias b
            WHERE b.id = p_barbearia_id AND b.aceita_influenciadores_barzzo = true
        ) THEN
            RAISE EXCEPTION 'Esta barbearia não aceita cupons de influenciadores do Barzzo.';
        END IF;
    END IF;

    SELECT COALESCE(SUM(s.preco), 0)::NUMERIC(10,2) INTO v_bruto
    FROM public.agendamentos_servicos s WHERE s.agendamento_id = p_agendamento_id;
    SELECT COUNT(*) INTO v_total_anterior_barbearia
    FROM public.agendamentos a
    WHERE a.cliente_id = p_cliente_id AND a.barbearia_id = p_barbearia_id AND a.status = 'concluido';
    SELECT COUNT(*) INTO v_total_anterior_global
    FROM public.agendamentos a
    WHERE a.cliente_id = p_cliente_id AND a.status = 'concluido';

    SELECT * INTO v_regra
    FROM public.cupons_regras r
    WHERE r.cupom_id = v_cupom.id AND r.ativo = true
      AND (r.atendimentos_minimos IS NULL OR
           (CASE WHEN r.escopo_historico = 'GLOBAL_BARZZO' THEN v_total_anterior_global ELSE v_total_anterior_barbearia END) >= r.atendimentos_minimos)
      AND (r.atendimentos_maximos IS NULL OR
           (CASE WHEN r.escopo_historico = 'GLOBAL_BARZZO' THEN v_total_anterior_global ELSE v_total_anterior_barbearia END) <= r.atendimentos_maximos)
      AND v_bruto >= r.valor_minimo_reserva
    ORDER BY r.prioridade ASC, r.id ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Nenhuma regra deste cupom é válida para o histórico e os serviços selecionados.';
    END IF;

    SELECT COALESCE(SUM(s.preco) FILTER (
        WHERE COALESCE(cardinality(v_regra.servicos_elegiveis), 0) = 0
           OR s.servico_id = ANY(v_regra.servicos_elegiveis)
    ), 0)::NUMERIC(10,2) INTO v_elegivel
    FROM public.agendamentos_servicos s WHERE s.agendamento_id = p_agendamento_id;

    SELECT COUNT(*) INTO v_total_usos FROM public.cupons_utilizacoes u
    WHERE u.cupom_id = v_cupom.id AND u.status IN ('reservado', 'consumido');
    IF v_regra.limite_usos_total IS NOT NULL AND v_total_usos >= v_regra.limite_usos_total THEN
        RAISE EXCEPTION 'O limite total deste cupom foi atingido.';
    END IF;

    v_limite_cliente_por_faixa :=
        v_cupom.origem IN ('BARBEARIA', 'INFLUENCIADOR')
        AND v_regra.escopo_historico = 'BARBEARIA'
        AND (
            (v_regra.atendimentos_minimos = 0 AND v_regra.atendimentos_maximos = 0)
            OR (v_regra.atendimentos_minimos = 1 AND v_regra.atendimentos_maximos IS NULL)
        );

    SELECT COUNT(*) INTO v_usos_cliente
    FROM public.cupons_utilizacoes u
    WHERE u.cupom_id = v_cupom.id
      AND u.cliente_id = p_cliente_id
      AND u.status IN ('reservado', 'consumido')
      AND (
          NOT v_limite_cliente_por_faixa
          OR (
              COALESCE(u.regra_aplicada ->> 'escopo_historico', 'BARBEARIA') = v_regra.escopo_historico
              AND (
                  (
                      (u.regra_aplicada ->> 'atendimentos_minimos') IS NOT DISTINCT FROM v_regra.atendimentos_minimos::TEXT
                      AND (u.regra_aplicada ->> 'atendimentos_maximos') IS NOT DISTINCT FROM v_regra.atendimentos_maximos::TEXT
                  )
                  OR (
                      u.regra_aplicada ->> 'atendimentos_minimos' IS NULL
                      AND u.regra_aplicada ->> 'atendimentos_maximos' IS NULL
                  )
              )
          )
      );
    IF v_regra.limite_usos_por_cliente IS NOT NULL AND v_usos_cliente >= v_regra.limite_usos_por_cliente THEN
        RAISE EXCEPTION 'Você já atingiu o limite de uso deste cupom.';
    END IF;

    IF v_regra.tipo_desconto = 'percentual' THEN
        v_desconto := ROUND((v_elegivel * v_regra.valor_desconto) / 100, 2);
    ELSE
        v_desconto := v_regra.valor_desconto;
    END IF;
    v_desconto := LEAST(v_elegivel, GREATEST(0, v_desconto));
    v_liquido := GREATEST(0, v_bruto - v_desconto);

    IF v_cupom.influenciador_id IS NOT NULL THEN
        SELECT * INTO v_influenciador FROM public.influenciadores i
        WHERE i.id = v_cupom.influenciador_id
          AND ((v_cupom.origem = 'BARZZO_GLOBAL' AND i.barbearia_id IS NULL) OR i.barbearia_id = p_barbearia_id)
          AND i.ativo = true;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Este cupom não está disponível para novas atribuições.';
        END IF;
        IF v_influenciador.tipo_comissao = 'percentual' THEN
            v_comissao := ROUND((v_liquido * v_influenciador.valor_comissao) / 100, 2);
        ELSE
            v_comissao := v_influenciador.valor_comissao;
        END IF;
    END IF;

    PERFORM set_config('barzzo.comercial_rpc', 'true', true);
    UPDATE public.agendamentos SET
        preco_total = v_liquido,
        cupom_id = v_cupom.id,
        codigo_cupom_snapshot = v_cupom.codigo,
        origem_cupom_snapshot = v_cupom.origem,
        influenciador_id_snapshot = v_cupom.influenciador_id,
        influenciador_nome_snapshot = v_influenciador.nome,
        valor_bruto_servicos_snapshot = v_bruto,
        subtotal_elegivel_snapshot = v_elegivel,
        desconto_snapshot = v_desconto,
        valor_liquido_snapshot = v_liquido,
        cupom_regra_id = v_regra.id,
        cupom_regra_snapshot = to_jsonb(v_regra),
        tipo_comissao_snapshot = v_influenciador.tipo_comissao,
        taxa_comissao_snapshot = v_influenciador.valor_comissao,
        valor_comissao_snapshot = v_comissao
    WHERE id = p_agendamento_id;

    INSERT INTO public.cupons_utilizacoes (
        cupom_id, regra_id, cliente_id, agendamento_id, status,
        valor_bruto, subtotal_elegivel, valor_desconto, regra_aplicada, consumido_em
    ) VALUES (
        v_cupom.id, v_regra.id, p_cliente_id, p_agendamento_id, 'consumido',
        v_bruto, v_elegivel, v_desconto, to_jsonb(v_regra), timezone('utc'::text, now())
    );

    INSERT INTO public.indicacoes (
        barbearia_id, influenciador_id, cupom_id, agendamento_id, cliente_id,
        codigo_ref_usado, status
    ) VALUES (
        p_barbearia_id, v_cupom.influenciador_id, v_cupom.id, p_agendamento_id,
        p_cliente_id, v_cupom.codigo, 'pendente'
    ) ON CONFLICT (agendamento_id) WHERE agendamento_id IS NOT NULL DO NOTHING;

    UPDATE public.cupons SET usos_atuais = (
        SELECT COUNT(*) FROM public.cupons_utilizacoes u
        WHERE u.cupom_id = public.cupons.id AND u.status IN ('reservado', 'consumido')
    ), updated_at = timezone('utc'::text, now()) WHERE id = v_cupom.id;
END;
$function$
;

-- ============================================================================
-- 4. Influenciador: cadastro próprio e cupom
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cadastrar_influenciador_barzzo(
    p_nome text,
    p_telefone text,
    p_chave_pix text,
    p_codigo text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_codigo text := UPPER(regexp_replace(COALESCE(p_codigo, ''), '\s', '', 'g'));
    v_nome text := TRIM(COALESCE(p_nome, ''));
    v_influenciador_id uuid;
    v_cupom_id uuid;
    v_email text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;
    IF char_length(v_nome) < 2 THEN
        RAISE EXCEPTION 'Informe seu nome.';
    END IF;
    IF v_codigo !~ '^[A-Z0-9]{4,20}$' THEN
        RAISE EXCEPTION 'O cupom deve ter de 4 a 20 letras ou números, sem espaços ou símbolos.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.influenciadores WHERE usuario_id = auth.uid() AND barbearia_id IS NULL) THEN
        RAISE EXCEPTION 'Você já possui cadastro de influenciador do Barzzo.';
    END IF;

    SELECT email INTO v_email FROM public.usuarios WHERE id = auth.uid();

    INSERT INTO public.influenciadores (
        barbearia_id, usuario_id, nome, email, telefone, chave_pix, tipo_comissao, valor_comissao, ativo
    ) VALUES (
        NULL, auth.uid(), v_nome, v_email, NULLIF(TRIM(p_telefone), ''), NULLIF(TRIM(p_chave_pix), ''),
        'percentual', 5, true
    ) RETURNING id INTO v_influenciador_id;

    BEGIN
        INSERT INTO public.cupons (
            barbearia_id, codigo, descricao, tipo_desconto, valor_desconto, data_inicio, data_fim,
            ativo, origem, influenciador_id, status_aprovacao
        ) VALUES (
            NULL, v_codigo, 'Cupom de influenciador do Barzzo', 'percentual', 15, timezone('utc'::text, now()), NULL,
            true, 'BARZZO_GLOBAL', v_influenciador_id, 'pendente'
        ) RETURNING id INTO v_cupom_id;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Este cupom já está em uso. Escolha outro.';
    END;

    UPDATE public.influenciadores SET cupom_padrao_id = v_cupom_id WHERE id = v_influenciador_id;

    INSERT INTO public.cupons_regras (
        cupom_id, prioridade, escopo_historico, atendimentos_minimos, atendimentos_maximos,
        tipo_desconto, valor_desconto, limite_usos_por_cliente
    ) VALUES
        (v_cupom_id, 10, 'GLOBAL_BARZZO', 0, 0, 'percentual', 15, 1),
        (v_cupom_id, 20, 'GLOBAL_BARZZO', 1, NULL, 'percentual', 5, NULL);

    RETURN v_cupom_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.alterar_cupom_influenciador_barzzo(p_codigo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_codigo text := UPPER(regexp_replace(COALESCE(p_codigo, ''), '\s', '', 'g'));
    v_cupom public.cupons%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;
    IF v_codigo !~ '^[A-Z0-9]{4,20}$' THEN
        RAISE EXCEPTION 'O cupom deve ter de 4 a 20 letras ou números, sem espaços ou símbolos.';
    END IF;

    SELECT c.* INTO v_cupom
    FROM public.cupons c
    JOIN public.influenciadores i ON i.id = c.influenciador_id
    WHERE i.usuario_id = auth.uid() AND i.barbearia_id IS NULL AND c.origem = 'BARZZO_GLOBAL'
    FOR UPDATE OF c;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cadastro de influenciador do Barzzo não encontrado.';
    END IF;
    -- Depois de aprovado o cupom já foi divulgado: só o Admin altera.
    IF v_cupom.status_aprovacao = 'aprovado' THEN
        RAISE EXCEPTION 'O cupom já foi aprovado e não pode ser alterado. Fale com o Barzzo.';
    END IF;

    BEGIN
        UPDATE public.cupons
        SET codigo = v_codigo, status_aprovacao = 'pendente', updated_at = timezone('utc'::text, now())
        WHERE id = v_cupom.id;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Este cupom já está em uso. Escolha outro.';
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_dados_influenciador_barzzo(p_nome text, p_telefone text, p_chave_pix text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;
    IF char_length(TRIM(COALESCE(p_nome, ''))) < 2 THEN
        RAISE EXCEPTION 'Informe seu nome.';
    END IF;

    UPDATE public.influenciadores
    SET nome = TRIM(p_nome),
        telefone = NULLIF(TRIM(p_telefone), ''),
        chave_pix = NULLIF(TRIM(p_chave_pix), ''),
        updated_at = timezone('utc'::text, now())
    WHERE usuario_id = auth.uid() AND barbearia_id IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cadastro de influenciador do Barzzo não encontrado.';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.obter_meu_cupom_barzzo()
RETURNS TABLE (codigo text, status_aprovacao text, ativo boolean, desconto_primeiro numeric, desconto_demais numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        c.codigo,
        c.status_aprovacao,
        (c.ativo AND i.ativo),
        (SELECT r.valor_desconto FROM public.cupons_regras r
         WHERE r.cupom_id = c.id AND r.atendimentos_minimos = 0 AND r.atendimentos_maximos = 0 LIMIT 1),
        (SELECT r.valor_desconto FROM public.cupons_regras r
         WHERE r.cupom_id = c.id AND r.atendimentos_minimos = 1 AND r.atendimentos_maximos IS NULL LIMIT 1)
    FROM public.influenciadores i
    JOIN public.cupons c ON c.influenciador_id = i.id AND c.origem = 'BARZZO_GLOBAL'
    WHERE i.usuario_id = auth.uid() AND i.barbearia_id IS NULL
    ORDER BY c.created_at ASC
    LIMIT 1;
$$;

-- ============================================================================
-- 5. Admin: aprovação e ajuste de tudo
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_decidir_cupom_global(p_cupom_id uuid, p_aprovar boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT public.eh_admin() THEN
        RAISE EXCEPTION 'Acesso restrito ao administrador.';
    END IF;

    UPDATE public.cupons
    SET status_aprovacao = CASE WHEN p_aprovar THEN 'aprovado' ELSE 'rejeitado' END,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_cupom_id AND origem = 'BARZZO_GLOBAL';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cupom global não encontrado.';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_atualizar_influenciador_global(
    p_influenciador_id uuid,
    p_tipo_comissao text,
    p_valor_comissao numeric,
    p_desconto_primeiro numeric,
    p_desconto_demais numeric,
    p_ativo boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cupom_id uuid;
BEGIN
    IF NOT public.eh_admin() THEN
        RAISE EXCEPTION 'Acesso restrito ao administrador.';
    END IF;
    IF p_tipo_comissao NOT IN ('percentual', 'valor_fixo') THEN
        RAISE EXCEPTION 'Tipo de comissão inválido.';
    END IF;
    IF p_valor_comissao IS NULL OR p_valor_comissao < 0 OR (p_tipo_comissao = 'percentual' AND p_valor_comissao > 100) THEN
        RAISE EXCEPTION 'Valor de comissão inválido.';
    END IF;
    IF p_desconto_primeiro IS NULL OR p_desconto_primeiro <= 0 OR p_desconto_primeiro > 100
       OR p_desconto_demais IS NULL OR p_desconto_demais <= 0 OR p_desconto_demais > 100 THEN
        RAISE EXCEPTION 'Os descontos devem ficar entre 0,01%% e 100%%.';
    END IF;

    UPDATE public.influenciadores
    SET tipo_comissao = p_tipo_comissao, valor_comissao = p_valor_comissao, ativo = p_ativo,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_influenciador_id AND barbearia_id IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Influenciador do Barzzo não encontrado.';
    END IF;

    SELECT id INTO v_cupom_id FROM public.cupons
    WHERE influenciador_id = p_influenciador_id AND origem = 'BARZZO_GLOBAL'
    ORDER BY created_at ASC LIMIT 1;

    IF v_cupom_id IS NOT NULL THEN
        UPDATE public.cupons
        SET ativo = p_ativo, valor_desconto = p_desconto_primeiro, updated_at = timezone('utc'::text, now())
        WHERE id = v_cupom_id;

        UPDATE public.cupons_regras SET valor_desconto = p_desconto_primeiro, tipo_desconto = 'percentual',
            atualizado_em = timezone('utc'::text, now())
        WHERE cupom_id = v_cupom_id AND atendimentos_minimos = 0 AND atendimentos_maximos = 0;

        UPDATE public.cupons_regras SET valor_desconto = p_desconto_demais, tipo_desconto = 'percentual',
            atualizado_em = timezone('utc'::text, now())
        WHERE cupom_id = v_cupom_id AND atendimentos_minimos = 1 AND atendimentos_maximos IS NULL;
    END IF;
END;
$$;

-- ============================================================================
-- 6. Permissões
-- ============================================================================

REVOKE ALL ON FUNCTION public.cadastrar_influenciador_barzzo(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.alterar_cupom_influenciador_barzzo(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.atualizar_dados_influenciador_barzzo(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_decidir_cupom_global(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_atualizar_influenciador_global(uuid, text, numeric, numeric, numeric, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cadastrar_influenciador_barzzo(text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.alterar_cupom_influenciador_barzzo(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atualizar_dados_influenciador_barzzo(text, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.obter_meu_cupom_barzzo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_meu_cupom_barzzo() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_decidir_cupom_global(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_atualizar_influenciador_global(uuid, text, numeric, numeric, numeric, boolean) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.registrar_uso_cupom(UUID, UUID, UUID, UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_uso_cupom(UUID, UUID, UUID, UUID, TEXT, UUID) TO authenticated, service_role;
