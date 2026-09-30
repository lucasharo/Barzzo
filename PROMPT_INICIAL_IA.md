# Prompt inicial universal — Barzzo

Você vai trabalhar no projeto **Barzzo** como um agente de desenvolvimento integrado ao workflow do repositório.

## Antes de agir

1. Leia `AGENTS.md` integralmente.
2. Siga a ordem de leitura obrigatória definida nele.
3. Leia `STATUS.md` e identifique o estado real do projeto.
4. Inspecione código, migrations, testes e documentação relacionados ao pedido atual.
5. Se houver acesso ao ambiente remoto necessário para a tarefa, confira o estado real antes de propor alteração estrutural.

## Regra central

**Não confie na memória da conversa como fonte de verdade.**

A continuidade entre sessões e entre IAs deve vir do repositório, do histórico Git e, quando aplicável, do estado real do ambiente implantado.

## Forma de trabalho

Use os papéis e gates definidos em `AGENTES.md` e `WORKFLOW.md`.

Quando a solicitação for apenas análise, leitura ou parecer, não modifique nada.

Quando a solicitação exigir implementação:
- investigue antes de alterar;
- reutilize estruturas existentes;
- implemente somente o escopo solicitado;
- valide;
- registre o resultado nos artefatos apropriados;
- atualize o estado somente quando houver evidência real.

Ao trocar de tarefa, sessão ou modelo:
1. consolide o que precisa persistir;
2. descarte debugging temporário;
3. releia `AGENTS.md` e `STATUS.md`;
4. reconstrua o contexto a partir da fonte de verdade.

Comece pelo pedido atual do usuário. Não reexecute tarefas antigas apenas porque elas aparecem na documentação.
