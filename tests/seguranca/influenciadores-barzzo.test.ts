import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calcularDescontoCupom } from "@barzzo/dominio";
import type { Cupom, CupomRegra } from "@barzzo/tipos";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261024000600_influenciadores_do_barzzo.sql", import.meta.url),
  "utf8"
);

const trecho = (inicio: string) => migration.slice(migration.indexOf(inicio));

describe("Influenciadores do Barzzo (banco)", () => {
  it("o cupom global não tem barbearia e o influenciador global tem conta própria", () => {
    expect(migration).toContain("ALTER TABLE public.cupons ALTER COLUMN barbearia_id DROP NOT NULL");
    expect(migration).toContain("CHECK ((origem = 'BARZZO_GLOBAL') = (barbearia_id IS NULL))");
    expect(migration).toContain("CHECK (barbearia_id IS NOT NULL OR usuario_id IS NOT NULL)");
    expect(migration).toContain("idx_cupons_global_codigo_unico");
    expect(migration).toContain("idx_influenciadores_global_por_usuario");
  });

  it("o cadastro nasce com 5% de comissão, cupom pendente e descontos de 15% e 5%", () => {
    const corpo = trecho("FUNCTION public.cadastrar_influenciador_barzzo(");
    expect(corpo).toContain("'percentual', 5, true");
    expect(corpo).toContain("'pendente'");
    expect(corpo).toContain("(v_cupom_id, 10, 'GLOBAL_BARZZO', 0, 0, 'percentual', 15, 1)");
    expect(corpo).toContain("(v_cupom_id, 20, 'GLOBAL_BARZZO', 1, NULL, 'percentual', 5, NULL)");
    expect(corpo).toContain("auth.uid() IS NULL");
  });

  it("o influenciador não aprova o próprio cupom: só o Admin decide e altera tudo", () => {
    for (const funcao of ["admin_decidir_cupom_global", "admin_atualizar_influenciador_global"]) {
      const corpo = trecho(`FUNCTION public.${funcao}(`);
      expect(corpo.slice(0, 700)).toContain("IF NOT public.eh_admin()");
    }
    const alterar = trecho("FUNCTION public.alterar_cupom_influenciador_barzzo(");
    expect(alterar).toContain("v_cupom.status_aprovacao = 'aprovado'");
  });

  it("o cupom só vale se aprovado e se a barbearia aceitou, na validação e na confirmação", () => {
    const validacao = trecho("FUNCTION public.obter_cupom_por_codigo(");
    expect(validacao).toContain("c.status_aprovacao = 'aprovado'");
    expect(validacao).toContain("b.aceita_influenciadores_barzzo = true");

    const registro = trecho("FUNCTION public.registrar_uso_cupom(");
    expect(registro).toContain("v_cupom.status_aprovacao <> 'aprovado'");
    expect(registro).toContain("b.aceita_influenciadores_barzzo = true");
    expect(registro).toContain("Esta barbearia não aceita cupons de influenciadores do Barzzo.");
  });

  it("as funções de influenciador e Admin não ficam abertas ao anônimo", () => {
    for (const assinatura of [
      "cadastrar_influenciador_barzzo(text, text, text, text)",
      "alterar_cupom_influenciador_barzzo(text)",
      "atualizar_dados_influenciador_barzzo(text, text, text)",
      "obter_meu_cupom_barzzo()",
      "admin_decidir_cupom_global(uuid, boolean)",
      "admin_atualizar_influenciador_global(uuid, text, numeric, numeric, numeric, boolean)",
    ]) {
      expect(migration).toContain(`REVOKE ALL ON FUNCTION public.${assinatura} FROM PUBLIC, anon`);
    }
  });

  it("a barbearia só vê influenciador global que gerou comissão nela, sem recursão de policy", () => {
    expect(migration).toContain("usuario_paga_comissao_do_influenciador");
    expect(trecho("FUNCTION public.usuario_paga_comissao_do_influenciador(")).toContain("SECURITY DEFINER");
  });
});

describe("Influenciadores do Barzzo (desconto do cliente)", () => {
  const regra = (parcial: Partial<CupomRegra>): CupomRegra =>
    ({
      id: "r", cupom_id: "c", prioridade: 10, escopo_historico: "GLOBAL_BARZZO", atendimentos_minimos: 0,
      atendimentos_maximos: 0, tipo_desconto: "percentual", valor_desconto: 15, valor_minimo_reserva: 0,
      limite_usos_total: null, limite_usos_por_cliente: 1, servicos_elegiveis: [], ativo: true,
      ...parcial,
    }) as CupomRegra;

  const cupom = {
    id: "c", barbearia_id: null, codigo: "ANA10", origem: "BARZZO_GLOBAL", ativo: true, data_inicio: "2020-01-01T00:00:00Z",
    data_fim: null, valor_desconto: 15, tipo_desconto: "percentual", usos_atuais: 0, limite_usos_por_cliente: 1,
    apenas_primeira_reserva: false, valor_minimo_reserva: 0, limite_usos_total: null,
    regras: [regra({}), regra({ id: "r2", prioridade: 20, atendimentos_minimos: 1, atendimentos_maximos: null, valor_desconto: 5, limite_usos_por_cliente: null })],
  } as unknown as Cupom;

  const calcular = (global: number) =>
    calcularDescontoCupom({
      cupom,
      valorTotal: 100,
      servicosIds: ["s"],
      servicos: [{ id: "s", preco: 100 }],
      totalAgendamentosConcluidosCliente: global,
      historicoPorEscopo: { barbearia: global, global },
    });

  it("primeiro atendimento no Barzzo: 15%", () => {
    expect(calcular(0)).toMatchObject({ valido: true, valor_desconto_calculado: 15 });
  });

  it("demais atendimentos: 5%", () => {
    expect(calcular(1)).toMatchObject({ valido: true, valor_desconto_calculado: 5 });
    expect(calcular(12)).toMatchObject({ valido: true, valor_desconto_calculado: 5 });
  });
});
