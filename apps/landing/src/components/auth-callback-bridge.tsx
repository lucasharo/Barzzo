"use client";

import * as React from "react";

/**
 * Ponte de redirecionamento de autenticação.
 * Caso o Supabase envie tokens de confirmação de e-mail ou redefinição de senha
 * para a URL raiz padrão (Site URL http://localhost:3000), redireciona automaticamente
 * para o app do parceiro na rota de influenciador mantendo hash e parâmetros intactos.
 */
export function AuthCallbackBridge() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash || "";
    const search = window.location.search || "";

    const temAuth =
      hash.includes("access_token=") ||
      hash.includes("type=signup") ||
      hash.includes("type=recovery") ||
      hash.includes("type=magiclink") ||
      search.includes("code=") ||
      search.includes("token=");

    if (!temAuth) return;

    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    const partnerHost = isLocal
      ? "http://localhost:3002"
      : window.location.hostname.includes("vercel.app")
      ? "https://barzzo-parceiro-dev.vercel.app"
      : "https://parceiro.barzzo.com.br";

    const destino = `${partnerHost}/influenciador/cadastro${search}${hash}`;
    window.location.replace(destino);
  }, []);

  return null;
}
