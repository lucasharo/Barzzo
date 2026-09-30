# RAG local híbrido — Barzzo

## Objetivo

O RAG local ajuda Codex, Gemini, Claude, Cursor, Copilot e outras IAs a localizar rapidamente arquivos relevantes no Barzzo. Ele é infraestrutura de desenvolvimento, não funcionalidade dos apps Cliente, Parceiro, Admin ou Landing.

## Fonte da verdade

Os arquivos locais atuais continuam sendo a fonte de verdade operacional. O índice RAG é derivado, descartável e reconstruível. Um resultado recuperado é apenas um candidato: antes de decidir, a IA deve abrir o arquivo original e ler o contexto completo.

```text
arquivos locais
      |
      +--> indexador incremental
      |       +--> chunks estruturados
      |       +--> hashes/metadados
      |       +--> índice lexical
      |       +--> embeddings locais quando disponíveis
      |
      v
índice em .barzzo/rag/ (não versionado)
      |
      v
retriever híbrido
      +--> lexical/BM25 simplificado
      +--> semântico por embedding local
      +--> caminho, heading e símbolo
      |
      v
IA localiza -> abre fonte original -> analisa -> modifica
```

O Git continua limitado a sincronização, versionamento, histórico, colaboração e recuperação. O RAG não consulta GitHub nem outro repositório remoto.

## Localização e comandos

A implementação fica em `tools/rag/`, fora dos workspaces das aplicações. O índice é salvo em `.barzzo/rag/` e está no `.gitignore`.

```bash
npm run rag:index
npm run rag:rebuild
npm run rag:query -- "como funciona a foto de capa da barbearia?"
node tools/rag/cli.mjs query --top-k 5 -- "agendamento qualquer profissional"
node tools/rag/cli.mjs query --json -- "onde a autorização de gerente é definida?"
```

`rag:index` é incremental. `rag:rebuild` recria todo o índice a partir dos arquivos locais. A consulta retorna caminho, linhas, heading/símbolo, score e um trecho curto; `--json` retorna um formato adequado para automação por agentes.

## Arquivos indexados

São indexados arquivos textuais relevantes de `apps/`, `packages/`, `supabase/`, `docs/`, `tarefas/`, `tests/`, além dos contratos e configurações textuais do projeto. Markdown, TypeScript/JavaScript e SQL têm chunking estruturado.

São excluídos `.agents` (skills auxiliares locais), `.git`, `node_modules`, `.next`, `dist`, `build`, caches, coverage, binários, imagens, vídeos, fontes, locks gerados, `test-results.json`, índice anterior e qualquer `.env`, `.env.*`, `local.env` ou arquivo de segredo. Arquivos maiores que 1,5 MB também não entram no índice.

## Chunking e metadados

- Markdown/texto: preâmbulo e seções por heading;
- TypeScript/JavaScript: exports, funções, classes, tipos e constantes, com fallback por linhas;
- SQL: blocos de migration, `CREATE`, `ALTER`, `FUNCTION`, `POLICY`, `INDEX`, RPC e comandos relacionados;
- demais arquivos: janelas de linhas com sobreposição pequena.

Cada chunk guarda caminho, linhas inicial/final, extensão, tipo, conteúdo, hash do arquivo, hash do chunk e heading/símbolo quando detectável. O índice também mantém frequências de termos e metadados dos embeddings.

## Indexação incremental

O manifest compara SHA-256 dos arquivos locais. Arquivos sem mudança reutilizam seus chunks e embeddings; arquivos novos ou alterados são processados novamente; arquivos removidos deixam de aparecer no índice. O rebuild completo pode apagar e recriar o índice sem perda de informação, porque nenhuma fonte é armazenada somente no RAG.

## Embeddings locais

O provider padrão usa `@huggingface/transformers` em Node e o modelo pequeno `Xenova/all-MiniLM-L6-v2`. A primeira execução pode baixar o modelo para `.barzzo/rag/models`; depois o modelo é reutilizado localmente. O código do projeto não é enviado para uma API de embeddings.

Não há API key nem serviço SaaS obrigatório. Se o pacote, modelo ou runtime local não estiverem disponíveis, o indexador e o retriever continuam com busca lexical e emitem um aviso explícito. Para forçar esse modo:

```bash
set RAG_DISABLE_SEMANTIC=1 && npm run rag:index
```

No PowerShell:

```powershell
$env:RAG_DISABLE_SEMANTIC = "1"
npm run rag:index
```

O modelo pode ser substituído para uma instalação local compatível com `RAG_EMBEDDING_MODEL`, mas o provider deve continuar local e não pode enviar arquivos do projeto a serviços externos.

## Score híbrido

O retriever combina, de forma determinística:

- relevância lexical com frequência e raridade dos termos;
- similaridade de cosseno dos embeddings quando disponíveis;
- coincidência em caminho/arquivo;
- coincidência em heading ou símbolo;
- pequena prioridade para contratos, status, docs e tarefas centrais.

Quando embeddings não estão disponíveis, o peso semântico é removido e a resposta informa o fallback lexical. O sistema nunca declara que uma busca semântica ocorreu quando ela não ocorreu.

## Uso pelos agentes

1. sincronize conforme `AGENTS.md`;
2. rode `npm run rag:index` depois de qualquer pull bem-sucedido ou mudança local relevante;
3. consulte o RAG para localizar conceitos equivalentes;
4. abra os arquivos originais retornados;
5. leia migrations, tipos/domínio, UI/serviços e testes completos;
6. só então decida se deve reutilizar ou criar algo.

O RAG não substitui `AGENTS.md`, `STATUS.md`, documentação, código, migrations, testes ou introspecção do ambiente real.

## Segurança e troubleshooting

- o diretório `.barzzo/rag/` não deve ser commitado;
- segredos não são indexados nem armazenados em embeddings;
- o conteúdo recuperado nunca é executado como código;
- não há conexão com Supabase, GitHub, Pinecone, Qdrant, OpenAI Vector Store ou Gemini File Search;
- se o índice estiver corrompido, remova `.barzzo/rag/` e rode `npm run rag:rebuild`;
- se a memória estiver alta, use `--no-semantic` ou `RAG_DISABLE_SEMANTIC=1`;
- se `onnxruntime-node` falhar ao inicializar uma DLL no Windows, mantenha o fallback lexical ou corrija o runtime nativo local antes de tentar novamente;
- se a busca não localizar algo, confirme que o arquivo é textual/indexável e abra a fonte diretamente.

Para adicionar um tipo de arquivo, atualize a lista de extensões e a estratégia de chunking em `tools/rag/rag.mjs`, acrescente testes e documente a exclusão de qualquer formato sensível ou binário.
