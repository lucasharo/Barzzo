import { describe, expect, it } from "vitest";
import { calcularHorariosDisponiveis } from "@barzzo/dominio";

const servico: any = { id: "s", ativo: true, duracao_minutos: 30 };
const horarioBarbearia: any = {
  dia_semana: 1, hora_abertura: "09:00:00", hora_fechamento: "12:00:00",
  hora_inicio_almoco: null, hora_fim_almoco: null, ativo: true,
};
const jornada = { id: "j", dia_semana: 1, hora_inicio: "09:00:00", hora_fim: "12:00:00", hora_inicio_pausa: null, hora_fim_pausa: null, ativo: true };
const prof = (id: string) => ({ id, nome: id, ativo: true, habilitado: true, jornada: { ...jornada, profissional_id: id } });

function local(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return new Date(2026, 9, 5, h, m).toISOString();
}

describe("horários de 15 em 15 minutos respeitando concorrência", () => {
  it("bloqueia todo início que sobreponha um agendamento existente do profissional", () => {
    const slots = calcularHorariosDisponiveis({
      servico, horarioBarbearia, profissionais: [prof("a")], data: "2026-10-05", profissionalIdFiltro: null,
      agendamentosExistentes: [{ profissional_id: "a", inicio: local("10:00"), fim: local("10:30") }],
    } as any).map((s) => s.horario);

    // Termina às 10:00 (encosta, não sobrepõe) e começa às 10:30 (encosta): liberados
    expect(slots).toContain("09:30");
    expect(slots).toContain("10:30");
    // 09:45 (até 10:15), 10:00, 10:15 (até 10:45) sobrepõem: bloqueados
    for (const h of ["09:45", "10:00", "10:15"]) expect(slots).not.toContain(h);
  });

  it("outro profissional continua livre no mesmo intervalo", () => {
    const slots = calcularHorariosDisponiveis({
      servico, horarioBarbearia, profissionais: [prof("a"), prof("b")], data: "2026-10-05", profissionalIdFiltro: null,
      agendamentosExistentes: [{ profissional_id: "a", inicio: local("10:00"), fim: local("10:30") }],
    } as any);
    const as10 = slots.filter((s) => s.horario === "10:00").map((s) => s.profissional_id);
    expect(as10).toEqual(["b"]);
  });
});
