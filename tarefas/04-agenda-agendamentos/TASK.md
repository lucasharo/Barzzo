# TASK-04 — Agenda e agendamentos

## Objetivo
Núcleo operacional com integridade concorrente.

## Dados
agendamentos e agendamentos_servicos. Guardar inicio_previsto, fim_previsto, inicio_real, fim_real e snapshot de serviço/preço/duração.

## Status
pendente, confirmado, em_atendimento, concluido, cancelado, nao_compareceu. Definir transições válidas.

## Operações
Criar agendamentos manualmente pela equipe com até três serviços, usar qualquer profissional, reagendar, cancelar, marcar no-show, iniciar e finalizar.

No agendamento manual, somar a duração dos serviços selecionados para consultar e reservar o intervalo completo; guardar um snapshot por serviço e totalizar os preços.

## Concorrência
Proteção de sobreposição obrigatória no banco/transação. Duas requisições simultâneas não podem vencer.

## Qualquer profissional
Elegíveis e disponíveis; menor carga do dia; desempate estável.

## Rotas
/parceiro/agenda
/parceiro/agendamentos/novo
/parceiro/agendamentos/[id]

## UX
ui-ux-pro-max obrigatório; agenda por dia/semana e por profissional, utilizável por toque.

## Testes críticos
Concorrência, reagendamento em conflito, bloqueio recente, seleção manual de um a três serviços, duração/preço total, snapshots por serviço, transições inválidas, tempos reais, RLS e regressão.

## Aceite
Agenda operacional sem dupla reserva, com previsto/real e autorização correta.
