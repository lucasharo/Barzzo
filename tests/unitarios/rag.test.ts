import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const projeto = path.resolve(__dirname, "../..");
const cli = path.join(projeto, "tools/rag/cli.mjs");

type EmbeddingProvider = {
  name: string;
  model: string;
  embed(texts: string[]): Promise<number[][]>;
};

function providerFake(): EmbeddingProvider {
  return {
    name: "fake-local",
    model: "fake-model",
    async embed(texts) {
      return texts.map((text) => {
        const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return [
          /galeria|capa|imagem|foto/.test(normalized) ? 1 : 0,
          /agenda|horario|profissional|reserva/.test(normalized) ? 1 : 0,
          /gerente|autorizacao|permissao|rls/.test(normalized) ? 1 : 0,
          /mercado|pagamento|assinatura/.test(normalized) ? 1 : 0,
        ];
      });
    },
  };
}

let root = "";
let indexDir = "";

async function fixtureFile(relativePath: string, content: string) {
  const absolute = path.join(root, relativePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, content, "utf8");
}

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "barzzo-rag-"));
  indexDir = path.join(root, ".barzzo", "rag");
  await fixtureFile(
    "AGENTS.md",
    "# Contrato\n\nArquivos locais são a fonte de verdade operacional.\n",
  );
  await fixtureFile(
    "docs/galeria.md",
    "# Galeria\n\nA imagem principal é escolhida pela foto com destaque_capa.\n",
  );
  await fixtureFile(
    "apps/agenda.ts",
    "export function qualquerProfissional() {\n  return 'menor carga';\n}\n",
  );
  await fixtureFile(
    "supabase/migrations/001_agenda.sql",
    "CREATE TABLE agendamentos (id UUID PRIMARY KEY);\nCREATE POLICY agenda_rls ON agendamentos USING (auth.uid() = cliente_id);\n",
  );
  await fixtureFile(".env", "SEGREDO=nao-indexar\n");
  await fixtureFile("docs/segredo.env.local", "TOKEN=nao-indexar\n");
  await fixtureFile("node_modules/pacote/ignorado.ts", "export const ignorado = true;\n");
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

async function importarRag() {
  return import("../../tools/rag/rag.mjs");
}

describe("RAG local híbrido", () => {
  it("indexa arquivo novo e exclui segredos e node_modules", async () => {
    const { buildIndex, discoverFiles } = await importarRag();
    const files = await discoverFiles(root);
    const paths = files.map((file) => file.path);
    expect(paths).toContain("AGENTS.md");
    expect(paths).toContain("docs/galeria.md");
    expect(paths).not.toContain(".env");
    expect(paths).not.toContain("docs/segredo.env.local");
    expect(paths).not.toContain("node_modules/pacote/ignorado.ts");

    const summary = await buildIndex({ root, indexDir, embeddingProvider: providerFake(), now: "2026-10-01T00:00:00.000Z" });
    expect(summary.indexedFiles).toBeGreaterThan(0);
    expect(summary.embeddedChunks).toBe(summary.chunks);
  });

  it("reaproveita arquivo sem alteração por hash", async () => {
    const { buildIndex } = await importarRag();
    const summary = await buildIndex({ root, indexDir, embeddingProvider: providerFake(), now: "2026-10-01T01:00:00.000Z" });
    expect(summary.changedFiles).toBe(0);
    expect(summary.reusedFiles).toBe(summary.files);
    expect(summary.index.generatedAt).toBe("2026-10-01T01:00:00.000Z");
  });

  it("reindexa arquivo alterado e remove arquivo apagado", async () => {
    const { buildIndex } = await importarRag();
    await fixtureFile("docs/galeria.md", "# Galeria\n\nA capa agora usa destaque_capa e galeria_fotos.\n");
    await fixtureFile("docs/remover.md", "Este arquivo será removido.\n");
    const changed = await buildIndex({ root, indexDir, embeddingProvider: providerFake(), now: "2026-10-01T02:00:00.000Z" });
    await rm(path.join(root, "docs/remover.md"));
    const summary = await buildIndex({ root, indexDir, embeddingProvider: providerFake(), now: "2026-10-01T03:00:00.000Z" });
    expect(changed.changedFiles).toBeGreaterThanOrEqual(1);
    expect(summary.removedFiles).toBe(1);
    expect(summary.index.files["docs/remover.md"]).toBeUndefined();
  });

  it("faz busca lexical com path, linhas e top-k", async () => {
    const { buildIndex, queryIndex } = await importarRag();
    await buildIndex({ root, indexDir, embeddingProvider: null, disableSemantic: true, force: true });
    const response = await queryIndex({ indexDir, query: "destaque_capa", topK: 1 });
    expect(response.semanticUsed).toBe(false);
    expect(response.results).toHaveLength(1);
    expect(response.results[0].path).toBe("docs/galeria.md");
    expect(response.results[0].startLine).toBe(1);
    expect(response.results[0].endLine).toBe(3);
  });

  it("usa busca semântica quando o provedor local está disponível", async () => {
    const { buildIndex, queryIndex } = await importarRag();
    await buildIndex({ root, indexDir, embeddingProvider: providerFake(), force: true });
    const response = await queryIndex({ indexDir, query: "qual é a imagem principal?", topK: 3, embeddingProvider: providerFake() });
    expect(response.semanticUsed).toBe(true);
    expect(response.results[0].path).toBe("docs/galeria.md");
  });

  it("faz fallback lexical quando embeddings não estão disponíveis", async () => {
    const { buildIndex, queryIndex } = await importarRag();
    await buildIndex({ root, indexDir, embeddingProvider: null, disableSemantic: true, force: true });
    const response = await queryIndex({ indexDir, query: "qualquer profissional agenda", topK: 5 });
    expect(response.semanticUsed).toBe(false);
    expect(response.notices.join(" ")).toMatch(/lexical|semântica/i);
    expect(response.results[0].path).toBe("apps/agenda.ts");
  });

  it("respeita modo JSON da CLI e rebuild completo", async () => {
    const rebuild = execFileSync(process.execPath, [cli, "rebuild", "--no-semantic", "--index-dir", indexDir], {
      cwd: projeto,
      env: { ...process.env, RAG_ROOT: root },
      encoding: "utf8",
    });
    expect(rebuild).toContain("Rebuild concluída");

    const output = execFileSync(process.execPath, [cli, "query", "--json", "--top-k", "2", "--index-dir", indexDir, "--", "imagem principal"], {
      cwd: projeto,
      env: { ...process.env, RAG_ROOT: root, RAG_DISABLE_SEMANTIC: "1" },
      encoding: "utf8",
    });
    const response = JSON.parse(output);
    expect(response.query).toBe("imagem principal");
    expect(response.results.length).toBeLessThanOrEqual(2);
    expect(response.results[0]).toHaveProperty("path");
    expect(response.results[0]).toHaveProperty("startLine");
  });

  it("permite rebuild a partir de índice reconstruível", async () => {
    const { loadIndexMetadata } = await importarRag();
    const metadata = await loadIndexMetadata(indexDir);
    expect(metadata?.version).toBe(1);
    const serialized = await readFile(path.join(indexDir, "index.json"), "utf8");
    expect(serialized).toContain('"chunks"');
  });
});
