# Parecer de Revisão Técnica — TASK-11: Revisão de cupons e influenciadores

**Revisor:** Líder Técnico
**Data:** 30/09/2026
**Veredito:** Aprovado tecnicamente, pendente de QA remoto/E2E e aceite PO

## 1. Arquitetura

1. A evolução é incremental e não modifica a migration histórica da Task 08.
2. O vínculo `cupons.influenciador_id` resolve a cardinalidade de vários cupons por influencer; o campo antigo foi mantido sem uso como fonte de atribuição.
3. Regras e utilizações são entidades próprias, permitindo faixas futuras sem hardcode em `cupons`.
4. A atribuição e a comissão são congeladas no agendamento. A conclusão lê snapshot, não a configuração atual do influencer.
5. O limite total e por cliente é protegido por `FOR UPDATE` no cupom e contagem de estados ativos na mesma transação.
6. Índices únicos garantem uma utilização/atribuição por agendamento e uma comissão por agendamento.

## 2. Segurança

- RLS foi habilitado em `cupons_regras` e `cupons_utilizacoes`.
- Regras são públicas somente para cupons ativos; utilizações são legíveis apenas por membros da barbearia.
- A RPC de confirmação exige o cliente do agendamento ou membro autorizado e foi removida do papel `anon`.
- Snapshot comercial é limpo na inserção e protegido em atualizações feitas fora da RPC comercial.
- A RPC de comissão usa `SECURITY DEFINER` com `search_path` vazio e referências qualificadas.
- Não foram adicionados secrets, service keys ou autorização baseada apenas na UI.

## 3. Decisões de compatibilidade

`ref` continua podendo abrir páginas existentes, mas é ignorado para atribuição e comissão. A UI de divulgação só gera `?cupom=CODIGO`. Dados legados são preservados e apenas associações antigas que já tinham cupom são backfilled como snapshot.

## 4. Gate

O código passou testes, typecheck, build e dry-run do Supabase. A aprovação técnica não equivale a migration aplicada, advisor remoto ou E2E autenticado.
