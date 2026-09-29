export interface EnderecoBuscaSessao {
  texto: string;
  lat?: number | null;
  lng?: number | null;
  bairro?: string | null;
  cidade?: string | null;
  origem: "manual" | "conta" | "gps";
  timestamp?: number;
}

export interface EnderecoContaCliente {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  endereco_completo?: string | null;
}

const CHAVE_SESSAO_ENDERECO = "barzzo_endereco_busca_sessao";

/**
 * Salva o endereço de busca atual na sessão (sessionStorage) e como fallback no localStorage.
 */
export function salvarEnderecoBuscaSessao(dados: EnderecoBuscaSessao): void {
  try {
    if (typeof window === "undefined") return;
    const payload = JSON.stringify({ ...dados, timestamp: Date.now() });
    sessionStorage.setItem(CHAVE_SESSAO_ENDERECO, payload);
    localStorage.setItem(CHAVE_SESSAO_ENDERECO, payload);
  } catch {
    // Ignorar falhas em navegadores com restrições
  }
}

/**
 * Obtém o endereço de busca gravado na sessão ativa.
 */
export function obterEnderecoBuscaSessao(): EnderecoBuscaSessao | null {
  try {
    if (typeof window === "undefined") return null;
    const itemSessao = sessionStorage.getItem(CHAVE_SESSAO_ENDERECO);
    if (itemSessao) {
      return JSON.parse(itemSessao) as EnderecoBuscaSessao;
    }
    const itemLocal = localStorage.getItem(CHAVE_SESSAO_ENDERECO);
    if (itemLocal) {
      return JSON.parse(itemLocal) as EnderecoBuscaSessao;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Limpa o endereço de busca gravado na sessão.
 */
export function limparEnderecoBuscaSessao(): void {
  try {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(CHAVE_SESSAO_ENDERECO);
    localStorage.removeItem(CHAVE_SESSAO_ENDERECO);
  } catch {
    // Ignorar falhas
  }
}

/**
 * Formata os dados de endereço salvos no perfil/metadados da conta do cliente.
 */
export function formatarEnderecoConta(meta: any): {
  texto: string;
  lat: number | null;
  lng: number | null;
  bairro: string | null;
  cidade: string | null;
} | null {
  if (!meta) return null;

  if (meta.endereco_completo && typeof meta.endereco_completo === "string" && meta.endereco_completo.trim()) {
    return {
      texto: meta.endereco_completo.trim(),
      lat: typeof meta.latitude === "number" ? meta.latitude : null,
      lng: typeof meta.longitude === "number" ? meta.longitude : null,
      bairro: meta.bairro || null,
      cidade: meta.cidade || null,
    };
  }

  const partes = [
    meta.logradouro ? `${meta.logradouro}${meta.numero ? ", " + meta.numero : ""}` : (meta.endereco || null),
    meta.bairro || null,
    meta.cidade && meta.estado ? `${meta.cidade} - ${meta.estado}` : (meta.cidade || meta.estado || null),
  ].filter(Boolean);

  if (partes.length === 0) return null;

  return {
    texto: partes.join(", "),
    lat: typeof meta.latitude === "number" ? meta.latitude : null,
    lng: typeof meta.longitude === "number" ? meta.longitude : null,
    bairro: meta.bairro || null,
    cidade: meta.cidade || null,
  };
}
