# QA: TASK-13

## Evidência local

- Redirects de autenticação: teste unitário cobre localhost, alias Dev, domínio PRD e bloqueio de destino externo.
- Supabase Dev: CLI `config push` atualizou apenas `auth.site_url` e `auth.additional_redirect_urls`; `config diff` confirmou sem divergências nesses campos.
- Usuários Dev: consulta somente agregada encontrou 36/36 contas com e-mail confirmadas e nenhuma pendente; não houve alteração de conta nem envio de e-mail.
- Supabase Dev: configuração aplicada e relida com `supabase config diff`, sem divergências em `auth.site_url` e `auth.additional_redirect_urls`.
- Templates remotos: edição bloqueada pelo plano Free com provedor padrão. Os formulários enviam `emailRedirectTo`/`redirectTo`; o template padrão documentado do Supabase preserva a URL da solicitação. Se o corpo remoto usar `{{ .SiteURL }}`, é necessária configuração de SMTP personalizado ou upgrade para alterá-lo.

| Gate | Resultado |
|---|---|
| `npm test` | Aprovado: 29 arquivos, 326 testes |
| `npm run lint` | Aprovado: 0 erros; avisos existentes |
| `npm run typecheck` | Aprovado |
| `npm run build` | Aprovado em Admin, Cliente, Landing e Parceiro; avisos de chunk grande em Cliente e Parceiro |
| Guardas Vercel PRD | Aprovadas: as quatro apps recusam build com Supabase Dev/variáveis públicas ausentes |
| Bundle Parceiro | Aprovado: nomes de variáveis privadas do backend não aparecem nos assets JavaScript compilados |
| Segurança do webhook | Testes aprovam HMAC válido, rejeição de assinatura inválida e falha segura quando a chave de produção falta |
| Crons Vercel | JSON válido; dois endpoints agendados diariamente às 12:00 UTC, protegidos por `CRON_SECRET` |

## QA de produção

Pendente. Não há projeto Supabase PRD ou projetos Vercel configurados para este lançamento. Não foram executados testes de domínio, Auth, cobrança, webhook, crons, reserva ou isolamento em PRD.
