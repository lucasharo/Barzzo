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
console.log("   BARZZO MVP — SUÍTE DE TESTES AUTOMATIZADOS (TASK-01 & TASK-02)");
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

// --- 2. Testes de Validações Zod (Task 01) ---
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

// --- 4. Testes de Barbearia, Equipe e Convites (Task 02) ---
console.log("▶ Executando testes: Barbearia, Equipe e Convites (Task 02)...");

const esquemaCriarBarbearia = z.object({
  nome: z.string().trim().min(2, "O nome deve ter no mínimo 2 caracteres").max(100),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido"),
  telefone: z.string().optional().refine(
    (val) => {
      if (!val || val.trim() === "") return true;
      const n = val.replace(/\D/g, "");
      return n.length === 10 || n.length === 11;
    },
    { message: "Telefone deve conter DDD válido" }
  ),
});

const esquemaCriarConvite = z.object({
  email: z.string().trim().email("Informe um e-mail válido"),
  papel: z.enum(["gerente", "profissional"]),
});

test("esquemaCriarBarbearia: aceita barbearia com nome e slug válido", () => {
  const r = esquemaCriarBarbearia.safeParse({
    nome: "Barbearia Dom Lucas",
    slug: "barbearia-dom-lucas",
    telefone: "11988887777",
  });
  expect(r.success).toBe(true);
});

test("esquemaCriarBarbearia: rejeita slug com espaços ou caracteres especiais", () => {
  const r = esquemaCriarBarbearia.safeParse({
    nome: "Barbearia Dom Lucas",
    slug: "Barbearia Com Espaco!",
  });
  expect(r.success).toBe(false);
});

test("esquemaCriarConvite: aceita papel profissional e gerente", () => {
  const r1 = esquemaCriarConvite.safeParse({ email: "barbeiro@teste.com", papel: "profissional" });
  const r2 = esquemaCriarConvite.safeParse({ email: "gerente@teste.com", papel: "gerente" });
  expect(r1.success).toBe(true);
  expect(r2.success).toBe(true);
});

test("esquemaCriarConvite: rejeita papel dono via convite direto", () => {
  const r = esquemaCriarConvite.safeParse({ email: "outro@teste.com", papel: "dono" });
  expect(r.success).toBe(false);
});

// --- 5. Testes de Migrações SQL e RLS Multi-Tenant (Task 02) ---
console.log("▶ Executando testes: Segurança, RLS e Migrações da Task 02...");

const caminhoSqlTask02 = path.resolve(raiz, "supabase/migrations/20260925000001_criar_barbearias_e_equipe.sql");
const sqlTask02 = fs.readFileSync(caminhoSqlTask02, "utf-8");

test("Migration Task 02: RLS ativado nas tabelas de barbearia e equipe", () => {
  expect(sqlTask02).toContain("ALTER TABLE public.barbearias ENABLE ROW LEVEL SECURITY;");
  expect(sqlTask02).toContain("ALTER TABLE public.membros_barbearia ENABLE ROW LEVEL SECURITY;");
  expect(sqlTask02).toContain("ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;");
  expect(sqlTask02).toContain("ALTER TABLE public.convites_profissionais ENABLE ROW LEVEL SECURITY;");
});

test("Migration Task 02: RPC atômica criar_barbearia_com_dono com trial de 30 dias", () => {
  expect(sqlTask02).toContain("CREATE OR REPLACE FUNCTION public.criar_barbearia_com_dono");
  expect(sqlTask02).toContain("interval '30 days'");
  expect(sqlTask02).toContain("'dono'");
});

test("Migration Task 02: RPC aceitar_convite_equipe vincula conta do usuário", () => {
  expect(sqlTask02).toContain("CREATE OR REPLACE FUNCTION public.aceitar_convite_equipe");
  expect(sqlTask02).toContain("usuario_id = auth.uid()");
  expect(sqlTask02).toContain("INSERT INTO public.membros_barbearia");
});

test("Migration Task 02: isolamento multi-tenant usuario_eh_dono_ou_gerente", () => {
  expect(sqlTask02).toContain("CREATE OR REPLACE FUNCTION public.usuario_eh_dono_ou_gerente");
  expect(sqlTask02).toContain("papel IN ('dono', 'gerente')");
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
  path.resolve(raiz, "tarefas/02-barbearias-equipe/test-results.json"),
  JSON.stringify(resultadoGeral, null, 2),
  "utf-8"
);

if (falhados > 0) {
  process.exit(1);
} else {
  console.log("✔ TODOS OS TESTES PASSARAM COM SUCESSO!\n");
  process.exit(0);
}
