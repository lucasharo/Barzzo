-- Corrige a mensagem de cancelamento para não tratar o nome do cliente como serviço.
CREATE OR REPLACE FUNCTION public.notificar_mudancas_agendamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_barbearia_nome text;
    v_profissional_nome text;
    v_evento text;
    v_tipo text;
    v_titulo_cliente text;
    v_corpo_cliente text;
    v_titulo_equipe text;
    v_corpo_equipe text;
    v_link_cliente text;
    v_horario_anterior text;
    v_horario_atual text;
BEGIN
    SELECT b.nome INTO v_barbearia_nome
    FROM public.barbearias b
    WHERE b.id = NEW.barbearia_id;

    SELECT p.nome INTO v_profissional_nome
    FROM public.profissionais p
    WHERE p.id = NEW.profissional_id
      AND p.barbearia_id = NEW.barbearia_id;

    v_barbearia_nome := COALESCE(NULLIF(btrim(v_barbearia_nome), ''), 'a barbearia');
    v_profissional_nome := COALESCE(NULLIF(btrim(v_profissional_nome), ''), 'o profissional');
    v_horario_atual := to_char(NEW.inicio_previsto AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');
    v_link_cliente := '/agendamentos/' || NEW.id::text;

    IF OLD.status IS DISTINCT FROM 'cancelado' AND NEW.status = 'cancelado' THEN
        v_evento := 'cancelamento_agendamento';
        v_tipo := 'cancelamento';
        v_titulo_cliente := 'Agendamento cancelado';
        v_corpo_cliente := format(
            'Seu agendamento em %s, marcado para %s, foi cancelado.',
            v_barbearia_nome,
            v_horario_atual
        );
        v_titulo_equipe := 'Agendamento cancelado';
        v_corpo_equipe := format(
            'O agendamento de %s com %s para %s foi cancelado.',
            COALESCE(NULLIF(btrim(NEW.cliente_nome), ''), 'Cliente'),
            v_profissional_nome,
            v_horario_atual
        );
    ELSIF OLD.status IN ('pendente', 'confirmado')
       AND NEW.status IN ('pendente', 'confirmado')
       AND (
            NEW.inicio_previsto IS DISTINCT FROM OLD.inicio_previsto
            OR NEW.fim_previsto IS DISTINCT FROM OLD.fim_previsto
            OR NEW.profissional_id IS DISTINCT FROM OLD.profissional_id
       ) THEN
        v_evento := 'reagendamento_agendamento';
        v_tipo := 'reagendamento';
        v_horario_anterior := to_char(OLD.inicio_previsto AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');
        v_titulo_cliente := 'Agendamento reagendado';
        v_corpo_cliente := format(
            'Seu horário em %s foi alterado de %s para %s.',
            v_barbearia_nome,
            v_horario_anterior,
            v_horario_atual
        );
        v_titulo_equipe := 'Agendamento reagendado';
        v_corpo_equipe := format(
            'O agendamento de %s foi alterado de %s para %s com %s.',
            COALESCE(NULLIF(btrim(NEW.cliente_nome), ''), 'Cliente'),
            v_horario_anterior,
            v_horario_atual,
            v_profissional_nome
        );
    ELSE
        RETURN NEW;
    END IF;

    IF NEW.cliente_id IS NOT NULL THEN
        INSERT INTO public.notificacoes (usuario_id, titulo, corpo, tipo, link, metadata)
        VALUES (
            NEW.cliente_id,
            v_titulo_cliente,
            v_corpo_cliente,
            v_tipo,
            v_link_cliente,
            jsonb_build_object(
                'evento', v_evento,
                'agendamento_id', NEW.id,
                'barbearia_id', NEW.barbearia_id
            )
        );
    END IF;

    INSERT INTO public.notificacoes (usuario_id, titulo, corpo, tipo, link, metadata)
    SELECT DISTINCT
        mb.usuario_id,
        v_titulo_equipe,
        v_corpo_equipe,
        v_tipo,
        '/agenda',
        jsonb_build_object(
            'evento', v_evento,
            'agendamento_id', NEW.id,
            'barbearia_id', NEW.barbearia_id
        )
    FROM public.membros_barbearia mb
    WHERE mb.barbearia_id = NEW.barbearia_id
      AND mb.ativo = true
      AND mb.usuario_id IS DISTINCT FROM NEW.cliente_id
      AND (
          mb.papel IN ('dono', 'gerente')
          OR EXISTS (
              SELECT 1
              FROM public.profissionais p
              WHERE p.id IN (OLD.profissional_id, NEW.profissional_id)
                AND p.barbearia_id = NEW.barbearia_id
                AND p.usuario_id = mb.usuario_id
                AND p.ativo = true
          )
      );

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notificar_mudancas_agendamento() FROM PUBLIC, anon, authenticated;
