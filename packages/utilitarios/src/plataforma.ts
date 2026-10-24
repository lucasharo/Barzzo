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
