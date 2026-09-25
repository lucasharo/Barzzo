# TASK-09 — Notificações, dashboard e relatórios

## Objetivo
Push e visão gerencial geral/por profissional.

## Dados
dispositivos e notificacoes. Um usuário pode ter vários dispositivos.

## Push
Firebase Cloud Messaging. Eventos: confirmação, cancelamento, lembrete, reagendamento, promoção e sistema. Sem e-mail.

## Dashboard
Agenda do dia, próximos, concluídos, cancelamentos/no-show, faturamento estimado e clientes novos.

## Relatórios
Filtros hoje/7/30/personalizado/profissional.
Geral: atendimentos, faturamento, ticket, cancelamentos/no-show.
Profissional: atendimentos, faturamento, ticket, ocupação, serviços, duração prevista x real e média.
Marketing: cupons, reservas por influencer e comissões.

## Rotas
/notificacoes
/parceiro/painel
/parceiro/relatorios

## UX
ux-pro-max obrigatório; informação acionável, sem excesso de gráficos.

## Testes
Múltiplos dispositivos, token inválido, preferência promocional, lembrete sem duplicação, períodos, visão funcionário, RLS e regressão.

## Aceite
Push e relatórios corretos, inclusive por funcionário e tempo real x previsto.
