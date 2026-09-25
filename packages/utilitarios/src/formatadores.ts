export function formatarTelefone(valor: string | null | undefined): string {
  if (!valor) return "";
  const apenasDigitos = valor.replace(/\D/g, "");

  if (apenasDigitos.length <= 2) {
    return apenasDigitos.length > 0 ? `(${apenasDigitos}` : "";
  }
  if (apenasDigitos.length <= 6) {
    return `(${apenasDigitos.slice(0, 2)}) ${apenasDigitos.slice(2)}`;
  }
  if (apenasDigitos.length <= 10) {
    return `(${apenasDigitos.slice(0, 2)}) ${apenasDigitos.slice(2, 6)}-${apenasDigitos.slice(6, 10)}`;
  }
  return `(${apenasDigitos.slice(0, 2)}) ${apenasDigitos.slice(2, 7)}-${apenasDigitos.slice(7, 11)}`;
}

export function limparTelefone(valor: string | null | undefined): string {
  if (!valor) return "";
  return valor.replace(/\D/g, "");
}

export function extrairPrimeiroNome(nomeCompleto: string | null | undefined): string {
  if (!nomeCompleto) return "";
  const partes = nomeCompleto.trim().split(/\s+/);
  return partes[0] || "";
}

export function obterIniciais(nomeCompleto: string | null | undefined): string {
  if (!nomeCompleto) return "BZ";
  const partes = nomeCompleto.trim().split(/\s+/);
  if (partes.length === 1) {
    return partes[0].slice(0, 2).toUpperCase();
  }
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
