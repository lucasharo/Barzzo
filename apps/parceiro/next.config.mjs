import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function carregarEnvRaiz() {
  const caminhos = [
    path.resolve(__dirname, "../../local.env"),
    path.resolve(__dirname, "../../.env.local"),
    path.resolve(__dirname, "../../.env"),
  ];

  for (const caminho of caminhos) {
    if (fs.existsSync(caminho)) {
      const linhas = fs.readFileSync(caminho, "utf-8").split("\n");
      for (const linha of linhas) {
        const l = linha.trim();
        if (l && !l.startsWith("#")) {
          const sep = l.indexOf("=");
          if (sep > -1) {
            const k = l.slice(0, sep).trim();
            const v = l.slice(sep + 1).trim();
            if (k && !process.env[k]) {
              process.env[k] = v;
            }
          }
        }
      }
      break;
    }
  }
}

carregarEnvRaiz();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@barzzo/ui",
    "@barzzo/utilitarios",
    "@barzzo/validacoes",
    "@barzzo/imagens",
    "@barzzo/supabase",
    "@barzzo/tipos",
    "@barzzo/dominio",
  ],
};

export default nextConfig;
