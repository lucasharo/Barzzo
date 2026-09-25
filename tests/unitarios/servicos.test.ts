import { describe, it, expect } from "vitest";
import {
  esquemaServico,
  esquemaHorarioBarbearia,
  esquemaJornadaProfissional,
  esquemaBloqueioAgenda,
} from "../../packages/validacoes/src/servicos";
import {
  calcularHorariosDisponiveis,
  timeParaMinutos,
  minutosParaTime,
  intervalosSobrepoem,
} from "../../packages/dominio/src/disponibilidade";
import type {
  Servico,
  HorarioBarbearia,
  JornadaProfissional,
  BloqueioAgenda,
} from "../../packages/tipos/src/servicos";

describe("TASK-03: Serviços, Jornadas e Disponibilidade", () => {
  describe("1. Utilitários de Tempo e Intervalos", () => {
    it("timeParaMinutos deve converter HH:MM em minutos corretamente", () => {
      expect(timeParaMinutos("00:00")).toBe(0);
      expect(timeParaMinutos("09:00")).toBe(540);
      expect(timeParaMinutos("14:30")).toBe(870);
      expect(timeParaMinutos("23:59")).toBe(1439);
    });

    it("minutosParaTime deve converter minutos em string formatada HH:MM", () => {
      expect(minutosParaTime(0)).toBe("00:00");
      expect(minutosParaTime(540)).toBe("09:00");
      expect(minutosParaTime(870)).toBe("14:30");
    });

    it("intervalosSobrepoem deve identificar sobreposição exata e disjunção", () => {
      // Sobreposição parcial
      expect(intervalosSobrepoem(540, 600, 570, 630)).toBe(true);
      // Intervalos contíguos (termina quando o outro começa) NÃO sobrepõem
      expect(intervalosSobrepoem(540, 600, 600, 660)).toBe(false);
      // Intervalos totalmente disjuntos
      expect(intervalosSobrepoem(540, 600, 700, 760)).toBe(false);
      // Um contido dentro do outro
      expect(intervalosSobrepoem(500, 700, 550, 650)).toBe(true);
    });
  });

  describe("2. Validações Zod de Serviços e Grade", () => {
    it("esquemaServico: aceita serviço válido", () => {
      const valido = {
        nome: "Corte Cabelo e Barba",
        descricao: "Corte navalhado e hidratação de barba",
        preco: 50.0,
        duracao_minutos: 45,
        ativo: true,
      };
      const res = esquemaServico.safeParse(valido);
      expect(res.success).toBe(true);
    });

    it("esquemaServico: rejeita duração inválida ou preço negativo", () => {
      const invalidoDuracao = {
        nome: "Corte",
        preco: 30,
        duracao_minutos: 0,
      };
      expect(esquemaServico.safeParse(invalidoDuracao).success).toBe(false);

      const invalidoPreco = {
        nome: "Corte",
        preco: -10,
        duracao_minutos: 30,
      };
      expect(esquemaServico.safeParse(invalidoPreco).success).toBe(false);
    });

    it("esquemaHorarioBarbearia: rejeita abertura após fechamento", () => {
      const invalido = {
        dia_semana: 1,
        hora_abertura: "19:00",
        hora_fechamento: "09:00",
        ativo: true,
      };
      expect(esquemaHorarioBarbearia.safeParse(invalido).success).toBe(false);
    });

    it("esquemaHorarioBarbearia: valida intervalo de almoço contido no expediente", () => {
      const valido = {
        dia_semana: 1,
        hora_abertura: "09:00",
        hora_fechamento: "19:00",
        hora_inicio_almoco: "12:00",
        hora_fim_almoco: "13:00",
        ativo: true,
      };
      expect(esquemaHorarioBarbearia.safeParse(valido).success).toBe(true);

      const almocoFora = {
        dia_semana: 1,
        hora_abertura: "09:00",
        hora_fechamento: "19:00",
        hora_inicio_almoco: "19:00",
        hora_fim_almoco: "20:00",
        ativo: true,
      };
      expect(esquemaHorarioBarbearia.safeParse(almocoFora).success).toBe(false);
    });

    it("esquemaBloqueioAgenda: valida período de início anterior ao término", () => {
      const valido = {
        barbearia_id: "00000000-0000-0000-0000-000000000001",
        inicio: "2026-10-01T09:00:00.000Z",
        fim: "2026-10-01T12:00:00.000Z",
        motivo: "Manutenção de cadeiras",
      };
      expect(esquemaBloqueioAgenda.safeParse(valido).success).toBe(true);

      const invertido = {
        barbearia_id: "00000000-0000-0000-0000-000000000001",
        inicio: "2026-10-01T14:00:00.000Z",
        fim: "2026-10-01T12:00:00.000Z",
        motivo: "Erro",
      };
      expect(esquemaBloqueioAgenda.safeParse(invertido).success).toBe(false);
    });
  });

  describe("3. Motor de Disponibilidade (calcularHorariosDisponiveis)", () => {
    const servicoPadrao: Servico = {
      id: "srv-01",
      barbearia_id: "barb-01",
      nome: "Corte Tradicional",
      descricao: null,
      preco: 40,
      duracao_minutos: 30,
      ativo: true,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };

    const horarioBarbeariaSegunda: HorarioBarbearia = {
      id: "hb-01",
      barbearia_id: "barb-01",
      dia_semana: 1,
      hora_abertura: "09:00",
      hora_fechamento: "12:00", // expediente curto para facilitar o teste: 09:00 a 12:00
      hora_inicio_almoco: null,
      hora_fim_almoco: null,
      ativo: true,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };

    const jornadaProfissional: JornadaProfissional = {
      id: "jp-01",
      profissional_id: "prof-01",
      dia_semana: 1,
      hora_inicio: "09:00",
      hora_fim: "12:00",
      hora_inicio_pausa: null,
      hora_fim_pausa: null,
      ativo: true,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };

    const profissionalApto = {
      id: "prof-01",
      nome: "Carlos Barbeiro",
      ativo: true,
      habilitado: true,
      jornada: jornadaProfissional,
    };

    it("deve retornar vazio se o serviço for inativo", () => {
      const slots = calcularHorariosDisponiveis({
        servico: { ...servicoPadrao, ativo: false },
        horarioBarbearia: horarioBarbeariaSegunda,
        profissionais: [profissionalApto],
        data: "2026-10-05",
      });
      expect(slots).toEqual([]);
    });

    it("deve retornar vazio se a barbearia estiver fechada no dia", () => {
      const slots = calcularHorariosDisponiveis({
        servico: servicoPadrao,
        horarioBarbearia: { ...horarioBarbeariaSegunda, ativo: false },
        profissionais: [profissionalApto],
        data: "2026-10-05",
      });
      expect(slots).toEqual([]);
    });

    it("deve gerar slots a cada 30min entre 09:00 e 12:00", () => {
      const slots = calcularHorariosDisponiveis({
        servico: servicoPadrao, // 30 min
        horarioBarbearia: horarioBarbeariaSegunda, // 09:00 às 12:00
        profissionais: [profissionalApto],
        data: "2026-10-05",
      });

      // 09:00 (até 09:30), 09:30 (até 10:00), 10:00 (até 10:30), 10:30 (até 11:00), 11:00 (até 11:30), 11:30 (até 12:00)
      const horarios = slots.map((s) => s.horario);
      expect(horarios).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
    });

    it("deve impedir slots cuja duração cruza o fechamento", () => {
      // Serviço de 45 minutos com passos de 30 minutos
      // 09:00 (até 09:45) -> OK
      // 09:30 (até 10:15) -> OK
      // 10:00 (até 10:45) -> OK
      // 10:30 (até 11:15) -> OK
      // 11:00 (até 11:45) -> OK
      // 11:30 (até 12:15) -> Ultrapassa 12:00! NÃO DEVE SER OFERECIDO
      const slots = calcularHorariosDisponiveis({
        servico: { ...servicoPadrao, duracao_minutos: 45 },
        horarioBarbearia: horarioBarbeariaSegunda,
        profissionais: [profissionalApto],
        data: "2026-10-05",
      });

      const horarios = slots.map((s) => s.horario);
      expect(horarios).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
      expect(horarios.includes("11:30")).toBe(false);
    });

    it("deve excluir horários durante o almoço da barbearia", () => {
      const hbComAlmoco: HorarioBarbearia = {
        ...horarioBarbeariaSegunda,
        hora_fechamento: "14:00",
        hora_inicio_almoco: "11:00",
        hora_fim_almoco: "12:00",
      };

      const jpAmpliada: JornadaProfissional = {
        ...jornadaProfissional,
        hora_fim: "14:00",
      };

      const slots = calcularHorariosDisponiveis({
        servico: servicoPadrao, // 30 min
        horarioBarbearia: hbComAlmoco,
        profissionais: [{ ...profissionalApto, jornada: jpAmpliada }],
        data: "2026-10-05",
      });

      const horarios = slots.map((s) => s.horario);
      // Almoço das 11:00 às 12:00 -> 11:00 e 11:30 não podem ser oferecidos
      expect(horarios.includes("11:00")).toBe(false);
      expect(horarios.includes("11:30")).toBe(false);
      // 10:30 (vai até 11:00) -> OK
      expect(horarios.includes("10:30")).toBe(true);
      // 12:00 (vai até 12:30) -> OK
      expect(horarios.includes("12:00")).toBe(true);
    });

    it("deve excluir horários sobrepostos por bloqueios pontuais", () => {
      const bloqueio: BloqueioAgenda = {
        id: "bloq-01",
        barbearia_id: "barb-01",
        profissional_id: null, // Bloqueio geral da barbearia
        inicio: "2026-10-05T10:00:00.000Z",
        fim: "2026-10-05T11:00:00.000Z",
        motivo: "Reunião de equipe",
        criado_em: new Date().toISOString(),
      };

      const slots = calcularHorariosDisponiveis({
        servico: servicoPadrao,
        horarioBarbearia: horarioBarbeariaSegunda,
        profissionais: [profissionalApto],
        bloqueios: [bloqueio],
        data: "2026-10-05",
      });

      const horarios = slots.map((s) => s.horario);
      // Slots das 10:00 e 10:30 devem ser bloqueados
      expect(horarios.includes("10:00")).toBe(false);
      expect(horarios.includes("10:30")).toBe(false);
      expect(horarios.includes("09:30")).toBe(true);
      expect(horarios.includes("11:00")).toBe(true);
    });

    it("deve listar múltiplos profissionais quando ambos estiverem disponíveis", () => {
      const prof2 = {
        id: "prof-02",
        nome: "Ana Barbeira",
        ativo: true,
        habilitado: true,
        jornada: {
          ...jornadaProfissional,
          id: "jp-02",
          profissional_id: "prof-02",
        },
      };

      const slots = calcularHorariosDisponiveis({
        servico: servicoPadrao,
        horarioBarbearia: horarioBarbeariaSegunda,
        profissionais: [profissionalApto, prof2],
        data: "2026-10-05",
      });

      // Às 09:00 deve haver slot para ambos os profissionais
      const slotsDas09 = slots.filter((s) => s.horario === "09:00");
      expect(slotsDas09.length).toBe(2);
      expect(slotsDas09.some((s) => s.profissional_id === "prof-01")).toBe(true);
      expect(slotsDas09.some((s) => s.profissional_id === "prof-02")).toBe(true);
    });

    it("deve filtrar por profissional específico quando solicitado", () => {
      const prof2 = {
        id: "prof-02",
        nome: "Ana Barbeira",
        ativo: true,
        habilitado: true,
        jornada: {
          ...jornadaProfissional,
          id: "jp-02",
          profissional_id: "prof-02",
        },
      };

      const slots = calcularHorariosDisponiveis({
        servico: servicoPadrao,
        horarioBarbearia: horarioBarbeariaSegunda,
        profissionais: [profissionalApto, prof2],
        data: "2026-10-05",
        profissionalIdFiltro: "prof-02",
      });

      expect(slots.every((s) => s.profissional_id === "prof-02")).toBe(true);
    });
  });
});
