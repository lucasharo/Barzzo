import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carregar configuração unificada de .env.local ou local.env na raiz do monorepo
function carregarEnvRaiz() {
  const caminhos = [
    path.resolve(__dirname, "../../.env.local"),
    path.resolve(__dirname, "../../local.env"),
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
            let v = l.slice(sep + 1).trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
              v = v.slice(1, -1);
            }
            if (k && v && !process.env[k]) {
              process.env[k] = v;
            }
          }
        }
      }
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
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

export default nextConfig;
