-- Data de término do cupom passa a ser opcional: sem data, o cupom vale até alguém desativá-lo.

ALTER TABLE public.cupons ALTER COLUMN data_fim DROP NOT NULL;

-- A validação de vigência na confirmação da reserva só compara com a data de término quando ela existe.
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

    IF p_cupom_id IS NOT NULL THEN
        SELECT * INTO v_cupom FROM public.cupons
        WHERE id = p_cupom_id AND barbearia_id = p_barbearia_id FOR UPDATE;
    ELSE
        SELECT * INTO v_cupom FROM public.cupons
        WHERE barbearia_id = p_barbearia_id AND UPPER(codigo) = v_codigo FOR UPDATE;
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
        WHERE i.id = v_cupom.influenciador_id AND i.barbearia_id = p_barbearia_id AND i.ativo = true;
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
