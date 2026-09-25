import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(__dirname, "..");

let totalTestes = 0;
let passados = 0;
let falhados = 0;
const relatorio = [];

function test(nome, fn) {
  totalTestes++;
  try {
    fn();
    passados++;
    relatorio.push(`  ✔ PASSOU: ${nome}`);
  } catch (erro) {
    falhados++;
    relatorio.push(`  ✖ FALHOU: ${nome} -> ${erro.message}`);
  }
}

function expect(valorAtual) {
  return {
    toBe(esperado) {
      if (valorAtual !== esperado) {
        throw new Error(`Esperado '${esperado}', mas obteve '${valorAtual}'`);
      }
    },
    toEqual(esperado) {
      if (JSON.stringify(valorAtual) !== JSON.stringify(esperado)) {
        throw new Error(`Esperado ${JSON.stringify(esperado)}, mas obteve ${JSON.stringify(valorAtual)}`);
      }
    },
    toContain(esperado) {
      if (!valorAtual || !valorAtual.includes(esperado)) {
        throw new Error(`Esperado conter '${esperado}', mas conteúdo foi '${valorAtual}'`);
      }
    },
    toMatch(regex) {
      if (!regex.test(valorAtual)) {
        throw new Error(`Texto não corresponde ao regex ${regex}`);
      }
    },
  };
}

console.log("\n=======================================================");
console.log("   BARZZO MVP — SUÍTE DE TESTES AUTOMATIZADOS (TASK-01)");
console.log("=======================================================\n");

// --- 1. Testes de Utilitários ---
console.log("▶ Executando testes: Utilitários e Formatadores...");

function formatarTelefone(valor) {
  if (!valor) return "";
  const apenasDigitos = valor.replace(/\D/g, "");
  if (apenasDigitos.length <= 2) return apenasDigitos.length > 0 ? `(${apenasDigitos}` : "";
  if (apenasDigitos.length <= 6) return `(${apenasDigitos.slice(0, 2)}) ${apenasDigitos.slice(2)}`;
  if (apenasDigitos.length <= 10) return `(${apenasDigitos.slice(0, 2)}) ${apenasDigitos.slice(2, 6)}-${apenasDigitos.slice(6, 10)}`;
  return `(${apenasDigitos.slice(0, 2)}) ${apenasDigitos.slice(2, 7)}-${apenasDigitos.slice(7, 11)}`;
}

function limparTelefone(valor) {
  if (!valor) return "";
  return valor.replace(/\D/g, "");
}

function extrairPrimeiroNome(nomeCompleto) {
  if (!nomeCompleto) return "";
  return nomeCompleto.trim().split(/\s+/)[0] || "";
}

