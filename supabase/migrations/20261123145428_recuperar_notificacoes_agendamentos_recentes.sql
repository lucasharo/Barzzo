-- Entrega os avisos perdidos antes do trigger de novos agendamentos ser criado.
WITH agendamentos_recentes AS (
    SELECT
        a.id,
        a.barbearia_id,
        a.cliente_nome,
        a.inicio_previsto,
        a.profissional_id
    FROM public.agendamentos a
    WHERE a.status = 'confirmado'
      AND a.origem IN ('marketplace', 'cliente')
      AND a.criado_em >= now() - interval '24 hours'
), destinatarios AS (
    SELECT DISTINCT
        a.id AS agendamento_id,
        a.barbearia_id,
        a.cliente_nome,
        a.inicio_previsto,
        a.profissional_id,
        mb.usuario_id
    FROM agendamentos_recentes a
    JOIN public.membros_barbearia mb
      ON mb.barbearia_id = a.barbearia_id
     AND mb.ativo = true
    WHERE mb.papel IN ('dono', 'gerente')
       OR EXISTS (
            SELECT 1
            FROM public.profissionais p
            WHERE p.id = a.profissional_id
              AND p.barbearia_id = a.barbearia_id
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
