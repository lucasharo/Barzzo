const CHAVE = "barzzo:cupom-indicado";
const FORMATO = /^[A-Za-z0-9]{3,30}$/;

/** Cupom vindo de um link de divulgação (?cupom=CODIGO), guardado até a reserva. */
export function lerCupomIndicado(): string | null {
  try {
    const valor = window.localStorage.getItem(CHAVE);
    return valor && FORMATO.test(valor) ? valor.toUpperCase() : null;
  } catch {
    return null;
  }
}

export function salvarCupomIndicado(codigo: string | null | undefined): void {
  const limpo = codigo?.trim() ?? "";
  if (!FORMATO.test(limpo)) return;
  try {
    window.localStorage.setItem(CHAVE, limpo.toUpperCase());
  } catch {
    // Sem armazenamento (modo privado): o cupom vale só enquanto o link estiver na URL.
  }
}
