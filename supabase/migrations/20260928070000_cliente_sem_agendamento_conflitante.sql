-- Migration: 20260928070000_cliente_sem_agendamento_conflitante.sql
-- Descrição: Impede que o mesmo cliente tenha agendamentos sobrepostos no mesmo horário

-- 1. Cancelar agendamentos duplicados/conflitantes residuais de testes passados
UPDATE public.agendamentos
SET status = 'cancelado',
    observacoes = COALESCE(observacoes, '') || ' [Cancelado por duplicidade/conflito de horário]'
WHERE id IN (
  SELECT a2.id
  FROM public.agendamentos a1
  JOIN public.agendamentos a2 ON a1.cliente_id = a2.cliente_id AND a1.id < a2.id
  WHERE a1.cliente_id IS NOT NULL
    AND a1.status NOT IN ('cancelado', 'nao_compareceu')
    AND a2.status NOT IN ('cancelado', 'nao_compareceu')
    AND tstzrange(a1.inicio_previsto, a1.fim_previsto, '[)') && tstzrange(a2.inicio_previsto, a2.fim_previsto, '[)')
);

-- 2. Adicionar restrição de exclusão para cliente_id
ALTER TABLE public.agendamentos
    DROP CONSTRAINT IF EXISTS uq_agendamento_cliente_sem_sobreposicao;

ALTER TABLE public.agendamentos
    ADD CONSTRAINT uq_agendamento_cliente_sem_sobreposicao EXCLUDE USING gist (
        cliente_id WITH =,
        tstzrange(inicio_previsto, fim_previsto, '[)') WITH &&
    ) WHERE (cliente_id IS NOT NULL AND status NOT IN ('cancelado', 'nao_compareceu'));
