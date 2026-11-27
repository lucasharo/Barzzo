import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error utilitário JS das rotas de /api
import {
  aplicarCors,
  exigirGestorDaBarbearia,
  exigirSegredoDeCron,
  obterUrlWebhookMercadoPago,
  validarAssinaturaWebhookMercadoPago,
} from "../../apps/parceiro/api/_seguranca.js";

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

    const producao = resposta();
    aplicarCors({ method: "OPTIONS", headers: { origin: "https://cliente.barzzo.io" } }, producao);
    expect(producao.headers["Access-Control-Allow-Origin"]).toBe("https://cliente.barzzo.io");

    const estranha = resposta();
    expect(aplicarCors({ method: "POST", headers: { origin: "https://malicioso.example" } }, estranha)).toBe(false);
    expect(estranha.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("webhook de pagamento usa a URL de produção e aceita configuração explícita", () => {
    const webhookAnterior = process.env.MERCADO_PAGO_WEBHOOK_URL;
    const ambienteAnterior = process.env.VERCEL_ENV;

    try {
      delete process.env.MERCADO_PAGO_WEBHOOK_URL;
      process.env.VERCEL_ENV = "production";
      expect(obterUrlWebhookMercadoPago()).toBe(
        "https://parceiro.barzzo.io/api/webhooks/mercadopago"
      );

      process.env.MERCADO_PAGO_WEBHOOK_URL = "https://custom.example/webhook";
      expect(obterUrlWebhookMercadoPago()).toBe("https://custom.example/webhook");
    } finally {
      if (webhookAnterior === undefined) delete process.env.MERCADO_PAGO_WEBHOOK_URL;
      else process.env.MERCADO_PAGO_WEBHOOK_URL = webhookAnterior;
      if (ambienteAnterior === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = ambienteAnterior;
    }
  });

  it("webhook valida a assinatura HMAC enviada pelo Mercado Pago", () => {
    const segredoAnterior = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    const ambienteAnterior = process.env.VERCEL_ENV;
    const segredo = "segredo-de-teste";
    const dataId = "123456";
    const requestId = "req-abc";
    const ts = "1704908010";
    const manifesto = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = createHmac("sha256", segredo).update(manifesto).digest("hex");
    const req = {
      headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId },
      query: { "data.id": dataId },
      body: {},
    };

    try {
      process.env.MERCADO_PAGO_WEBHOOK_SECRET = segredo;
      process.env.VERCEL_ENV = "production";
      expect(validarAssinaturaWebhookMercadoPago(req)).toBe(true);
      expect(validarAssinaturaWebhookMercadoPago({ ...req, headers: { ...req.headers, "x-request-id": "req-otro" } })).toBe(false);

      delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
      expect(validarAssinaturaWebhookMercadoPago(req)).toBe(false);
    } finally {
      if (segredoAnterior === undefined) delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
      else process.env.MERCADO_PAGO_WEBHOOK_SECRET = segredoAnterior;
      if (ambienteAnterior === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = ambienteAnterior;
    }
  });

  it("build do Parceiro não inclui variáveis privadas do backend no bundle", () => {
    const config = readFileSync(new URL("../../apps/parceiro/vite.config.ts", import.meta.url), "utf8");
    expect(config).toContain('key.startsWith("VITE_") || key.startsWith("NEXT_PUBLIC_")');
    expect(config).toContain('"process.env": JSON.stringify(publicEnv)');
    expect(config).not.toContain('"process.env": JSON.stringify(mergedEnv)');
  });

  it("produção não ativa assinatura sem pagamento aprovado pelo Mercado Pago", () => {
    const codigo = rota("assinar-com-cartao.js");
    expect(codigo).toContain("paymentData.status === 'approved'");
    expect(codigo).toContain("process.env.VERCEL_ENV === 'production'");
    expect(codigo).toContain("A assinatura não foi ativada.");
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
