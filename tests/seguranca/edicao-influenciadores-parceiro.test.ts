import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { esquemaInfluenciador } from "@barzzo/dominio";

const formulario = readFileSync(
  new URL("../../apps/parceiro/src/pages/influenciadores/Influenciadores.tsx", import.meta.url),
  "utf8"
);
const migration = readFileSync(
  new URL("../../supabase/migrations/20260925000007_campanhas_cupons_influenciadores.sql", import.meta.url),
  "utf8"
);

describe("Edição de influenciadores pelo Parceiro", () => {
  it("aceita cadastro inativo e mantém a validação dos dados editáveis", () => {
    const validacao = esquemaInfluenciador.safeParse({
      nome: "Magro",
      codigo_ref: "MAGRO",
      email: "contato@exemplo.com",
      telefone: "(11) 98888-7777",
      chave_pix: null,
      tipo_comissao: "percentual",
      valor_comissao: 10,
      ativo: false,
    });
    expect(validacao.success).toBe(true);
    if (validacao.success) expect(validacao.data.ativo).toBe(false);
  });

  it("filtra a atualização por influenciador e barbearia e não altera o tenant", () => {
    expect(formulario).toMatch(/\.update\(\{ \.\.\.dados, updated_at:[\s\S]*?\.eq\("id", influenciadorEmEdicao\.id\)[\s\S]*?\.eq\("barbearia_id", barbearia\.id\)/);
    expect(formulario).not.toMatch(/\.update\(\{[^}]*barbearia_id/);
    expect(formulario).toContain("<Switch marcado={ativo} aoMudar={setAtivo}");
    expect(migration).toMatch(/CREATE POLICY "Membros da equipe gerenciam influenciadores da barbearia"[\s\S]*?FOR ALL[\s\S]*?USING \(public\.usuario_eh_membro_equipe\(barbearia_id, auth\.uid\(\)\)\)[\s\S]*?WITH CHECK \(public\.usuario_eh_membro_equipe\(barbearia_id, auth\.uid\(\)\)\)/);
  });
});
