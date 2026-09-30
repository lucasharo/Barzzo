# Barzzo

SaaS + marketplace para barbearias.

## Para agentes de IA

A entrada universal do projeto é [AGENTS.md](AGENTS.md).

Qualquer IA deve começar por ele e reconstruir o contexto a partir do repositório, não da memória da conversa.

Adaptadores disponíveis:

- Gemini: [GEMINI.md](GEMINI.md) + `.gemini/settings.json`;
- Claude: [CLAUDE.md](CLAUDE.md);
- Codex/OpenAI: `AGENTS.md`;
- GitHub Copilot: `.github/copilot-instructions.md`;
- Cursor: `AGENTS.md` + `.cursor/rules/barzzo.mdc`;
- outras IAs: [PROMPT_INICIAL_IA.md](PROMPT_INICIAL_IA.md).

A arquitetura de contexto está documentada em [docs/ia/arquitetura_contexto.md](docs/ia/arquitetura_contexto.md).

Depois do contrato universal, siga [REGRAS_GERAIS.md](REGRAS_GERAIS.md), [AGENTES.md](AGENTES.md), [WORKFLOW.md](WORKFLOW.md) e [STATUS.md](STATUS.md).

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

Fluxo de branches:
- `feature/*`: desenvolvimento;
- `release/*`: homologação/estabilização;
- `main`: somente produção.
