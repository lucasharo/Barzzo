export interface Coordenadas {
  lat: number;
  lng: number;
  enderecoFormatado?: string;
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