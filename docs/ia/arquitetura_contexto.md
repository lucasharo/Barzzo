# Arquitetura de contexto para IAs — Barzzo

## Objetivo

Permitir que diferentes IAs trabalhem no mesmo projeto sem depender de memória de conversa e sem criar versões divergentes das regras.

## Modelo

```text
                 AGENTS.md
                    |
      +-------------+-------------+
      |             |             |
  GEMINI.md     CLAUDE.md     Copilot/Cursor
      |             |             |
      +-------------+-------------+
                    |
       REGRAS_GERAIS / AGENTES
          WORKFLOW / STATUS
                    |
           docs + tarefas
                    |
      código + migrations + testes
```

## Fonte central

`AGENTS.md` é o contrato operacional universal.

Os arquivos específicos de fornecedor são adaptadores. Eles não devem conter regras de negócio ou arquitetura próprias.

## Suporte configurado

### Codex / OpenAI

Usa `AGENTS.md` diretamente.

### Cursor

Usa `AGENTS.md` e a rule `.cursor/rules/barzzo.mdc`.

### Gemini CLI

`.gemini/settings.json` carrega `AGENTS.md` e `GEMINI.md`.

### Claude

`CLAUDE.md` direciona o agente para `AGENTS.md`.

### GitHub Copilot

`.github/copilot-instructions.md` referencia `AGENTS.md`.

### Outras IAs

Use `PROMPT_INICIAL_IA.md` como bootstrap manual.

## Como adicionar outra IA

Não copie todo o conteúdo de `AGENTS.md`.

Crie apenas um arquivo de adaptação que diga:
1. onde a ferramenta busca instruções;
2. que ela deve ler `AGENTS.md`;
3. como recarregar contexto, se a ferramenta oferecer esse recurso.

## Persistência de contexto

A IA deve salvar apenas conhecimento persistente em arquivos versionados.

O que deve persistir:
- decisões;
- contratos;
- migrations;
- APIs/RPCs;
- regras;
- testes;
- limitações;
- estado da tarefa.

O que não deve persistir como verdade:
- debugging temporário;
- hipótese rejeitada;
- tentativa que falhou;
- conclusão baseada apenas na conversa.

## Regra de segurança operacional

Antes de qualquer mudança estrutural, o agente deve estudar a implementação existente.

Esse princípio evita:
- schema duplicado;
- buckets redundantes;
- segunda fonte de verdade;
- mudança desnecessária para uma simples carga de dados;
- divergência entre documentação, código e ambiente remoto.
