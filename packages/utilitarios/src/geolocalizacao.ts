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
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
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
 * Busca coordenadas para um endereço digitado, nome de rua, bairro, cidade ou CEP.
 * Utiliza ViaCEP para CEPs e o geocoder Photon (OpenStreetMap) de alta performance compatível com chamadas no navegador.
 */
export async function geocodificarEndereco(termo: string): Promise<Coordenadas | null> {
  if (!termo || !termo.trim()) return null;
  const limpo = termo.trim();

  // 1. Se for formato CEP (ex: 04459-310 ou 04459310)
  const apenasDigitos = limpo.replace(/\D/g, "");
  if (apenasDigitos.length === 8 && /^\d{5}-?\d{3}$/.test(limpo)) {
    try {
      const respCep = await fetch(`https://viacep.com.br/ws/${apenasDigitos}/json/`);
      if (respCep.ok) {
        const dadosCep = await respCep.json();
        if (!dadosCep.erro) {
          const partesCep = [
            dadosCep.logradouro,
            dadosCep.bairro,
            dadosCep.localidade ? `${dadosCep.localidade} - ${dadosCep.uf}` : null,
          ].filter(Boolean);
          const enderecoCep = partesCep.join(", ");
          const coords = await buscarNoPhoton(enderecoCep);
          if (coords) return coords;
        }
      }
    } catch {
      // Fallback
    }
  }

  // 2. Busca direta no Photon (OpenStreetMap)
  let coords = await buscarNoPhoton(limpo);
  if (coords) return coords;

  // 3. Fallback: remover número predial ou complementos (ex: "Rua X, 123, Bairro" -> "Rua X, Bairro")
  const semNumero = limpo.replace(/,\s*\d+\s*,?/, ", ");
  if (semNumero !== limpo) {
    coords = await buscarNoPhoton(semNumero);
    if (coords) return coords;
  }

  // 4. Fallback: buscar rua/bairro e cidade
  const partes = limpo.split(",").map((p) => p.trim()).filter(Boolean);
  if (partes.length >= 2) {
    const simplificado = `${partes[0]}, ${partes[partes.length - 1]}`;
    coords = await buscarNoPhoton(simplificado);
    if (coords) return coords;
  }

  return null;
}

/**
 * Autocomplete em tempo real para busca de endereços (ViaCEP + Photon OSM).
 */
