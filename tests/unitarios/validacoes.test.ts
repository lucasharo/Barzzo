import { describe, it, expect } from "vitest";
import {
  esquemaLogin,
  esquemaCadastro,
  esquemaRecuperarSenha,
  esquemaAtualizarPerfil,
} from "@barzzo/validacoes";

describe("Validações Zod — Autenticação e Usuário", () => {
  describe("esquemaLogin", () => {
    it("deve aceitar login com credenciais válidas", () => {
      const dados = { email: "usuario@barzzo.com", senha: "senhaSegura123" };
      const resultado = esquemaLogin.safeParse(dados);
      expect(resultado.success).toBe(true);
    });

    it("deve rejeitar e-mail inválido", () => {
      const dados = { email: "email-invalido", senha: "senhaSegura123" };
      const resultado = esquemaLogin.safeParse(dados);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.errors[0]?.message).toBe("Informe um e-mail válido");
      }
    });

    it("deve rejeitar senha com menos de 6 caracteres", () => {
      const dados = { email: "usuario@barzzo.com", senha: "123" };
      const resultado = esquemaLogin.safeParse(dados);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.errors[0]?.message).toBe(
          "A senha deve ter no mínimo 6 caracteres"
        );
      }
    });
  });

  describe("esquemaCadastro", () => {
    it("deve aceitar cadastro válido com telefone formatado ou numérico", () => {
      const dados = {
        nome: "João da Silva",
        email: "joao@barzzo.com",
        telefone: "11987654321",
        senha: "minhaSenhaForte",
        confirmarSenha: "minhaSenhaForte",
      };
      const resultado = esquemaCadastro.safeParse(dados);
      expect(resultado.success).toBe(true);
    });

    it("deve aceitar cadastro sem telefone (opcional)", () => {
      const dados = {
        nome: "Maria Oliveira",
        email: "maria@barzzo.com",
        senha: "minhaSenhaForte",
        confirmarSenha: "minhaSenhaForte",
      };
      const resultado = esquemaCadastro.safeParse(dados);
      expect(resultado.success).toBe(true);
    });

    it("deve rejeitar nome muito curto", () => {
      const dados = {
        nome: "Al",
        email: "al@barzzo.com",
        senha: "minhaSenhaForte",
        confirmarSenha: "minhaSenhaForte",
      };
      const resultado = esquemaCadastro.safeParse(dados);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.errors[0]?.message).toBe(
          "O nome deve ter no mínimo 3 caracteres"
        );
      }
    });

    it("deve rejeitar senhas que não coincidem", () => {
      const dados = {
        nome: "Carlos Eduardo",
        email: "carlos@barzzo.com",
        senha: "senhaCorreta123",
        confirmarSenha: "outraSenha456",
      };
      const resultado = esquemaCadastro.safeParse(dados);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.errors[0]?.message).toBe("As senhas não conferem");
      }
    });

    it("deve rejeitar telefone com número de dígitos incorreto", () => {
      const dados = {
        nome: "Ana Paula",
        email: "ana@barzzo.com",
        telefone: "12345", // Menos de 10 dígitos
        senha: "senhaSegura123",
        confirmarSenha: "senhaSegura123",
      };
      const resultado = esquemaCadastro.safeParse(dados);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.errors[0]?.message).toContain(
          "Informe um telefone válido com DDD"
        );
      }
    });
  });

  describe("esquemaRecuperarSenha", () => {
    it("deve aceitar e-mail válido para recuperação", () => {
      const resultado = esquemaRecuperarSenha.safeParse({
        email: "contato@barzzo.com",
      });
      expect(resultado.success).toBe(true);
    });

    it("deve rejeitar e-mail em branco", () => {
      const resultado = esquemaRecuperarSenha.safeParse({ email: "" });
      expect(resultado.success).toBe(false);
    });
  });

  describe("esquemaAtualizarPerfil", () => {
    it("deve aceitar atualização de nome e telefone válidos", () => {
      const resultado = esquemaAtualizarPerfil.safeParse({
        nome: "Lucas Pereira",
        telefone: "11988887777",
        foto_url: "https://exemplo.supabase.co/storage/v1/object/public/avatares/foto.webp",
      });
      expect(resultado.success).toBe(true);
    });

    it("deve rejeitar URL de foto inválida", () => {
      const resultado = esquemaAtualizarPerfil.safeParse({
        nome: "Lucas Pereira",
        foto_url: "caminho-invalido-sem-url",
      });
      expect(resultado.success).toBe(false);
    });
  });
});
