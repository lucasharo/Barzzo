/** Plataforma em que o app está rodando: o WebView do Capacitor injeta `window.Capacitor`. */
export type Plataforma = "android" | "ios" | "web";

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

function capacitor(): CapacitorGlobal | undefined {
  return (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function plataformaAtual(): Plataforma {
  const cap = capacitor();
  if (!cap?.isNativePlatform?.()) return "web";
  const plataforma = cap.getPlatform?.();
  return plataforma === "android" || plataforma === "ios" ? plataforma : "web";
}

/** Verdadeiro dentro do app Android/iOS (Capacitor); falso no navegador e no PWA. */
export function ehAppNativo(): boolean {
  return plataformaAtual() !== "web";
}

/**
 * Origem web usada em links que saem do app (recuperação de senha, convites). No navegador é a própria origem;
 * no app nativo a origem é https://localhost, então vale o endereço público informado.
 */
export function origemWeb(urlPublica: string): string {
  if (!ehAppNativo() && typeof window !== "undefined") return window.location.origin;
  return urlPublica.replace(/\/+$/, "");
}
