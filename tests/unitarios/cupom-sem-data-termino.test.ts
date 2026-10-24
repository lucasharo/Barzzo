import { describe, expect, it } from "vitest";
import { calcularDescontoCupom, esquemaCupom } from "@barzzo/dominio";
import type { Cupom } from "@barzzo/tipos";

const base = {
  codigo: "SEMFIM",
  tipo_desconto: "percentual" as const,
  valor_desconto: 10,
  data_inicio: "2026-01-01",
};

describe("Cupom sem data de término", () => {
  it("aceita data de término ausente, nula ou vazia", () => {
    expect(esquemaCupom.safeParse(base).success).toBe(true);
    expect(esquemaCupom.safeParse({ ...base, data_fim: null }).success).toBe(true);
    expect(esquemaCupom.safeParse({ ...base, data_fim: "" }).success).toBe(true);
  });

  it("continua validando a ordem das datas quando o término é informado", () => {
    expect(esquemaCupom.safeParse({ ...base, data_fim: "2025-12-31" }).success).toBe(false);
    expect(esquemaCupom.safeParse({ ...base, data_fim: "2026-12-31" }).success).toBe(true);
  });

  const cupom: Cupom = {
    id: "c1",
    barbearia_id: "b1",
    codigo: "SEMFIM",
    descricao: null,
    tipo_desconto: "percentual",
    valor_desconto: 10,
    valor_minimo_reserva: 0,
    limite_usos_total: null,
    limite_usos_por_cliente: null,
    usos_atuais: 0,
    apenas_primeira_reserva: false,
    ativo: true,
    data_inicio: "2026-01-01T00:00:00Z",
    data_fim: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  } as Cupom;

  it("vale em qualquer data depois do início enquanto estiver ativo", () => {
    const daqui10Anos = calcularDescontoCupom({ cupom, valorTotal: 100, agora: new Date("2036-06-01T12:00:00Z") });
    expect(daqui10Anos.valido).toBe(true);
    expect(daqui10Anos.valor_desconto_calculado).toBe(10);
  });

  it("não vale antes do início nem depois de desativado", () => {
    expect(calcularDescontoCupom({ cupom, valorTotal: 100, agora: new Date("2025-12-01T12:00:00Z") }).valido).toBe(false);
    const desativado = calcularDescontoCupom({ cupom: { ...cupom, ativo: false }, valorTotal: 100, agora: new Date("2026-06-01T12:00:00Z") });
    expect(desativado.valido).toBe(false);
  });
});
