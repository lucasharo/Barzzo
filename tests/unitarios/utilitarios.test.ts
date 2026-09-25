import { describe, it, expect } from "vitest";
import {
  formatarTelefone,
  limparTelefone,
  extrairPrimeiroNome,
  obterIniciais,
} from "@barzzo/utilitarios";

describe("Utilitários e Formatadores", () => {
  describe("formatarTelefone", () => {
    it("deve formatar celular com 11 dígitos: (11) 98765-4321", () => {
      expect(formatarTelefone("11987654321")).toBe("(11) 98765-4321");
    });

    it("deve formatar telefone fixo com 10 dígitos: (11) 3456-7890", () => {
      expect(formatarTelefone("1134567890")).toBe("(11) 3456-7890");
    });

    it("deve formatar parcialmente durante digitação", () => {
      expect(formatarTelefone("11")).toBe("(11");
      expect(formatarTelefone("1198")).toBe("(11) 98");
    });

    it("deve retornar vazio se nulo ou vazio", () => {
      expect(formatarTelefone(null)).toBe("");
      expect(formatarTelefone("")).toBe("");
    });
  });

  describe("limparTelefone", () => {
    it("deve remover caracteres não numéricos", () => {
      expect(limparTelefone("(11) 98765-4321")).toBe("11987654321");
      expect(limparTelefone("+55 (11) 98765-4321")).toBe("5511987654321");
    });
  });

  describe("extrairPrimeiroNome", () => {
    it("deve retornar apenas o primeiro nome", () => {
      expect(extrairPrimeiroNome("Lucas Gabriel Silva")).toBe("Lucas");
      expect(extrairPrimeiroNome("Maria")).toBe("Maria");
      expect(extrairPrimeiroNome("")).toBe("");
    });
  });

  describe("obterIniciais", () => {
    it("deve extrair primeira e última inicial", () => {
      expect(obterIniciais("Lucas Silva")).toBe("LS");
      expect(obterIniciais("Carlos Eduardo Santos")).toBe("CS");
    });

    it("deve extrair duas letras para nome único", () => {
      expect(obterIniciais("Lucas")).toBe("LU");
    });

    it("deve retornar fallback se vazio", () => {
      expect(obterIniciais("")).toBe("BZ");
      expect(obterIniciais(null)).toBe("BZ");
    });
  });
});
