import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Segurança e RLS — Migration de Usuários", () => {
  const caminhoMigration = path.resolve(
    __dirname,
    "../../supabase/migrations/20260925000000_criar_usuarios_e_auth.sql"
  );

  it("o arquivo de migration inicial de usuários deve existir", () => {
    expect(fs.existsSync(caminhoMigration)).toBe(true);
  });

  const conteudoSql = fs.readFileSync(caminhoMigration, "utf-8");

  it("deve habilitar Row Level Security (RLS) explicitamente na tabela usuarios", () => {
    expect(conteudoSql).toMatch(
      /ALTER\s+TABLE\s+public\.usuarios\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i
    );
  });

  it("deve conter política de SELECT garantindo que o usuário só lê seu próprio registro", () => {
    expect(conteudoSql).toMatch(/CREATE\s+POLICY.*FOR\s+SELECT/i);
    expect(conteudoSql).toContain("auth.uid() = id");
  });

  it("deve conter política de UPDATE impedindo alteração de dados alheios", () => {
    expect(conteudoSql).toMatch(/CREATE\s+POLICY.*FOR\s+UPDATE/i);
    expect(conteudoSql).toContain("WITH CHECK (auth.uid() = id)");
  });

  it("deve configurar bucket avatares com RLS isolando por usuário", () => {
    expect(conteudoSql).toContain("bucket_id = 'avatares'");
    expect(conteudoSql).toContain("(storage.foldername(name))[1] = auth.uid()::text");
  });

  it("deve conter trigger para sincronização a partir de auth.users", () => {
    expect(conteudoSql).toContain("CREATE TRIGGER on_auth_user_created");
    expect(conteudoSql).toContain("funcao_ao_criar_usuario_auth");
  });

  it("deve possuir chave estrangeira referenciando auth.users com ON DELETE CASCADE", () => {
    expect(conteudoSql).toMatch(
      /REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+CASCADE/i
    );
  });
});
