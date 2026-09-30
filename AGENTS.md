# AGENTS.md — Contrato universal de agentes do Barzzo

Este arquivo é a **porta de entrada oficial para qualquer IA ou agente de desenvolvimento** que trabalhe no Barzzo.

As regras permanentes do projeto não pertencem a Gemini, Claude, Codex, Copilot, Cursor ou qualquer outro fornecedor. Arquivos específicos de ferramenta devem apenas adaptar o agente a este contrato e **nunca duplicar regras de negócio ou arquitetura**.

## 1. Fonte de verdade

Não use memória de conversa como fonte principal.

A fonte de verdade do Barzzo é, nesta ordem de responsabilidade:

1. código versionado;
2. migrations versionadas;
3. testes versionados;
4. documentação versionada;
5. `STATUS.md`;
6. issues e histórico Git.

Para o estado de um ambiente já implantado:
- migrations representam o estado **reproduzível/intencional** do schema;
- introspecção do Supabase representa o estado **real atual** do ambiente;
- se houver divergência, trate como drift e investigue antes de alterar qualquer coisa.

Nunca transforme uma lembrança da conversa em fato quando o repositório ou o ambiente puderem ser consultados.

## 2. Leitura obrigatória ao iniciar ou retomar trabalho

Antes de implementar, corrigir, migrar banco ou afirmar o estado atual do projeto, leia:

1. `AGENTS.md`;
2. `REGRAS_GERAIS.md`;
3. `AGENTES.md`;
4. `WORKFLOW.md`;
5. `STATUS.md`;
6. documentação relevante em `docs/produto/*`;
7. documentação relevante em `docs/arquitetura/*`;
8. `docs/design/design_system.md` quando houver UI;
9. `TASK.md` da tarefa atual, quando existir;
10. código, migrations e testes que a tarefa reutiliza ou altera.

Se a sessão foi compactada, reiniciada ou transferida para outra IA, repita esta leitura.

## 3. Regra obrigatória: investigar antes de alterar

Antes de criar tabela, coluna, bucket, RPC, endpoint, componente estrutural ou regra nova:

1. pesquise se a estrutura já existe;
2. leia migrations relacionadas;
3. leia tipos e domínio relacionados;
4. leia a UI/serviço que já executa o fluxo;
5. consulte o schema remoto se a tarefa depender do estado atual do Supabase;
6. só então proponha ou implemente a mudança.

É proibido criar uma estrutura paralela apenas porque ela parece mais simples.

Exemplo de princípio:
- se uma foto de capa já é representada por `galeria_fotos.destaque_capa`, não crie uma segunda fonte de verdade em `barbearias`;
- se uma tarefa é apenas carga/seed de dados, não altere schema para realizá-la;
- se o usuário pediu apenas análise, parecer ou leitura, não modifique arquivos, banco ou serviços.

Quando houver dúvida entre reutilizar algo existente e criar algo novo, investigue primeiro.

## 4. Arquitetura das aplicações

Respeite `docs/arquitetura/separacao_aplicacoes.md`.

O repositório possui aplicações fisicamente separadas:

- `apps/cliente`;
- `apps/parceiro`;
- `apps/admin`;
- `apps/landing` quando aplicável ao site público/SEO.

Cliente, Parceiro e Admin não devem virar apenas grupos de rotas de um único app.

Regras:
- apps não importam telas entre si;
- compartilhamento ocorre via `packages/*`;
- todos usam o mesmo backend Supabase;
- autorização real vive no backend/RLS, nunca só na UI;
- Cliente mantém navegação pública até o resumo do agendamento;
- autenticação do Cliente ocorre antes da confirmação definitiva;
- Parceiro exige autenticação para áreas operacionais;
- Admin é aplicação separada.

## 5. Papéis dos agentes

Os papéis oficiais estão em `AGENTES.md`:

`PO -> Líder Técnico -> Dev -> Revisão Técnica -> QA -> PO final`

Nenhuma IA deve pular gates porque "já entendeu" a tarefa.

Se faltar decisão de produto, use `BLOQUEADA_POR_DECISAO`.
Se for decisão técnica interna compatível com as regras existentes, o Líder Técnico pode decidir e deve documentar.

## 6. Persistência de contexto

Ao concluir uma tarefa ou bloco relevante:

1. consolide decisões persistentes em arquivos versionados;
2. atualize os artefatos da task;
3. registre migrations, tabelas, RPCs, APIs, rotas e contratos relevantes;
4. registre testes e limitações conhecidas;
5. atualize `STATUS.md` quando o estado da tarefa mudar;
6. descarte debugging temporário e hipóteses rejeitadas;
7. trate a próxima tarefa como uma nova sessão;
8. releia a fonte de verdade.

O objetivo é permitir que outra IA continue o trabalho sem depender da conversa anterior.

## 7. Artefatos por tarefa

Quando houver task formal, mantenha:

