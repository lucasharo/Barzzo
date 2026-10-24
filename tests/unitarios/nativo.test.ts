import { afterEach, describe, expect, it } from "vitest";
import { ehAppNativo, plataformaAtual } from "../../packages/utilitarios/src/plataforma";
import { caminhoDoLink } from "../../packages/nativo/src/link";

afterEach(() => {
  delete (globalThis as { Capacitor?: unknown }).Capacitor;
});

describe("plataforma", () => {
  it("no navegador (sem Capacitor) é web e não é nativo", () => {
    expect(plataformaAtual()).toBe("web");
    expect(ehAppNativo()).toBe(false);
  });

  it("dentro do WebView do Capacitor reconhece Android e iOS", () => {
    (globalThis as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "android" };
    expect(plataformaAtual()).toBe("android");
    expect(ehAppNativo()).toBe(true);

    (globalThis as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" };
    expect(plataformaAtual()).toBe("ios");
  });

  it("Capacitor em modo web (PWA) não conta como nativo", () => {
    (globalThis as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => false, getPlatform: () => "web" };
    expect(ehAppNativo()).toBe(false);
  });
});

describe("links profundos", () => {
  it("barzzo://host/caminho vira a rota interna, com query e hash", () => {
    expect(caminhoDoLink("barzzo://cliente/barbearia/abc?cupom=ANA10#topo", "cliente")).toBe("/barbearia/abc?cupom=ANA10#topo");
    expect(caminhoDoLink("barzzo://parceiro/influenciador/cadastro", "parceiro")).toBe("/influenciador/cadastro");
  });

  it("recusa link de outro app (host diferente) e esquemas desconhecidos", () => {
    expect(caminhoDoLink("barzzo://parceiro/painel", "cliente")).toBeNull();
    expect(caminhoDoLink("javascript:alert(1)", "cliente")).toBeNull();
    expect(caminhoDoLink("intent://x#Intent;end", "cliente")).toBeNull();
    expect(caminhoDoLink("não é url", "cliente")).toBeNull();
  });

  it("aceita link https e usa só o caminho", () => {
    expect(caminhoDoLink("https://barzzo-cliente.vercel.app/agendamentos?x=1")).toBe("/agendamentos?x=1");
  });
});
