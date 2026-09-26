// packages/dominio/src/marketplace.ts
// Regras de geolocalização e gerenciamento seguro do rascunho de reserva pré-login.

import type { RascunhoReserva } from "@barzzo/tipos";

export const CHAVE_RASCUNHO_RESERVA = "@barzzo:rascunho_reserva";

/**
 * Calcula a distância em quilômetros entre duas coordenadas geográficas
 * utilizando a fórmula de Haversine.
 */
export function calcularDistanciaKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

/**
 * Salva o rascunho da reserva no localStorage do navegador para persistência pré-login.
 */
export function salvarRascunhoReserva(rascunho: RascunhoReserva): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAVE_RASCUNHO_RESERVA, JSON.stringify(rascunho));
  } catch {
    // Tratamento de falha silenciosa (ex: modo anônimo estrito do Safari)
  }
}

/**
 * Recupera o rascunho da reserva do localStorage após login ou cadastro.
 */
export function obterRascunhoReserva(): RascunhoReserva | null {
  if (typeof window === "undefined") return null;
  try {
    const item = localStorage.getItem(CHAVE_RASCUNHO_RESERVA);
    return item ? (JSON.parse(item) as RascunhoReserva) : null;
  } catch {
    return null;
  }
}

/**
 * Remove o rascunho da reserva após a confirmação definitiva ou desistência.
 */
export function limparRascunhoReserva(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CHAVE_RASCUNHO_RESERVA);
  } catch {
    // Falha silenciosa
  }
}

/**
 * Extrai o valor do serviço de "Corte" a partir da lista de serviços de uma barbearia.
 * Dá prioridade a serviços de corte avulsos/tradicionais (ex: "Corte Tradicional", "Corte Degradê", "Corte Social"),
 * ignorando combos (ex: "Corte + Barba") se houver corte individual disponível.
 * Retorna null se não houver serviços válidos.
 */
export function obterPrecoCorte(
  servicos: Array<{ nome?: string | null; preco?: number | string | null; ativo?: boolean | null }>
): number | null {
  if (!servicos || servicos.length === 0) return null;

  const ativos = servicos.filter((s) => s.ativo !== false);
  if (ativos.length === 0) return null;

  function normalizar(texto: string): string {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  // Filtrar serviços cujo nome mencione "corte" ou "cabelo"
  const servicosCorte = ativos.filter((s) => {
    const nomeNorm = normalizar(s.nome || "");
    return nomeNorm.includes("corte") || nomeNorm.includes("cabelo");
  });

  // Priorizar cortes avulsos (sem barba, sem combo, sem "+", etc.)
  const cortesAvulsos = servicosCorte.filter((s) => {
    const nomeNorm = normalizar(s.nome || "");
    return (
      !nomeNorm.includes("barba") &&
      !nomeNorm.includes("combo") &&
      !nomeNorm.includes("+") &&
      !nomeNorm.includes(" e ")
    );
  });

  const candidatos = cortesAvulsos.length > 0 ? cortesAvulsos : servicosCorte;

  const precos = candidatos
    .map((s) => Number(s.preco))
    .filter((p) => !isNaN(p) && p > 0);

  if (precos.length > 0) {
    return Math.min(...precos);
  }

  // Fallback: se não houver nenhum serviço chamado explicitamente "corte",
  // usa o menor preço entre os serviços ativos
  const todosPrecos = ativos
    .map((s) => Number(s.preco))
    .filter((p) => !isNaN(p) && p > 0);

  return todosPrecos.length > 0 ? Math.min(...todosPrecos) : null;
}

/**
 * Calcula o destino de redirecionamento após login ou cadastro com segurança,
 * priorizando o parâmetro de retorno e recuperando o fluxo de agendamento em andamento.
 */
export function calcularDestinoAposAuth(
  retornoUrl: string | null | undefined,
  draft: RascunhoReserva | null | undefined
): string {
  if (retornoUrl && retornoUrl.startsWith("/") && !retornoUrl.startsWith("//")) {
    return retornoUrl;
  }
  if (draft && draft.barbearia_slug) {
    return `/reservar/${draft.barbearia_slug}`;
  }
  return "/perfil";
}

