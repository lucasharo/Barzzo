# Relatório de Garantia da Qualidade (QA) — TASK-11

**Data:** 30/09/2026
**Status:** CONCLUIDA (Aceite formal concedido pelo PO Lucas em 31/10/2026)

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

## 6. Aplicação remota e advisors (2026-10-23)

**Ledger e schema (projeto `gdgeokfwkbusemayqucb`):** `supabase migration list` mostra local = remoto para as 4 migrations desta task (`20260930135753`, `20260930224406`, `20261001181434`, `20261001182505`). `cupons.influenciador_id` e `cupons.origem` existem, assim como `cupons_regras` e `cupons_utilizacoes` (3 policies). O `PGRST204` não se aplica mais.

**Advisors:** a CLI instalada (v2.118) não tem comando de advisors; as verificações equivalentes foram feitas por consultas somente leitura no catálogo.

| Verificação | Resultado |
|---|---|
| Tabelas do schema `public` sem RLS | nenhuma |
| RPCs da Task 11 (`registrar_uso_cupom`, `processar_comissao_conclusao_atendimento`, `liberar_uso_cupom_agendamento`, `atualizar_snapshot_sem_cupom`, `disparar_comissao_agendamento_concluido`) | sem execução para `anon`; `SECURITY DEFINER` com `search_path` fixo; apenas as duas chamadas pelo app liberadas a `authenticated` |
| `registrar_clique_influenciador` | sem execução para `anon`/`authenticated`; sem `search_path` fixo |
| `proteger_snapshot_comercial_agendamento` (trigger, não `SECURITY DEFINER`) | sem `search_path` fixo |

**Achados de performance ligados à Task 11 (FK sem índice):** `agendamentos.cupom_id`, `agendamentos.cupom_regra_id`, `agendamentos.influenciador_id_snapshot`, `cupons_utilizacoes.regra_id`, `comissoes_influenciadores.cupom_id`, `comissoes_influenciadores.indicacao_id`, `indicacoes.cupom_id`, `influenciadores.cupom_padrao_id`. Policies novas (`cupons_regras`, `cupons_utilizacoes`, `cupons`) usam `auth.uid()` sem `(select auth.uid())`.

**Fora do escopo, a registrar separadamente (herdado de tasks anteriores):**
- ~27 funções `SECURITY DEFINER` do schema `public` executáveis por `anon`, entre elas `conceder_extensao_trial`, `processar_confirmacao_pagamento_assinatura`, `obter_metricas_admin_global`, `eh_admin` e `rls_auto_enable`; várias também sem `search_path` fixo. Cada uma precisa ser conferida quanto a validação interna de autorização.
- Mais 10 FKs sem índice em outras tabelas (`logs_auditoria`, `indicacoes`, `assinaturas` etc.) e ~37 policies antigas com `auth.uid()` sem `(select ...)`.

Nenhum dado foi alterado nesta verificação.

## 7. QA remoto no banco (2026-10-23)

Script: `D:\Temp\claude\barzzo-qa\qa_task11.sql`, executado no projeto `gdgeokfwkbusemayqucb` em uma única transação encerrada por `RAISE EXCEPTION`, de modo que nada foi persistido (conferido depois: 0 usuários, barbearias e cupons de teste). Papéis simulados com `SET LOCAL ROLE` e `request.jwt.claims` (2 donos de barbearia, 2 clientes, Admin).

| # | Verificação | Resultado |
|---|---|---|
| T1 | Faixa 1 (histórico 0): desconto 20% de R$ 100 → líquido 80, snapshot de comissão 8,00; uma utilização `consumido` | OK |
| T2 | Reaplicar cupom no mesmo agendamento é idempotente (1 utilização) | OK |
| T3 | Cupom com limite total 1: segundo cliente bloqueado ("O limite total deste cupom foi atingido.") | OK |
| T4 | Cancelamento libera a utilização, não gera comissão e reabre a vaga para outro cliente | OK |
| T5 | Conclusão gera exatamente 1 comissão (8,00), mesmo repetindo o UPDATE; alterar a comissão do influenciador depois não muda o valor congelado | OK |
| T6 | Segunda faixa após 1 atendimento concluído: desconto 10% | OK |
| T7 | Regra de histórico `GLOBAL_BARZZO` (primeiro atendimento global) bloqueia cliente que já foi atendido em outra barbearia | OK |
| T8 | Cliente 2 não confirma cupom em agendamento do cliente 1; `anon` sem permissão na RPC | OK |
| T9 | Dono da barbearia B não altera cupom da A nem lê suas utilizações; dono A lê as próprias | OK |
| T10 | Parceiro não cria cupom `BARZZO_GLOBAL` nem regra `GLOBAL_BARZZO` (RLS); Admin cria; Parceiro cria cupom de influenciador sem erro de coluna; `user_metadata` com `role=admin` não concede admin | OK |

