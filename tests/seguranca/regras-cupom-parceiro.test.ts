import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260930135753_revisao_cupons_influenciadores.sql", import.meta.url),
  "utf8"
);
const formulario = readFileSync(
  new URL("../../apps/parceiro/src/pages/campanhas/Detalhes.tsx", import.meta.url),
  "utf8"
);

describe("Escopo de cupons do Parceiro", () => {
  it("fixa o histórico local e não oferece a opção global no formulário", () => {
    expect(formulario).not.toContain('rotulo: "Em todo o Barzzo"');
    expect(formulario.match(/escopo_historico: "BARBEARIA"/g)).toHaveLength(2);
  });

  it("reserva o escopo GLOBAL_BARZZO ao Admin na leitura e gravação da política", () => {
    const politica = migration.match(
      /CREATE POLICY "Membros gerenciam regras de cupons da barbearia"[\s\S]*?(?=CREATE POLICY "Membros visualizam utilizações)/
    )?.[0];
    expect(politica).toBeDefined();
    expect(politica?.match(/escopo_historico = 'BARBEARIA'/g)).toHaveLength(2);
    expect(politica?.match(/public\.eh_admin\(\)/g)).toHaveLength(2);
  });
});

describe("Faixas do cupom no Parceiro", () => {
  it("usa apenas o switch de primeira reserva e mostra a faixa seguinte quando desligado", () => {
    expect(formulario).not.toContain("faixaSeguinteAtiva");
    expect(formulario).not.toContain("Ativar faixa para atendimentos seguintes");
    expect(formulario).toContain("{apenasPrimeiraReserva ? (");
    expect(formulario).toContain('id="valorDescontoSeguinte"');
  });

  it("só envia a faixa seguinte quando o switch está desligado e a limita ao histórico a partir de um", () => {
    expect(formulario).toContain("if (!apenasPrimeiraReserva) {");
    expect(formulario).toContain("atendimentos_maximos: 0,");
    expect(formulario).toContain("atendimentos_minimos: 1,");
    expect(formulario).toContain("limite_usos_por_cliente: limiteClienteSeguinteNum,");
  });
});
