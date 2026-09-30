# TASK-11 — Revisão de cupons, atribuição e comissões

## Objetivo

Evoluir a implementação da Task 08 para que o cupom aplicado seja a fonte de verdade da atribuição comercial, com regras/faixas extensíveis, histórico auditável de utilização, snapshots na confirmação e comissão idempotente somente após atendimento concluído.

## Escopo

- Migration incremental sem alterar a migration histórica da Task 08.
- Vínculo opcional `cupons.influenciador_id`, permitindo vários cupons por influencer.
- Regras de cupom por prioridade, histórico, escopo, benefício, serviços elegíveis, valor mínimo e limites.
- Histórico transacional em `cupons_utilizacoes`.
- Snapshot comercial em `agendamentos` e comissão baseada no snapshot.
- Cliente com `?cupom=CODIGO`, substituição de cupom e nenhum reaproveitamento entre agendamentos.
- Parceiro administrando origem, influencer, regras, vigência, elegibilidade e limites.
- RLS/multi-tenant, idempotência e concorrência no banco.
- Compatibilidade de navegação com `ref`, sem usar `ref` para atribuição ou comissão.

## Regras de aceite

As regras oficiais são as do pedido da Task 11 e estão formalizadas em `REGRAS_GERAIS.md`, `docs/produto/produto.md` e `docs/arquitetura/banco.md`. Incluem: uma atribuição por reserva, percentual sobre líquido, fixa congelada, histórico por barbearia/global, primeiro atendimento global, limites total/cliente/ilimitado, serviços elegíveis e comissão apenas em `concluido`.

## Estado

EM_DESENVOLVIMENTO
