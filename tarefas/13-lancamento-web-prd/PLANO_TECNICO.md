# Plano técnico: TASK-13

1. Confirmar organização Supabase PRD e custo do projeto antes de criar recursos faturáveis.
2. Criar projeto Supabase independente, na região aprovada; preservar o Dev `gdgeokfwkbusemayqucb`.
3. Conferir migrations locais, executar o fluxo oficial `supabase db push`, listar migrations aplicadas e verificar schema, RLS, advisors e dados iniciais de planos.
4. Definir `Site URL` e redirects de Auth separados por projeto: localhost na stack local; aliases `*-dev.vercel.app` no Supabase Dev; domínios `barzzo.io` no Supabase PRD. Cadastro e recuperação sempre passam `emailRedirectTo`/`redirectTo` da origem ativa. Os templates de confirmação e recuperação devem usar `{{ .ConfirmationURL }}` para preservar o `redirectTo` sem depender de um domínio fixo no corpo do e-mail.
5. Criar/reutilizar quatro projetos Vercel, cada um com root directory de `apps/landing`, `apps/cliente`, `apps/parceiro` ou `apps/admin`, ligados ao repositório `lucasharo/Barzzo` e produção em `main`.
6. Configurar somente variáveis públicas Supabase nos quatro frontends. Configurar credenciais privadas Supabase/Mercado Pago e `CRON_SECRET` exclusivamente no Parceiro. Revisar os defaults de desenvolvimento e URLs hardcoded antes da promoção; builds Vercel de produção devem falhar se continuarem apontando ao Dev.
7. Associar domínios, aplicar registros DNS sem sobrescrever registros existentes, validar ownership e SSL.
8. Configurar webhook `https://parceiro.barzzo.io/api/webhooks/mercadopago` e verificar agendamentos de cron. Usar sandbox antes de credenciais live e de uma cobrança controlada.
9. Executar todos os gates locais. Fazer smoke de cadastro/login, reserva, recuperação, Admin, assinatura/webhook/crons e isolamento multi-tenant em PRD controlado.
10. Promover somente após a revisão do diff, gates, verificações de Supabase/Vercel/DNS e aprovação dos critérios de aceite; registrar IDs e resultados sem segredos.

## Variáveis previstas

- Todos os apps: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA`.
- Cliente: `VITE_WEB_URL`.
- Parceiro frontend: `VITE_API_BASE_URL`, `VITE_CLIENTE_URL`, `VITE_MERCADO_PAGO_PUBLIC_KEY`.
- Parceiro backend: `SUPABASE_CHAVE_SECRETA`, `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`, `CRON_SECRET`, `MERCADO_PAGO_WEBHOOK_URL`; `CORS_ORIGENS` se a chamada exigir CORS.
- `MERCADO_PAGO_CLIENT_ID` e `MERCADO_PAGO_CLIENT_SECRET` não são requisito enquanto nenhum código consumir essas variáveis.

## Condições para promoção

- A organização e qualquer custo do Supabase foram confirmados.
- O domínio e a gestão DNS estão acessíveis; registros existentes foram inspecionados.
- Os quatro projetos Vercel apontam para a branch `main` e têm variáveis corretas por ambiente.
- Não há fallback de produção apontando ao Supabase Dev, segredo no frontend ou URL produtiva conflitante.
- Todos os gates e smoke tests passam.
