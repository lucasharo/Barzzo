import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@barzzo/tipos";

export function criarClienteSupabaseBrowser() {
  const url =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
    (typeof import.meta !== "undefined" && (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL) ||
    "https://exemplo-barzzo.supabase.co";

  const chave =
    (typeof process !== "undefined" && (process.env?.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA || process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY)) ||
    (typeof import.meta !== "undefined" && ((import.meta as any).env?.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA || (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY)) ||
    "exemplo-chave-publica-barzzo";

  return createBrowserClient<any>(url, chave);
}
