# Workflow

## Estados
PENDENTE, EM_REFINAMENTO, PRONTA_PARA_DESENVOLVIMENTO, EM_DESENVOLVIMENTO, EM_REVISAO_TECNICA, EM_QA, REPROVADA_QA, AGUARDANDO_ACEITE_PO, CONCLUIDA, BLOQUEADA_POR_DECISAO.

Somente uma task ativa por vez.

## Gate PO
Confirma requisitos e critérios. Se faltar decisão: BLOQUEADA_POR_DECISAO.

## Gate Líder
Cria PLANO_TECNICO.md com banco, migrations, RLS, índices, módulos, APIs/RPC, segurança, UX e estratégia de testes.

## Gate Dev
Implementa e cria RESULTADO.md. Antes de revisão:
- build OK;
- lint OK;
- typecheck OK;
- testes OK;
- migrations reproduzíveis;
- nenhum segredo versionado.

## Gate Revisão Técnica
Líder verifica arquitetura, tipagem, duplicação, banco, RLS, índices, concorrência, erros e impacto futuro. Falhou -> Dev.

## Gate QA
Cria QA.md e testa funcional, integração, RLS, regressão, erros, responsividade, acessibilidade e ux-pro-max. Falhou -> Dev -> revisão -> QA.

## Gate PO final
Confere critérios de aceite. Só então CONCLUIDA.

## Loop
Enquanto houver task não concluída:
1. ler STATUS.md;
2. executar agente do estado atual;
3. atualizar artefatos;
4. atualizar STATUS.md;
5. avançar gate;
6. em falha, retornar e repetir;
7. iniciar próxima task apenas após CONCLUIDA.

## Bloqueios legítimos
Credencial indispensável ausente, decisão funcional ausente, risco de perda de dados, serviço essencial indisponível ou mudança arquitetural que invalide decisão aprovada. Bugs normais entram no loop.

## Git
Base inicial: feature/init.
Commits pequenos: feat:, fix:, test:, refactor:, docs:, chore:.
