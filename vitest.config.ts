import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@barzzo/tipos": path.resolve(__dirname, "./packages/tipos/src"),
      "@barzzo/validacoes": path.resolve(__dirname, "./packages/validacoes/src"),
      "@barzzo/utilitarios": path.resolve(__dirname, "./packages/utilitarios/src"),
      "@barzzo/imagens": path.resolve(__dirname, "./packages/imagens/src"),
      "@barzzo/supabase": path.resolve(__dirname, "./packages/supabase/src"),
      "@barzzo/ui": path.resolve(__dirname, "./packages/ui/src"),
      "@barzzo/dominio": path.resolve(__dirname, "./packages/dominio/src"),
    },
  },
});
