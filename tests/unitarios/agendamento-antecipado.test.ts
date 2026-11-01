import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ler = (caminho: string) => readFileSync(new URL(`../../${caminho}`, import.meta.url), "utf8");

describe("Reagendamento automático de atendimento antecipado", () => {
  const sql = ler("supabase/migrations/20261031210000_ajustar_horario_agendamento_antecipado.sql");

  it("define atualizar_status_agendamento com SECURITY DEFINER e search_path fixo", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.atualizar_status_agendamento");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = public, pg_temp");
  });

  it("atualiza inicio_previsto e fim_previsto quando atendimento inicia antes do previsto (em_atendimento)", () => {
    expect(sql).toContain("IF v_inicio_real < v_agendamento.inicio_previsto THEN");
    expect(sql).toContain("v_novo_inicio := v_inicio_real;");
    expect(sql).toContain("v_novo_fim := v_novo_inicio + (v_duracao_minutos || ' minutes')::interval;");
    expect(sql).toContain("inicio_previsto = v_novo_inicio");
    expect(sql).toContain("fim_previsto = v_novo_fim");
  });

  it("valida conflitos com outros agendamentos do profissional e do cliente ao antecipar", () => {
    expect(sql).toContain("Não é possível antecipar o agendamento: o profissional já possui outro atendimento agendado neste horário.");
    expect(sql).toContain("Não é possível antecipar o agendamento: o cliente já possui outro atendimento agendado neste horário.");
  });

  it("ajusta inicio_previsto e fim_previsto na conclusão quando o atendimento foi realizado antecipadamente", () => {
    expect(sql).toContain("ELSIF p_novo_status = 'concluido' THEN");
    expect(sql).toContain("IF v_inicio_real < v_agendamento.inicio_previsto THEN");
    expect(sql).toContain("inicio_previsto = v_novo_inicio");
    expect(sql).toContain("fim_previsto = v_novo_fim");
  });

  it("libera os minutos restantes na conclusão quando encerra antes do fim previsto original", () => {
    expect(sql).toContain("ELSIF v_fim_real < v_agendamento.fim_previsto AND v_fim_real > v_agendamento.inicio_previsto THEN");
    expect(sql).toContain("fim_previsto = v_fim_real");
  });

  it("simulação lógica de reagendamento antecipado", () => {
    // Horário agendado originalmente: 17:00 às 17:45 (45 min)
    const inicioPrevisto = new Date("2026-10-31T20:00:00.000Z"); // 17:00 BRT
    const fimPrevisto = new Date("2026-10-31T20:45:00.000Z"); // 17:45 BRT
    const duracaoMinutos = 45;

    // Cliente chega às 14:15 e o profissional inicia o atendimento
    const inicioReal = new Date("2026-10-31T17:15:00.000Z"); // 14:15 BRT
    expect(inicioReal.getTime()).toBeLessThan(inicioPrevisto.getTime());

    // Novo intervalo calculado para a grade da agenda
    const novoInicioPrevisto = new Date(inicioReal.getTime());
    const novoFimPrevisto = new Date(novoInicioPrevisto.getTime() + duracaoMinutos * 60000);

    expect(novoInicioPrevisto.toISOString()).toBe("2026-10-31T17:15:00.000Z");
    expect(novoFimPrevisto.toISOString()).toBe("2026-10-31T18:00:00.000Z");
    // O horário das 17:00 original foi liberado
    expect(novoFimPrevisto.getTime()).toBeLessThanOrEqual(inicioPrevisto.getTime());
  });
});
