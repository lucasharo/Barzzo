# Resultado atual: TASK-13

## Preflight (2026-11-10)

- Repositório em `feature/init`, sincronizado com `origin/feature/init`; existem alterações locais não commitadas da conclusão da Task 12 e foram preservadas.
- `main` local coincide com `origin/main` e está em commit anterior à `feature/init`.
- Equipe Vercel conectada: Hobby, sem projetos Git vinculados e sem domínios na conta.
- `barzzo.io` resolve para `2.57.91.91` e responde HTTP 200 em HTTPS. `cliente.barzzo.io`, `parceiro.barzzo.io` e `admin.barzzo.io` não resolvem no DNS.
- A conta Supabase da organização Lucas Miranda lista o projeto Barzzo Dev `gdgeokfwkbusemayqucb` e não lista um projeto PRD.
- O código tem URLs `.com`/`.vercel.app` hardcoded e defaults de Supabase Dev que precisam ser tratados antes da promoção.
- Corrigidos em preparação: o Vite agora serializa apenas variáveis `VITE_*` e `NEXT_PUBLIC_*`; builds Vercel PRD falham se faltarem valores públicos ou se o Supabase ainda for o Dev; URLs de Landing, Cliente e Parceiro alinham-se a `barzzo.io`; os dois fluxos de pagamento usam o webhook do Parceiro, que valida HMAC; o Parceiro agenda ambos os crons diariamente às 12:00 UTC; falha ou pagamento não aprovado no Mercado Pago não ativa assinatura em produção.
- Não foi feita alteração em infraestrutura externa nem promoção de branch.

## Auth por ambiente (2026-11-13)

- Cadastro do Cliente passou a enviar `emailRedirectTo`, alinhado ao cadastro do Parceiro. Cadastro e recuperação nos dois apps usam a origem atual no navegador; no app nativo usam a URL web configurada para o mesmo ambiente.
- A função comum `urlRedirectAutenticacao` também rejeita destinos que tentem sair da origem do app.
- `supabase/config.toml` local usa localhost, exige confirmação de cadastro e permite os ports 3000 a 3003; os templates locais de confirmação e recuperação usam `{{ .ConfirmationURL }}`.
- Supabase Dev `gdgeokfwkbusemayqucb`: `Site URL` alterada de localhost para `https://barzzo-landing-dev.vercel.app`; allowlist recebeu localhost e os quatro aliases `*-dev.vercel.app`.
- Auditoria de usuários no Supabase Dev: 36 contas com e-mail, 36 confirmadas e zero pendentes (`email_confirmed_at IS NULL`). Nenhuma conta foi alterada.
- O CLI recusou publicar templates customizados porque o projeto está no plano Free com provedor de e-mail padrão. As configurações de Site URL e redirects foram aplicadas separadamente. O projeto remoto permanece com seus templates atuais; os fluxos enviam explicitamente os redirects. O template padrão do Supabase usa `{{ .ConfirmationURL }}`; se o corpo atual tiver sido customizado para usar `{{ .SiteURL }}`, será necessário habilitar SMTP personalizado ou um plano que permita a edição de templates.
- Supabase PRD ainda não existe; quando criado, configurar `Site URL=https://barzzo.io` e allowlist com os quatro domínios PRD, além dos caminhos de Auth.

## Gates locais executados

- `npm test`: passou após as alterações de Auth, 29 arquivos e 326 testes.
- `npm run lint`: passou, 0 erros; avisos existentes.
- `npm run typecheck`: passou em todos os workspaces.
- `npm run build`: passou em todos os workspaces. Cliente e Parceiro emitem aviso de chunk maior que 500 kB.
- Builds de segurança das quatro apps foram executadas com `VERCEL_ENV=production` sem env PRD e falharam como esperado.
- Inspeção dos bundles compilados do Parceiro não encontrou nomes de variáveis privadas do backend.
- `apps/parceiro/vercel.json` validado como JSON; configuração contém os dois crons diários às 12:00 UTC.

## Dependências pendentes

- Confirmar a organização Supabase Lucas Miranda para consultar o custo; aceitar o custo cotado antes de criar o novo projeto PRD.
- Provisionar o Supabase PRD, configurar Auth e aplicar/verificar migrations.
- Associar o repositório às quatro aplicações Vercel e configurar domínios, variáveis, DNS e SSL.
- Confirmar o acesso ao provedor DNS do domínio.
- Revisar URLs/defaults do código para que cada ambiente mantenha os destinos apropriados.
- Configurar e testar Mercado Pago, webhook, crons e os fluxos de QA em PRD.
