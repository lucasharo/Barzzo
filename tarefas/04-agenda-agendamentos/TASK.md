# TASK-04 — Agenda e agendamentos

## Objetivo
Núcleo operacional com integridade concorrente.

## Dados
agendamentos e agendamentos_servicos. Guardar inicio_previsto, fim_previsto, inicio_real, fim_real e snapshot de serviço/preço/duração.

## Status
pendente, confirmado, em_atendimento, concluido, cancelado, nao_compareceu. Definir transições válidas.

## Operações
Criar, manual pela equipe, qualquer profissional, reagendar, cancelar, no-show, iniciar e finalizar.

## Concorrência
Proteção de sobreposição obrigatória no banco/transação. Duas requisições simultâneas não podem vencer.

## Qualquer profissional
Elegíveis e disponíveis; menor carga do dia; desempate estável.

## Rotas
/parceiro/agenda
/parceiro/agendamentos/novo
/parceiro/agendamentos/[id]

## UX
ux-pro-max obrigatório; agenda por dia/semana e por profissional, utilizável por toque.

## Testes críticos
Concorrência, reagendamento em conflito, bloqueio recente, transições inválidas, tempos reais, snapshot, RLS e regressão.

## Aceite
Agenda operacional sem dupla reserva, com previsto/real e autorização correta.
