import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const INDEX_VERSION = 1;
export const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";
const DEFAULT_MAX_LINES = 80;
const DEFAULT_OVERLAP_LINES = 8;
const INDEX_FILE = "index.json";

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".jsx",
  ".json",
  ".md",
  ".mdc",
  ".mjs",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

const EXCLUDED_DIRECTORY_NAMES = new Set([
  ".barzzo",
  ".agents",
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  "build",
  "cache",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "tmp",
]);

const EXCLUDED_FILE_NAMES = new Set([
  ".env",
  "local.env",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);

const EXCLUDED_EXTENSIONS = new Set([
  ".7z",
  ".avif",
  ".bmp",
  ".eot",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".mp3",
  ".mp4",
  ".otf",
  ".pdf",
  ".png",
  ".rar",
  ".svg",
  ".ttf",
  ".wav",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);

const PRIORITY_PATHS = [
  "AGENTS.md",
  "STATUS.md",
  "REGRAS_GERAIS.md",
  "AGENTES.md",
  "WORKFLOW.md",
  "docs/ia/",
  "docs/arquitetura/",
  "docs/produto/",
  "tarefas/",
];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function normalizePath(value) {
  return toPosix(value).replace(/^\.\//, "");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function shortHash(value) {
  return sha256(value).slice(0, 16);
}

function round(value, digits = 4) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function tokenize(value) {
  const rawTokens = value.match(/[A-Za-zÀ-ÿ0-9_$-]+/g) ?? [];
  const tokens = [];

  for (const originalToken of rawTokens) {
    const rawToken = normalizeText(originalToken);
    if (rawToken.length >= 2) tokens.push(rawToken);

    for (const part of rawToken.split(/[_$-]+/g)) {
      if (part.length >= 2 && part !== rawToken) tokens.push(part);
    }

    const camelParts = originalToken.replace(/([a-zÀ-ÿ])([A-Z])/g, "$1 $2").split(/\s+/g);
    for (const part of camelParts.map(normalizeText)) {
      if (part.length >= 2 && part !== rawToken) tokens.push(part);
    }
  }

  return tokens;
}

function termFrequency(value) {
  const frequencies = Object.create(null);
  for (const token of tokenize(value)) {
    frequencies[token] = (frequencies[token] ?? 0) + 1;
  }
  return frequencies;
}

export function isIndexablePath(relativePath, size = 0) {
  const normalized = normalizePath(relativePath);
  const segments = normalized.split("/");
  const basename = segments.at(-1) ?? "";
  const extension = path.posix.extname(basename).toLowerCase();

  if (!normalized || segments.some((segment) => EXCLUDED_DIRECTORY_NAMES.has(segment))) {
    return false;
  }
  if (EXCLUDED_FILE_NAMES.has(basename) || basename === "test-results.json") {
    return false;
  }
  if (basename === ".env" || basename.startsWith(".env.")) return false;
  if (EXCLUDED_EXTENSIONS.has(extension)) return false;
  if (!TEXT_EXTENSIONS.has(extension)) return false;
  return size <= 1_500_000;
}

export function indexDirectory(root) {
  return path.join(root, ".barzzo", "rag");
}

export function indexFile(indexDir) {
  return path.join(indexDir, INDEX_FILE);
}

async function walk(root, current = root, output = []) {
  const entries = await fs.readdir(current, { withFileTypes: true });

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(current, entry.name);
    const relative = normalizePath(path.relative(root, absolute));

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRECTORY_NAMES.has(entry.name)) {
        await walk(root, absolute, output);
      }
      continue;
    }

    if (!entry.isFile()) continue;
    const stat = await fs.stat(absolute);
    if (isIndexablePath(relative, stat.size)) {
      output.push({ absolute, path: relative, size: stat.size, mtimeMs: stat.mtimeMs });
    }
  }

  return output;
}

export async function discoverFiles(root) {
  return walk(root);
}

function lineHeading(line) {
  const match = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
  return match?.[1]?.trim();
}

