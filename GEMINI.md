# Instruções para o Gemini

Este repositório é a fonte de verdade do Barzzo.

## Leitura obrigatória
1. REGRAS_GERAIS.md
2. AGENTES.md
3. WORKFLOW.md
4. STATUS.md
5. docs/produto/produto.md
6. docs/arquitetura/*
7. docs/design/design_system.md
8. TASK.md da task atual

## Execução
Execute as 10 tasks em ordem. Cada task passa por:
PO -> Líder Técnico -> Dev -> Revisão Técnica -> QA -> PO.

Se houver reprovação, corrija e repita o ciclo. Só avance quando a task anterior estiver CONCLUIDA.

Nunca invente regra de negócio. Se uma decisão necessária não estiver documentada, marque BLOQUEADA_POR_DECISAO em STATUS.md.

## UX
Toda task com interface exige uso da skill `ui-ux-pro-max` antes da implementação e novamente na revisão de QA. Se ela não estiver instalada no ambiente, deve ser baixada/instalada antes de iniciar trabalho de UI. Não substituir por outra skill sem decisão explícita. Registre decisões relevantes de UX.

A implementação visual deve obedecer integralmente `docs/design/design_system.md`. Não criar cores, tipografias ou variantes visuais fora dos tokens documentados sem decisão explícita de produto/design.

## Idioma
Código de domínio, banco, variáveis, rotas, telas e documentação em português. Identificadores técnicos sem acentos.

## Segurança
Nunca grave segredos. Nunca exponha chave secreta no frontend. Nunca desative RLS para contornar erro.

## Resultado
Ao fim da Task 10, o MVP deve estar funcional, testado, responsivo, seguro e pronto para homologação.


## Protocolo entre tasks

Ao concluir cada task, antes de iniciar a próxima, é obrigatório:

1. consolidar decisões, implementação e testes nos arquivos versionados;
2. compactar o contexto, descartando debugging e hipóteses temporárias;
3. tratar a próxima task como uma nova sessão;
4. reler STATUS.md, GEMINI.md, REGRAS_GERAIS.md, AGENTES.md, WORKFLOW.md e a documentação relevante;
5. ler a nova TASK.md e inspecionar o código produzido que ela reutiliza;
6. nunca depender apenas da memória acumulada da conversa.

O procedimento completo está em `PROMPT_INICIAL_GEMINI.md`.
