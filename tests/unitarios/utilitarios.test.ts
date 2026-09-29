import { describe, it, expect } from "vitest";
import {
  formatarTelefone,
  limparTelefone,
  extrairPrimeiroNome,
  obterIniciais,
  traduzirErro,
  formatarData,
  formatarDataHora,
  formatarHora,
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

  describe("traduzirErro", () => {
    it("deve traduzir erros de autenticação do Supabase", () => {
      expect(traduzirErro("Invalid login credentials")).toBe(
        "E-mail ou senha incorretos. Por favor, verifique seus dados e tente novamente."
      );
      expect(traduzirErro(new Error("User already registered"))).toBe(
        "Este e-mail já está cadastrado na plataforma. Tente fazer login."
      );
      expect(traduzirErro({ message: "JWT expired" })).toBe(
        "Sua sessão expirou. Por favor, faça login novamente para continuar."
      );
    });

    it("deve traduzir erros de conexão e rede", () => {
      expect(traduzirErro(new TypeError("Failed to fetch"))).toBe(
        "Falha na conexão de internet. Verifique sua rede e tente novamente."
      );
      expect(traduzirErro("NetworkError when attempting to fetch resource")).toBe(
        "Falha na conexão de internet. Verifique sua rede e tente novamente."
      );
    });

    it("deve traduzir erros de banco de dados e RLS", () => {
      expect(traduzirErro("new row violates row-level security policy")).toBe(
        "Você não tem permissão para realizar esta ação."
      );
      expect(traduzirErro("duplicate key value violates unique constraint")).toBe(
        "Já existe um registro com essas informações cadastradas."
      );
      expect(traduzirErro("exclusion_violation")).toBe(
        "Este horário já foi reservado ou está indisponível. Por favor, selecione outro horário."
      );
    });

    it("deve filtrar mensagens em inglês genéricas usando fallback em português", () => {
      const msgTraduzida = traduzirErro("Something went wrong with the database connection");
      expect(msgTraduzida).toBe(
        "Ocorreu um erro ao processar sua solicitação. Tente novamente."
      );
    });

    it("deve manter mensagens que já estão em português sem termos em inglês", () => {
      const msgPt = "Informe um e-mail válido para continuar";
      expect(traduzirErro(msgPt)).toBe(msgPt);
    });
  });

  describe("geocodificarEndereco", () => {
    it("deve retornar null para strings vazias ou com espaços em branco", async () => {
      const { geocodificarEndereco } = await import("@barzzo/utilitarios");
      expect(await geocodificarEndereco("")).toBeNull();
      expect(await geocodificarEndereco("   ")).toBeNull();
    });
  });

  describe("formatarData", () => {
    it("deve formatar data no formato YYYY-MM-DD para dd/MM/yyyy", () => {
      expect(formatarData("2026-09-29")).toBe("29/09/2026");
      expect(formatarData("2026-01-05")).toBe("05/01/2026");
    });

    it("deve manter datas já no formato dd/MM/yyyy", () => {
      expect(formatarData("29/09/2026")).toBe("29/09/2026");
    });

    it("deve formatar instâncias de Date", () => {
      const d = new Date(2026, 8, 29);
      expect(formatarData(d)).toBe("29/09/2026");
    });

    it("deve retornar vazio se nulo ou indefinido", () => {
      expect(formatarData(null)).toBe("");
      expect(formatarData(undefined)).toBe("");
      expect(formatarData("")).toBe("");
    });
  });

  describe("formatarDataHora", () => {
    it("deve formatar data e hora no formato dd/MM/yyyy HH:mm", () => {
      const d = new Date(2026, 8, 29, 14, 30);
      expect(formatarDataHora(d)).toBe("29/09/2026 14:30");
      expect(formatarDataHora(d, true)).toBe("29/09/2026 às 14:30");
    });
  });

  describe("formatarHora", () => {
    it("deve extrair e formatar apenas HH:mm", () => {
      expect(formatarHora("14:30:00")).toBe("14:30");
      expect(formatarHora("09:05")).toBe("09:05");
      const d = new Date(2026, 8, 29, 9, 5);
      expect(formatarHora(d)).toBe("09:05");
    });
  });
});