- `TASK.md`;
- `PLANO_TECNICO.md`;
- `RESULTADO.md`;
- `QA.md`.

Antes de revisão técnica, verifique:
- build;
- lint;
- typecheck;
- testes;
- migrations reproduzíveis;
- ausência de segredos versionados.

## 8. Banco de dados e Supabase

Projeto Supabase do Barzzo: `gdgeokfwkbusemayqucb`.

Para alterações estruturais:
1. inspecione migrations existentes;
2. crie migration em `supabase/migrations/<timestamp>_<descricao>.sql`;
3. aplique pelo fluxo oficial do projeto;
4. valide o schema remoto;
5. valide RLS e isolamento multi-tenant;
6. mantenha a migration versionada no mesmo ciclo da implementação.

Fluxo CLI esperado quando aplicável:

```bash
npx supabase db push --project-ref gdgeokfwkbusemayqucb
npx supabase migration list --project-ref gdgeokfwkbusemayqucb
```

Nunca:
- exponha secret/service key no frontend;
- desative RLS para contornar erro;
- use autorização baseada apenas em estado visual;
- modifique schema para resolver uma simples carga de dados;
- aplique DDL sem antes entender a modelagem existente.

### Storage

Supabase Storage é o armazenamento oficial de imagens.

Antes de criar bucket novo, confira os buckets e fluxos existentes.
Banco guarda caminho/URL, não bytes.

## 9. Segurança

Regras críticas:
- RLS obrigatório nas tabelas expostas;
- multi-tenant obrigatório;
- autorização por vínculo/contexto;
- não confiar em metadata editável pelo usuário para privilégio administrativo;
- operações críticas no backend/banco;
- concorrência de agendamento protegida no banco;
- webhooks e pagamentos devem ser autenticados/validados conforme o provedor;
- nenhum segredo real no Git.

## 10. UX/UI

A skill oficial é:

`.agents/skills/ui-ux-pro-max/SKILL.md`

Para qualquer implementação visual relevante:
1. leia/use `ui-ux-pro-max` antes de implementar;
2. siga `docs/design/design_system.md`;
3. revise novamente no QA;
4. valide mobile-first, touch, responsividade, acessibilidade e estados de loading/vazio/erro/sucesso.

Não crie novos tokens visuais sem decisão documentada.

## 11. Idioma

Interface final: 100% pt-BR.

Código de domínio, banco, variáveis de negócio e documentação: português sem acentos em identificadores técnicos quando necessário.

Erros de SDKs/infraestrutura devem ser traduzidos antes de aparecer ao usuário. Use o tradutor central `traduzirErro` quando aplicável.

## 12. Git e ambientes

Fluxo oficial:

- `feature/*`: desenvolvimento ativo;
- `release/*`: estabilização/homologação;
- `main`: somente produção.

Não trate `main` como branch de desenvolvimento.
Não promova para `main` sem solicitação explícita de produção.

Commits:
- `feat:`
- `fix:`
- `test:`
- `refactor:`
- `docs:`
- `chore:`

## 13. Escopo e mudanças

Implemente somente o que foi pedido ou o que for estritamente necessário para fazê-lo corretamente.

Não:
- invente feature;
- crie botão de simulação para esconder integração quebrada;
- faça refactor lateral sem necessidade;
- altere arquitetura aprovada silenciosamente;
- apague dados ou artefatos irreversíveis sem autorização;
- corrija "por oportunidade" algo fora do escopo sem registrar.

Se detectar um problema fora do escopo, reporte-o separadamente.

## 14. Verificação antes de concluir

Antes de afirmar "feito", verifique evidência real.

Para código:
- arquivo existe;
- build/testes relevantes passam;
- comportamento foi validado quando possível.

Para banco:
- objeto/registro existe no ambiente correto;
- contagem/estado final confere;
- não deixou permissão temporária ou função insegura ativa.

Para Git:
- confirme branch e commit reais.

Nunca confunda plano, documentação ou intenção com implementação executada.

## 15. Adaptadores de IA

Arquivos específicos existem apenas para inicialização automática:

- Gemini: `GEMINI.md` + `.gemini/settings.json`;
- Claude: `CLAUDE.md`;
- GitHub Copilot: `.github/copilot-instructions.md`;
- Cursor: `AGENTS.md` e `.cursor/rules/barzzo.mdc`;
- Codex/OpenAI: `AGENTS.md`;
- outras IAs: use `PROMPT_INICIAL_IA.md`.

Se adicionar suporte a uma nova IA:
1. crie um adaptador mínimo;
2. faça-o apontar para `AGENTS.md`;
3. não copie regras de produto/arquitetura para o adaptador.

**Regra final:** se houver conflito entre um adaptador específico e este arquivo, `AGENTS.md` representa o contrato de projeto mais atual, exceto por instruções superiores do usuário/sistema da ferramenta.
