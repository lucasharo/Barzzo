import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

function carregarEnvLocal(raiz: string) {
  const caminho = path.resolve(raiz, "local.env");
  const parsed: Record<string, string> = {};
  if (fs.existsSync(caminho)) {
    const lines = fs.readFileSync(caminho, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
        parsed[k] = v;
      }
    }
  }
  return parsed;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname), "");
  const rootEnv = loadEnv(mode, path.resolve(__dirname, "../.."), "");
  const localEnvVars = carregarEnvLocal(path.resolve(__dirname, "../.."));
  const mergedEnv = { ...rootEnv, ...localEnvVars, ...env };

  const supabaseUrl =
    mergedEnv.NEXT_PUBLIC_SUPABASE_URL || "https://gdgeokfwkbusemayqucb.supabase.co";
  const supabaseKey =
    mergedEnv.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA ||
    mergedEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  const localApiPlugin = {
    name: "local-api-middleware",
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        delete req.headers["if-none-match"];
        delete req.headers["if-modified-since"];
        const origSetHeader = res.setHeader.bind(res);
        res.setHeader = (name: string, value: any) => {
          if (name.toLowerCase() === "etag") {
            return res;
          }
          if (name.toLowerCase() === "cache-control") {
            return origSetHeader(
              "Cache-Control",
              "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
            );
          }
          return origSetHeader(name, value);
        };
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        next();
      });

      server.middlewares.use(async (req: any, res: any, next: any) => {
        const endpoints = [
          { route: "/api/assinar-com-cartao", file: "./api/assinar-com-cartao.js" },
          { route: "/api/salvar-cartao", file: "./api/salvar-cartao.js" },
          { route: "/api/cancelar-assinatura", file: "./api/cancelar-assinatura.js" },
          { route: "/api/remover-cartao", file: "./api/remover-cartao.js" },
          { route: "/api/criar-preferencia", file: "./api/criar-preferencia.js" },
        ];

        const match = endpoints.find((e) => req.url?.startsWith(e.route));
        if (match) {
          let body = "";
          req.on("data", (chunk: any) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              req.body = body ? JSON.parse(body) : {};
              Object.assign(process.env, mergedEnv);
              const handler = (await import(match.file)).default;
              res.status = (code: number) => {
                res.statusCode = code;
                return res;
              };
              res.json = (data: any) => {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(data));
              };
              await handler(req, res);
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (req.url?.startsWith("/api/verificar-assinatura")) {
          const urlObj = new URL(req.url, "http://localhost:3002");
          req.query = Object.fromEntries(urlObj.searchParams.entries());
          Object.assign(process.env, mergedEnv);
          const handler = (await import("./api/verificar-assinatura.js")).default;
          res.status = (code: number) => {
            res.statusCode = code;
            return res;
          };
          res.json = (data: any) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(data));
          };
          await handler(req, res);
          return;
        }
        next();
      });
    },
  };

  const monorepoVersion = Date.now().toString(36);
  const cacheBusterPlugin = {
    name: "monorepo-cache-buster",
    enforce: "pre" as const,
    resolveId(source: string, importer?: string) {
      if (source.startsWith("@barzzo/")) {
        const pkgName = source.replace("@barzzo/", "");
        const target = path.resolve(__dirname, `../../packages/${pkgName}/src/index.ts`);
        if (fs.existsSync(target)) {
          return `${target}?v=${monorepoVersion}`;
        }
      }
      if (importer && (importer.includes("packages") || importer.includes("packages/")) && source.startsWith(".")) {
        const cleanImporter = importer.split("?")[0];
        const dir = path.dirname(cleanImporter);
        const resolved = path.resolve(dir, source);
        for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
          const full = resolved + ext;
          if (fs.existsSync(full) && fs.statSync(full).isFile()) {
            return `${full}?v=${monorepoVersion}`;
          }
        }
      }
    },
  };

  return {
    plugins: [react(), localApiPlugin, cacheBusterPlugin],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        react: path.resolve(__dirname, "../../node_modules/react"),
        "react-dom": path.resolve(__dirname, "../../node_modules/react-dom"),
      },
      dedupe: ["react", "react-dom"],
    },
    build: {
      outDir: "dist",
    },
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    define: {
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA": JSON.stringify(supabaseKey),
      "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(supabaseKey),
      "process.env": JSON.stringify(mergedEnv),
    },
    optimizeDeps: {
      exclude: [
        "@barzzo/ui",
        "@barzzo/utilitarios",
        "@barzzo/supabase",
        "@barzzo/tipos",
        "@barzzo/dominio",
        "@barzzo/validacoes",
        "@barzzo/imagens",
      ],
    },
    server: {
      port: 3002,
      host: true,
      watch: {
        usePolling: true,
        interval: 100,
      },
    },
  };
});