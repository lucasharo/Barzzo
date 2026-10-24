import { ehAppNativo } from "@barzzo/utilitarios";

export interface PosicaoAtual {
  latitude: number;
  longitude: number;
}

/**
 * Posição do aparelho. No app Android usa o plugin nativo (pede a permissão do sistema);
 * no navegador usa a API do próprio navegador. Rejeita quando o usuário nega ou o GPS falha.
 */
export async function obterPosicaoAtual(): Promise<PosicaoAtual> {
  if (ehAppNativo()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    const permissao = await Geolocation.requestPermissions({ permissions: ["location"] });
    if (permissao.location !== "granted" && permissao.coarseLocation !== "granted") {
      throw new Error("Permissão de localização negada.");
    }
    const posicao = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000 });
    return { latitude: posicao.coords.latitude, longitude: posicao.coords.longitude };
  }

  return new Promise<PosicaoAtual>((resolver, rejeitar) => {
    if (!navigator.geolocation) {
      rejeitar(new Error("Geolocalização indisponível neste navegador."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicao) => resolver({ latitude: posicao.coords.latitude, longitude: posicao.coords.longitude }),
      (erro) => rejeitar(new Error(erro.message || "Não foi possível obter a localização.")),
      { enableHighAccuracy: false, timeout: 15000 }
    );
  });
}
