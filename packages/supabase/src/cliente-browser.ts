import { createBrowserClient } from "@supabase/ssr";

export function criarClienteSupabaseBrowser() {
  const envVite = typeof globalThis !== "undefined" ? (globalThis as any).import?.meta?.env : undefined;

  const url =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
    envVite?.NEXT_PUBLIC_SUPABASE_URL ||
    "https://gdgeokfwkbusemayqucb.supabase.co";

  const chave =
    (typeof process !== "undefined" && (process.env?.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA || process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY)) ||
    envVite?.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA ||
    envVite?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "sb_publishable_NiZkUufBW9bn3y1V2NWt2w_IuRdQUjd";

  return createBrowserClient<any>(url, chave);
}
