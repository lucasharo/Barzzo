# TASK-13: Lançamento web em Produção

## Objetivo

Publicar Landing, Cliente, Parceiro e Admin em Vercel ligados à branch `main`, com domínios `barzzo.io`, `cliente.barzzo.io`, `parceiro.barzzo.io` e `admin.barzzo.io`, usando um projeto Supabase PRD separado do Dev.

## Escopo

- Criar e configurar o projeto Supabase PRD, aplicar as migrations oficiais e revisar RLS, advisors, Auth e planos iniciais.
- Configurar quatro projetos Vercel com `main` como branch de produção e variáveis separadas por aplicação.
- Associar e validar domínios, DNS e SSL.
- Configurar Mercado Pago do Parceiro, webhook com assinatura HMAC e crons; validar em sandbox e fazer uma cobrança controlada antes da ativação comercial.
- Garantir que a compilação do Parceiro não exponha segredos do backend no bundle e que falhas de pagamento não ativem assinatura em produção.
- Rodar `npm test`, `npm run lint`, `npm run typecheck` e `npm run build`; validar fluxos e isolamento multi-tenant.
- Registrar IDs e evidências sem salvar segredos em arquivos versionados.

## Fora do escopo

- Publicação Android ou em lojas.

## Critérios de aceite

- As quatro aplicações abrem nos domínios definidos com HTTPS.
- Todos apontam para o Supabase PRD e Auth redireciona corretamente.
- Parceiro processa assinatura, webhook e crons com credenciais de produção configuradas com segurança.
- Gates e fluxos de QA passam, incluindo reserva, recuperação de senha, Admin e isolamento entre barbearias.
- A branch de produção é `main`; IDs e evidências não contêm segredos.

## Estado

BLOQUEADA_POR_DECISAO. A confirmação da organização Supabase é necessária para consultar o custo do novo projeto; dependências externas em `RESULTADO.md`.
