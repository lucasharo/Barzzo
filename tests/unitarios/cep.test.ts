import { afterEach, describe, expect, it, vi } from "vitest";
import { buscarEnderecoPorCep } from "@barzzo/utilitarios";

function simularFetch(resposta: Partial<Response> | Error) {
  const fetchSimulado = vi.fn().mockImplementation(async () => {
    if (resposta instanceof Error) throw resposta;
    return resposta;
  });
  vi.stubGlobal("fetch", fetchSimulado);
  return fetchSimulado;
}

describe("buscarEnderecoPorCep (BrasilAPI)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejeita CEP incompleto sem chamar a API", async () => {
    const fetchSimulado = simularFetch({ ok: true, status: 200 });
    expect(await buscarEnderecoPorCep("0541-00")).toEqual({ ok: false, motivo: "invalido" });
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it("consulta a BrasilAPI v2 só com dígitos e normaliza a resposta", async () => {
    const fetchSimulado = simularFetch({
      ok: true,
      status: 200,
      json: async () => ({ cep: "05410000", state: "SP", city: "São Paulo", neighborhood: "Pinheiros", street: "Rua Alves Guimarães" }),
    });
    const resultado = await buscarEnderecoPorCep("05410-000");
    expect(fetchSimulado).toHaveBeenCalledWith("https://brasilapi.com.br/api/cep/v2/05410000", { signal: undefined });
    expect(resultado).toEqual({
      ok: true,
      endereco: { cep: "05410000", logradouro: "Rua Alves Guimarães", bairro: "Pinheiros", cidade: "São Paulo", estado: "SP" },
    });
  });

  it("aceita CEP genérico sem logradouro ou bairro", async () => {
    simularFetch({ ok: true, status: 200, json: async () => ({ cep: "01001000", state: "SP", city: "Cidade Pequena" }) });
    const resultado = await buscarEnderecoPorCep("01001000");
    expect(resultado).toMatchObject({ ok: true, endereco: { logradouro: "", bairro: "", cidade: "Cidade Pequena" } });
  });

  it("diferencia CEP inexistente de serviço indisponível", async () => {
    simularFetch({ ok: false, status: 404 });
    expect(await buscarEnderecoPorCep("00000000")).toEqual({ ok: false, motivo: "nao_encontrado" });
    simularFetch({ ok: false, status: 500 });
    expect(await buscarEnderecoPorCep("05410000")).toEqual({ ok: false, motivo: "indisponivel" });
    simularFetch(new Error("rede"));
    expect(await buscarEnderecoPorCep("05410000")).toEqual({ ok: false, motivo: "indisponivel" });
  });
});
