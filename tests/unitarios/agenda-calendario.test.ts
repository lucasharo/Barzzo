import { describe, expect, it } from "vitest";
import {
  calcularFaixaHoras,
  chaveDiaLocal,
  minutosDoDiaLocal,
  posicionarSobrepostos,
  quantidadeColunasAgenda,
} from "@barzzo/dominio";

describe("agenda em calendário (funções puras)", () => {
  it("define 1 dia no celular e mais dias conforme a largura", () => {
    expect(quantidadeColunasAgenda(390)).toBe(1);
    expect(quantidadeColunasAgenda(639)).toBe(1);
    expect(quantidadeColunasAgenda(640)).toBe(3);
    expect(quantidadeColunasAgenda(899)).toBe(3);
    expect(quantidadeColunasAgenda(900)).toBe(5);
    expect(quantidadeColunasAgenda(1249)).toBe(5);
    expect(quantidadeColunasAgenda(1250)).toBe(7);
  });

  it("converte instantes para a data e o horário locais", () => {
    const instante = new Date(2026, 9, 23, 22, 45);
    expect(chaveDiaLocal(instante)).toBe("2026-10-23");
    expect(minutosDoDiaLocal(instante.toISOString())).toBe(22 * 60 + 45);
  });

  it("mantém a largura total quando não há sobreposição", () => {
    const blocos = posicionarSobrepostos([
      { id: "a", inicioMin: 600, fimMin: 640 },
      { id: "b", inicioMin: 640, fimMin: 700 },
    ]);
    expect(blocos.map((b) => [b.item.id, b.faixa, b.totalFaixas])).toEqual([
      ["a", 0, 1],
      ["b", 0, 1],
    ]);
  });

  it("coloca lado a lado os blocos que se sobrepõem e reaproveita faixas livres", () => {
    const blocos = posicionarSobrepostos([
      { id: "a", inicioMin: 600, fimMin: 660 },
      { id: "b", inicioMin: 615, fimMin: 645 },
      { id: "c", inicioMin: 660, fimMin: 690 },
    ]);
    const por = Object.fromEntries(blocos.map((b) => [b.item.id, [b.faixa, b.totalFaixas]]));
    expect(por.a).toEqual([0, 2]);
    expect(por.b).toEqual([1, 2]);
    // "c" começa quando "a" termina: ocupa a faixa 0 do mesmo grupo
    expect(por.c[0]).toBe(0);
  });

  it("calcula a faixa de horas com folga e usa o padrão quando tudo está fechado", () => {
    expect(
      calcularFaixaHoras([{ abertura: 9 * 60, fechamento: 19 * 60 }, { abertura: 8 * 60 + 30, fechamento: 18 * 60 }, null])
    ).toEqual({ inicioMin: 8 * 60, fimMin: 20 * 60 });
    expect(calcularFaixaHoras([null, null])).toEqual({ inicioMin: 8 * 60, fimMin: 20 * 60 });
  });
});

import { descreverMomentoAgendamento } from "@barzzo/dominio";

describe("descreverMomentoAgendamento", () => {
  const agora = new Date(2026, 9, 23, 13, 25);
  const marcar = (dia: number, h: number, m: number, dur = 40) => {
    const ini = new Date(2026, 9, dia, h, m);
    return [ini.toISOString(), new Date(ini.getTime() + dur * 60000).toISOString()] as const;
  };

  it("hoje, antes do início", () => {
    const [i, f] = marcar(23, 14, 0);
    expect(descreverMomentoAgendamento(i, f, "confirmado", agora)).toBe("Hoje · começa em 35 min");
    const [i2, f2] = marcar(23, 16, 30);
    expect(descreverMomentoAgendamento(i2, f2, "confirmado", agora)).toBe("Hoje · começa em 3 h 5 min");
  });

  it("em atendimento, concluído e cancelado ignoram a data", () => {
    const [i, f] = marcar(23, 13, 0);
    expect(descreverMomentoAgendamento(i, f, "em_atendimento", agora)).toBe("Em andamento desde 13:00");
    expect(descreverMomentoAgendamento(i, f, "cancelado", agora)).toBe("Não será realizado");
  });

  it("outros dias", () => {
    expect(descreverMomentoAgendamento(...marcar(24, 10, 0), "confirmado", agora)).toBe("Amanhã");
    expect(descreverMomentoAgendamento(...marcar(27, 10, 0), "confirmado", agora)).toBe("Daqui a 4 dias");
    expect(descreverMomentoAgendamento(...marcar(22, 10, 0), "confirmado", agora)).toBe("Ontem");
    expect(descreverMomentoAgendamento(...marcar(20, 10, 0), "confirmado", agora)).toBe("Há 3 dias");
  });
});

