import { urlRedirectAutenticacao } from "@barzzo/utilitarios";

describe("redirecionamentos de autenticação por ambiente", () => {
  it.each([
    ["local", "http://localhost:3001", "http://localhost:3001/redefinir-senha"],
    ["Dev", "https://barzzo-cliente-dev.vercel.app", "https://barzzo-cliente-dev.vercel.app/redefinir-senha"],
    ["PRD", "https://cliente.barzzo.io", "https://cliente.barzzo.io/redefinir-senha"],
  ])("usa a origem do ambiente %s", (_ambiente, origem, esperado) => {
    expect(urlRedirectAutenticacao("/redefinir-senha", origem)).toBe(esperado);
  });

  it("bloqueia destino externo recebido por parâmetro", () => {
    expect(urlRedirectAutenticacao("//exemplo-malicioso.com", "https://cliente.barzzo.io")).toBe(
      "https://cliente.barzzo.io/",
    );
  });
});
