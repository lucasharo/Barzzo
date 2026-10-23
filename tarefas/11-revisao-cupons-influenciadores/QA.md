# Relatório de Garantia da Qualidade (QA) — TASK-11

**Data:** 30/09/2026
**Status:** Aprovado em validação local; pendente de QA remoto/E2E

## 1. Automação

| Verificação | Resultado |
|---|---:|
| Vitest completo | 237/237 |
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

No refinamento visual do Parceiro, os seletores usam largura responsiva e opção ativa com fundo bronze completo. As datas têm teclado numérico, máscara `DD/MM/AAAA`, mensagens de erro ligadas ao campo e bloqueio de datas inexistentes ou término anterior ao início. Build do Parceiro, typecheck de UI/Parceiro, lint sem erros e suíte de 235 testes passaram; a conferência visual autenticada em tamanhos mobile e desktop ainda precisa ser feita.

O build do Admin e seu typecheck também passaram após a alteração no `Seletor` compartilhado.

Na edição local de influenciadores, a suíte completa passou com 242/242 testes e o build/typecheck do Parceiro passaram. A tabela remota possui `ativo` e os campos editáveis; a política RLS vigente restringe `UPDATE` por membro ativo da barbearia. Não foi feita gravação remota nem teste E2E autenticado.

Na simplificação local das faixas do cupom, a suíte completa passou com 244/244 testes, e build/typecheck do Parceiro passaram. O lint dos arquivos alterados não teve erros (16 avisos preexistentes na tela). Não houve teste visual autenticado da interação nem gravação remota.

No refinamento atual, a interface mantém a seção de demais atendimentos e o switch visíveis quando `Apenas 1ª Reserva` está ligado, oculta apenas os campos e mostra um aviso. A migration local altera a contagem do RPC para separar os limites por snapshot da faixa. Typecheck e build do Parceiro passaram; lint sem erros, com 16 avisos preexistentes. Não foram executados testes automatizados nesta rodada, nem QA visual autenticado; a migration não foi aplicada remotamente.

## 4. Pendências de QA

- Aplicar migration somente no ambiente autorizado.
- Executar advisors de segurança/performance após a aplicação.
- Rodar E2E autenticado com dois clientes/barbearias para comprovar concorrência, RLS cruzado, primeiro atendimento global e cancelamento liberando uso.
- Validar manualmente no mobile a troca de cupom, retorno da autenticação e link `?cupom`.
- Validar manualmente no Parceiro que a lista de origem não oferece Global e que o Admin consegue criar cupom Global após a aplicação da migration.
- Validar no formulário do Parceiro que o switch `Apenas 1ª Reserva` fica na seção de demais atendimentos: desligado, seus campos ficam abertos e o desconto é obrigatório; ligado, seus campos somem da tela e da navegação por teclado, aparece o aviso, e somente a primeira regra é salva. Ao desligar antes de salvar, o desconto digitado deve reaparecer. Com segunda faixa preenchida, conferir que a primeira atende histórico zero e a seguinte começa no histórico um.
- Confirmar visualmente no Parceiro, em mobile e desktop, que `Cupom Ativo` é o último controle antes de Cancelar/Salvar, tanto com a faixa seguinte visível quanto oculta.
- Confirmar no Parceiro que não há opção `Em todo o Barzzo` para histórico, que o formulário envia somente `BARBEARIA` e que um cupom com origem ou regra global não abre para edição. Após deploy autorizado, tentar `INSERT`/`UPDATE` autenticado com `GLOBAL_BARZZO` como membro de barbearia e confirmar bloqueio pela RLS; repetir como Admin e confirmar permissão.
- Após o deploy autorizado, confirmar no schema real que `public.cupons.influenciador_id` e `origem` existem, que a migration consta no ledger e que o POST autenticado de cupom de influenciador não retorna `PGRST204`.
- Validar no Parceiro a edição de nome, código, contato, Pix e comissão; desativar e reativar um influenciador, confirmar a atualização do card, impedir novas divulgações quando inativo e verificar que comissões antigas mantêm seus valores.

## 5. Correção do preview por histórico

- `npm run build --workspace=apps/cliente`: passou.
- `npm run test -- tests/unitarios/campanhas-influenciadores.test.ts`: 35/35 passaram, incluindo cálculo por faixa com histórico anterior.
- `git diff --check`: passou.
- QA manual autenticado após recarga ainda não foi executado. O rascunho não restaura mais desconto antigo e cupons restaurados são revalidados; falhas ao ler regras/histórico bloqueiam o preview e orientam tentar novamente.
