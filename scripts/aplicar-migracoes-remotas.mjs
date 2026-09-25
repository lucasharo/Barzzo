import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const pastaMigracoes = path.resolve("supabase/migrations");
const args = process.argv.slice(2);
const aPartirDe = args[0] || "20260925000005";

const arquivos = fs
  .readdirSync(pastaMigracoes)
  .filter((f) => f.endsWith(".sql") && f >= aPartirDe)
  .sort();

console.log("=== APLICANDO MIGRAÇÕES NO SUPABASE REMOTO ===");
console.log(`Aplicando ${arquivos.length} migrações a partir de ${aPartirDe}...\n`);

const projectRef = "gdgeokfwkbusemayqucb";

for (const arquivo of arquivos) {
  const caminhoCompleto = path.join(pastaMigracoes, arquivo);
  console.log(`▶ Aplicando: ${arquivo}...`);
  try {
    const comando = `npx supabase db query --linked --project-ref ${projectRef} --file "${caminhoCompleto}"`;
    const saida = execSync(comando, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    console.log(`  ✔ Sucesso: ${arquivo}`);
  } catch (err) {
    console.error(`  ❌ Erro ao aplicar ${arquivo}:`);
    if (err.stdout) console.error(err.stdout);
    if (err.stderr) console.error(err.stderr);
    process.exit(1);
  }
}

console.log("\n✔ TODAS AS MIGRAÇÕES FORAM APLICADAS COM SUCESSO!");
