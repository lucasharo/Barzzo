# Resultado da Implementação — TASK-11: Revisão de cupons e influenciadores

**Agente:** Dev
**Data:** 30/09/2026
**Status:** Implementação concluída; aguardando aceite PO

## 1. Entrega

- Documentação oficial atualizada e decisões antigas da Task 08 marcadas como superseded.
- Migration incremental `supabase/migrations/20260930135753_revisao_cupons_influenciadores.sql` criada sem editar migrations históricas.
- `cupons.influenciador_id` permite vários cupons por influencer; `cupom_padrao_id` foi preservado para compatibilidade histórica.
- `cupons_regras` suporta prioridade, faixa de histórico, escopo por barbearia/global, desconto percentual/fixo, serviços elegíveis, mínimo e limites.
- `cupons_utilizacoes` registra uso individual com estados `reservado`, `consumido`, `liberado` e `cancelado`.
- Agendamentos congelam dados comerciais e comissão no snapshot; comissão percentual usa líquido e fixa usa valor congelado.
- RPC de uso bloqueia a linha do cupom e conta limites na transação. Cancelamento/no-show libera uso e não gera comissão.
- RPC de comissão e trigger de conclusão são idempotentes e não consultam configuração atual ou `ativo` do influencer.
- Cliente aceita/preenche/aplica `?cupom=CODIGO`, permite substituição e não usa atribuição persistida para reservas futuras.
- Parceiro administra origem, influencer, regras, faixas, histórico, serviços, vigência e limites; links novos usam cupom.
- Parceiro não cria nem edita cupons `BARZZO_GLOBAL`; essa origem fica restrita ao Admin por RLS e pela política de origem da migration.
- Parceiro não escolhe histórico global: o formulário fixa `escopo_historico = 'BARBEARIA'`, informa a abrangência local e bloqueia a edição de cupons com origem ou regra global. A RLS da migration pendente reserva `GLOBAL_BARZZO` ao Admin também para chamadas diretas à API.
- O `Seletor` compartilhado substitui os selects nativos da campanha, e o `Switch` compartilhado substitui todos os checkboxes encontrados nos apps.
- Refinamento do formulário: os seletores ocupam a largura disponível e a opção selecionada usa bronze em toda a linha; Histórico considerado ganhou mais espaço que os dois campos numéricos, e Tipo da faixa seguinte também foi ampliado.
- A vigência é digitada em `DD/MM/AAAA`, com máscara e validação de datas reais e da ordem início/término antes da conversão para o formato ISO enviado ao banco.
- Ao ativar `Apenas 1ª Reserva`, o formulário do Parceiro oculta a seção inteira de faixa para atendimentos seguintes e não inclui essa faixa nas regras salvas. Ao desativar antes de salvar, os valores digitados reaparecem.
- O formulário de faixas foi simplificado para um único switch (`Apenas 1ª Reserva`): desligado, o desconto da faixa seguinte é obrigatório; ligado, seus campos somem e só a primeira regra é salva. Quando há segunda faixa, a primeira fica limitada a zero atendimentos anteriores, e a seguinte começa em um.
- Refinamento das faixas: o formulário separa primeiro atendimento e demais atendimentos; o switch `Apenas 1ª Reserva` fica na segunda seção, e ligado mantém o controle visível, oculta os campos da faixa e apresenta um aviso. Cada faixa pode ter seu limite por cliente, contado pelo snapshot persistido; o limite total continua global ao cupom. Migration incremental criada localmente para aplicar a contagem por faixa no RPC.
- No formulário do Parceiro, `Cupom Ativo` aparece por último entre os controles, após a faixa opcional e antes das ações; o estado do switch não foi alterado.
- Influenciadores cadastrados no Parceiro podem ser editados no mesmo formulário de cadastro, incluindo contato, Pix, comissão e status ativo/inativo. A atualização filtra por influenciador e barbearia; a RLS existente restringe a equipe à própria barbearia, sem migration nova.

## 2. Arquivos principais

Alterados: `REGRAS_GERAIS.md`, `STATUS.md`, `docs/produto/produto.md`, `docs/arquitetura/banco.md`, os documentos históricos da Task 08, domínio/tipos/validações, telas Cliente/Parceiro, `scripts/testar.mjs` e testes unitários.

