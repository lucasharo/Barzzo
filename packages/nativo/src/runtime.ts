import { ehAppNativo } from "@barzzo/utilitarios";
import { caminhoDoLink } from "./link";

export interface OpcoesRuntimeNativo {
  /** Rotas em que o botão voltar fecha o app em vez de navegar (ex.: início, painel). */
  rotasRaiz: string[];
  /** Navega para uma rota interna (React Router). */
  navegar: (caminho: string) => void;
  /** Host do link profundo: barzzo://<host>/caminho. */
  esquemaHost: string;
}

const COR_FUNDO = { claro: "#FFFFFF", escuro: "#0A0A0B" };

/**
 * Inicia o comportamento nativo do app (Android): barra de status, tela de abertura, botão voltar e links profundos.
 * No navegador não faz nada. Retorna a função que desfaz os ouvintes.
 */
export async function iniciarRuntimeNativo(opcoes: OpcoesRuntimeNativo): Promise<() => void> {
  if (!ehAppNativo()) return () => undefined;

  const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/status-bar"),
    import("@capacitor/splash-screen"),
  ]);

  const aplicarBarraDeStatus = () => {
    const escuro = document.documentElement.classList.contains("dark");
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
    StatusBar.setStyle({ style: escuro ? Style.Dark : Style.Light }).catch(() => undefined);
    StatusBar.setBackgroundColor({ color: escuro ? COR_FUNDO.escuro : COR_FUNDO.claro }).catch(() => undefined);
  };
  aplicarBarraDeStatus();
  const observador = new MutationObserver(aplicarBarraDeStatus);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  const voltar = await App.addListener("backButton", ({ canGoBack }) => {
    const naRaiz = opcoes.rotasRaiz.includes(window.location.pathname);
    if (naRaiz || !canGoBack) {
      App.exitApp().catch(() => undefined);
      return;
    }
    window.history.back();
  });

  const link = await App.addListener("appUrlOpen", ({ url }) => {
    const caminho = caminhoDoLink(url, opcoes.esquemaHost);
    if (caminho) opcoes.navegar(caminho);
  });

  await SplashScreen.hide().catch(() => undefined);

  return () => {
    observador.disconnect();
    voltar.remove().catch(() => undefined);
    link.remove().catch(() => undefined);
  };
}
