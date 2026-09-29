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

export interface InfoBandeiraCartao {
  id: "visa" | "master" | "amex" | "elo" | "hipercard" | "diners" | "outros";
  nome: string;
  tamanhoMaximo: number;
  tamanhoCvv: number;
  mascara: number[];
}

export function detectarBandeiraCartao(numero: string | null | undefined): InfoBandeiraCartao {
  const digitos = (numero || "").replace(/\D/g, "");

  // 1. Elo (deve ser checada antes de Visa/Mastercard pois compartilha alguns prefixos específicos)
  const regexElo =
    /^(4011(78|79)|43(1274|8935)|45(1416|7393|7631|7632)|50(4175|6699|67[0-7][0-9]|90[0-9]{2})|627780|63(6297|6368)|650(03[1-3]|0[3-5][0-9]|4[0-3][0-9]|48[5-9]|49[0-9]|5[0-9]{2}|7[0-2][0-9]|9[0-7][0-9])|6516[5-7][0-9]|6550[0-5][0-9])/;
  if (regexElo.test(digitos)) {
    return {
      id: "elo",
      nome: "Elo",
      tamanhoMaximo: 16,
      tamanhoCvv: 3,
      mascara: [4, 4, 4, 4],
    };
  }

  // 2. Hipercard
  if (/^(606282|3841(00|40|60))/.test(digitos)) {
    return {
      id: "hipercard",
      nome: "Hipercard",
      tamanhoMaximo: 16,
      tamanhoCvv: 3,
      mascara: [4, 4, 4, 4],
    };
  }

  // 3. American Express (Amex) - 15 dígitos, CVV 4 dígitos, máscara 4-6-5
  if (/^3[47]/.test(digitos)) {
    return {
      id: "amex",
      nome: "American Express",
      tamanhoMaximo: 15,
      tamanhoCvv: 4,
      mascara: [4, 6, 5],
    };
  }

  // 4. Diners Club - 14 dígitos, CVV 3 dígitos, máscara 4-6-4
  if (/^3(0[0-5]|[689])/.test(digitos)) {
    return {
      id: "diners",
      nome: "Diners Club",
      tamanhoMaximo: 14,
      tamanhoCvv: 3,
      mascara: [4, 6, 4],
    };
  }

  // 5. Visa
  if (/^4/.test(digitos)) {
    return {
      id: "visa",
      nome: "Visa",
      tamanhoMaximo: 16,
      tamanhoCvv: 3,
      mascara: [4, 4, 4, 4],
    };
  }

  // 6. Mastercard
  if (/^(5[1-5]|2(22[1-9]|2[3-9][0-9]|[3-6][0-9]{2}|7[0-1][0-9]|720))/.test(digitos)) {
    return {
      id: "master",
      nome: "Mastercard",
      tamanhoMaximo: 16,
      tamanhoCvv: 3,
      mascara: [4, 4, 4, 4],
    };
  }

  // 7. Padrão / Desconhecido
  return {
    id: "outros",
    nome: "Cartão de Crédito",
    tamanhoMaximo: 16,
    tamanhoCvv: 3,
    mascara: [4, 4, 4, 4],
  };
}

export function formatarNumeroCartao(valor: string | null | undefined): string {
  if (!valor) return "";
  const info = detectarBandeiraCartao(valor);
  const digitos = valor.replace(/\D/g, "").slice(0, info.tamanhoMaximo);

  const partes: string[] = [];
  let inicio = 0;

  for (const tam of info.mascara) {
    if (inicio >= digitos.length) break;
    partes.push(digitos.slice(inicio, inicio + tam));
    inicio += tam;
  }

  return partes.join(" ");
}

export function formatarValidadeCartao(valor: string | null | undefined): string {
  if (!valor) return "";
  const digitos = valor.replace(/\D/g, "").slice(0, 4);

  if (digitos.length === 0) return "";
  if (digitos.length === 1) return digitos;
  if (digitos.length === 2) return `${digitos}/`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}`;
}

export function formatarCpf(valor: string | null | undefined): string {
  if (!valor) return "";
  const digitos = valor.replace(/\D/g, "").slice(0, 11);

  if (digitos.length <= 3) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 3)}.${digitos.slice(3)}`;
  if (digitos.length <= 9) return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6)}`;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9, 11)}`;
}

export function formatarCnpj(valor: string | null | undefined): string {
  if (!valor) return "";
  const digitos = valor.replace(/\D/g, "").slice(0, 14);

  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 5) return `${digitos.slice(0, 2)}.${digitos.slice(2)}`;
  if (digitos.length <= 8) return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5)}`;
  if (digitos.length <= 12)
    return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8)}`;
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12, 14)}`;
}

export function formatarDocumento(valor: string | null | undefined): string {
  if (!valor) return "";
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length > 11) {
    return formatarCnpj(digitos);
  }
  return formatarCpf(digitos);
}

export function formatarCep(valor: string | null | undefined): string {
  if (!valor) return "";
  const digitos = valor.replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 5) return digitos;
  return `${digitos.slice(0, 5)}-${digitos.slice(5, 8)}`;
}

/**
 * Formata uma data no formato padrão brasileiro `dd/MM/yyyy`.
 * Suporta strings no formato ISO, YYYY-MM-DD, instâncias de Date e timestamps numéricos.
 */
export function formatarData(valor: string | Date | number | null | undefined): string {
  if (!valor) return "";

  if (typeof valor === "string") {
    const trimmed = valor.trim();
    if (!trimmed) return "";

    // Se já estiver no formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [ano, mes, dia] = trimmed.split("-");
      return `${dia}/${mes}/${ano}`;
    }

    // Se já estiver no formato dd/MM/yyyy
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return trimmed;
    }

    // Tratamento seguro para strings de data ISO
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return trimmed;
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  const d = typeof valor === "number" ? new Date(valor) : valor;
  if (isNaN(d.getTime())) return "";
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

/**
 * Formata data e hora no formato brasileiro `dd/MM/yyyy HH:mm` ou `dd/MM/yyyy às HH:mm`.
 */
export function formatarDataHora(
  valor: string | Date | number | null | undefined,
  comAs = false
): string {
  if (!valor) return "";

  let d: Date;
  if (typeof valor === "string") {
    const trimmed = valor.trim();
    if (!trimmed) return "";
    d = new Date(trimmed);
  } else if (typeof valor === "number") {
    d = new Date(valor);
  } else {
    d = valor;
  }

  if (isNaN(d.getTime())) return "";
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, "0");
  const minuto = String(d.getMinutes()).padStart(2, "0");

  const separador = comAs ? " às " : " ";
  return `${dia}/${mes}/${ano}${separador}${hora}:${minuto}`;
}

/**
 * Formata apenas o horário no formato `HH:mm`.
 */
export function formatarHora(valor: string | Date | number | null | undefined): string {
  if (!valor) return "";

  if (typeof valor === "string") {
    const trimmed = valor.trim();
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      return trimmed.slice(0, 5);
    }
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return trimmed;
    const hora = String(d.getHours()).padStart(2, "0");
    const minuto = String(d.getMinutes()).padStart(2, "0");
    return `${hora}:${minuto}`;
  }

  const d = typeof valor === "number" ? new Date(valor) : valor;
  if (isNaN(d.getTime())) return "";
  const hora = String(d.getHours()).padStart(2, "0");
  const minuto = String(d.getMinutes()).padStart(2, "0");
  return `${hora}:${minuto}`;
}