**Observações (não reprovam a task):**
- A política "Leitura pública de cupons ativos para validação" permite a `anon` e a qualquer autenticado listar todos os cupons ativos de todas as barbearias (inclusive `influenciador_id` e limites). Decisão herdada da Task 08 para validar o código; vale avaliar uma RPC de validação por código.
- `eh_admin()` devolve `NULL` (e não `false`) quando o JWT não é de admin. As policies tratam `NULL` como negação, então não há brecha, mas `COALESCE(..., false)` deixaria o contrato explícito.
- Concorrência real (duas transações simultâneas) não foi exercitada; o limite foi comprovado em sequência e a RPC usa `FOR UPDATE` no cupom.

**Segue pendente (precisa de navegador e do PO):** itens de UI no celular/desktop (link `?cupom`, troca de cupom, formulário de faixas, Cupom Ativo, edição de influenciadores) e aceite final.

## 8. Endurecimento do acesso anônimo (2026-10-24)

As funções `SECURITY DEFINER` sem verificação de autorização citadas na seção 6 foram corrigidas. Achados e correções:

| Problema | Correção |
|---|---|
| `processar_confirmacao_pagamento_assinatura`: qualquer pessoa (inclusive sem login) ativava um plano pago sem pagar | só `service_role` (webhook e cron); `EXECUTE` removido de `anon` e `authenticated` |
| `conceder_extensao_trial`: qualquer usuário logado estendia o trial de qualquer barbearia | exige Admin; limite de 1 a 365 dias |
| `atualizar_status_agendamento` e `reagendar_agendamento`: sem checagem de dono | equipe da barbearia; o cliente só cancela a própria reserva futura; novo profissional precisa ser da mesma barbearia |
| `obter_metricas_admin_global`: métricas do negócio abertas | exige Admin |
| `obter_metricas_cliente_crm`: dados de clientes de qualquer barbearia | exige equipe e cliente da mesma barbearia |
| `eh_admin()` devolvia `NULL` para não-admin, então `IF NOT eh_admin()` nunca disparava | agora sempre booleano; guardas usam `COALESCE` |
| convites: `anon` lia todos os tokens pendentes | policy removida; leitura por token via RPC `obter_convite_por_token` |
| `indicacoes`: `anon` inseria linhas livremente | policy removida (a RPC de cupom grava a indicação) |
| bucket `capas-barbearias`: upload anônimo ("TEMP") | policy removida |
| policies no papel público que dependiam de login | restritas a `authenticated` |
| `search_path` mutável nas funções `SECURITY DEFINER` | fixado em `public, pg_temp` |

**Parte 2** (`20261024000100_restringir_leitura_anonima.sql`, **ainda não aplicada**; depende do deploy dos apps): remove todo privilégio de tabela do `anon` (hoje inclui INSERT, UPDATE, DELETE e TRUNCATE; só a RLS segurava) e libera apenas leitura de serviços, horários, jornadas, vínculos, galeria, produtos, planos e colunas públicas de `barbearias`, `profissionais` e `avaliacoes` (sem documento, dados de cobrança, e-mail/telefone de profissionais ou identificadores de avaliadores). A listagem pública de cupons sai; o app usa `obter_cupom_por_codigo`.

**Verificação:** script em transação que termina em erro (nada persistiu) simulando visitante, dois clientes, dono de outra barbearia, Admin e `service_role`; chamadas reais à API com a chave pública (negadas: 401) e com a chave secreta (`eh_service_role()` = true).

**Ainda em aberto (fora desta rodada):**
- Usuário logado ainda lê todas as colunas de `barbearias` e `profissionais` de barbearias ativas (documento e IDs do Mercado Pago); a solução é separar os dados de cobrança em outra tabela.
- Policy de UPDATE do cliente em `agendamentos` permite alterar qualquer coluna da própria reserva futura.
- Uploads de galeria e produtos não conferem a barbearia do usuário.
- O app do Cliente calcula horários lendo `agendamentos` e `bloqueios_agenda` sob RLS, então não enxerga reservas de outros clientes; o ideal é usar `buscar_horarios_disponiveis`.

## 9. Influenciadores do Barzzo (globais)

Migration `20261024000600_influenciadores_do_barzzo.sql`. Teste em transação (nada persiste), simulando influenciador, cliente, dono e Admin:

- Cadastro com código inválido negado; duplicado negado; cupom nasce `BARZZO_GLOBAL`, sem barbearia, `pendente`, com regras 15% (1 uso por cliente) e 5%; comissão 5%.
- Cupom pendente invisível mesmo com a barbearia aceitando; dono e influenciador não aprovam nem editam (acesso restrito ao Admin); `anon` sem permissão nas RPCs.
- Aprovado: visível só na barbearia que aceitou; em barbearia que não aceitou o uso é negado.
- 1º atendimento: desconto 15,00 e comissão 4,25 (5% de 85,00). 2º atendimento (após 1 concluído): desconto 5,00.
- Conclusão gera a comissão na barbearia que aceitou; o influenciador vê as próprias comissões; o dono vê o influenciador global que gerou comissão nele; o cliente não vê.
- Admin altera descontos (20/10), comissão (8) e desativa; cupom desativado deixa de ser visível. Descontos inválidos negados.
- Corrigido: recursão infinita de policy entre `influenciadores` e `comissoes_influenciadores` (função `SECURITY DEFINER`).
