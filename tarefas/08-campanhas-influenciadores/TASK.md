# TASK-08 — Campanhas, cupons e influenciadores

## Objetivo
Promoções e aquisição por influenciadores.

## Dados
campanhas, cupons, influenciadores, campanhas_influenciadores, indicacoes, comissoes_influenciadores.

## Regras
Desconto percentual/fixo, validade, limites, primeira reserva e serviços elegíveis. Referência deve sobreviver navegação e login.

Comissão só após atendimento concluído; idempotente; status pendente, paga, cancelada. Sem repasse automático.

## Rotas
/parceiro/campanhas
/parceiro/campanhas/[id]
/parceiro/influenciadores
/influenciador/painel
/influenciador/campanhas
/influenciador/comissoes

## Métricas
Cliques quando rastreáveis, reservas, concluídos, desconto, comissão pendente/paga.

## UX
ui-ux-pro-max obrigatório.

## Testes
Validade, limite, primeira reserva, referência após login, cancelado/no-show sem comissão, conclusão gera uma só comissão, RLS, regressão.

## Aceite
Campanhas, cupons, atribuição e comissões consistentes, sem fluxo financeiro no Barzzo.
