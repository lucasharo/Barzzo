import { describe, it, expect } from "vitest";
import {
  validarTransicaoStatus,
  selecionarProfissionalMenorCarga,
  calcularComparativoTempo,
  type CandidatoProfissional,
} from "../../packages/dominio/src/agenda";
import {
  esquemaCriarAgendamentoManual,
  esquemaReagendamento,
  esquemaAtualizarStatusAgendamento,
} from "../../packages/validacoes/src/agenda";

describe("TASK-04: Agenda e Agendamentos", () => {
  describe("1. Máquina de Estados e Transições de Status", () => {
    it("deve permitir transições válidas a partir de 'pendente'", () => {
      expect(validarTransicaoStatus("pendente", "confirmado")).toBe(true);
      expect(validarTransicaoStatus("pendente", "cancelado")).toBe(true);
      expect(validarTransicaoStatus("pendente", "em_atendimento")).toBe(false);
      expect(validarTransicaoStatus("pendente", "concluido")).toBe(false);
    });

    it("deve permitir transições válidas a partir de 'confirmado'", () => {
      expect(validarTransicaoStatus("confirmado", "em_atendimento")).toBe(true);
      expect(validarTransicaoStatus("confirmado", "cancelado")).toBe(true);
      expect(validarTransicaoStatus("confirmado", "nao_compareceu")).toBe(true);
      expect(validarTransicaoStatus("confirmado", "confirmado")).toBe(true); // reagendamento
      expect(validarTransicaoStatus("confirmado", "concluido")).toBe(false); // não pode concluir sem iniciar
    });

    it("deve permitir transições válidas a partir de 'em_atendimento'", () => {
      expect(validarTransicaoStatus("em_atendimento", "concluido")).toBe(true);
      expect(validarTransicaoStatus("em_atendimento", "cancelado")).toBe(true);
      expect(validarTransicaoStatus("em_atendimento", "confirmado")).toBe(false);
      expect(validarTransicaoStatus("em_atendimento", "pendente")).toBe(false);
    });

    it("deve bloquear qualquer alteração em estados terminais (concluido, cancelado, nao_compareceu)", () => {
      expect(validarTransicaoStatus("concluido", "em_atendimento")).toBe(false);
      expect(validarTransicaoStatus("concluido", "cancelado")).toBe(false);

      expect(validarTransicaoStatus("cancelado", "confirmado")).toBe(false);
      expect(validarTransicaoStatus("cancelado", "em_atendimento")).toBe(false);

      expect(validarTransicaoStatus("nao_compareceu", "confirmado")).toBe(false);
      expect(validarTransicaoStatus("nao_compareceu", "em_atendimento")).toBe(false);
    });
  });

  describe("2. Algoritmo 'Qualquer Profissional' (Menor Carga do Dia)", () => {
    it("deve selecionar o profissional ativo com menor carga de atendimentos no dia", () => {
      const candidatos: CandidatoProfissional[] = [
        { id: "prof-01", nome: "Bruno", ativo: true, totalAgendamentosNoDia: 5 },
        { id: "prof-02", nome: "Carlos", ativo: true, totalAgendamentosNoDia: 2 },
        { id: "prof-03", nome: "André", ativo: true, totalAgendamentosNoDia: 4 },
      ];

      const selecionado = selecionarProfissionalMenorCarga(candidatos);
      expect(selecionado?.id).toBe("prof-02");
    });

    it("deve desempatar por ordem alfabética de nome em caso de mesma carga", () => {
      const candidatos: CandidatoProfissional[] = [
        { id: "prof-01", nome: "Thiago", ativo: true, totalAgendamentosNoDia: 2 },
        { id: "prof-02", nome: "André", ativo: true, totalAgendamentosNoDia: 2 },
        { id: "prof-03", nome: "Marcos", ativo: true, totalAgendamentosNoDia: 2 },
      ];

      const selecionado = selecionarProfissionalMenorCarga(candidatos);
      expect(selecionado?.id).toBe("prof-02");
      expect(selecionado?.nome).toBe("André");
    });

    it("deve ignorar profissionais inativos", () => {
      const candidatos: CandidatoProfissional[] = [
        { id: "prof-01", nome: "André", ativo: false, totalAgendamentosNoDia: 0 },
        { id: "prof-02", nome: "Bruno", ativo: true, totalAgendamentosNoDia: 3 },
      ];

      const selecionado = selecionarProfissionalMenorCarga(candidatos);
      expect(selecionado?.id).toBe("prof-02");
    });

    it("deve retornar null se lista vazia ou sem ativos", () => {
      expect(selecionarProfissionalMenorCarga([])).toBeNull();
      expect(
        selecionarProfissionalMenorCarga([
          { id: "prof-01", nome: "Inativo", ativo: false, totalAgendamentosNoDia: 0 },
        ])
      ).toBeNull();
    });
  });

  describe("3. Comparativo de Tempos Previsto vs Real", () => {
    it("deve calcular duração prevista corretamente", () => {
      const comp = calcularComparativoTempo(
        "2026-10-05T09:00:00.000Z",
        "2026-10-05T09:45:00.000Z"
      );
      expect(comp.duracaoPrevistaMinutos).toBe(45);
      expect(comp.duracaoRealMinutos).toBeNull();
    });

    it("deve calcular atraso e duração real quando preenchidos", () => {
      // Previsto: 09:00 às 09:30 (30 min)
      // Real: Início 09:10 (10 min de atraso), Fim 09:45 (35 min de duração real)
      const comp = calcularComparativoTempo(
        "2026-10-05T09:00:00.000Z",
        "2026-10-05T09:30:00.000Z",
        "2026-10-05T09:10:00.000Z",
        "2026-10-05T09:45:00.000Z"
      );

      expect(comp.duracaoPrevistaMinutos).toBe(30);
      expect(comp.atrasoInicioMinutos).toBe(10);
      expect(comp.duracaoRealMinutos).toBe(35);
      expect(comp.diferencaDuracaoMinutos).toBe(5); // +5 min que o previsto
    });
  });

  describe("4. Validações Zod (esquemaCriarAgendamentoManual e esquemaReagendamento)", () => {
    it("esquemaCriarAgendamentoManual: aceita agendamento com dados válidos", () => {
      const valido = {
        barbearia_id: "00000000-0000-0000-0000-000000000001",
        profissional_id: "00000000-0000-0000-0000-000000000002",
        cliente_nome: "João da Silva",
        cliente_telefone: "(11) 99999-8888",
        inicio_previsto: "2026-10-05T09:00:00.000Z",
        fim_previsto: "2026-10-05T09:30:00.000Z",
        servicos: [
          {
            servico_id: "00000000-0000-0000-0000-000000000003",
            nome_servico: "Corte Social",
            preco: 45.0,
            duracao_minutos: 30,
          },
        ],
      };

      const res = esquemaCriarAgendamentoManual.safeParse(valido);
      expect(res.success).toBe(true);
    });

    it("esquemaCriarAgendamentoManual: rejeita término anterior ao início", () => {
      const invalido = {
        barbearia_id: "00000000-0000-0000-0000-000000000001",
        profissional_id: "00000000-0000-0000-0000-000000000002",
        cliente_nome: "João da Silva",
        inicio_previsto: "2026-10-05T10:00:00.000Z",
        fim_previsto: "2026-10-05T09:30:00.000Z",
        servicos: [
          {
            servico_id: "00000000-0000-0000-0000-000000000003",
            nome_servico: "Corte",
            preco: 45.0,
            duracao_minutos: 30,
          },
        ],
      };

      const res = esquemaCriarAgendamentoManual.safeParse(invalido);
      expect(res.success).toBe(false);
    });

    it("esquemaReagendamento: valida novo horário e rejeita início posterior ao fim", () => {
      const valido = {
        agendamento_id: "00000000-0000-0000-0000-000000000001",
        novo_inicio: "2026-10-06T14:00:00.000Z",
        novo_fim: "2026-10-06T14:30:00.000Z",
      };
      expect(esquemaReagendamento.safeParse(valido).success).toBe(true);

      const invalido = {
        agendamento_id: "00000000-0000-0000-0000-000000000001",
        novo_inicio: "2026-10-06T15:00:00.000Z",
        novo_fim: "2026-10-06T14:30:00.000Z",
      };
      expect(esquemaReagendamento.safeParse(invalido).success).toBe(false);
    });

    it("esquemaAtualizarStatusAgendamento: valida status aceito e rejeita inválido", () => {
      expect(esquemaAtualizarStatusAgendamento.safeParse({ status: "em_atendimento" }).success).toBe(true);
      expect(esquemaAtualizarStatusAgendamento.safeParse({ status: "status_inexistente" }).success).toBe(false);
    });
  });
});
