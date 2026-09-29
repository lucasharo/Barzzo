export interface Coordenadas {
  lat: number;
  lng: number;
  enderecoFormatado?: string;
}

export interface SugestaoEndereco {
  id: string;
  titulo: string;
  subtitulo: string;
  enderecoCompleto: string;
  lat: number;
  lng: number;
}

export async function geocodificarEndereco(termo: string): Promise<Coordenadas | null> {
  if (!termo || !termo.trim()) return null;
  const limpo = termo.trim();

  // 1. Se for formato CEP (ex: 08529-100 ou 08529100)
  const apenasDigitos = limpo.replace(/\D/g, "");
  if (apenasDigitos.length === 8 && /^\d{5}-?\d{3}$/.test(limpo)) {
    try {
      const respCep = await fetch(`https://viacep.com.br/ws/${apenasDigitos}/json/`);
      const dadosCep = await respCep.json();
      if (!dadosCep.erro) {
        const enderecoCep = `${dadosCep.logradouro ? dadosCep.logradouro + ", " : ""}${dadosCep.bairro}, ${dadosCep.localidade} - ${dadosCep.uf}`;
        const coords = await buscarNoNominatim(enderecoCep);
        if (coords) return coords;
      }
    } catch {
      // Fallback para Nominatim direto
    }
  }

  // 2. Busca geocodificada via Nominatim
  return await buscarNoNominatim(limpo);
}

export async function buscarSugestoesEndereco(
  termo: string,
  limite = 5
): Promise<SugestaoEndereco[]> {
  if (!termo || termo.trim().length < 2) return [];
  const limpo = termo.trim();

  const sugestoes: SugestaoEndereco[] = [];

  // 1. Se for CEP (8 dígitos)
  const apenasDigitos = limpo.replace(/\D/g, "");
  if (apenasDigitos.length === 8 && /^\d{5}-?\d{3}$/.test(limpo)) {
    try {
      const respCep = await fetch(`https://viacep.com.br/ws/${apenasDigitos}/json/`);
      if (respCep.ok) {
        const dadosCep = await respCep.json();
        if (!dadosCep.erro) {
          const enderecoFormatado = `${dadosCep.logradouro ? dadosCep.logradouro + ", " : ""}${dadosCep.bairro ? dadosCep.bairro + ", " : ""}${dadosCep.localidade} - ${dadosCep.uf}`;
          const coords = await buscarNoNominatim(enderecoFormatado);
          sugestoes.push({
            id: `cep-${dadosCep.cep}`,
            titulo: dadosCep.logradouro || dadosCep.bairro || `CEP ${dadosCep.cep}`,
            subtitulo: `${dadosCep.bairro ? dadosCep.bairro + ", " : ""}${dadosCep.localidade} - ${dadosCep.uf} (CEP ${dadosCep.cep})`,
            enderecoCompleto: enderecoFormatado,
            lat: coords?.lat ?? 0,
            lng: coords?.lng ?? 0,
          });
          return sugestoes;
        }
      }
    } catch {
      // Continua para o Nominatim
    }
  }

  // 2. Busca no OpenStreetMap Nominatim
  try {
    const consulta = limpo.toLowerCase().includes("brasil") ? limpo : `${limpo}, Brasil`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      consulta
    )}&format=json&addressdetails=1&limit=${limite}&countrycodes=br`;

    const res = await fetch(url, {
      headers: {
        "Accept-Language": "pt-BR",
        "User-Agent": "Barzzo-App/1.0",
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const item of data) {
          const addr = item.address || {};
          const titulo =
            addr.road ||
            addr.suburb ||
            addr.neighbourhood ||
            addr.city_district ||
            addr.city ||
            addr.town ||
            addr.municipality ||
            item.display_name.split(",")[0];

          const partesSubtitulo = [
            addr.suburb || addr.neighbourhood || addr.city_district,
            addr.city || addr.town || addr.municipality,
            addr.state,
          ]
            .filter((p): p is string => Boolean(p && p !== titulo))
            .filter((val, idx, arr) => arr.indexOf(val) === idx);

          const subtitulo = partesSubtitulo.join(", ") || item.display_name;

          sugestoes.push({
            id: String(item.place_id || `${item.lat},${item.lon}`),
            titulo,
            subtitulo,
            enderecoCompleto: `${titulo}, ${subtitulo}`,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          });
        }
      }
    }
  } catch {
    // Retorna sugestões acumuladas
  }

  return sugestoes;
}

export interface InfoEnderecoReverso {
  enderecoCompleto: string;
  titulo: string;
  subtitulo: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

/**
 * Obtém o endereço formatado e legível a partir de coordenadas de GPS (geocodificação reversa via Nominatim).
 */
export async function obterEnderecoPorCoordenadas(
  lat: number,
  lng: number
): Promise<InfoEnderecoReverso | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "Accept-Language": "pt-BR",
        "User-Agent": "Barzzo-App/1.0",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.address) return null;

    const addr = data.address;
    const rua = addr.road || addr.street;
    const numero = addr.house_number;
    const bairro = addr.suburb || addr.neighbourhood || addr.city_district || addr.quarter;
    const cidade = addr.city || addr.town || addr.municipality || addr.village;
    const estado = addr.state_code || addr.state;
    const cep = addr.postcode;

    const titulo = rua
      ? `${rua}${numero ? ", " + numero : ""}`
      : bairro || cidade || data.display_name.split(",")[0];

    const partesSub = [bairro && bairro !== titulo ? bairro : null, cidade, estado].filter(Boolean);
    const subtitulo = partesSub.join(" - ") || data.display_name;

    const partesCompletas = [
      rua ? `${rua}${numero ? ", " + numero : ""}` : null,
      bairro && bairro !== rua ? bairro : null,
      cidade && estado ? `${cidade} - ${estado}` : (cidade || estado),
    ].filter(Boolean);

    const enderecoCompleto = partesCompletas.join(", ") || data.display_name;

    return {
      enderecoCompleto,
      titulo,
      subtitulo,
      bairro: bairro || undefined,
      cidade: cidade || undefined,
      estado: estado || undefined,
      cep: cep || undefined,
    };
  } catch {
    return null;
  }
}

async function buscarNoNominatim(query: string): Promise<Coordenadas | null> {
  try {
    const consulta = query.toLowerCase().includes("brasil") ? query : `${query}, Brasil`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(consulta)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: {
        "Accept-Language": "pt-BR",
        "User-Agent": "Barzzo-App/1.0",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        enderecoFormatado: data[0].display_name,
      };
    }
  } catch {
    return null;
  }
  return null;
}