export async function buscarSugestoesEndereco(
  termo: string,
  limite = 5
): Promise<SugestaoEndereco[]> {
  if (!termo || termo.trim().length < 2) return [];
  const limpo = termo.trim();

  // 1. Se for CEP (8 dígitos)
  const apenasDigitos = limpo.replace(/\D/g, "");
  if (apenasDigitos.length === 8 && /^\d{5}-?\d{3}$/.test(limpo)) {
    try {
      const respCep = await fetch(`https://viacep.com.br/ws/${apenasDigitos}/json/`);
      if (respCep.ok) {
        const dadosCep = await respCep.json();
        if (!dadosCep.erro) {
          const partesCep = [
            dadosCep.logradouro,
            dadosCep.bairro,
            dadosCep.localidade ? `${dadosCep.localidade} - ${dadosCep.uf}` : null,
          ].filter(Boolean);
          const enderecoFormatado = partesCep.join(", ");
          const coords = await buscarNoPhoton(enderecoFormatado);
          return [
            {
              id: `cep-${dadosCep.cep}`,
              titulo: dadosCep.logradouro || dadosCep.bairro || `CEP ${dadosCep.cep}`,
              subtitulo: `${dadosCep.bairro ? dadosCep.bairro + ", " : ""}${dadosCep.localidade} - ${dadosCep.uf} (CEP ${dadosCep.cep})`,
              enderecoCompleto: enderecoFormatado,
              lat: coords?.lat ?? 0,
              lng: coords?.lng ?? 0,
              bairro: dadosCep.bairro || undefined,
              cidade: dadosCep.localidade || undefined,
              estado: dadosCep.uf || undefined,
              cep: dadosCep.cep || undefined,
            },
          ];
        }
      }
    } catch {
      // Continua
    }
  }

  // 2. Busca no Photon (OpenStreetMap)
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(limpo)}&limit=${limite}&lang=default`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const sugestoes: SugestaoEndereco[] = [];

      for (const f of data.features || []) {
        const p = f.properties || {};
        const lat = f.geometry?.coordinates?.[1];
        const lng = f.geometry?.coordinates?.[0];

        if (typeof lat !== "number" || typeof lng !== "number") continue;

        const ruaOuNome = p.street || p.name || "";
        const numero = p.housenumber ? `, ${p.housenumber}` : "";
        const titulo = ruaOuNome ? `${ruaOuNome}${numero}` : p.district || p.city || "Localização";

        const partesSub = [
          p.district && p.district !== titulo ? p.district : null,
          p.city,
          p.state,
        ].filter(Boolean);

        const subtitulo = partesSub.join(", ") || p.country || "";
        const enderecoCompleto = [titulo, subtitulo].filter(Boolean).join(", ");

        sugestoes.push({
          id: String(p.osm_id || `${lat},${lng}`),
          titulo,
          subtitulo,
          enderecoCompleto,
          lat,
          lng,
          bairro: p.district || undefined,
          cidade: p.city || undefined,
          estado: p.state || undefined,
          cep: p.postcode || undefined,
        });
      }

      if (sugestoes.length > 0) {
        return sugestoes;
      }
    }
  } catch {
    // Retorna vazio
  }

  return [];
}

/**
 * Obtém o endereço completo a partir de coordenadas de GPS (geocodificação reversa).
 * Usa Nominatim (OpenStreetMap) como fonte primária — retorna logradouro, bairro, cidade e estado.
 * BigDataCloud como fallback caso o Nominatim não responda.
 */
export async function obterEnderecoPorCoordenadas(
  lat: number,
  lng: number
): Promise<InfoEnderecoReverso | null> {
  // 1. Tentativa primária: Nominatim (OSM) — retorna endereço completo com logradouro
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=pt-BR&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Barzzo/1.0 (app.barzzo.com.br)" },
    });
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};

      const logradouro =
        addr.road || addr.pedestrian || addr.footway || addr.path || "";
      const numero = addr.house_number ? `, ${addr.house_number}` : "";
      const bairro =
        addr.suburb || addr.neighbourhood || addr.quarter || addr.district || "";
      const cidade =
        addr.city || addr.town || addr.village || addr.municipality || "";
      const estado = addr.state_code
        ? addr.state_code.replace("BR-", "")
        : addr.state || "";
      const cep = addr.postcode || undefined;

      // Monta endereço completo priorizando logradouro
      const partes = [
        logradouro ? `${logradouro}${numero}` : null,
        bairro && bairro !== logradouro ? bairro : null,
        cidade ? (estado ? `${cidade} - ${estado}` : cidade) : null,
      ].filter(Boolean);

      const enderecoCompleto =
        partes.length > 0
          ? partes.join(", ")
          : data.display_name?.split(",").slice(0, 3).join(",").trim() ||
            "Localização Atual";

      return {
        enderecoCompleto,
        titulo: logradouro || bairro || cidade || "Localização Atual",
        subtitulo: [bairro, cidade, estado].filter(Boolean).join(", "),
        bairro: bairro || undefined,
        cidade: cidade || undefined,
        estado: estado || undefined,
        cep,
      };
    }
  } catch {
    // Fallback para BigDataCloud
  }

  // 2. Fallback: BigDataCloud
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=pt`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data) return null;

    const admins: Array<{ name: string }> = data.localityInfo?.administrative || [];
    let bairro = "";
    if (admins.length >= 7) {
      bairro = admins[admins.length - 1]?.name || "";
      if (bairro === data.locality || bairro === data.principalSubdivision) {
        bairro = admins[admins.length - 2]?.name || "";
      }
    }

    const cidade = data.locality || data.city || "";
    const estado = data.principalSubdivisionCode
      ? data.principalSubdivisionCode.replace("BR-", "")
      : data.principalSubdivision || "";

    const partes = [
      bairro && bairro !== cidade ? bairro : null,
      cidade ? (estado ? `${cidade} - ${estado}` : cidade) : null,
    ].filter(Boolean);

    const enderecoCompleto = partes.join(", ") || "Localização Atual";

    return {
      enderecoCompleto,
      titulo: bairro || cidade || "Localização Atual",
      subtitulo: cidade ? (estado ? `${cidade} - ${estado}` : cidade) : "",
      bairro: bairro || undefined,
      cidade: cidade || undefined,
      estado: estado || undefined,
      cep: data.postcode || undefined,
    };
  } catch {
    return null;
  }
}

async function buscarNoPhoton(query: string): Promise<Coordenadas | null> {
  try {
    const consulta = query.toLowerCase().includes("brasil") ? query : `${query}, Brasil`;
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(consulta)}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.features && data.features.length > 0) {
      const f = data.features[0];
      return {
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        enderecoFormatado: f.properties?.name || query,
      };
    }
  } catch {
    return null;
  }
  return null;
}