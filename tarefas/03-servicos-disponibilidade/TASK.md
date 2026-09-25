# TASK-03 — Serviços, jornadas e disponibilidade

## Objetivo
Criar serviços e regras de disponibilidade.

## Dados
servicos, profissionais_servicos, horarios_barbearia, jornadas_profissionais, bloqueios_agenda.

## Serviço
nome, descricao, preco, duracao_minutos, ativo. Preço/duração iguais para profissionais no MVP.

## Disponibilidade
Considerar funcionamento, jornada, duração, bloqueios e reservas existentes. Preparar serviço/função central buscar_horarios_disponiveis.

## Rotas
/parceiro/servicos
/parceiro/servicos/[id]
/parceiro/horarios
/parceiro/equipe/[id]/jornada
/parceiro/agenda/bloqueios

## UX
ui-ux-pro-max obrigatório; edição semanal simples em mobile/desktop.

## Testes
Ativo/inativo, jornada menor que funcionamento, bloqueios, duração cruzando fechamento, múltiplos profissionais, RLS, regressão.

## Aceite
Sistema retorna somente horários válidos para serviço/profissional/data.