function lineSymbol(line) {
  const match = line.match(
    /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/,
  );
  return match?.[1];
}

function sqlHeading(lines, index) {
  for (let cursor = index; cursor >= 0 && index - cursor <= 3; cursor -= 1) {
    const match = lines[cursor].match(/^\s*--\s*(?:={3,}\s*)?(.+?)\s*$/);
    if (match?.[1] && !/^=+$/.test(match[1])) return match[1].trim();
  }
  return undefined;
}

function boundedRanges(start, end, maxLines = DEFAULT_MAX_LINES, overlap = DEFAULT_OVERLAP_LINES) {
  const ranges = [];
  let cursor = start;

  while (cursor <= end) {
    const rangeEnd = Math.min(end, cursor + maxLines - 1);
    ranges.push([cursor, rangeEnd]);
    if (rangeEnd >= end) break;
    cursor = Math.max(cursor + 1, rangeEnd - overlap + 1);
  }

  return ranges;
}

function rangesFromBoundaries(lines, boundaries) {
  const ranges = [];
  let cursor = 0;

  for (const boundary of boundaries) {
    if (boundary <= cursor) continue;
    ranges.push(...boundedRanges(cursor, boundary - 1));
    cursor = boundary;
  }
  if (cursor < lines.length) ranges.push(...boundedRanges(cursor, lines.length - 1));
  return ranges;
}

function splitRanges(relativePath, lines) {
  const extension = path.posix.extname(relativePath).toLowerCase();

  if (extension === ".md" || extension === ".mdc" || extension === ".txt") {
    const boundaries = lines
      .map((line, index) => (lineHeading(line) ? index : -1))
      .filter((index) => index >= 0);
    return rangesFromBoundaries(lines, boundaries);
  }

  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(extension)) {
    const boundaries = lines
      .map((line, index) => (lineSymbol(line) ? index : -1))
      .filter((index) => index >= 0);
    return rangesFromBoundaries(lines, boundaries);
  }

  if (extension === ".sql") {
    const boundaries = lines
      .map((line, index) =>
        /^\s*(?:--\s*=+|CREATE(?:\s+OR\s+REPLACE)?\b|ALTER\b|DROP\b|GRANT\b|REVOKE\b|DO\s+\$\$|INSERT\b|UPDATE\b|DELETE\b)/i.test(line)
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    return rangesFromBoundaries(lines, boundaries);
  }

  return boundedRanges(0, lines.length - 1);
}

function inferKind(relativePath) {
  const extension = path.posix.extname(relativePath).toLowerCase();
  if ([".md", ".mdc", ".txt"].includes(extension)) return "markdown";
  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(extension)) return "code";
  if (extension === ".sql") return "sql";
  if (extension === ".json") return "json";
  return "config";
}

function metadataForRange(relativePath, lines, start, end) {
  const extension = path.posix.extname(relativePath).toLowerCase();
  let heading;
  let symbol;

  for (let index = start; index <= end; index += 1) {
    heading ??= lineHeading(lines[index]);
    symbol ??= lineSymbol(lines[index]);
    if (extension === ".sql") heading ??= sqlHeading(lines, index);
    if (heading && symbol) break;
  }

  return { heading, symbol };
}

export function chunkDocument(relativePath, content, fileHash, options = {}) {
  const lines = content.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  const ranges = splitRanges(relativePath, lines);
  const chunks = [];

  for (const [start, end] of ranges) {
    const chunkContent = lines.slice(start, end + 1).join("\n").trim();
    if (!chunkContent) continue;
    const metadata = metadataForRange(relativePath, lines, start, end);
    const chunkHash = sha256(`${relativePath}\n${start + 1}\n${end + 1}\n${chunkContent}`);
    chunks.push({
      id: shortHash(chunkHash),
      path: normalizePath(relativePath),
      startLine: start + 1,
      endLine: end + 1,
      extension: path.posix.extname(relativePath).toLowerCase(),
      kind: inferKind(relativePath),
      content: chunkContent,
      fileHash,
      chunkHash,
      heading: metadata.heading,
      symbol: metadata.symbol,
      terms: termFrequency(`${relativePath}\n${metadata.heading ?? ""}\n${metadata.symbol ?? ""}\n${chunkContent}`),
      indexedAt: options.indexedAt ?? new Date().toISOString(),
    });
  }

  return chunks;
}

