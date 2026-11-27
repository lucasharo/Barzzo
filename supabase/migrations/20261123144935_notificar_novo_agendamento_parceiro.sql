-- Gera a notificação do parceiro no banco para que o trigger de push a envie ao FCM.
-- O destino é o dono/gerente da barbearia e o profissional vinculado ao atendimento.
CREATE OR REPLACE FUNCTION public.notificar_novo_agendamento_parceiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_profissional_nome text;
    v_data_hora text;
BEGIN
    SELECT nome INTO v_profissional_nome
    FROM public.profissionais
    WHERE id = NEW.profissional_id
      AND barbearia_id = NEW.barbearia_id;

    v_data_hora := to_char(
        NEW.inicio_previsto AT TIME ZONE 'America/Sao_Paulo',
        'DD/MM/YYYY "às" HH24:MI'
    );

    INSERT INTO public.notificacoes (
        usuario_id,
        titulo,
        corpo,
        tipo,
        link,
        metadata
    )
    SELECT
        mb.usuario_id,
        'Novo agendamento',
        format(
            'Novo agendamento de %s com %s para %s.',
            COALESCE(NULLIF(btrim(NEW.cliente_nome), ''), 'Cliente'),
            COALESCE(NULLIF(btrim(v_profissional_nome), ''), 'o profissional'),
            v_data_hora
        ),
        'confirmacao',
        '/agenda',
        jsonb_build_object(
            'agendamento_id', NEW.id,
            'barbearia_id', NEW.barbearia_id,
            'evento', 'novo_agendamento'
        )
    FROM public.membros_barbearia mb
    WHERE mb.barbearia_id = NEW.barbearia_id
      AND mb.ativo = true
      AND (
          mb.papel IN ('dono', 'gerente')
          OR EXISTS (
              SELECT 1
              FROM public.profissionais p
              WHERE p.id = NEW.profissional_id
                AND p.barbearia_id = NEW.barbearia_id
                AND p.usuario_id = mb.usuario_id
                AND p.ativo = true
          )
      );

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notificar_novo_agendamento_parceiro()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notificar_novo_agendamento_parceiro ON public.agendamentos;
CREATE TRIGGER trg_notificar_novo_agendamento_parceiro
AFTER INSERT ON public.agendamentos
FOR EACH ROW
WHEN (NEW.status = 'confirmado' AND NEW.origem IN ('marketplace', 'cliente'))
EXECUTE FUNCTION public.notificar_novo_agendamento_parceiro();

-- Recupera reservas futuras recentes criadas antes deste trigger existir.
WITH reservas_pendentes_de_aviso AS (
    SELECT
        a.id,
        a.barbearia_id,
        a.cliente_nome,
        a.inicio_previsto,
        a.profissional_id
    FROM public.agendamentos a
    WHERE a.status = 'confirmado'
      AND a.origem IN ('marketplace', 'cliente')
      AND a.inicio_previsto >= now()
      AND a.criado_em >= now() - interval '24 hours'
), destinatarios AS (
    SELECT DISTINCT
        r.id AS agendamento_id,
        r.barbearia_id,
        r.cliente_nome,
        r.inicio_previsto,
        r.profissional_id,
        mb.usuario_id
    FROM reservas_pendentes_de_aviso r
    JOIN public.membros_barbearia mb
      ON mb.barbearia_id = r.barbearia_id
     AND mb.ativo = true
    WHERE mb.papel IN ('dono', 'gerente')
       OR EXISTS (
            SELECT 1
            FROM public.profissionais p
            WHERE p.id = r.profissional_id
              AND p.barbearia_id = r.barbearia_id
              AND p.usuario_id = mb.usuario_id
              AND p.ativo = true
       )
)
INSERT INTO public.notificacoes (
    usuario_id,
    titulo,
    corpo,
    tipo,
    link,
    metadata
)
SELECT
    d.usuario_id,
    'Novo agendamento',
    format(
        'Novo agendamento de %s com %s para %s.',
        COALESCE(NULLIF(btrim(d.cliente_nome), ''), 'Cliente'),
        COALESCE(NULLIF(btrim(p.nome), ''), 'o profissional'),
        to_char(d.inicio_previsto AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI')
    ),
    'confirmacao',
    '/agenda',
    jsonb_build_object(
        'agendamento_id', d.agendamento_id,
        'barbearia_id', d.barbearia_id,
        'evento', 'novo_agendamento'
    )
FROM destinatarios d
LEFT JOIN public.profissionais p
  ON p.id = d.profissional_id
 AND p.barbearia_id = d.barbearia_id
WHERE NOT EXISTS (
    SELECT 1
    FROM public.notificacoes n
    WHERE n.usuario_id = d.usuario_id
      AND n.metadata->>'agendamento_id' = d.agendamento_id::text
      AND n.metadata->>'evento' = 'novo_agendamento'
);
