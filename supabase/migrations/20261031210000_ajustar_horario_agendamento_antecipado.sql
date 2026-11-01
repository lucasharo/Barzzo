-- Reagendar horário do agendamento quando o atendimento é realizado antes do previsto.
-- Quando o status avança para 'em_atendimento' e o momento atual (now()) for anterior
-- ao 'inicio_previsto', atualiza 'inicio_previsto' para a hora real de início e 'fim_previsto'
-- proporcional à duração, liberando o horário agendado originalmente no calendário.
-- De forma correspondente, ao concluir ('concluido'), se o atendimento foi antecipado ou se encerrou
-- mais cedo que o previsto, ajusta 'fim_previsto' para liberar os horários futuros.

CREATE OR REPLACE FUNCTION public.atualizar_status_agendamento(p_agendamento_id uuid, p_novo_status text)
RETURNS agendamentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_agendamento public.agendamentos;
    v_status_atual TEXT;
    v_agora TIMESTAMPTZ := timezone('utc'::text, now());
    v_duracao_minutos INTEGER;
    v_novo_inicio TIMESTAMPTZ;
    v_novo_fim TIMESTAMPTZ;
    v_inicio_real TIMESTAMPTZ;
    v_fim_real TIMESTAMPTZ;
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

    IF v_status_atual = 'confirmado' AND p_novo_status NOT IN ('em_atendimento', 'concluido', 'cancelado', 'nao_compareceu', 'confirmado') THEN
        RAISE EXCEPTION 'Transição inválida de confirmado para %.', p_novo_status;
    END IF;

    IF v_status_atual = 'em_atendimento' AND p_novo_status NOT IN ('concluido', 'cancelado') THEN
        RAISE EXCEPTION 'Transição inválida de em_atendimento para %.', p_novo_status;
    END IF;

    -- Calcular duração total em minutos
    v_duracao_minutos := COALESCE(
        NULLIF(v_agendamento.duracao_total_minutos, 0),
        ROUND(EXTRACT(EPOCH FROM (v_agendamento.fim_previsto - v_agendamento.inicio_previsto)) / 60)::integer,
        30
    );
    IF v_duracao_minutos <= 0 THEN
        v_duracao_minutos := 30;
    END IF;

    -- Aplicar marcas de tempo reais e ajustar horários quando realizado com antecedência
    IF p_novo_status = 'em_atendimento' THEN
        v_inicio_real := COALESCE(v_agendamento.inicio_real, v_agora);

        -- Se foi iniciado ANTES do agendamento previsto:
        -- Reagendar o horário do agendamento para o momento em que está sendo realizado.
        IF v_inicio_real < v_agendamento.inicio_previsto THEN
            v_novo_inicio := v_inicio_real;
            v_novo_fim := v_novo_inicio + (v_duracao_minutos || ' minutes')::interval;

            -- Validar se não sobrepõe outro atendimento ativo do mesmo profissional
            IF EXISTS (
                SELECT 1 FROM public.agendamentos a
                WHERE a.id <> p_agendamento_id
                  AND a.barbearia_id = v_agendamento.barbearia_id
                  AND a.profissional_id = v_agendamento.profissional_id
                  AND a.status NOT IN ('cancelado', 'nao_compareceu')
                  AND tstzrange(a.inicio_previsto, a.fim_previsto, '[)') && tstzrange(v_novo_inicio, v_novo_fim, '[)')
            ) THEN
                RAISE EXCEPTION 'Não é possível antecipar o agendamento: o profissional já possui outro atendimento agendado neste horário.';
            END IF;

            -- Validar se não sobrepõe outro atendimento ativo do mesmo cliente
            IF v_agendamento.cliente_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.agendamentos a
                WHERE a.id <> p_agendamento_id
                  AND a.cliente_id = v_agendamento.cliente_id
                  AND a.status NOT IN ('cancelado', 'nao_compareceu')
                  AND tstzrange(a.inicio_previsto, a.fim_previsto, '[)') && tstzrange(v_novo_inicio, v_novo_fim, '[)')
            ) THEN
                RAISE EXCEPTION 'Não é possível antecipar o agendamento: o cliente já possui outro atendimento agendado neste horário.';
            END IF;

            UPDATE public.agendamentos
            SET status = p_novo_status,
                inicio_real = v_inicio_real,
                inicio_previsto = v_novo_inicio,
                fim_previsto = v_novo_fim,
                atualizado_em = v_agora
            WHERE id = p_agendamento_id
            RETURNING * INTO v_agendamento;
        ELSE
            UPDATE public.agendamentos
            SET status = p_novo_status,
                inicio_real = v_inicio_real,
                atualizado_em = v_agora
            WHERE id = p_agendamento_id
            RETURNING * INTO v_agendamento;
        END IF;

    ELSIF p_novo_status = 'concluido' THEN
        v_fim_real := v_agora;

        IF v_agendamento.inicio_real IS NOT NULL THEN
            v_inicio_real := v_agendamento.inicio_real;
        ELSE
            IF v_agora < v_agendamento.inicio_previsto THEN
                v_inicio_real := v_agora - (v_duracao_minutos || ' minutes')::interval;
            ELSE
                v_inicio_real := v_agendamento.inicio_previsto;
            END IF;
        END IF;

        IF v_fim_real <= v_inicio_real THEN
            v_fim_real := v_inicio_real + interval '1 minute';
        END IF;

        -- Se o atendimento foi realizado antes do início previsto originalmente
        IF v_inicio_real < v_agendamento.inicio_previsto THEN
            v_novo_inicio := v_inicio_real;
            v_novo_fim := v_fim_real;

            IF EXISTS (
                SELECT 1 FROM public.agendamentos a
                WHERE a.id <> p_agendamento_id
                  AND a.barbearia_id = v_agendamento.barbearia_id
                  AND a.profissional_id = v_agendamento.profissional_id
                  AND a.status NOT IN ('cancelado', 'nao_compareceu')
                  AND tstzrange(a.inicio_previsto, a.fim_previsto, '[)') && tstzrange(v_novo_inicio, v_novo_fim, '[)')
            ) THEN
                RAISE EXCEPTION 'Não é possível concluir antecipadamente: o profissional possui outro atendimento agendado neste horário.';
            END IF;

            IF v_agendamento.cliente_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.agendamentos a
                WHERE a.id <> p_agendamento_id
                  AND a.cliente_id = v_agendamento.cliente_id
                  AND a.status NOT IN ('cancelado', 'nao_compareceu')
                  AND tstzrange(a.inicio_previsto, a.fim_previsto, '[)') && tstzrange(v_novo_inicio, v_novo_fim, '[)')
            ) THEN
                RAISE EXCEPTION 'Não é possível concluir antecipadamente: o cliente possui outro atendimento agendado neste horário.';
            END IF;

            UPDATE public.agendamentos
            SET status = p_novo_status,
                inicio_real = v_inicio_real,
                fim_real = v_fim_real,
                inicio_previsto = v_novo_inicio,
                fim_previsto = v_novo_fim,
                atualizado_em = v_agora
            WHERE id = p_agendamento_id
            RETURNING * INTO v_agendamento;

        ELSIF v_fim_real < v_agendamento.fim_previsto AND v_fim_real > v_agendamento.inicio_previsto THEN
            -- Liberar os minutos restantes do horário previsto
            UPDATE public.agendamentos
            SET status = p_novo_status,
                inicio_real = v_inicio_real,
                fim_real = v_fim_real,
                fim_previsto = v_fim_real,
                atualizado_em = v_agora
            WHERE id = p_agendamento_id
            RETURNING * INTO v_agendamento;

        ELSE
            UPDATE public.agendamentos
            SET status = p_novo_status,
                inicio_real = v_inicio_real,
                fim_real = v_fim_real,
                atualizado_em = v_agora
            WHERE id = p_agendamento_id
            RETURNING * INTO v_agendamento;
        END IF;

    ELSE
        UPDATE public.agendamentos
        SET status = p_novo_status,
            atualizado_em = v_agora
        WHERE id = p_agendamento_id
        RETURNING * INTO v_agendamento;
    END IF;

    RETURN v_agendamento;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.atualizar_status_agendamento(uuid, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.atualizar_status_agendamento(uuid, text) FROM PUBLIC, anon;
