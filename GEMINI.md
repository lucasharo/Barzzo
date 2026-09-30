# Adaptador Gemini — Barzzo

Este arquivo contém apenas instruções específicas de inicialização do Gemini.

A fonte universal de regras para agentes é **`AGENTS.md`**.

## Inicialização

O Gemini CLI está configurado em `.gemini/settings.json` para carregar:

- `AGENTS.md`;
- `GEMINI.md`.

Ao iniciar, retomar ou compactar uma sessão:

1. confirme que `AGENTS.md` foi carregado;
2. leia `STATUS.md`;
3. siga a ordem de leitura obrigatória definida em `AGENTS.md`;
4. não dependa da memória da conversa anterior.

Quando disponível, use `/memory reload` após mudanças relevantes nas instruções e `/memory show` para conferir o contexto carregado.

## Skill de UI

A skill oficial está em:

`.agents/skills/ui-ux-pro-max/SKILL.md`

Use-a conforme `AGENTS.md` e `docs/design/design_system.md`.

## Regra de manutenção

Não adicione aqui regras de produto, banco, arquitetura, segurança ou workflow que devam valer para outras IAs.

Se uma regra é universal, altere `AGENTS.md` ou o documento de domínio correspondente.
