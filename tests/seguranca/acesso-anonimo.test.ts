import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ler = (caminho: string) => readFileSync(new URL(`../../${caminho}`, import.meta.url), "utf8");
const parte1 = ler("supabase/migrations/20261024000000_endurecer_acesso_anonimo.sql");
const parte2 = ler("supabase/migrations/20261024000100_restringir_leitura_anonima.sql");

function corpoDaFuncao(sql: string, nome: string): string {
  const inicio = sql.indexOf(`FUNCTION public.${nome}(`);
  expect(inicio, `função ${nome} não encontrada`).toBeGreaterThan(-1);
  const fim = sql.indexOf("$function$;", inicio);
  const fimAlternativo = sql.indexOf("$$;", inicio);
  return sql.slice(inicio, fim > -1 ? fim : fimAlternativo);
}

describe("RPCs SECURITY DEFINER conferem quem chama", () => {
  it("eh_admin devolve sempre booleano (NULL fazia 'IF NOT eh_admin()' nunca disparar)", () => {
    expect(corpoDaFuncao(parte1, "eh_admin")).toContain("COALESCE(");
    expect(parte1).not.toMatch(/IF NOT public\.eh_admin\(\) THEN/);
  });

  it("extensão de trial e métricas globais exigem Admin", () => {
    expect(corpoDaFuncao(parte1, "conceder_extensao_trial")).toContain("COALESCE(public.eh_admin(), false)");
    expect(corpoDaFuncao(parte1, "obter_metricas_admin_global")).toContain("COALESCE(public.eh_admin(), false)");
  });

  it("ativação de assinatura só pela chave de serviço", () => {
    expect(corpoDaFuncao(parte1, "processar_confirmacao_pagamento_assinatura")).toContain("public.eh_service_role()");
    expect(parte1).toMatch(/REVOKE ALL ON FUNCTION %s FROM authenticated/);
    expect(parte1).toContain("'processar_confirmacao_pagamento_assinatura'");
  });

  it("status e reagendamento exigem equipe da barbearia (cliente só cancela a própria reserva futura)", () => {
    const status = corpoDaFuncao(parte1, "atualizar_status_agendamento");
    expect(status).toContain("usuario_eh_membro_equipe(v_agendamento.barbearia_id, auth.uid())");
    expect(status).toContain("p_novo_status = 'cancelado'");
    expect(status).toContain("inicio_previsto > now()");
    const reagendar = corpoDaFuncao(parte1, "reagendar_agendamento");
    expect(reagendar).toContain("usuario_eh_membro_equipe(v_agendamento.barbearia_id, auth.uid())");
    expect(reagendar).toContain("p.barbearia_id = v_agendamento.barbearia_id");
  });

  it("métricas de cliente exigem equipe e cliente da mesma barbearia", () => {
    const crm = corpoDaFuncao(parte1, "obter_metricas_cliente_crm");
    expect(crm).toContain("public.usuario_eh_membro(p_barbearia_id)");
    expect(crm).toContain("c.barbearia_id = p_barbearia_id");
  });
});

describe("Visitante sem login (anon)", () => {
  it("perde EXECUTE em todas as funções e só recebe as públicas", () => {
    expect(parte1).toContain("REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon");
    for (const nome of [
      "buscar_barbearias_com_distancia",
      "buscar_horarios_disponiveis",
      "obter_convite_por_token",
      "obter_cupom_por_codigo",
    ]) {
      expect(parte1).toContain(`'${nome}'`);
    }
  });

  it("não lê convites nem lista indicações, e não faz upload anônimo", () => {
    expect(parte1).toContain('DROP POLICY IF EXISTS "Leitura de convite por token"');
    expect(parte1).toContain('DROP POLICY IF EXISTS "Clientes inserem indicacao ao agendar"');
    expect(parte1).toContain('DROP POLICY IF EXISTS "TEMP upload capas barbearias"');
  });

  it("parte 2 remove escrita e leitura ampla de tabelas para anon e restringe colunas sensíveis", () => {
    expect(parte2).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon");
    expect(parte2).toContain("DROP POLICY IF EXISTS \"Leitura pública de cupons ativos para validação\"");
    const colunasBarbearias = parte2.match(/GRANT SELECT \(([^)]*)\) ON public\.barbearias TO anon/)?.[1] ?? "";
    for (const sensivel of ["documento", "mercado_pago", "trial_inicio", "recorrencia_ativa"]) {
      expect(colunasBarbearias).not.toContain(sensivel);
    }
    const colunasProfissionais = parte2.match(/GRANT SELECT \(([^)]*)\) ON public\.profissionais TO anon/)?.[1] ?? "";
    expect(colunasProfissionais).not.toMatch(/email|telefone|usuario_id/);
    const colunasAvaliacoes = parte2.match(/GRANT SELECT \(([^)]*)\) ON public\.avaliacoes TO anon/)?.[1] ?? "";
    expect(colunasAvaliacoes).not.toMatch(/cliente_id|agendamento_id/);
  });
});

describe("Apps compatíveis com a restrição anônima", () => {
  it("Cliente lê barbearias, profissionais e avaliações com colunas explícitas", () => {
    for (const arquivo of [
      "apps/cliente/src/pages/BarbeariaDetalhes.tsx",
      "apps/cliente/src/pages/Reservar.tsx",
    ]) {
      const codigo = ler(arquivo);
      expect(codigo, arquivo).not.toMatch(/from\("barbearias"\)(?: as any)?\s*\.select\("\*"\)/);
      expect(codigo, arquivo).not.toMatch(/from\("profissionais"\)(?: as any)?\s*\.select\("\*"\)/);
    }
  });

  it("cupom e convite são consultados por RPC, não por listagem de tabela", () => {
    expect(ler("apps/cliente/src/pages/Reservar.tsx")).toContain("obter_cupom_por_codigo");
    expect(ler("apps/cliente/src/pages/ConfirmarReserva.tsx")).not.toContain('from("cupons")');
    expect(ler("apps/parceiro/src/pages/convite/AceitarConvite.tsx")).toContain("obter_convite_por_token");
  });
});
