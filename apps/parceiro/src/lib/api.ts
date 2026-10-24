import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { ehAppNativo } from "@barzzo/utilitarios";

/**
 * No app Android não existe servidor local: as rotas de /api vivem no deploy web do Parceiro.
 * O endereço é configurável em VITE_API_BASE_URL (padrão: ambiente Dev).
 */
const API_NATIVA: string =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL ??
    "https://barzzo-parceiro-dev.vercel.app").replace(/\/$/, "");

export function urlApi(caminho: string): string {
  return ehAppNativo() ? `${API_NATIVA}${caminho}` : caminho;
}

/** Chama uma rota de /api enviando a sessão do usuário (as rotas exigem login). */
export async function chamarApi(caminho: string, init: RequestInit = {}): Promise<Response> {
  const supabase = criarClienteSupabaseBrowser();
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session?.access_token) {
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }
  return fetch(urlApi(caminho), { ...init, headers });
}
