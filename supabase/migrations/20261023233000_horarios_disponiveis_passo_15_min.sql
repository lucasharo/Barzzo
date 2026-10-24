-- Horários de 15 em 15 minutos em buscar_horarios_disponiveis.
-- Com o passo menor, o RPC também passa a descartar inícios que sobreponham agendamentos
-- ativos do profissional (a mesma regra da constraint uq_agendamento_sem_sobreposicao,
-- que continua sendo a garantia final contra concorrência). Os horários do slot são locais
-- (America/Sao_Paulo), então a comparação com timestamptz de bloqueios e agendamentos converte o fuso.

CREATE OR REPLACE FUNCTION public.buscar_horarios_disponiveis(p_barbearia_id uuid, p_servico_id uuid, p_data date, p_profissional_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(horario text, duracao_minutos integer, profissional_id uuid, profissional_nome text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
    v_dia_semana SMALLINT;
    v_horario_barbearia RECORD;
    v_servico RECORD;
    v_prof RECORD;
    v_jornada RECORD;
    v_slot_atual TIME;
    v_slot_fim TIME;
    v_duracao_interval INTERVAL;
    v_limite_inicio TIME;
    v_limite_fim TIME;
    v_valido BOOLEAN;
    v_passo_minutos INTEGER := 15; -- Intervalo de passo de slot padrão
    v_agora_local TIMESTAMP := (now() AT TIME ZONE 'America/Sao_Paulo');
BEGIN
    v_dia_semana := EXTRACT(DOW FROM p_data)::SMALLINT;

    -- 1. Obter serviço ativo
    SELECT * INTO v_servico
    FROM public.servicos s
    WHERE s.id = p_servico_id
      AND s.barbearia_id = p_barbearia_id
      AND s.ativo = true;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_duracao_interval := (v_servico.duracao_minutos || ' minutes')::INTERVAL;

    -- 2. Verificar horário de funcionamento da barbearia no dia
    SELECT * INTO v_horario_barbearia
    FROM public.horarios_barbearia hb
    WHERE hb.barbearia_id = p_barbearia_id
      AND hb.dia_semana = v_dia_semana
      AND hb.ativo = true;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- 3. Para cada profissional apto
    FOR v_prof IN
        SELECT p.id, p.nome
        FROM public.profissionais p
        JOIN public.profissionais_servicos ps ON ps.profissional_id = p.id
        WHERE p.barbearia_id = p_barbearia_id
          AND p.ativo = true
          AND ps.servico_id = p_servico_id
          AND ps.ativo = true
          AND (p_profissional_id IS NULL OR p.id = p_profissional_id)
        ORDER BY p.nome ASC
    LOOP
        -- Obter jornada do profissional
        SELECT * INTO v_jornada
        FROM public.jornadas_profissionais jp
        WHERE jp.profissional_id = v_prof.id
          AND jp.dia_semana = v_dia_semana
          AND jp.ativo = true;

        IF FOUND THEN
            -- O limite operacional é a interseção entre o funcionamento e a jornada
            v_limite_inicio := GREATEST(v_horario_barbearia.hora_abertura, v_jornada.hora_inicio);
            v_limite_fim := LEAST(v_horario_barbearia.hora_fechamento, v_jornada.hora_fim);

            v_slot_atual := v_limite_inicio;

            WHILE (v_slot_atual + v_duracao_interval) <= v_limite_fim LOOP
                v_slot_fim := (v_slot_atual + v_duracao_interval)::TIME;
                v_valido := true;

                -- Checagem 1: Almoço da barbearia
                IF v_horario_barbearia.hora_inicio_almoco IS NOT NULL AND v_horario_barbearia.hora_fim_almoco IS NOT NULL THEN
                    IF v_slot_atual < v_horario_barbearia.hora_fim_almoco AND v_slot_fim > v_horario_barbearia.hora_inicio_almoco THEN
                        v_valido := false;
                    END IF;
                END IF;

                -- Checagem 2: Pausa do profissional
                IF v_valido AND v_jornada.hora_inicio_pausa IS NOT NULL AND v_jornada.hora_fim_pausa IS NOT NULL THEN
                    IF v_slot_atual < v_jornada.hora_fim_pausa AND v_slot_fim > v_jornada.hora_inicio_pausa THEN
                        v_valido := false;
                    END IF;
                END IF;

                -- Checagem 3: Bloqueios pontuais de agenda (geral da barbearia ou do profissional)
                IF v_valido THEN
                    IF EXISTS (
                        SELECT 1 FROM public.bloqueios_agenda ba
                        WHERE ba.barbearia_id = p_barbearia_id
                          AND (ba.profissional_id IS NULL OR ba.profissional_id = v_prof.id)
                          AND ba.inicio < ((p_data + v_slot_fim) AT TIME ZONE 'America/Sao_Paulo')
                          AND ba.fim > ((p_data + v_slot_atual) AT TIME ZONE 'America/Sao_Paulo')
                    ) THEN
                        v_valido := false;
                    END IF;
                END IF;

                -- Checagem 3b: Agendamentos ativos do profissional que sobreponham o intervalo
                IF v_valido THEN
                    IF EXISTS (
                        SELECT 1 FROM public.agendamentos ag
                        WHERE ag.profissional_id = v_prof.id
                          AND ag.status NOT IN ('cancelado', 'nao_compareceu')
                          AND ag.inicio_previsto < ((p_data + v_slot_fim) AT TIME ZONE 'America/Sao_Paulo')
                          AND ag.fim_previsto > ((p_data + v_slot_atual) AT TIME ZONE 'America/Sao_Paulo')
                    ) THEN
                        v_valido := false;
                    END IF;
                END IF;

                -- Checagem 4: Horário no passado (se for a data de hoje em Brasília)
                IF v_valido AND p_data = v_agora_local::date THEN
                    IF v_slot_atual <= v_agora_local::time THEN
                        v_valido := false;
                    END IF;
                END IF;

                -- Se válido, emitir linha
                IF v_valido THEN
                    horario := to_char(v_slot_atual, 'HH24:MI');
                    duracao_minutos := v_servico.duracao_minutos;
                    profissional_id := v_prof.id;
                    profissional_nome := v_prof.nome;
                    RETURN NEXT;
                END IF;

                v_slot_atual := (v_slot_atual + (v_passo_minutos || ' minutes')::INTERVAL)::TIME;
            END LOOP;
        END IF;
    END LOOP;
END;
$function$;
