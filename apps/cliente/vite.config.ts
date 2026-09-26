import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname), "");
  const rootEnv = loadEnv(mode, path.resolve(__dirname, "../.."), "");
  const mergedEnv = { ...rootEnv, ...env };

  const supabaseUrl =
    mergedEnv.NEXT_PUBLIC_SUPABASE_URL || "https://gdgeokfwkbusemayqucb.supabase.co";
  const supabaseKey =
    mergedEnv.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA ||
    mergedEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@barzzo/ui": path.resolve(__dirname, "../../packages/ui/src"),
        "@barzzo/utilitarios": path.resolve(__dirname, "../../packages/utilitarios/src"),
        "@barzzo/supabase": path.resolve(__dirname, "../../packages/supabase/src"),
        "@barzzo/tipos": path.resolve(__dirname, "../../packages/tipos/src"),
        "@barzzo/dominio": path.resolve(__dirname, "../../packages/dominio/src"),
        "@barzzo/validacoes": path.resolve(__dirname, "../../packages/validacoes/src"),
        "@barzzo/imagens": path.resolve(__dirname, "../../packages/imagens/src"),
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
    server: {
      port: 3001,
    },
  };
});
