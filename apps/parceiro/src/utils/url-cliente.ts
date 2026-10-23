const URL_CLIENTE_PRODUCAO = "https://barzzo-cliente.vercel.app";
const URL_CLIENTE_DESENVOLVIMENTO = "https://barzzo-cliente-dev.vercel.app";

export function obterUrlBaseAppCliente(): string {
  const ambiente = (import.meta as any).env;
  const urlConfigurada = ambiente?.VITE_CLIENTE_URL?.trim();
  if (urlConfigurada) return urlConfigurada.replace(/\/+$/, "");

  if (typeof window === "undefined") return URL_CLIENTE_PRODUCAO;

  const hostname = window.location.hostname.toLowerCase();
  const ambienteLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    ambiente?.DEV;

  if (ambienteLocal) {
    return `${window.location.protocol}//${hostname}:3001`;
  }

  if (hostname === "barzzo-parceiro-dev.vercel.app") {
    return URL_CLIENTE_DESENVOLVIMENTO;
  }

  return URL_CLIENTE_PRODUCAO;
}
