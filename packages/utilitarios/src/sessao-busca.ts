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
 * Salva o endereço cadastrado do perfil localmente vinculado ao ID do usuário.
 */
export function salvarEnderecoPerfilLocal(
  usuarioId: string,
  dados: EnderecoContaCliente
): void {
  try {
    if (typeof window === "undefined" || !usuarioId) return;
    localStorage.setItem(
      `barzzo_endereco_perfil_${usuarioId}`,
      JSON.stringify(dados)
    );
  } catch {
    // Ignorar falhas
  }
}

/**
 * Obtém o endereço cadastrado do perfil armazenado localmente para o ID do usuário.
 */
export function obterEnderecoPerfilLocal(
  usuarioId: string
): EnderecoContaCliente | null {
  try {
    if (typeof window === "undefined" || !usuarioId) return null;
    const item = localStorage.getItem(`barzzo_endereco_perfil_${usuarioId}`);
    if (item) {
      return JSON.parse(item) as EnderecoContaCliente;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Formata os dados de endereço salvos no perfil/metadados da conta do cliente
 * no padrão legível: "Nome da Rua, Número, Bairro, Cidade - UF".
 */
export function formatarEnderecoConta(meta: any): {
  texto: string;
  lat: number | null;
  lng: number | null;
  bairro: string | null;
  cidade: string | null;
} | null {
  if (!meta) return null;

  const rua = meta.logradouro || meta.endereco || "";
  const num = meta.numero ? `${meta.numero}` : "";
  const logradouroCompleto = rua ? (num ? `${rua}, ${num}` : rua) : "";
  const bairro = meta.bairro || "";
  const cidadeEstado = meta.cidade && meta.estado
    ? `${meta.cidade} - ${meta.estado}`
    : (meta.cidade || meta.estado || "");

  // Formato: "Rua..., Bairro, Cidade - UF"
  const partes = [logradouroCompleto, bairro, cidadeEstado].filter(Boolean);
  let texto = partes.join(", ");

  // Se não foi possível montar a partir dos campos estruturados, tenta endereco_completo
  if (!texto && meta.endereco_completo && typeof meta.endereco_completo === "string") {
    // Remove "CEP ..." caso tenha sido gravado no texto completo
    texto = meta.endereco_completo.replace(/,?\s*CEP\s*[\d.-]+/gi, "").trim();
  }

  if (!texto) return null;

  return {
    texto,
    lat: typeof meta.latitude === "number" ? meta.latitude : (meta.latitude ? parseFloat(meta.latitude) : null),
    lng: typeof meta.longitude === "number" ? meta.longitude : (meta.longitude ? parseFloat(meta.longitude) : null),
    bairro: bairro || null,
    cidade: meta.cidade || null,
  };
}
