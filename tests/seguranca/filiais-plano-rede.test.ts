import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  escolherUnidadeAtual,
  matrizQuePodeCadastrarFiliais,
  salvarUnidadeAtual,
  situacaoFiliais,
  type UnidadeUsuario,
} from "../../apps/parceiro/src/lib/unidade-atual";

const ler = (arquivo: string) =>
  readFileSync(new URL(`../../supabase/migrations/${arquivo}`, import.meta.url), "utf8");
const migrationBase = ler("20261024000400_filiais_plano_rede.sql");
const migrationLimite = ler("20261024000500_limite_filiais_por_plano.sql");

const unidade = (parcial: Partial<UnidadeUsuario>): UnidadeUsuario => ({
  id: "u1", nome: "Matriz", slug: "matriz", bairro: null, cidade: null, estado: null,
  matriz_id: null, papel: "dono", status_assinatura: "ativo", plano: "rede",
  plano_permite_filiais: true, limite_filiais: null, total_filiais: 0, ...parcial,
});

describe("Filiais por plano (banco)", () => {
  it("o limite de filiais é a única diferença entre os planos: 0, 0, 1 e ilimitado", () => {
    expect(migrationLimite).toContain("UPDATE public.planos SET limite_filiais = 0 WHERE identificador IN ('solo', 'pro')");
    expect(migrationLimite).toContain("UPDATE public.planos SET limite_filiais = 1 WHERE identificador = 'growth'");
    expect(migrationLimite).toContain("UPDATE public.planos SET limite_filiais = NULL WHERE identificador = 'rede'");
    // limites de profissionais não são mexidos
    expect(migrationLimite).not.toContain("limite_profissionais");
  });

  it("criar_filial exige dono da matriz, assinatura ativa e respeita o limite com a matriz travada", () => {
    const corpo = migrationLimite.slice(migrationLimite.indexOf("FUNCTION public.criar_filial("));
    expect(corpo).toContain("FOR UPDATE");
    expect(corpo).toContain("m.papel = 'dono'");
    expect(corpo).toContain("a.status = 'ativa'");
    expect(corpo).toContain("v_plano.limite_filiais = 0");
    expect(corpo).toContain("v_total_filiais >= v_plano.limite_filiais");
    expect(corpo).toContain("v_matriz.status_assinatura");
    expect(migrationBase).toContain(
      "REVOKE ALL ON FUNCTION public.criar_filial(uuid, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon"
    );
  });

  it("assinatura e vínculo de rede não podem ser editados pelo usuário", () => {
    expect(migrationBase).toContain('DROP POLICY IF EXISTS "Membros gestores podem atualizar assinaturas"');
    expect(migrationBase).toContain('DROP POLICY IF EXISTS "Membros gestores podem inserir assinaturas"');
    const gatilho = migrationBase.slice(migrationBase.indexOf("FUNCTION public.proteger_cobranca_barbearia"));
    for (const coluna of ["status_assinatura", "trial_fim", "matriz_id", "mercado_pago_customer_id", "recorrencia_ativa"]) {
      expect(gatilho).toContain(`NEW.${coluna} IS DISTINCT FROM OLD.${coluna}`);
    }
    expect(gatilho).toContain("current_user IN ('authenticated', 'anon')");
  });

  it("a situação da assinatura da matriz é propagada às filiais", () => {
    expect(migrationBase).toContain("trigger_propagar_assinatura_filiais");
    expect(migrationBase).toContain("WHERE matriz_id = NEW.id");
  });
});

describe("Filiais por plano (app do Parceiro)", () => {
  it("Solo e Pro não cadastram filiais", () => {
    const solo = unidade({ plano: "solo", plano_permite_filiais: false, limite_filiais: 0 });
    expect(situacaoFiliais([solo])).toMatchObject({ permiteFiliais: false, podeCadastrar: false });
    expect(matrizQuePodeCadastrarFiliais([solo])).toBeNull();
  });

  it("Growth cadastra 1 filial e depois atinge o limite", () => {
    const sem = unidade({ plano: "growth", limite_filiais: 1, total_filiais: 0 });
    expect(situacaoFiliais([sem])).toMatchObject({ permiteFiliais: true, limiteAtingido: false, podeCadastrar: true });
    expect(matrizQuePodeCadastrarFiliais([sem])?.id).toBe("u1");

    const cheio = unidade({ plano: "growth", limite_filiais: 1, total_filiais: 1 });
    expect(situacaoFiliais([cheio])).toMatchObject({ permiteFiliais: true, limiteAtingido: true, podeCadastrar: false });
    expect(matrizQuePodeCadastrarFiliais([cheio])).toBeNull();
  });

  it("Rede cadastra filiais sem limite", () => {
    const rede = unidade({ plano: "rede", limite_filiais: null, total_filiais: 40 });
    expect(situacaoFiliais([rede])).toMatchObject({ permiteFiliais: true, limiteAtingido: false, podeCadastrar: true });
  });

  it("exige ser dono da matriz com assinatura ativa", () => {
    expect(situacaoFiliais([unidade({ papel: "gerente" })]).matriz).toBeNull();
    expect(situacaoFiliais([unidade({ status_assinatura: "inadimplente" })]).podeCadastrar).toBe(false);
    expect(situacaoFiliais([unidade({ id: "f1", matriz_id: "u1" })]).matriz).toBeNull();
  });

  it("usa a unidade escolhida por último, ou a primeira quando ela não existe mais", () => {
    const armazenamento = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (chave: string) => armazenamento.get(chave) ?? null,
      setItem: (chave: string, valor: string) => void armazenamento.set(chave, valor),
    };
    const lista = [unidade({ id: "u1" }), unidade({ id: "f1", matriz_id: "u1", nome: "Filial" })];

    expect(escolherUnidadeAtual(lista)?.id).toBe("u1");
    salvarUnidadeAtual("f1");
    expect(escolherUnidadeAtual(lista)?.id).toBe("f1");
    salvarUnidadeAtual("removida");
    expect(escolherUnidadeAtual(lista)?.id).toBe("u1");
    expect(escolherUnidadeAtual([])).toBeNull();
  });
});
