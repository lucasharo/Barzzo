# Arquitetura de contexto para IAs — Barzzo

## Objetivo

Permitir que diferentes IAs trabalhem no mesmo projeto sem depender de memória de conversa e sem criar versões divergentes das regras.

## Modelo

```text
Git remoto
    |
    | git fetch + comparação/diff
    | somente se houver atualização e for seguro
    v
git pull --ff-only
    |
    v
ARQUIVOS LOCAIS ATUAIS
    |
    +--> AGENTS.md
    +--> STATUS.md
    +--> docs/ e tarefas/
    +--> apps/ e packages/
    +--> supabase/ e testes
    |
    +--------------------+
    |                    |
    v                    v
 INDEXADOR RAG       LEITURA DIRETA
    |                    |
    v                    |
 ÍNDICE LOCAL           |
    |                    |
    +---------+----------+
              v
        IA localiza candidatos
              |
              v
        IA abre arquivos originais
              |
              v
        IA analisa / modifica
```

O mesmo fluxo é usado por Codex/OpenAI, Gemini, Claude, Cursor e GitHub Copilot. Os adaptadores apenas carregam `AGENTS.md`; não existem implementações RAG divergentes por fornecedor.

## Fonte central

`AGENTS.md` é o contrato operacional universal.

Os arquivos locais atuais são a fonte de verdade operacional durante o trabalho. O estado real de um ambiente externo é consultado quando a tarefa exigir. O Git não é memória operacional: é usado para sincronização, versionamento, histórico, colaboração e recuperação de mudanças.

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

## Sincronização e contexto entre sessões

Ao iniciar ou retomar uma sessão, o agente deve:

1. confirmar o repositório, executar `git status` e confirmar a branch;
2. executar `git fetch origin` e comparar o estado local com o remoto;
3. não executar `pull` se não houver atualização remota;
4. executar `git pull --ff-only` somente quando houver atualização e não houver risco ao trabalho local;
5. interromper e informar o usuário diante de alterações locais, divergência ou conflito que impeça o fast-forward;
6. depois da sincronização, trabalhar sobre os arquivos locais;
7. ler `AGENTS.md`, `STATUS.md` e os arquivos relevantes da tarefa.

O histórico Git pode ser consultado para uma investigação histórica específica, mas não deve ser usado por padrão para reconstruir contexto.

## Regra de segurança operacional

Antes de qualquer mudança estrutural, o agente deve estudar a implementação existente.

Esse princípio evita:
- schema duplicado;
- buckets redundantes;
- segunda fonte de verdade;
- mudança desnecessária para uma simples carga de dados;
- divergência entre documentação, código e ambiente remoto.