Criados: migration incremental e os artefatos `TASK.md`, `REQUISITOS_PO.md`, `PLANO_TECNICO.md`, `RESULTADO.md`, `REVISAO_TECNICA.md`, `QA.md` e `test-results.json` desta task.

## 3. Verificações

- `npm test`: 237/237 testes passando.
- `node scripts/testar.mjs`: 61/61 verificações estruturais passando.
- `npm run typecheck`: todos os workspaces sem erros.
- `npm run build`: apps Admin, Cliente, Landing e Parceiro compilados com sucesso. O bundle Vite existente gera apenas aviso de tamanho de chunk.
- `npx supabase db push --dry-run --project-ref gdgeokfwkbusemayqucb`: somente a migration da Task 11 pendente; nenhuma alteração remota aplicada.
- `git diff --check`: sem erros de whitespace.
- Busca estrutural: nenhum `<select>` nativo ou `input type="checkbox"` restante em `apps/` e `packages/`.
- Refinamento da faixa seguinte: build do Parceiro passou; 35/35 testes unitários de campanhas passaram; lint do Parceiro terminou sem erros (avisos preexistentes). A interação visual autenticada ainda requer QA manual.
- Restrição de escopo do Parceiro: `npm test` passou com 237/237 testes, incluindo 2 testes de segurança para formulário/RLS; build do Parceiro, lint dos arquivos alterados (0 erros, avisos preexistentes), `git diff --check` e dry-run da migration passaram. Nenhum deploy remoto foi executado.
- Edição local de influenciadores: 242/242 testes passaram, incluindo 2 verificações de dados inativos e filtro por influenciador/barbearia; build e typecheck do Parceiro passaram. O lint da tela terminou sem erros, com avisos preexistentes. O schema e a RLS remotos foram inspecionados em modo somente leitura; a gravação autenticada ainda requer QA manual.
- Simplificação local das faixas: 244/244 testes passaram, inclusive 2 verificações estruturais novas; build e typecheck do Parceiro passaram, e o lint dos arquivos alterados terminou sem erros (16 avisos preexistentes na tela). A interação visual autenticada ainda requer QA manual.
- Incidente `PGRST204` ao criar cupom de influenciador: introspecção confirmou que `cupons.influenciador_id` e `cupons.origem` ainda não existem no projeto remoto `gdgeokfwkbusemayqucb`; o ledger remoto não inclui a migration da Task 11. Não é falha sanável apenas com recarga do schema cache.
- Na migration ainda não aplicada, `eh_admin()` deixou de confiar em `user_metadata` editável pelo usuário; o `ON CONFLICT` da indicação passou a corresponder ao índice único parcial. A suíte estrutural passou 61/61 e o dry-run continuou apontando somente essa migration pendente.

## 4. Limitações conhecidas

Não foi executada a migration em ambiente remoto nem feito E2E autenticado com navegador. A validação disponível comprova código, testes, build, RLS/RPC por inspeção estática e dry-run do ledger; a aplicação real da migration, advisor remoto pós-DDL e QA manual dependem do gate autorizado de ambiente.

Enquanto a migration não for aplicada no ambiente autorizado, a criação de cupons com `origem` e `influenciador_id` continuará retornando `PGRST204` nesse projeto remoto. O fluxo de deploy segue `feature/*` (local), `release/*` (Dev) e `main` (PRD), sem promoção implícita.

Não houve merge, promoção ou commit nesta entrega.

## 5. Correção posterior do preview de histórico

- O preview no Cliente aguarda o carregamento inicial da sessão e revalida automaticamente cupons vindos da URL ou do rascunho, com prioridade para o código da URL.
- Rascunhos não restauram mais o valor de desconto calculado anteriormente; a faixa sempre é recalculada com o histórico atual.
- Falha ao carregar regras do cupom também bloqueia sua aplicação, evitando cair silenciosamente no desconto legado.
- As contagens de atendimentos concluídos por barbearia e global agora são verificadas explicitamente. Falha ou contagem ausente impede a aplicação do cupom e mostra orientação para tentar novamente, em vez de assumir histórico zero e conceder a primeira faixa.
- A confirmação permanece revalidada pela RPC transacional; esta correção evita exibir um desconto otimista incorreto no preview.
