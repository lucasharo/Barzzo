import { describe, it, expect } from "vitest";
import {
  calcularMRR,
  verificarAcessoPlano,
  validarCapacidadeEquipe,
  calcularEconomiaSemestral,
  formatarAcaoAuditoria,
} from "@barzzo/dominio";
import {
  esquemaPlano,
  esquemaBeneficioAssinatura,
  esquemaCheckoutAssinatura,
  esquemaAcaoAuditoria,
  esquemaModeracaoAvaliacao,
  esquemaStatusBarbeariaAdmin,
} from "@barzzo/validacoes";
import type { CicloAssinatura, StatusAssinatura } from "@barzzo/tipos";

describe("Task 10 — Assinaturas, Governança Admin e Auditoria", () => {
  describe("Cálculo de Receita Recorrente Mensal (calcularMRR)", () => {
    it("deve retornar 0 para listas vazias ou indefinidas", () => {
      expect(calcularMRR([])).toBe(0);
      expect(calcularMRR(null as any)).toBe(0);
    });

    it("deve somar assinaturas mensais ativas", () => {
      const assinaturas = [
        { ciclo: "mensal" as CicloAssinatura, valor: 49.9, status: "ativa" as StatusAssinatura },
        { ciclo: "mensal" as CicloAssinatura, valor: 99.9, status: "ativa" as StatusAssinatura },
      ];
      expect(calcularMRR(assinaturas)).toBe(149.8);
    });

    it("deve ratear o valor semestral em 6 parcelas para o MRR", () => {
      const assinaturas = [
        { ciclo: "semestral" as CicloAssinatura, valor: 600, status: "ativa" as StatusAssinatura },
      ];
      expect(calcularMRR(assinaturas)).toBe(100);
    });

    it("deve combinar assinaturas mensais e semestrais ativas com arredondamento preciso", () => {
      const assinaturas = [
        { ciclo: "mensal" as CicloAssinatura, valor: 99.9, status: "ativa" as StatusAssinatura },
        { ciclo: "semestral" as CicloAssinatura, valor: 499.0, status: "ativa" as StatusAssinatura }, // 499 / 6 = 83.1666...
      ];
      // 99.90 + 83.1666... = 183.07
      expect(calcularMRR(assinaturas)).toBe(183.07);
    });

    it("deve ignorar assinaturas em trial, vencidas, suspensas ou canceladas", () => {
      const assinaturas = [
        { ciclo: "mensal" as CicloAssinatura, valor: 99.9, status: "ativa" as StatusAssinatura },
        { ciclo: "mensal" as CicloAssinatura, valor: 99.9, status: "trial" as StatusAssinatura },
        { ciclo: "mensal" as CicloAssinatura, valor: 189.9, status: "vencida" as StatusAssinatura },
        { ciclo: "semestral" as CicloAssinatura, valor: 949.0, status: "suspensa" as StatusAssinatura },
        { ciclo: "mensal" as CicloAssinatura, valor: 49.9, status: "cancelada" as StatusAssinatura },
      ];
      expect(calcularMRR(assinaturas)).toBe(99.9);
    });

    it("deve ignorar valores negativos ou zerados", () => {
      const assinaturas = [
        { ciclo: "mensal" as CicloAssinatura, valor: 0, status: "ativa" as StatusAssinatura },
        { ciclo: "mensal" as CicloAssinatura, valor: -50, status: "ativa" as StatusAssinatura },
      ];
      expect(calcularMRR(assinaturas)).toBe(0);
    });
  });

  describe("Máquina de Estados de Acesso ao Plano (verificarAcessoPlano)", () => {
    const dataReferencia = new Date("2026-09-25T12:00:00Z");

    it("deve permitir acesso irrestrito para assinaturas ativas", () => {
      const res = verificarAcessoPlano("ativa", null, dataReferencia);
      expect(res.acessoPermitido).toBe(true);
      expect(res.motivoBloqueio).toBeUndefined();
    });

    it("deve permitir acesso para trial dentro do prazo de 30 dias", () => {
      const trialFuturo = "2026-10-25T12:00:00Z";
      const res = verificarAcessoPlano("trial", trialFuturo, dataReferencia);
      expect(res.acessoPermitido).toBe(true);
    });

    it("deve bloquear acesso com mensagem explicativa quando trial expira sem apagar dados", () => {
      const trialPassado = "2026-09-20T12:00:00Z";
      const res = verificarAcessoPlano("trial", trialPassado, dataReferencia);
      expect(res.acessoPermitido).toBe(false);
      expect(res.motivoBloqueio).toContain("Seu período de testes de 30 dias expirou");
    });

    it("deve bloquear acesso para assinatura suspensa pela administração", () => {
      const res = verificarAcessoPlano("suspensa", null, dataReferencia);
      expect(res.acessoPermitido).toBe(false);
      expect(res.motivoBloqueio).toContain("suspensa pela administração");
    });

    it("deve bloquear acesso para assinatura vencida orientando regularização", () => {
      const res = verificarAcessoPlano("vencida", null, dataReferencia);
      expect(res.acessoPermitido).toBe(false);
      expect(res.motivoBloqueio).toContain("vencida. Regularize o pagamento");
    });

    it("deve bloquear acesso para assinatura cancelada", () => {
      const res = verificarAcessoPlano("cancelada", null, dataReferencia);
      expect(res.acessoPermitido).toBe(false);
      expect(res.motivoBloqueio).toContain("inativa ou cancelada");
    });
  });

  describe("Validação de Capacidade da Equipe (validarCapacidadeEquipe)", () => {
    it("deve permitir profissionais ilimitados quando limite for nulo (Plano Rede)", () => {
      expect(validarCapacidadeEquipe(null, 50).permitido).toBe(true);
      expect(validarCapacidadeEquipe(undefined as any, 100).permitido).toBe(true);
    });

    it("deve validar plano Solo (limite = 1)", () => {
      expect(validarCapacidadeEquipe(1, 0).permitido).toBe(true);
      const bloqueio = validarCapacidadeEquipe(1, 1);
      expect(bloqueio.permitido).toBe(false);
      expect(bloqueio.motivo).toContain("permite no máximo 1 profissional");
    });

    it("deve validar plano Pro (limite = 5)", () => {
      expect(validarCapacidadeEquipe(5, 4).permitido).toBe(true);
      expect(validarCapacidadeEquipe(5, 5).permitido).toBe(false);
      expect(validarCapacidadeEquipe(5, 6).permitido).toBe(false);
    });

    it("deve validar plano Growth (limite = 15)", () => {
      expect(validarCapacidadeEquipe(15, 14).permitido).toBe(true);
      expect(validarCapacidadeEquipe(15, 15).permitido).toBe(false);
    });
  });

  describe("Cálculo de Economia Semestral (calcularEconomiaSemestral)", () => {
    it("deve calcular economia e percentual para o plano Solo (49.90 vs 249.00)", () => {
      const { economiaTotal, percentualEconomia } = calcularEconomiaSemestral(49.9, 249.0);
      // 49.90 * 6 = 299.40. Economia = 299.40 - 249.00 = 50.40. (50.40 / 299.40) = 16.83% -> 17%
      expect(economiaTotal).toBe(50.4);
      expect(percentualEconomia).toBe(17);
    });

    it("deve calcular economia e percentual para o plano Pro (99.90 vs 499.00)", () => {
      const { economiaTotal, percentualEconomia } = calcularEconomiaSemestral(99.9, 499.0);
      // 99.90 * 6 = 599.40. Economia = 599.40 - 499.00 = 100.40. (100.40 / 599.40) = 16.75% -> 17%
      expect(economiaTotal).toBe(100.4);
      expect(percentualEconomia).toBe(17);
    });

    it("deve retornar 0 para valores inválidos ou zerados", () => {
      expect(calcularEconomiaSemestral(0, 100)).toEqual({ economiaTotal: 0, percentualEconomia: 0 });
      expect(calcularEconomiaSemestral(100, -10)).toEqual({ economiaTotal: 0, percentualEconomia: 0 });
    });
  });

  describe("Formatação de Auditoria Admin (formatarAcaoAuditoria)", () => {
    it("deve converter identificadores técnicos para descrições amigáveis em português", () => {
      expect(formatarAcaoAuditoria("conceder_extensao_trial")).toBe("Extensão de Trial Concedida");
      expect(formatarAcaoAuditoria("ativar_assinatura")).toBe("Assinatura Ativada");
      expect(formatarAcaoAuditoria("suspender_barbearia")).toBe("Barbearia Suspensa");
      expect(formatarAcaoAuditoria("reativar_barbearia")).toBe("Barbearia Reativada");
      expect(formatarAcaoAuditoria("bloquear_avaliacao")).toBe("Avaliação Bloqueada");
    });

    it("deve tratar ações customizadas com fallback elegante", () => {
      expect(formatarAcaoAuditoria("alterar_configuracao_seguranca")).toBe("ALTERAR CONFIGURACAO SEGURANCA");
    });
  });

  describe("Validações Zod para Assinaturas e Admin", () => {
    it("deve validar plano com limites corretos (esquemaPlano)", () => {
      const res = esquemaPlano.safeParse({
        identificador: "pro",
        nome: "Plano Pro",
        descricao: "Ideal para equipes em crescimento.",
        limite_profissionais: 5,
        preco_mensal: 99.9,
        preco_semestral: 499.0,
        ativo: true,
        recursos: ["Até 5 profissionais", "Marketplace"],
      });
      expect(res.success).toBe(true);
    });

    it("deve rejeitar identificador de plano inválido", () => {
      const res = esquemaPlano.safeParse({
        identificador: "mega_invalido",
        nome: "Plano Teste",
        preco_mensal: 10,
        preco_semestral: 50,
      });
      expect(res.success).toBe(false);
    });

    it("deve validar benefício de extensão de trial (esquemaBeneficioAssinatura)", () => {
      const res = esquemaBeneficioAssinatura.safeParse({
        barbearia_id: "a0000000-0000-0000-0000-000000000001",
        tipo: "extensao_trial",
        dias_concedidos: 30,
        motivo: "Cliente em fase final de homologação do plano semestral.",
      });
      expect(res.success).toBe(true);
    });

    it("deve rejeitar extensão com menos de 1 dia ou motivo muito curto", () => {
      const resZero = esquemaBeneficioAssinatura.safeParse({
        barbearia_id: "a0000000-0000-0000-0000-000000000001",
        tipo: "extensao_trial",
        dias_concedidos: 0,
        motivo: "Válido",
      });
      expect(resZero.success).toBe(false);

      const resMotivoCurto = esquemaBeneficioAssinatura.safeParse({
        barbearia_id: "a0000000-0000-0000-0000-000000000001",
        tipo: "extensao_trial",
        dias_concedidos: 30,
        motivo: "Oi",
      });
      expect(resMotivoCurto.success).toBe(false);
    });

    it("deve validar checkout de assinatura (esquemaCheckoutAssinatura)", () => {
      const res = esquemaCheckoutAssinatura.safeParse({
        barbearia_id: "a0000000-0000-0000-0000-000000000001",
        plano_id: "b0000000-0000-0000-0000-000000000002",
        ciclo: "semestral",
      });
      expect(res.success).toBe(true);
    });

    it("deve validar moderação de avaliação (esquemaModeracaoAvaliacao)", () => {
      const res = esquemaModeracaoAvaliacao.safeParse({
        avaliacao_id: "c0000000-0000-0000-0000-000000000003",
        motivo_bloqueio: "Linguagem ofensiva violando as diretrizes da comunidade Barzzo.",
      });
      expect(res.success).toBe(true);
    });

    it("deve validar suspensão administrativa de barbearia (esquemaStatusBarbeariaAdmin)", () => {
      const res = esquemaStatusBarbeariaAdmin.safeParse({
        barbearia_id: "a0000000-0000-0000-0000-000000000001",
        status: "suspensa",
        motivo: "Descumprimento reiterado das políticas de agendamento e no-show.",
      });
      expect(res.success).toBe(true);
    });
  });
});
