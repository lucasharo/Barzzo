# Barzzo

SaaS + marketplace para barbearias.

## Para agentes

Comece por [GEMINI.md](GEMINI.md). Depois siga [REGRAS_GERAIS.md](REGRAS_GERAIS.md), [AGENTES.md](AGENTES.md), [WORKFLOW.md](WORKFLOW.md) e [STATUS.md](STATUS.md).

O desenvolvimento é dividido em 10 tasks sequenciais em `tarefas/`, também representadas pelas issues #1 a #10.

## Stack definida

- Next.js + React + TypeScript
- Tailwind CSS + shadcn/ui
- PWA primeiro
- Supabase: PostgreSQL, Auth e Storage
- Firebase Cloud Messaging somente para push
- PostGIS para proximidade
- Vercel inicialmente
- Capacitor preparado para fase futura

## Regras importantes

- domínio, banco, rotas e telas em português;
- RLS e multi-tenant obrigatórios;
- imagens no Supabase Storage e sempre redimensionadas;
- cliente navega até o resumo da reserva sem login;
- pagamento de serviços não passa pelo Barzzo no MVP;
- ui-ux-pro-max obrigatório nas interfaces.

Branch de preparação: `feature/init`.
