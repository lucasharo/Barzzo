#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import {
  buildIndex,
  createLocalEmbeddingProvider,
  indexDirectory,
  loadIndexMetadata,
  queryIndex,
} from "./rag.mjs";

const root = path.resolve(process.env.RAG_ROOT || process.cwd());
const defaultIndexDir = indexDirectory(root);

function optionValue(args, name, fallback = undefined) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  return args[index + 1] ?? fallback;
}

function hasOption(args, name) {
  return args.includes(name);
}

function queryArgument(args) {
  const values = [];
  const optionsWithValues = new Set(["--top-k", "--index-dir"]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") continue;
    if (optionsWithValues.has(arg)) {
      index += 1;
      continue;
    }
    if (arg === "--json" || arg === "--no-semantic" || arg === "--help" || arg.startsWith("--top-k=") || arg.startsWith("--index-dir=")) {
      continue;
    }
    if (!arg.startsWith("--")) values.push(arg);
  }
  return values.join(" ").trim();
}

function printHelp() {
  console.log(`Uso:
  npm run rag:index
  npm run rag:rebuild
  npm run rag:query -- "consulta" [--top-k 8]
  npm run rag:query -- --json "consulta"

Opções:
  --top-k N       quantidade máxima de resultados (padrão: 8)
  --json          saída estruturada para agentes
  --index-dir DIR diretório alternativo do índice local
  --no-semantic   não carregar o modelo local de embeddings`);
}

function printHumanResult(response) {
  if (response.notices.length) {
    for (const notice of response.notices) console.warn(`Aviso: ${notice}`);
  }
  console.log(`Consulta: ${response.query}`);
  console.log(`Busca semântica: ${response.semanticUsed ? "ativa" : "indisponível/fallback lexical"}`);
  if (!response.results.length) {
    console.log("Nenhum trecho relevante encontrado.");
    return;
  }

  response.results.forEach((result, index) => {
    const location = `${result.path}:${result.startLine}-${result.endLine}`;
    const metadata = [result.heading, result.symbol].filter(Boolean).join(" · ");
    console.log(`\n${index + 1}. ${location}`);
    if (metadata) console.log(`   ${metadata}`);
    console.log(`   score: ${result.score.toFixed(4)}`);
    console.log(`   ${result.snippet.replace(/\s+/g, " ").trim()}`);
  });
}

async function semanticProvider(indexDir, noSemantic) {
  if (noSemantic) {
    process.env.RAG_DISABLE_SEMANTIC = "1";
  }
  return createLocalEmbeddingProvider({ cacheDir: path.join(indexDir, "models") });
}

async function runIndex({ rebuild, args }) {
  const indexDir = optionValue(args, "--index-dir", defaultIndexDir);
  const semantic = await semanticProvider(indexDir, hasOption(args, "--no-semantic"));
  const summary = await buildIndex({
    root,
    indexDir,
    embeddingProvider: semantic.provider,
    disableSemantic: hasOption(args, "--no-semantic"),
    force: rebuild,
  });

  console.log(`${rebuild ? "Rebuild" : "Indexação incremental"} concluída.`);
  console.log(`Arquivos: ${summary.files} | chunks: ${summary.chunks}`);
  console.log(`Novos: ${summary.indexedFiles} | alterados: ${summary.changedFiles} | reaproveitados: ${summary.reusedFiles} | removidos: ${summary.removedFiles}`);
  console.log(`Embeddings locais: ${summary.embeddedChunks}`);
  if (semantic.notice) console.warn(`Aviso: ${semantic.notice}`);
  if (summary.semanticNotice) console.warn(`Aviso: ${summary.semanticNotice}`);
}

async function runQuery(args) {
  const indexDir = optionValue(args, "--index-dir", defaultIndexDir);
  const query = queryArgument(args);
  const topK = optionValue(args, "--top-k", "8");
  const semantic = await semanticProvider(indexDir, hasOption(args, "--no-semantic"));
  const response = await queryIndex({
    indexDir,
    query,
    topK,
    embeddingProvider: semantic.provider,
  });
  if (hasOption(args, "--json")) {
    console.log(JSON.stringify(response, null, 2));
  } else {
    if (semantic.notice) response.notices.unshift(semantic.notice);
    printHumanResult(response);
  }
}

async function run() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "help" || hasOption(args, "--help")) {
    printHelp();
    return;
  }

  if (command === "index" || command === "rebuild") {
    await runIndex({ rebuild: command === "rebuild", args });
    return;
  }
  if (command === "query") {
    await runQuery(args);
    return;
  }

  throw new Error(`Comando RAG desconhecido: ${command}`);
}

run().catch((error) => {
  console.error(`Erro no RAG: ${error.message}`);
  process.exitCode = 1;
});
