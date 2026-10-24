import { createBrowserClient } from "@supabase/ssr";

declare const __BARZZO_APP_ID__: "cliente" | "parceiro" | "admin" | undefined;

export function criarClienteSupabaseBrowser(
  aplicacao?: "cliente" | "parceiro" | "admin"
) {
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

  const identificadorHtml =
    typeof document !== "undefined"
      ? document.querySelector<HTMLMetaElement>('meta[name="barzzo-app-id"]')?.content
      : undefined;
  const nomeHtmlValido =
    identificadorHtml === "cliente" ||
    identificadorHtml === "parceiro" ||
    identificadorHtml === "admin"
      ? identificadorHtml
      : undefined;
  const nomeAplicacao =
    aplicacao ??
    nomeHtmlValido ??
    (typeof __BARZZO_APP_ID__ !== "undefined" ? __BARZZO_APP_ID__ : undefined);
  const referenciaProjeto = new URL(url).hostname.split(".")[0];

  return createBrowserClient<any>(url, chave, nomeAplicacao
    ? { cookieOptions: { name: `sb-${referenciaProjeto}-${nomeAplicacao}-auth-token` } }
    : undefined);
}
