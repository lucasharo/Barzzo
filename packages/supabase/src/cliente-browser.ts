import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@barzzo/tipos";

export function criarClienteSupabaseBrowser() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://exemplo-barzzo.supabase.co";
  const chave =
    process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "exemplo-chave-publica-barzzo";

  return createBrowserClient<any>(url, chave);
}
