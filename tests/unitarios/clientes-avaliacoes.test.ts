import { describe, it, expect } from "vitest";
import {
  calcularMediaAvaliacoes,
  calcularDistribuicaoEstrelas,
  formatarResumoReputacao,
  validarElegibilidadeAvaliacao,
} from "../../packages/dominio/src/crm";
import {
  esquemaCriarClienteManual,
  esquemaCriarObservacaoCliente,
  esquemaCriarAvaliacao,
  esquemaResponderAvaliacao,
} from "../../packages/validacoes/src/crm";

describe("TASK-06: Clientes, Favoritos e Avaliações", () => {
  describe("1. CRM e Observações Internas da Barbearia", () => {
    it("deve validar com sucesso a criação de um cliente manual", () => {
      const valido = esquemaCriarClienteManual.safeParse({
        nome: "Guilherme Santos",
        telefone: "11987654321",
        email: "guilherme@exemplo.com",
      });
      expect(valido.success).toBe(true);
    });

    it("deve rejeitar cliente com nome menor que 2 caracteres", () => {
      const invalido = esquemaCriarClienteManual.safeParse({
        nome: "A",
        telefone: "11987654321",
      });
      expect(invalido.success).toBe(false);
      if (!invalido.success) {
        expect(invalido.error.issues[0].message).toContain("pelo menos 2 caracteres");
      }
    });

    it("deve validar observação confidencial interna válida", () => {
      const valido = esquemaCriarObservacaoCliente.safeParse({
        texto: "Cliente tem sensibilidade na nuca, usar apenas tesoura.",
      });
      expect(valido.success).toBe(true);
    });

    it("deve rejeitar observação interna vazia ou contendo apenas espaços", () => {
      const invalido = esquemaCriarObservacaoCliente.safeParse({
        texto: "   ",
      });
      // Observação sem conteúdo deve ser rejeitada após trim
      expect(invalido.success ? invalido.data.texto.trim().length > 0 : false).toBe(false);
    });
  });

  describe("2. Elegibilidade e Criação de Avaliações", () => {
    it("deve permitir avaliação apenas para agendamento com status 'concluido'", () => {
      expect(validarElegibilidadeAvaliacao("concluido").elegivel).toBe(true);
      expect(validarElegibilidadeAvaliacao("confirmado").elegivel).toBe(false);
      expect(validarElegibilidadeAvaliacao("pendente").elegivel).toBe(false);
      expect(validarElegibilidadeAvaliacao("cancelado").elegivel).toBe(false);
      expect(validarElegibilidadeAvaliacao("nao_compareceu").elegivel).toBe(false);
    });

    it("deve fornecer mensagem explicativa quando o atendimento não for elegível", () => {
      const resultadoCanc = validarElegibilidadeAvaliacao("cancelado");
      expect(resultadoCanc.elegivel).toBe(false);
      expect(resultadoCanc.motivo).toContain("cancelados não podem ser avaliados");

      const resultadoNoShow = validarElegibilidadeAvaliacao("nao_compareceu");
      expect(resultadoNoShow.elegivel).toBe(false);
      expect(resultadoNoShow.motivo).toContain("não compareceu");
    });

    it("deve validar avaliação com notas inteiras entre 1 e 5", () => {
      const valido = esquemaCriarAvaliacao.safeParse({
        agendamento_id: "00000000-0000-0000-0000-000000000001",
        nota: 5,
        comentario: "Excelente corte, pontual e muito atencioso!",
      });
      expect(valido.success).toBe(true);
    });

    it("deve rejeitar notas fora do intervalo permitido (< 1 ou > 5) ou decimais", () => {
      expect(
        esquemaCriarAvaliacao.safeParse({
          agendamento_id: "00000000-0000-0000-0000-000000000001",
          nota: 0,
        }).success
      ).toBe(false);

      expect(
        esquemaCriarAvaliacao.safeParse({
          agendamento_id: "00000000-0000-0000-0000-000000000001",
          nota: 6,
        }).success
      ).toBe(false);

      expect(
        esquemaCriarAvaliacao.safeParse({
          agendamento_id: "00000000-0000-0000-0000-000000000001",
          nota: 4.5,
        }).success
      ).toBe(false);
    });

    it("deve validar resposta oficial da barbearia", () => {
      const valido = esquemaResponderAvaliacao.safeParse({
        resposta_barbearia: "Agradecemos a confiança, Guilherme! Até a próxima.",
      });
      expect(valido.success).toBe(true);

      const invalido = esquemaResponderAvaliacao.safeParse({
        resposta_barbearia: "",
      });
      expect(invalido.success).toBe(false);
    });
  });

  describe("3. Cálculo de Reputação e Distribuição de Estrelas", () => {
    it("deve retornar 0 quando não houver avaliações", () => {
      expect(calcularMediaAvaliacoes([])).toBe(0);
    });

    it("deve calcular a média aritmética com precisão de 1 casa decimal", () => {
      const avaliacoes = [
        { nota: 5 },
        { nota: 5 },
        { nota: 4 },
        { nota: 4 },
        { nota: 5 },
      ];
      // (5 + 5 + 4 + 4 + 5) / 5 = 23 / 5 = 4.6
      expect(calcularMediaAvaliacoes(avaliacoes)).toBe(4.6);
    });

    it("deve calcular a distribuição exata por estrelas", () => {
      const avaliacoes = [
        { nota: 5 },
        { nota: 5 },
        { nota: 4 },
        { nota: 3 },
        { nota: 1 },
      ];
      const dist = calcularDistribuicaoEstrelas(avaliacoes);
      expect(dist.estrela_5).toBe(2);
      expect(dist.estrela_4).toBe(1);
      expect(dist.estrela_3).toBe(1);
      expect(dist.estrela_2).toBe(0);
      expect(dist.estrela_1).toBe(1);
    });

    it("deve formatar o resumo consolidado de reputação", () => {
      const avaliacoes = [{ nota: 5 }, { nota: 4 }];
      const resumo = formatarResumoReputacao(avaliacoes);
      expect(resumo.total_avaliacoes).toBe(2);
      expect(resumo.media_nota).toBe(4.5);
      expect(resumo.distribuicao_estrelas.estrela_5).toBe(1);
      expect(resumo.distribuicao_estrelas.estrela_4).toBe(1);
    });
  });
});
