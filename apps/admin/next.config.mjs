import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://gdgeokfwkbusemayqucb.supabase.co";

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_NiZkUufBW9bn3y1V2NWt2w_IuRdQUjd";

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
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA: supabaseKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseKey,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "./src"),
      "@barzzo/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@barzzo/utilitarios": path.resolve(__dirname, "../../packages/utilitarios/src"),
      "@barzzo/validacoes": path.resolve(__dirname, "../../packages/validacoes/src"),
      "@barzzo/imagens": path.resolve(__dirname, "../../packages/imagens/src"),
      "@barzzo/supabase": path.resolve(__dirname, "../../packages/supabase/src"),
      "@barzzo/tipos": path.resolve(__dirname, "../../packages/tipos/src"),
      "@barzzo/dominio": path.resolve(__dirname, "../../packages/dominio/src"),
    };
    return config;
  },
};

export default nextConfig;
