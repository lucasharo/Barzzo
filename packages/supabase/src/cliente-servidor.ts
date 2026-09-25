import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@barzzo/tipos";

export interface GerenciadorCookies {
  get(name: string): { value: string } | undefined | string | null;
  set(name: string, value: string, options: CookieOptions): void;
  remove(name: string, options: CookieOptions): void;
}

export function criarClienteSupabaseServidor(cookies: GerenciadorCookies) {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://exemplo-barzzo.supabase.co";
  const chave =
    process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "exemplo-chave-publica-barzzo";

  return createServerClient<Database>(url, chave, {
    cookies: {
      get(nome: string) {
        const c = cookies.get(nome);
        if (typeof c === "string") return c;
        return c?.value;
      },
      set(nome: string, valor: string, opcoes: CookieOptions) {
        try {
          cookies.set(nome, valor, opcoes);
        } catch {
          // Em Server Components somente leitura pode lançar exceção
        }
      },
      remove(nome: string, opcoes: CookieOptions) {
        try {
          cookies.remove(nome, opcoes);
        } catch {
          // Em Server Components somente leitura pode lançar exceção
        }
      },
    },
  });
}
