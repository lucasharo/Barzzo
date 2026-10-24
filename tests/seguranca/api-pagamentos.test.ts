import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error utilitário JS das rotas de /api
import { aplicarCors, exigirGestorDaBarbearia, exigirSegredoDeCron } from "../../apps/parceiro/api/_seguranca.js";

const rota = (arquivo: string) =>
  readFileSync(new URL(`../../apps/parceiro/api/${arquivo}`, import.meta.url), "utf8");

function resposta() {
  const res: any = { statusCode: 200, headers: {} as Record<string, string>, corpo: undefined as unknown };
  res.status = (codigo: number) => {
    res.statusCode = codigo;
    return res;
  };
  res.json = (corpo: unknown) => {
    res.corpo = corpo;
    return res;
  };
  res.setHeader = (nome: string, valor: string) => {
    res.headers[nome] = valor;
  };
  res.end = vi.fn();
  return res;
}

function supabaseFalso(usuario: { id: string } | null, vinculos: Array<{ papel: string }>) {
  return {
    auth: { getUser: async () => ({ data: { user: usuario }, error: usuario ? null : new Error("inválido") }) },
    from: () => {
      const consulta: any = { select: () => consulta, eq: () => consulta, in: () => consulta, limit: async () => ({ data: vinculos }) };
      return consulta;
    },
  };
}

describe("API de pagamentos do Parceiro", () => {
  it("toda rota de assinatura exige gestor da barbearia e aplica CORS", () => {
    for (const arquivo of [
      "assinar-com-cartao.js",
      "salvar-cartao.js",
      "cancelar-assinatura.js",
      "remover-cartao.js",
      "criar-preferencia.js",
      "verificar-assinatura.js",
    ]) {
      const codigo = rota(arquivo);
      expect(codigo, arquivo).toContain("exigirGestorDaBarbearia(req, res");
      expect(codigo, arquivo).toContain("aplicarCors(req, res)");
    }
  });

  it("rotas de cron exigem o segredo", () => {
    for (const arquivo of ["cron/renovar-assinaturas.js", "cron/alertas-assinatura.js"]) {
      expect(rota(arquivo), arquivo).toContain("exigirSegredoDeCron(req, res)");
    }
  });

  it("verificar-assinatura só ativa o plano com pagamento aprovado e conferido no Mercado Pago", () => {
    const codigo = rota("verificar-assinatura.js");
    expect(codigo).toContain("api.mercadopago.com/v1/payments/");
    expect(codigo).toContain("pagamento.status === 'approved'");
    expect(codigo).toContain("referencia.barbearia_id === barbearia_id");
    expect(codigo).toContain("referencia.plano_id === plano_id");
    expect(codigo).not.toContain("MP_SYNC_RETURN");
  });

  it("sem token, com token inválido ou sem vínculo de gestor a chamada é negada", async () => {
    const semToken = resposta();
    expect(await exigirGestorDaBarbearia({ headers: {} }, semToken, supabaseFalso(null, []), "b1")).toBeNull();
    expect(semToken.statusCode).toBe(401);

    const invalido = resposta();
    expect(
      await exigirGestorDaBarbearia({ headers: { authorization: "Bearer x" } }, invalido, supabaseFalso(null, []), "b1")
    ).toBeNull();
    expect(invalido.statusCode).toBe(401);

    const semVinculo = resposta();
    expect(
      await exigirGestorDaBarbearia({ headers: { authorization: "Bearer x" } }, semVinculo, supabaseFalso({ id: "u" }, []), "b1")
    ).toBeNull();
    expect(semVinculo.statusCode).toBe(403);

    const ok = resposta();
    const usuario = await exigirGestorDaBarbearia(
      { headers: { authorization: "Bearer x" } },
      ok,
      supabaseFalso({ id: "u" }, [{ papel: "dono" }]),
      "b1"
    );
    expect(usuario).toEqual({ id: "u" });
  });

  it("CORS só libera origens conhecidas e responde ao preflight", () => {
    const permitida = resposta();
    expect(aplicarCors({ method: "OPTIONS", headers: { origin: "https://localhost" } }, permitida)).toBe(true);
    expect(permitida.headers["Access-Control-Allow-Origin"]).toBe("https://localhost");
    expect(permitida.statusCode).toBe(204);

    const estranha = resposta();
    expect(aplicarCors({ method: "POST", headers: { origin: "https://malicioso.example" } }, estranha)).toBe(false);
    expect(estranha.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("cron sem CRON_SECRET configurado ou com segredo errado é negado", () => {
    const antes = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    const semSegredo = resposta();
    expect(exigirSegredoDeCron({ headers: {} }, semSegredo)).toBe(false);
    expect(semSegredo.statusCode).toBe(503);

    process.env.CRON_SECRET = "segredo";
    const errado = resposta();
    expect(exigirSegredoDeCron({ headers: { authorization: "Bearer outro" } }, errado)).toBe(false);
    expect(errado.statusCode).toBe(401);
    expect(exigirSegredoDeCron({ headers: { authorization: "Bearer segredo" } }, resposta())).toBe(true);

    if (antes === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = antes;
  });
});
