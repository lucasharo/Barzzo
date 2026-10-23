import { describe, expect, it } from "vitest";
import { apagarSeparadorMascarado, posicaoCursorMascarado } from "@barzzo/ui/input-mascarado";
import {
  formatarCep,
  formatarCpf,
  formatarCnpj,
  formatarDataDigitada,
  formatarDocumento,
  formatarNumeroCartao,
  formatarTelefone,
  formatarValidadeCartao,
} from "@barzzo/utilitarios";

describe("edição de campos mascarados", () => {
  it("mantém o cursor perto do dígito apagado no meio da data", () => {
    const digitado = "30/0/2026";
    expect(formatarDataDigitada(digitado)).toBe("30/0/2026");
    expect(posicaoCursorMascarado(digitado, 4, formatarDataDigitada)).toBe(4);
    expect(formatarDataDigitada("30/09/2026")).toBe("30/09/2026");
    expect(formatarDataDigitada("3/09/2026")).toBe("3/09/2026");
    expect(formatarDataDigitada("30/092")).toBe("30/09/2");
  });

  it("apaga o dígito vizinho ao separador com Backspace ou Delete", () => {
    expect(apagarSeparadorMascarado("30/09/2026", 3, "Backspace", formatarDataDigitada))
      .toEqual({ valor: "30/92/026", cursor: 1 });
    expect(apagarSeparadorMascarado("30/09/2026", 2, "Delete", formatarDataDigitada))
      .toEqual({ valor: "30/92/026", cursor: 2 });
    expect(apagarSeparadorMascarado("(11) 98765-4321", 1, "Backspace", formatarTelefone))
      .toEqual({ valor: "(19) 8765-4321", cursor: 0 });
  });

  it("aceita digitação progressiva e colagem em telefone, CPF, CNPJ, documento, CEP e cartão", () => {
    expect(formatarTelefone("11987654321")).toBe("(11) 98765-4321");
    expect(formatarCpf("12345678901")).toBe("123.456.789-01");
    expect(formatarCnpj("12345678000190")).toBe("12.345.678/0001-90");
    expect(formatarDocumento("12345678901")).toBe("123.456.789-01");
    expect(formatarDocumento("12345678000190")).toBe("12.345.678/0001-90");
    expect(formatarCep("01310930")).toBe("01310-930");
    expect(formatarDataDigitada("30092026")).toBe("30/09/2026");
    expect(formatarDataDigitada("2026-09-30")).toBe("30/09/2026");
    expect(formatarNumeroCartao("4111111111111111")).toBe("4111 1111 1111 1111");
    expect(formatarValidadeCartao("1230")).toBe("12/30");
  });
});
