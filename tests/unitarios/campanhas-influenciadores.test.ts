import { describe, it, expect } from "vitest";
import {
  esquemaCampanha,
  esquemaCupom,
  esquemaInfluenciador,
  esquemaValidarCupom,
} from "@barzzo/validacoes";
import {
  calcularDescontoCupom,
  calcularValorComissao,
  gerarLinkInfluenciador,
} from "@barzzo/dominio";
import type { Cupom } from "@barzzo/tipos";

describe("Task 08 — Campanhas, Cupons e Influenciadores", () => {
  describe("Validação de Cupons (esquemaCupom)", () => {
    it("deve aceitar cupom percentual válido com regras completas", () => {
      const res = esquemaCupom.safeParse({
        codigo: "VERAO20",
        tipo_desconto: "percentual",
        valor_desconto: 20,
        data_inicio: "2026-09-01T00:00:00Z",
        data_fim: "2026-10-31T23:59:59Z",
        limite_usos_total: 100,
        valor_minimo_reserva: 50,
        apenas_primeira_reserva: false,
        ativo: true,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.codigo).toBe("VERAO20");
        expect(res.data.tipo_desconto).toBe("percentual");
        expect(res.data.valor_desconto).toBe(20);
      }
    });

    it("deve converter código para letras maiúsculas automaticamente", () => {
      const res = esquemaCupom.safeParse({
        codigo: "desconto10",
        tipo_desconto: "valor_fixo",
        valor_desconto: 10,
        data_inicio: "2026-01-01",
        data_fim: "2026-12-31",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.codigo).toBe("DESCONTO10");
      }
    });

    it("deve rejeitar código com caracteres especiais ou espaços", () => {
      const res = esquemaCupom.safeParse({
        codigo: "CUPOM INVÁLIDO!",
        tipo_desconto: "valor_fixo",
        valor_desconto: 15,
        data_inicio: "2026-01-01",
        data_fim: "2026-12-31",
      });

      expect(res.success).toBe(false);
    });

    it("deve rejeitar percentual acima de 100%", () => {
      const res = esquemaCupom.safeParse({
        codigo: "SUPER150",
        tipo_desconto: "percentual",
        valor_desconto: 150,
        data_inicio: "2026-01-01",
        data_fim: "2026-12-31",
      });

      expect(res.success).toBe(false);
    });
  });

  describe("Validação de Influenciadores (esquemaInfluenciador)", () => {
    it("deve validar parceiro influenciador com comissão percentual e chave Pix", () => {
      const res = esquemaInfluenciador.safeParse({
        nome: "Barba & Estilo Blog",
        email: "contato@barbaestilo.com.br",
        telefone: "11988887777",
        codigo_ref: "BARBAESTILO",
        tipo_comissao: "percentual",
        valor_comissao: 10,
        chave_pix: "contato@barbaestilo.com.br",
        ativo: true,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.codigo_ref).toBe("BARBAESTILO");
        expect(res.data.valor_comissao).toBe(10);
      }
    });

    it("deve aceitar comissão em valor fixo por atendimento", () => {
      const res = esquemaInfluenciador.safeParse({
        nome: "Canal do Navalha",
        codigo_ref: "NAVALHA5",
        tipo_comissao: "valor_fixo",
        valor_comissao: 7.5,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.tipo_comissao).toBe("valor_fixo");
        expect(res.data.valor_comissao).toBe(7.5);
      }
    });
  });

  describe("Cálculo e Validação de Cupom (calcularDescontoCupom)", () => {
    const cupomBase: Cupom = {
      id: "cup-1",
      barbearia_id: "barb-1",
      codigo: "PRIMEIRACOMPRA",
      tipo_desconto: "percentual",
      valor_desconto: 20,
      valor_minimo_reserva: 50,
      limite_usos_total: 10,
      usos_atuais: 2,
      apenas_primeira_reserva: true,
      ativo: true,
      data_inicio: "2026-09-01T00:00:00Z",
      data_fim: "2026-12-31T23:59:59Z",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    };

    it("deve aplicar desconto percentual de 20% para cliente novo atendendo requisitos", () => {
      const resultado = calcularDescontoCupom({
        cupom: cupomBase,
        valorTotal: 100,
        totalAgendamentosConcluidosCliente: 0,
        agora: new Date("2026-09-15T12:00:00Z"),
      });

      expect(resultado.valido).toBe(true);
      expect(resultado.valor_desconto_calculado).toBe(20);
      expect(resultado.valor_final).toBe(80);
    });

    it("deve rejeitar cupom inativo", () => {
      const resultado = calcularDescontoCupom({
        cupom: { ...cupomBase, ativo: false },
        valorTotal: 100,
      });

      expect(resultado.valido).toBe(false);
      expect(resultado.motivo_invalido).toContain("não está mais ativo");
    });

    it("deve rejeitar cupom com data expirada", () => {
      const resultado = calcularDescontoCupom({
        cupom: cupomBase,
        valorTotal: 100,
        agora: new Date("2027-01-01T00:00:00Z"),
      });

      expect(resultado.valido).toBe(false);
      expect(resultado.motivo_invalido).toContain("já expirou");
    });

    it("deve rejeitar cupom quando limite de utilizações for atingido", () => {
      const resultado = calcularDescontoCupom({
        cupom: { ...cupomBase, limite_usos_total: 10, usos_atuais: 10 },
        valorTotal: 100,
      });

      expect(resultado.valido).toBe(false);
      expect(resultado.motivo_invalido).toContain("limite de utilizações");
    });

    it("deve rejeitar cupom quando valor da reserva for menor que o mínimo", () => {
      const resultado = calcularDescontoCupom({
        cupom: cupomBase, // valor_minimo_reserva = 50
        valorTotal: 40,
        agora: new Date("2026-09-15T12:00:00Z"),
      });

      expect(resultado.valido).toBe(false);
      expect(resultado.motivo_invalido).toContain("valor mínimo");
    });

    it("deve rejeitar cupom de primeira reserva para cliente que já possui atendimentos concluídos", () => {
      const resultado = calcularDescontoCupom({
        cupom: cupomBase, // apenas_primeira_reserva = true
        valorTotal: 100,
        totalAgendamentosConcluidosCliente: 2,
        agora: new Date("2026-09-15T12:00:00Z"),
      });

      expect(resultado.valido).toBe(false);
      expect(resultado.motivo_invalido).toContain("primeira reserva");
    });

    it("deve aplicar desconto fixo com teto sem negativar o valor", () => {
      const cupomFixo: Cupom = {
        ...cupomBase,
        tipo_desconto: "valor_fixo",
        valor_desconto: 80,
        valor_minimo_reserva: 0,
        apenas_primeira_reserva: false,
      };

      const resultado = calcularDescontoCupom({
        cupom: cupomFixo,
        valorTotal: 60,
        agora: new Date("2026-09-15T12:00:00Z"),
      });

      expect(resultado.valido).toBe(true);
      expect(resultado.valor_desconto_calculado).toBe(60); // limitado ao total
      expect(resultado.valor_final).toBe(0);
    });

    it("deve validar elegibilidade de serviços restritos", () => {
      const cupomRestrito: Cupom = {
        ...cupomBase,
        servicos_elegiveis: ["serv-corte-1", "serv-corte-2"],
        apenas_primeira_reserva: false,
      };

      const rejeitado = calcularDescontoCupom({
        cupom: cupomRestrito,
        valorTotal: 100,
        servicosIds: ["serv-barba-1"],
        agora: new Date("2026-09-15T12:00:00Z"),
      });
      expect(rejeitado.valido).toBe(false);

      const aceito = calcularDescontoCupom({
        cupom: cupomRestrito,
        valorTotal: 100,
        servicosIds: ["serv-corte-2"],
        agora: new Date("2026-09-15T12:00:00Z"),
      });
      expect(aceito.valido).toBe(true);
    });
  });

  describe("Cálculo de Comissão de Influenciadores (calcularValorComissao)", () => {
    it("deve calcular comissão percentual corretamente", () => {
      const comissao = calcularValorComissao(120, "percentual", 15);
      expect(comissao).toBe(18); // 15% de 120 = 18.00
    });

    it("deve retornar valor fixo quando configurado como valor_fixo", () => {
      const comissao = calcularValorComissao(80, "valor_fixo", 12.5);
      expect(comissao).toBe(12.5);
    });

    it("deve retornar 0 se o valor dos serviços for nulo ou negativo", () => {
      expect(calcularValorComissao(0, "percentual", 10)).toBe(0);
      expect(calcularValorComissao(-50, "valor_fixo", 10)).toBe(0);
    });
  });

  describe("Geração de Links de Influenciador (gerarLinkInfluenciador)", () => {
    it("deve gerar link canônico com query parameter ref", () => {
      const link = gerarLinkInfluenciador(
        "https://barzzo.com.br",
        "navalha-de-ouro",
        "VINICIUS10"
      );
      expect(link).toBe("https://barzzo.com.br/barbearias/navalha-de-ouro?ref=VINICIUS10");
    });

    it("deve tratar barras extras na URL base", () => {
      const link = gerarLinkInfluenciador(
        "https://barzzo.com.br///",
        "barbearia-vintage",
        "PROMO_VIP"
      );
      expect(link).toBe("https://barzzo.com.br/barbearias/barbearia-vintage?ref=PROMO_VIP");
    });
  });
});
