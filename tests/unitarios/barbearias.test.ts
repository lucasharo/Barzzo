import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  esquemaCriarBarbearia,
  esquemaCriarProfissional,
  esquemaCriarConvite,
} from "@barzzo/validacoes";

describe("TASK-02: Barbearias, Onboarding e Equipe", () => {
  describe("Validações Zod — Barbearia", () => {
    it("deve aceitar barbearia com dados válidos", () => {
      const dados = {
        nome: "Barbearia Dom Lucas",
        slug: "barbearia-dom-lucas",
        telefone: "11988887777",
        email: "contato@domlucas.com",
        endereco: "Rua Augusta, 1000",
        bairro: "Consolação",
        cidade: "São Paulo",
        estado: "SP",
        cep: "01305100",
      };
      const res = esquemaCriarBarbearia.safeParse(dados);
      expect(res.success).toBe(true);
    });

    it("deve rejeitar slug com letras maiúsculas, espaços ou caracteres especiais", () => {
      const dados = {
        nome: "Barbearia Inválida",
        slug: "Barbearia Com Espaço!",
      };
      const res = esquemaCriarBarbearia.safeParse(dados);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.errors[0]?.message).toContain("apenas letras minúsculas, números e hífens");
      }
    });

    it("deve rejeitar nome muito curto", () => {
      const dados = {
        nome: "A",
        slug: "barbearia-a",
      };
      const res = esquemaCriarBarbearia.safeParse(dados);
      expect(res.success).toBe(false);
    });
  });

  describe("Validações Zod — Profissional", () => {
    it("deve aceitar profissional sem conta com nome válido", () => {
      const dados = {
        nome: "Barbeiro João",
        telefone: "11999998888",
        bio: "Especialista em barba clássica",
      };
      const res = esquemaCriarProfissional.safeParse(dados);
      expect(res.success).toBe(true);
    });

    it("deve rejeitar profissional com nome vazio", () => {
      const dados = { nome: "" };
      const res = esquemaCriarProfissional.safeParse(dados);
      expect(res.success).toBe(false);
    });
  });

  describe("Validações Zod — Convites de Equipe", () => {
    it("deve aceitar convite para papel profissional", () => {
      const dados = {
        email: "novo.barbeiro@barbearia.com",
        papel: "profissional",
      };
      const res = esquemaCriarConvite.safeParse(dados);
      expect(res.success).toBe(true);
    });

    it("deve aceitar convite para papel gerente", () => {
      const dados = {
        email: "gerente@barbearia.com",
        papel: "gerente",
      };
      const res = esquemaCriarConvite.safeParse(dados);
      expect(res.success).toBe(true);
    });

    it("deve rejeitar papel inválido (não pode convidar dono diretamente)", () => {
      const dados = {
        email: "outro@barbearia.com",
        papel: "dono",
      };
      const res = esquemaCriarConvite.safeParse(dados);
      expect(res.success).toBe(false);
    });
  });

  describe("Segurança e RLS Multi-Tenant no Banco", () => {
    const caminhoSql = path.resolve(
      __dirname,
      "../../supabase/migrations/20260925000001_criar_barbearias_e_equipe.sql"
    );

    it("o arquivo de migração da Task 02 deve existir", () => {
      expect(fs.existsSync(caminhoSql)).toBe(true);
    });

    const sql = fs.readFileSync(caminhoSql, "utf-8");

    it("deve habilitar Row Level Security em todas as 4 tabelas da Task 02", () => {
      expect(sql).toContain("ALTER TABLE public.barbearias ENABLE ROW LEVEL SECURITY;");
      expect(sql).toContain("ALTER TABLE public.membros_barbearia ENABLE ROW LEVEL SECURITY;");
      expect(sql).toContain("ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;");
      expect(sql).toContain("ALTER TABLE public.convites_profissionais ENABLE ROW LEVEL SECURITY;");
    });

    it("deve conter função de verificação multi-tenant usuario_eh_dono_ou_gerente", () => {
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.usuario_eh_dono_ou_gerente");
      expect(sql).toContain("papel IN ('dono', 'gerente')");
    });

    it("deve conter RPC atômica criar_barbearia_com_dono com trial de 30 dias", () => {
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.criar_barbearia_com_dono");
      expect(sql).toContain("interval '30 days'");
      expect(sql).toContain("VALUES (v_barbearia_id, auth.uid(), 'dono', true)");
    });

    it("deve conter RPC aceitar_convite_equipe para vincular profissional à conta", () => {
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.aceitar_convite_equipe");
      expect(sql).toContain("UPDATE public.profissionais");
      expect(sql).toContain("SET usuario_id = auth.uid()");
      expect(sql).toContain("INSERT INTO public.membros_barbearia");
    });
  });
});