function priorityBonus(relativePath) {
  const normalized = normalizePath(relativePath);
  if (PRIORITY_PATHS.some((prefix) => normalized === prefix || normalized.startsWith(prefix))) return 1;
  return 0;
}

function buildLexicalStats(chunks) {
  const documentFrequency = Object.create(null);
  let totalLength = 0;

  for (const chunk of chunks) {
    const terms = Object.keys(chunk.terms);
    totalLength += Object.values(chunk.terms).reduce((sum, value) => sum + value, 0);
    for (const term of new Set(terms)) {
      documentFrequency[term] = (documentFrequency[term] ?? 0) + 1;
    }
  }

  return {
    documentFrequency,
    averageDocumentLength: chunks.length ? totalLength / chunks.length : 0,
    chunkCount: chunks.length,
  };
}

function cosineSimilarity(left, right) {
  if (!left?.length || !right?.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  if (!leftNorm || !rightNorm) return 0;
  return Math.max(0, Math.min(1, dot / Math.sqrt(leftNorm * rightNorm)));
}

function lexicalScore(query, chunk, lexical) {
  const queryTerms = [...new Set(tokenize(query))];
  const chunkLength = Object.values(chunk.terms).reduce((sum, value) => sum + value, 0) || 1;
  const averageLength = lexical.averageDocumentLength || chunkLength;
  const totalChunks = lexical.chunkCount || 1;
  const k1 = 1.2;
  const b = 0.75;
  let score = 0;

  for (const term of queryTerms) {
    const frequency = chunk.terms[term] ?? 0;
    if (!frequency) continue;
    const documentFrequency = lexical.documentFrequency[term] ?? 0;
    const idf = Math.log(1 + (totalChunks - documentFrequency + 0.5) / (documentFrequency + 0.5));
    score += idf * ((frequency * (k1 + 1)) / (frequency + k1 * (1 - b + b * (chunkLength / averageLength))));
  }

  const normalizedQuery = normalizeText(query).trim();
  const normalizedContent = normalizeText(chunk.content);
  if (normalizedQuery && normalizedContent.includes(normalizedQuery)) score += 1.25;
  return score;
}

function pathAndMetadataScore(query, chunk) {
  const normalizedQuery = normalizeText(query);
  const queryTerms = [...new Set(tokenize(query))];
  const pathText = normalizeText(`${chunk.path} ${chunk.heading ?? ""} ${chunk.symbol ?? ""}`);
  const matchedTerms = queryTerms.filter((term) => pathText.includes(term));
  const exactPath = normalizedQuery && normalizeText(chunk.path).includes(normalizedQuery);
  const metadata = matchedTerms.length / Math.max(1, queryTerms.length);
  return Math.min(1, metadata * 0.7 + (exactPath ? 0.3 : 0) + priorityBonus(chunk.path) * 0.08);
}

function semanticCount(chunks) {
  return chunks.reduce((count, chunk) => count + (Array.isArray(chunk.embedding) ? 1 : 0), 0);
}

async function readIndex(indexDir) {
  try {
    const content = await fs.readFile(indexFile(indexDir), "utf8");
    const parsed = JSON.parse(content);
    if (parsed.version !== INDEX_VERSION) return null;
    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeIndex(indexDir, index) {
  await fs.mkdir(indexDir, { recursive: true });
  const temporary = `${indexFile(indexDir)}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  await fs.rename(temporary, indexFile(indexDir));
}

async function embedChunks(chunks, provider) {
  if (!provider || !chunks.length) return { embedded: 0 };
  let embedded = 0;
  for (let start = 0; start < chunks.length; start += 32) {
    const batch = chunks.slice(start, start + 32);
    const vectors = await provider.embed(batch.map((chunk) => chunk.content));
    if (!Array.isArray(vectors) || vectors.length !== batch.length) {
      throw new Error("O provedor de embeddings retornou uma quantidade inválida de vetores.");
    }
    for (let index = 0; index < batch.length; index += 1) {
      const vector = vectors[index];
      if (!Array.isArray(vector) || vector.some((value) => typeof value !== "number")) {
        throw new Error("O provedor de embeddings retornou um vetor inválido.");
      }
      batch[index].embedding = vector;
      embedded += 1;
    }
  }
  return { embedded };
}

export async function buildIndex({
  root,
  indexDir = indexDirectory(root),
  embeddingProvider = null,
  disableSemantic = false,
  force = false,
  now = new Date().toISOString(),
} = {}) {
  const previous = force ? null : await readIndex(indexDir);
  const discovered = await discoverFiles(root);
  const previousChunks = new Map((previous?.chunks ?? []).map((chunk) => [chunk.id, chunk]));
  const previousFiles = previous?.files ?? {};
  const chunks = [];
  const files = {};
  let indexedFiles = 0;
  let reusedFiles = 0;
  let changedFiles = 0;

  for (const file of discovered) {
    const content = await fs.readFile(file.absolute, "utf8");
    const fileHash = sha256(content);
    const previousFile = previousFiles[file.path];
    const canReuse = !force && previousFile?.hash === fileHash && previousFile.chunkIds?.every((id) => previousChunks.has(id));
    let fileChunks;

    if (canReuse) {
      fileChunks = previousFile.chunkIds.map((id) => previousChunks.get(id));
      reusedFiles += 1;
    } else {
      fileChunks = chunkDocument(file.path, content, fileHash, { indexedAt: now });
      changedFiles += previousFile ? 1 : 0;
      indexedFiles += previousFile ? 0 : 1;
    }

    files[file.path] = {
      hash: fileHash,
      size: file.size,
      mtimeMs: file.mtimeMs,
      chunkIds: fileChunks.map((chunk) => chunk.id),
    };
    chunks.push(...fileChunks);
  }

  const discoveredPaths = new Set(discovered.map((file) => file.path));
  const removedFiles = Object.keys(previousFiles).filter((filePath) => !discoveredPaths.has(filePath)).length;
  const filesWithEmbeddings = chunks.filter((chunk) => Array.isArray(chunk.embedding));
  let semanticNotice = null;
  let semanticProvider = previous?.semantic?.provider ?? null;

  if (disableSemantic) {
    semanticNotice = "Busca semântica desabilitada por configuração; usando busca lexical.";
  } else if (embeddingProvider) {
    semanticProvider = embeddingProvider.name ?? semanticProvider;
    try {
      const result = await embedChunks(chunks.filter((chunk) => !Array.isArray(chunk.embedding)), embeddingProvider);
      if (result.embedded > 0) semanticProvider = embeddingProvider.name ?? semanticProvider;
    } catch (error) {
      semanticNotice = `Busca semântica indisponível: ${error.message}`;
    }
  } else if (!filesWithEmbeddings.length) {
    semanticNotice = "Busca semântica indisponível; nenhum provedor local foi carregado. Usando busca lexical.";
  }

  const lexical = buildLexicalStats(chunks);
  const embeddingCount = semanticCount(chunks);
  const index = {
    version: INDEX_VERSION,
    generatedAt: now,
    root: path.resolve(root),
    files,
    chunks,
    lexical,
    semantic: {
      available: embeddingCount > 0,
      provider: semanticProvider,
      model: embeddingProvider?.model ?? previous?.semantic?.model ?? null,
      dimensions: chunks.find((chunk) => Array.isArray(chunk.embedding))?.embedding?.length ?? previous?.semantic?.dimensions ?? null,
      embeddedChunks: embeddingCount,
      notice: semanticNotice,
    },
  };

  await writeIndex(indexDir, index);
  return {
    index,
    indexDir,
    files: discovered.length,
    indexedFiles,
    changedFiles,
    reusedFiles,
    removedFiles,
    chunks: chunks.length,
    embeddedChunks: embeddingCount,
    semanticAvailable: index.semantic.available,
    semanticNotice,
  };
}

export async function queryIndex({
  indexDir,
  query,
  topK = 8,
  embeddingProvider = null,
} = {}) {
  const index = await readIndex(indexDir);
  if (!index) {
    throw new Error("Índice RAG não encontrado. Execute `npm run rag:index` primeiro.");
  }
  if (!query?.trim()) throw new Error("Informe uma consulta para o RAG.");

  const notices = [];
  let queryVector = null;
  let semanticUsed = false;

  if (index.semantic.embeddedChunks > 0 && embeddingProvider) {
    try {
      const vectors = await embeddingProvider.embed([query]);
      queryVector = vectors[0];
      semanticUsed = Array.isArray(queryVector);
    } catch (error) {
      notices.push(`Busca semântica indisponível: ${error.message}`);
    }
  } else if (index.semantic.embeddedChunks > 0 && !embeddingProvider) {
    notices.push("Busca semântica indisponível; provedor local não carregado. Usando busca lexical.");
  } else {
    notices.push(index.semantic.notice ?? "Busca semântica indisponível; usando busca lexical.");
  }

  const scored = index.chunks.map((chunk) => ({
    chunk,
    lexical: lexicalScore(query, chunk, index.lexical),
    semantic: queryVector ? cosineSimilarity(queryVector, chunk.embedding) : 0,
    metadata: pathAndMetadataScore(query, chunk),
  }));
  const maxLexical = Math.max(1, ...scored.map((item) => item.lexical));
  const semanticWeight = semanticUsed ? 0.3 : 0;
  const lexicalWeight = semanticUsed ? 0.55 : 0.85;
  const metadataWeight = semanticUsed ? 0.15 : 0.15;

  const results = scored
    .map(({ chunk, lexical, semantic, metadata }) => ({
      path: chunk.path,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      symbol: chunk.symbol,
      heading: chunk.heading,
      score: round(lexicalWeight * (lexical / maxLexical) + semanticWeight * semantic + metadataWeight * metadata),
      snippet: chunk.content.length > 700 ? `${chunk.content.slice(0, 697)}...` : chunk.content,
      lexicalScore: round(lexical),
      semanticScore: round(semantic),
      semanticUsed,
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path) || left.startLine - right.startLine)
    .slice(0, Math.max(1, Math.min(50, Number(topK) || 8)));

  return {
    query,
    topK: results.length,
    semanticUsed,
    notices: [...new Set(notices.filter(Boolean))],
    results,
  };
}

export async function createLocalEmbeddingProvider({
  cacheDir,
  model = process.env.RAG_EMBEDDING_MODEL || DEFAULT_MODEL,
} = {}) {
  if (process.env.RAG_DISABLE_SEMANTIC === "1") {
    return { provider: null, notice: "Busca semântica desabilitada por RAG_DISABLE_SEMANTIC=1." };
  }

  try {
    const transformers = await import("@huggingface/transformers");
    await fs.mkdir(cacheDir, { recursive: true });
    transformers.env.cacheDir = cacheDir;
    transformers.env.allowLocalModels = true;
    transformers.env.allowRemoteModels = true;
    const extractor = await transformers.pipeline("feature-extraction", model, { dtype: "q8" });
    return {
      provider: {
        name: `transformers.js:${model}`,
        model,
        async embed(texts) {
          const output = await extractor(texts, { pooling: "mean", normalize: true });
          return output.tolist();
        },
      },
      notice: null,
    };
  } catch (error) {
    return {
      provider: null,
      notice: `Busca semântica indisponível: ${error.message}`,
    };
  }
}

export async function loadIndexMetadata(indexDir) {
  const index = await readIndex(indexDir);
  if (!index) return null;
  return {
    version: index.version,
    generatedAt: index.generatedAt,
    files: Object.keys(index.files).length,
    chunks: index.chunks.length,
    semantic: index.semantic,
  };
}
