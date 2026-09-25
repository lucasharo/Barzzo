# TASK-06 — Clientes, favoritos e avaliações

## Objetivo
CRM básico, retenção e reputação.

## Dados
clientes_barbearia, observacoes_clientes, favoritos, avaliacoes.

## Clientes
Último atendimento, total, gasto estimado, profissional frequente quando possível, cancelamentos/no-show e histórico.

Observações são internas.

## Avaliações
Uma por agendamento concluído, nota 1-5, comentário opcional, resposta da barbearia e média pública.

## Rotas
/favoritos
/avaliacoes/[agendamento_id]
/parceiro/clientes
/parceiro/clientes/[id]
/parceiro/avaliacoes

## UX
ux-pro-max obrigatório.

## Testes
Isolamento, observação privada, avaliação sem conclusão/duplicada, favorito, resposta, regressão.

## Aceite
CRM e reputação funcionam com elegibilidade e RLS corretas.
