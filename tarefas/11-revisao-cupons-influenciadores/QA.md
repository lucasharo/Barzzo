# Relatório de Garantia da Qualidade (QA) — TASK-11

**Data:** 30/09/2026
**Status:** Aprovado em validação local; pendente de QA remoto/E2E

## 1. Automação

| Verificação | Resultado |
|---|---:|
| Vitest completo | 227/227 |
| Cenários específicos de campanhas/influencers | 35 |
| `scripts/testar.mjs` | 61/61 |
| Typecheck de workspaces | 0 erros |
| Build Admin, Cliente, Landing e Parceiro | passou |
| `git diff --check` | passou |
| `supabase db push --dry-run` | migration Task 11 identificada |

O advisor remoto foi consultado antes da aplicação. Ele ainda reporta alertas históricos do ambiente atual, incluindo funções antigas com `search_path` mutável e grants públicos de `SECURITY DEFINER`; a migration nova revoga os grants públicos dos RPCs/handlers desta task e define `search_path` vazio nas funções críticas. O advisor pós-migration precisa ser executado depois do apply.

## 2. Cobertura Task 11

Os testes de domínio cobrem atribuição por cupom, ausência de influencer em cupom de barbearia/global, substituição, não herança, link `?cupom`, faixas de primeiro/seguintes, histórico global, limites, ilimitado, subtotal elegível, desconto fixo com teto, mínimo bruto e comissão percentual/fixa sobre snapshot.

A migration é verificada por presença de tabelas, estados, RLS, índices, proteção de snapshot, triggers, grants/revokes e processamento por snapshot.

## 3. Segurança e UX

Foi revisada a separação entre `apps/cliente` e `apps/parceiro`, a dependência de RLS/RPC para regras críticas, mensagens pt-BR, inputs com labels, estados de carregamento existentes e targets mínimos de 44px nos controles novos. O cliente não exibe `ref` como conceito operacional.

## 4. Pendências de QA

- Aplicar migration somente no ambiente autorizado.
- Executar advisors de segurança/performance após a aplicação.
- Rodar E2E autenticado com dois clientes/barbearias para comprovar concorrência, RLS cruzado, primeiro atendimento global e cancelamento liberando uso.
- Validar manualmente no mobile a troca de cupom, retorno da autenticação e link `?cupom`.
