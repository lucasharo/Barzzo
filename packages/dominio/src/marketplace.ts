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
