-- Completa os produtores de notificações do ciclo de vida e das campanhas.
-- O trigger de notificacoes já encaminha cada registro ao push FCM.

-- Evita que a mesma campanha produza avisos repetidos para o mesmo cliente.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notificacoes_campanha_promocional_usuario
    ON public.notificacoes (usuario_id, (metadata ->> 'campanha_id'))
    WHERE metadata ->> 'evento' = 'campanha_promocional'
      AND metadata ->> 'campanha_id' IS NOT NULL;

-- Um novo horário deve receber um novo lembrete quando ainda for elegível.
CREATE OR REPLACE FUNCTION public.rearmar_lembrete_agendamento_reagendado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NEW.inicio_previsto IS DISTINCT FROM OLD.inicio_previsto
       OR NEW.fim_previsto IS DISTINCT FROM OLD.fim_previsto
       OR NEW.profissional_id IS DISTINCT FROM OLD.profissional_id THEN
        NEW.lembrete_enviado := false;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rearmar_lembrete_agendamento_reagendado ON public.agendamentos;
CREATE TRIGGER trg_rearmar_lembrete_agendamento_reagendado
BEFORE UPDATE OF inicio_previsto, fim_previsto, profissional_id ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.rearmar_lembrete_agendamento_reagendado();

-- Notifica cliente e equipe quando um agendamento é cancelado ou reagendado.
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
            'Seu horário para %s em %s, marcado para %s, foi cancelado.',
            COALESCE(NULLIF(btrim(NEW.cliente_nome), ''), 'atendimento'),
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

DROP TRIGGER IF EXISTS trg_notificar_mudancas_agendamento ON public.agendamentos;
CREATE TRIGGER trg_notificar_mudancas_agendamento
AFTER UPDATE OF status, inicio_previsto, fim_previsto, profissional_id ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.notificar_mudancas_agendamento();

-- Processa lembretes uma única vez por horário, respeitando a preferência do cliente.
CREATE OR REPLACE FUNCTION public.processar_lembretes_agendamentos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_total integer;
BEGIN
    WITH elegiveis AS (
        SELECT a.id
        FROM public.agendamentos a
        LEFT JOIN public.preferencias_notificacao pn ON pn.usuario_id = a.cliente_id
        WHERE a.status = 'confirmado'
          AND a.cliente_id IS NOT NULL
          AND a.lembrete_enviado = false
          AND a.inicio_previsto > now()
          AND a.inicio_previsto <= now() + interval '24 hours'
          AND COALESCE(pn.notificacoes_lembretes, true) = true
        ORDER BY a.inicio_previsto
        FOR UPDATE OF a SKIP LOCKED
    ), marcados AS (
        UPDATE public.agendamentos a
        SET lembrete_enviado = true
        FROM elegiveis e
        WHERE a.id = e.id
        RETURNING a.id, a.cliente_id, a.barbearia_id, a.profissional_id,
                  a.cliente_nome, a.inicio_previsto
    )
    INSERT INTO public.notificacoes (usuario_id, titulo, corpo, tipo, link, metadata)
    SELECT
        m.cliente_id,
        'Lembrete de agendamento',
        format(
            'Seu horário em %s com %s é %s.',
            COALESCE(NULLIF(btrim(b.nome), ''), 'a barbearia'),
            COALESCE(NULLIF(btrim(p.nome), ''), 'o profissional'),
            to_char(m.inicio_previsto AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI')
        ),
        'lembrete',
        '/agendamentos/' || m.id::text,
        jsonb_build_object(
            'evento', 'lembrete_agendamento',
            'agendamento_id', m.id,
            'barbearia_id', m.barbearia_id
        )
    FROM marcados m
    JOIN public.barbearias b ON b.id = m.barbearia_id
    JOIN public.profissionais p ON p.id = m.profissional_id;

    GET DIAGNOSTICS v_total = ROW_COUNT;
    RETURN v_total;
END;
$$;

-- Envia a divulgação quando uma campanha ativa entra na vigência.
-- Somente clientes vinculados à barbearia e com preferência promocional ativa recebem.
CREATE OR REPLACE FUNCTION public.processar_notificacoes_campanhas_promocionais()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_total integer;
BEGIN
    INSERT INTO public.notificacoes (usuario_id, titulo, corpo, tipo, link, metadata)
    SELECT DISTINCT
        cb.usuario_id,
        'Nova promoção em ' || b.nome,
        COALESCE(NULLIF(btrim(c.descricao), ''), 'Confira a promoção e as ofertas disponíveis desta barbearia.'),
        'promocao',
        '/barbearias/' || b.slug,
        jsonb_build_object(
            'evento', 'campanha_promocional',
            'campanha_id', c.id,
            'barbearia_id', b.id
        )
    FROM public.campanhas c
    JOIN public.barbearias b ON b.id = c.barbearia_id
    JOIN public.clientes_barbearia cb ON cb.barbearia_id = c.barbearia_id
    LEFT JOIN public.preferencias_notificacao pn ON pn.usuario_id = cb.usuario_id
    WHERE c.ativa = true
      AND c.data_inicio <= now()
      AND c.data_fim >= now()
      AND cb.usuario_id IS NOT NULL
      AND COALESCE(pn.notificacoes_promocionais, true) = true
      AND NOT EXISTS (
          SELECT 1
          FROM public.notificacoes n
          WHERE n.usuario_id = cb.usuario_id
            AND n.metadata ->> 'evento' = 'campanha_promocional'
            AND n.metadata ->> 'campanha_id' = c.id::text
      )
    ON CONFLICT (usuario_id, (metadata ->> 'campanha_id'))
    WHERE metadata ->> 'evento' = 'campanha_promocional'
      AND metadata ->> 'campanha_id' IS NOT NULL
    DO NOTHING;

    GET DIAGNOSTICS v_total = ROW_COUNT;
    RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.processar_lembretes_agendamentos() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.processar_notificacoes_campanhas_promocionais() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.processar_lembretes_agendamentos() TO service_role;
GRANT EXECUTE ON FUNCTION public.processar_notificacoes_campanhas_promocionais() TO service_role;

-- O Supabase Cron roda a cada 15 minutos sem depender do plano de cron da Vercel.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

SELECT cron.schedule(
    'barzzo-lembretes-agendamentos',
    '*/15 * * * *',
    'SELECT public.processar_lembretes_agendamentos()'
);

SELECT cron.schedule(
    'barzzo-campanhas-promocionais',
    '*/15 * * * *',
    'SELECT public.processar_notificacoes_campanhas_promocionais()'
);
