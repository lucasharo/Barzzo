-- Calcula a disponibilidade para todos os serviços selecionados em uma reserva.
-- A duração e as qualificações são obtidas do banco, sem confiar em totais enviados pelo cliente.

CREATE OR REPLACE FUNCTION public.buscar_horarios_disponiveis_multiplos_servicos(
    p_barbearia_id UUID,
    p_servicos_ids UUID[],
    p_data DATE,
    p_profissional_id UUID DEFAULT NULL
)
RETURNS TABLE(
    horario TEXT,
    duracao_minutos INTEGER,
    profissional_id UUID,
    profissional_nome TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_dia_semana SMALLINT;
    v_horario_barbearia RECORD;
    v_prof RECORD;
    v_jornada RECORD;
    v_slot_atual TIME;
    v_slot_fim TIME;
    v_limite_inicio TIME;
    v_limite_fim TIME;
    v_limite_inicio_minutos INTEGER;
    v_limite_fim_minutos INTEGER;
    v_slot_inicio_minutos INTEGER;
    v_slot_fim_minutos INTEGER;
    v_quantidade_servicos INTEGER;
    v_total_servicos INTEGER;
    v_duracao_total BIGINT;
    v_valido BOOLEAN;
    v_passo_minutos INTEGER := 15;
    v_agora_local TIMESTAMP := now() AT TIME ZONE 'America/Sao_Paulo';
BEGIN
    IF p_data IS NULL
       OR p_data < v_agora_local::DATE
       OR p_servicos_ids IS NULL
       OR cardinality(p_servicos_ids) = 0
       OR cardinality(p_servicos_ids) > 4 THEN
        RETURN;
    END IF;

    v_quantidade_servicos := cardinality(p_servicos_ids);

    SELECT COUNT(*)::INTEGER, COALESCE(SUM(s.duracao_minutos), 0)
      INTO v_total_servicos, v_duracao_total
    FROM public.servicos s
    WHERE s.id = ANY(p_servicos_ids)
      AND s.barbearia_id = p_barbearia_id
      AND s.ativo = true;

    -- A contagem também rejeita IDs duplicados, inativos ou de outra barbearia.
    IF v_total_servicos <> v_quantidade_servicos
       OR v_duracao_total <= 0
       OR v_duracao_total > 1440 THEN
        RETURN;
    END IF;

    v_dia_semana := EXTRACT(DOW FROM p_data)::SMALLINT;

    SELECT * INTO v_horario_barbearia
    FROM public.horarios_barbearia hb
    WHERE hb.barbearia_id = p_barbearia_id
      AND hb.dia_semana = v_dia_semana
      AND hb.ativo = true;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    FOR v_prof IN
        SELECT p.id, p.nome
        FROM public.profissionais p
        JOIN public.profissionais_servicos ps ON ps.profissional_id = p.id
        JOIN public.servicos s ON s.id = ps.servico_id
        WHERE p.barbearia_id = p_barbearia_id
          AND p.ativo = true
          AND ps.ativo = true
          AND s.ativo = true
          AND s.barbearia_id = p_barbearia_id
          AND ps.servico_id = ANY(p_servicos_ids)
          AND (p_profissional_id IS NULL OR p.id = p_profissional_id)
        GROUP BY p.id, p.nome
        HAVING COUNT(DISTINCT ps.servico_id) = v_quantidade_servicos
        ORDER BY (
            SELECT COUNT(*)
            FROM public.agendamentos ag
            WHERE ag.profissional_id = p.id
              AND ag.status NOT IN ('cancelado', 'nao_compareceu')
              AND ag.inicio_previsto >= (p_data::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')
              AND ag.inicio_previsto < ((p_data + 1)::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')
        ) ASC, p.nome ASC, p.id ASC
    LOOP
        SELECT * INTO v_jornada
        FROM public.jornadas_profissionais jp
        WHERE jp.profissional_id = v_prof.id
          AND jp.dia_semana = v_dia_semana
          AND jp.ativo = true;

        IF NOT FOUND THEN
            CONTINUE;
        END IF;

        v_limite_inicio := GREATEST(v_horario_barbearia.hora_abertura, v_jornada.hora_inicio);
        v_limite_fim := LEAST(v_horario_barbearia.hora_fechamento, v_jornada.hora_fim);
        v_limite_inicio_minutos := FLOOR(EXTRACT(EPOCH FROM v_limite_inicio) / 60)::INTEGER;
        v_limite_fim_minutos := FLOOR(EXTRACT(EPOCH FROM v_limite_fim) / 60)::INTEGER;
        v_slot_inicio_minutos := v_limite_inicio_minutos;

        -- Minutos inteiros evitam que a soma do horário dê a volta após meia-noite.
        WHILE v_slot_inicio_minutos + v_duracao_total <= v_limite_fim_minutos LOOP
            v_slot_fim_minutos := v_slot_inicio_minutos + v_duracao_total::INTEGER;
            v_slot_atual := make_time(v_slot_inicio_minutos / 60, v_slot_inicio_minutos % 60, 0);
            v_slot_fim := make_time(v_slot_fim_minutos / 60, v_slot_fim_minutos % 60, 0);
            v_valido := true;

            IF v_horario_barbearia.hora_inicio_almoco IS NOT NULL
               AND v_horario_barbearia.hora_fim_almoco IS NOT NULL
               AND v_slot_atual < v_horario_barbearia.hora_fim_almoco
               AND v_slot_fim > v_horario_barbearia.hora_inicio_almoco THEN
                v_valido := false;
            END IF;

            IF v_valido
               AND v_jornada.hora_inicio_pausa IS NOT NULL
               AND v_jornada.hora_fim_pausa IS NOT NULL
               AND v_slot_atual < v_jornada.hora_fim_pausa
               AND v_slot_fim > v_jornada.hora_inicio_pausa THEN
                v_valido := false;
            END IF;

            IF v_valido AND EXISTS (
                SELECT 1
                FROM public.bloqueios_agenda ba
                WHERE ba.barbearia_id = p_barbearia_id
                  AND (ba.profissional_id IS NULL OR ba.profissional_id = v_prof.id)
                  AND ba.inicio < ((p_data + v_slot_fim) AT TIME ZONE 'America/Sao_Paulo')
                  AND ba.fim > ((p_data + v_slot_atual) AT TIME ZONE 'America/Sao_Paulo')
            ) THEN
                v_valido := false;
            END IF;

            IF v_valido AND EXISTS (
                SELECT 1
                FROM public.agendamentos ag
                WHERE ag.profissional_id = v_prof.id
                  AND ag.status NOT IN ('cancelado', 'nao_compareceu')
                  AND ag.inicio_previsto < ((p_data + v_slot_fim) AT TIME ZONE 'America/Sao_Paulo')
                  AND ag.fim_previsto > ((p_data + v_slot_atual) AT TIME ZONE 'America/Sao_Paulo')
            ) THEN
                v_valido := false;
            END IF;

            IF v_valido AND p_data = v_agora_local::DATE
               AND v_slot_atual <= v_agora_local::TIME THEN
                v_valido := false;
            END IF;

            IF v_valido THEN
                horario := to_char(v_slot_atual, 'HH24:MI');
                duracao_minutos := v_duracao_total::INTEGER;
                profissional_id := v_prof.id;
                profissional_nome := v_prof.nome;
                RETURN NEXT;
            END IF;

            v_slot_inicio_minutos := v_slot_inicio_minutos + v_passo_minutos;
        END LOOP;
    END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.buscar_horarios_disponiveis_multiplos_servicos(UUID, UUID[], DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_horarios_disponiveis_multiplos_servicos(UUID, UUID[], DATE, UUID) TO anon, authenticated;