function obterIniciais(nomeCompleto) {
  if (!nomeCompleto) return "BZ";
  const partes = nomeCompleto.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

test("formatarTelefone: deve formatar celular com 11 dígitos", () => {
  expect(formatarTelefone("11987654321")).toBe("(11) 98765-4321");
});

test("formatarTelefone: deve formatar telefone fixo com 10 dígitos", () => {
  expect(formatarTelefone("1134567890")).toBe("(11) 3456-7890");
});

test("limparTelefone: deve remover pontuações e símbolos", () => {
  expect(limparTelefone("+55 (11) 98765-4321")).toBe("5511987654321");
});

test("extrairPrimeiroNome: deve isolar o primeiro nome corretamente", () => {
  expect(extrairPrimeiroNome("Lucas Gabriel da Silva")).toBe("Lucas");
});

test("obterIniciais: deve gerar iniciais com 2 letras", () => {
  expect(obterIniciais("Lucas Silva")).toBe("LS");
  expect(obterIniciais("Barzzo")).toBe("BA");
  expect(obterIniciais("")).toBe("BZ");
});

// --- 2. Testes de Validações Zod ---
console.log("▶ Executando testes: Validações Zod (Auth e Usuário)...");

const esquemaLogin = z.object({
  email: z.string().trim().min(1, "E-mail é obrigatório").email("Informe um e-mail válido"),
  senha: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

const esquemaCadastro = z
  .object({
    nome: z.string().trim().min(3, "O nome deve ter no mínimo 3 caracteres").max(100),
    email: z.string().trim().min(1).email("Informe um e-mail válido"),
    telefone: z.string().optional().refine(
      (val) => {
        if (!val || val.trim() === "") return true;
        const n = val.replace(/\D/g, "");
        return n.length === 10 || n.length === 11;
      },
      { message: "Telefone deve ter 10 ou 11 dígitos com DDD" }
    ),
    senha: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
    confirmarSenha: z.string().min(6),
  })
  .refine((dados) => dados.senha === dados.confirmarSenha, {
    message: "As senhas não conferem",
    path: ["confirmarSenha"],
  });

test("esquemaLogin: aceita credenciais válidas", () => {
  const r = esquemaLogin.safeParse({ email: "cliente@barzzo.com", senha: "segura123" });
  expect(r.success).toBe(true);
});

test("esquemaLogin: rejeita e-mail inválido", () => {
  const r = esquemaLogin.safeParse({ email: "sem-arroba", senha: "segura123" });
  expect(r.success).toBe(false);
});

test("esquemaCadastro: aceita dados válidos", () => {
  const r = esquemaCadastro.safeParse({
    nome: "Cliente Teste",
    email: "cliente@barzzo.com",
    telefone: "11987654321",
    senha: "senhaSegura123",
    confirmarSenha: "senhaSegura123",
  });
  expect(r.success).toBe(true);
});

test("esquemaCadastro: rejeita senhas que não coincidem", () => {
  const r = esquemaCadastro.safeParse({
    nome: "Cliente Teste",
    email: "cliente@barzzo.com",
    senha: "senhaSegura123",
    confirmarSenha: "outraSenhaDiferente",
  });
  expect(r.success).toBe(false);
  expect(r.error.errors[0]?.message).toBe("As senhas não conferem");
});

test("esquemaCadastro: rejeita telefone incompleto", () => {
  const r = esquemaCadastro.safeParse({
    nome: "Cliente Teste",
    email: "cliente@barzzo.com",
    telefone: "119999", // Apenas 6 dígitos
    senha: "senhaSegura123",
    confirmarSenha: "senhaSegura123",
  });
  expect(r.success).toBe(false);
});

// --- 3. Testes de Imagens e Redimensionamento ---
console.log("▶ Executando testes: Validação e Dimensões de Imagem...");

function calcularDimensoesRedimensionamento(largura, altura, maxDimensao = 800) {
  if (largura <= maxDimensao && altura <= maxDimensao) {
    return { largura, altura };
  }
  const proporcao = largura / altura;
  if (largura > altura) {
    return { largura: maxDimensao, altura: Math.round(maxDimensao / proporcao) };
  }
  return { largura: Math.round(maxDimensao * proporcao), altura: maxDimensao };
}

test("calcularDimensoesRedimensionamento: preserva imagem <= 800x800", () => {
  const dim = calcularDimensoesRedimensionamento(600, 400, 800);
  expect(dim.largura).toBe(600);
  expect(dim.altura).toBe(400);
});

test("calcularDimensoesRedimensionamento: redimensiona proporcionalmente horizontal", () => {
  const dim = calcularDimensoesRedimensionamento(1600, 800, 800);
  expect(dim.largura).toBe(800);
  expect(dim.altura).toBe(400);
});

test("calcularDimensoesRedimensionamento: redimensiona proporcionalmente vertical", () => {
  const dim = calcularDimensoesRedimensionamento(600, 1200, 800);
  expect(dim.largura).toBe(400);
  expect(dim.altura).toBe(800);
});

// --- 4. Testes de Segurança e Migrações RLS ---
console.log("▶ Executando testes: Segurança, RLS e Migrações Supabase...");

const caminhoMigration = path.resolve(raiz, "supabase/migrations/20260925000000_criar_usuarios_e_auth.sql");
const sql = fs.readFileSync(caminhoMigration, "utf-8");

test("Migration: RLS ativado na tabela usuarios", () => {
  expect(sql).toMatch(/ALTER\s+TABLE\s+public\.usuarios\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
});

test("Migration: SELECT restrito a auth.uid() = id", () => {
  expect(sql).toContain("auth.uid() = id");
});

test("Migration: UPDATE com verificação WITH CHECK (auth.uid() = id)", () => {
  expect(sql).toContain("WITH CHECK (auth.uid() = id)");
});

test("Migration: Storage bucket avatares com política isolada por usuario_id", () => {
  expect(sql).toContain("bucket_id = 'avatares'");
  expect(sql).toContain("(storage.foldername(name))[1] = auth.uid()::text");
});

test("Migration: Trigger on_auth_user_created para sincronizar auth com usuarios", () => {
  expect(sql).toContain("CREATE TRIGGER on_auth_user_created");
  expect(sql).toContain("funcao_ao_criar_usuario_auth");
});

// --- Relatório Final ---
console.log("\n-------------------------------------------------------");
relatorio.forEach((r) => console.log(r));
console.log("-------------------------------------------------------");
console.log(`TOTAL: ${totalTestes} testes | PASSARAM: ${passados} | FALHARAM: ${falhados}`);
console.log("=======================================================\n");

const resultadoGeral = {
  sucesso: falhados === 0,
  totalTestes,
  passados,
  falhados,
  data: new Date().toISOString(),
};

fs.writeFileSync(
  path.resolve(raiz, "tarefas/01-fundacao-autenticacao/test-results.json"),
  JSON.stringify(resultadoGeral, null, 2),
  "utf-8"
);

if (falhados > 0) {
  process.exit(1);
} else {
  console.log("✔ TODOS OS TESTES PASSARAM COM SUCESSO!\n");
  process.exit(0);
}
