import { describe, expect, it } from "vitest";
import { dataLocalIso } from "@barzzo/utilitarios";
import { calcularHorariosDisponiveis } from "@barzzo/dominio";

describe("dataLocalIso", () => {
  it("usa a data do dispositivo, sem virar o dia por causa do UTC", () => {
    expect(dataLocalIso(new Date(2026, 9, 23, 23, 30))).toBe("2026-10-23");
    expect(dataLocalIso(new Date(2026, 0, 5, 0, 5))).toBe("2026-01-05");
  });
});

describe("disponibilidade no dia de hoje", () => {
  const base: any = {
    servico: { id: "s", ativo: true, duracao_minutos: 40 },
    horarioBarbearia: { dia_semana: 5, hora_abertura: "09:00:00", hora_fechamento: "20:00:00", hora_inicio_almoco: null, hora_fim_almoco: null, ativo: true },
    profissionais: [{
      id: "p", nome: "Douglas", ativo: true, habilitado: true,
      jornada: { id: "j", profissional_id: "p", dia_semana: 5, hora_inicio: "09:00:00", hora_fim: "20:00:00", hora_inicio_pausa: null, hora_fim_pausa: null, ativo: true },
    }],
    profissionalIdFiltro: null,
  };

  it("descarta horários já passados na data local de hoje", () => {
    const agora = new Date(2026, 9, 23, 15, 10);
    const horarios = calcularHorariosDisponiveis({ ...base, data: "2026-10-23", agora }).map((s) => s.horario);
    expect(horarios[0]).toBe("15:15");
    expect(horarios).not.toContain("15:00");
  });

  it("à noite ainda trata a data local como hoje (sem horários após o fechamento)", () => {
    const agora = new Date(2026, 9, 23, 19, 47);
    expect(calcularHorariosDisponiveis({ ...base, data: "2026-10-23", agora })).toHaveLength(0);
  });

  it("não filtra horários de outra data", () => {
    const agora = new Date(2026, 9, 23, 19, 47);
    expect(calcularHorariosDisponiveis({ ...base, data: "2026-10-30", agora }).length).toBeGreaterThan(0);
  });
});