import { profissionaisLivresNaCelula } from "@barzzo/dominio";

describe("profissionaisLivresNaCelula (clique em horário vazio da agenda)", () => {
  const dia = new Date(2026, 9, 27); // terça
  const agora = new Date(2026, 9, 23, 12, 0);
  const funcionamento = { abertura: 9 * 60, fechamento: 19 * 60, almocoInicio: null, almocoFim: null };
  const jornada = (pausa = true) => ({
    dia_semana: 2, hora_inicio: "09:00:00", hora_fim: "19:00:00",
    hora_inicio_pausa: pausa ? "12:00:00" : null, hora_fim_pausa: pausa ? "13:00:00" : null, ativo: true,
  });
  const base = {
    dia, funcionamento, agora, bloqueios: [], agendamentos: [],
    profissionais: [{ id: "a", jornadas: [jornada()] }, { id: "b", jornadas: [jornada(false)] }],
  } as any;
  const iso = (h: number, m = 0) => new Date(2026, 9, 27, h, m).toISOString();

  it("libera horário futuro dentro do expediente para quem trabalha", () => {
    expect(profissionaisLivresNaCelula({ ...base, minutos: 10 * 60 })).toEqual(["a", "b"]);
  });

  it("não libera fora do expediente, passado ou barbearia fechada", () => {
    expect(profissionaisLivresNaCelula({ ...base, minutos: 8 * 60 })).toEqual([]);
    expect(profissionaisLivresNaCelula({ ...base, minutos: 18 * 60 + 45 })).toEqual(["a", "b"]);
    expect(profissionaisLivresNaCelula({ ...base, minutos: 19 * 60 })).toEqual([]);
    expect(profissionaisLivresNaCelula({ ...base, funcionamento: null, minutos: 10 * 60 })).toEqual([]);
    expect(profissionaisLivresNaCelula({ ...base, agora: new Date(2026, 9, 27, 10, 30), minutos: 10 * 60 })).toEqual([]);
  });

  it("respeita a pausa do profissional e o almoço da barbearia", () => {
    expect(profissionaisLivresNaCelula({ ...base, minutos: 12 * 60 + 15 })).toEqual(["b"]);
    expect(
      profissionaisLivresNaCelula({ ...base, funcionamento: { ...funcionamento, almocoInicio: 12 * 60, almocoFim: 13 * 60 }, minutos: 12 * 60 })
    ).toEqual([]);
  });

  it("ignora quem está ocupado ou bloqueado, mas não agendamentos cancelados", () => {
    const ag = (status: string) => ({ profissional_id: "a", inicio_previsto: iso(10), fim_previsto: iso(10, 40), status });
    expect(profissionaisLivresNaCelula({ ...base, agendamentos: [ag("confirmado")], minutos: 10 * 60 + 15 })).toEqual(["b"]);
    expect(profissionaisLivresNaCelula({ ...base, agendamentos: [ag("cancelado")], minutos: 10 * 60 + 15 })).toEqual(["a", "b"]);
    // célula logo depois do fim do agendamento está livre
    expect(profissionaisLivresNaCelula({ ...base, agendamentos: [ag("confirmado")], minutos: 10 * 60 + 45 })).toEqual(["a", "b"]);
    const bloqueioGeral = [{ inicio: iso(14), fim: iso(15), profissional_id: null }];
    expect(profissionaisLivresNaCelula({ ...base, bloqueios: bloqueioGeral, minutos: 14 * 60 })).toEqual([]);
    const bloqueioDoB = [{ inicio: iso(14), fim: iso(15), profissional_id: "b" }];
    expect(profissionaisLivresNaCelula({ ...base, bloqueios: bloqueioDoB, minutos: 14 * 60 })).toEqual(["a"]);
  });
});
