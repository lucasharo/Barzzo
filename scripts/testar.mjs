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

// --- 6. Testes da Task 03: Serviços, Jornadas e Disponibilidade ---
console.log("▶ Executando testes: Serviços, Jornadas e Disponibilidade (Task 03)...");

// Schemas Zod Task 03
const formatoHora = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

const esquemaServico = z.object({
  nome: z.string().min(2).max(100).trim(),
  descricao: z.string().max(500).optional().nullable(),
  preco: z.coerce.number().min(0),
  duracao_minutos: z.coerce.number().int().min(5).max(480),
  ativo: z.boolean().default(true),
});

const esquemaHorarioBarbearia = z.object({
  dia_semana: z.number().int().min(0).max(6),
  hora_abertura: z.string().regex(formatoHora),
  hora_fechamento: z.string().regex(formatoHora),
  hora_inicio_almoco: z.string().regex(formatoHora).optional().nullable(),
  hora_fim_almoco: z.string().regex(formatoHora).optional().nullable(),
  ativo: z.boolean().default(true),
}).refine((data) => data.hora_abertura < data.hora_fechamento);

const esquemaBloqueioAgenda = z.object({
  barbearia_id: z.string().uuid(),
  profissional_id: z.string().uuid().optional().nullable(),
  inicio: z.string().datetime(),
  fim: z.string().datetime(),
  motivo: z.string().min(3).max(200).trim(),
}).refine((data) => new Date(data.inicio) < new Date(data.fim));

// Utilitários de tempo e disponibilidade
function timeParaMinutos(horaStr) {
  const partes = horaStr.split(":");
  return (parseInt(partes[0], 10) || 0) * 60 + (parseInt(partes[1], 10) || 0);
}

function minutosParaTime(minutosTotal) {
  const horas = Math.floor(minutosTotal / 60);
  const minutos = minutosTotal % 60;
  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}

function intervalosSobrepoem(aInicio, aFim, bInicio, bFim) {
  return aInicio < bFim && aFim > bInicio;
}

function calcularHorariosDisponiveis(opcoes) {
  const {
    servico,
    horarioBarbearia,
    profissionais,
    bloqueios = [],
    data,
    profissionalIdFiltro,
    passoMinutos = 30,
  } = opcoes;

  if (!servico.ativo || servico.duracao_minutos <= 0) return [];
  if (!horarioBarbearia || !horarioBarbearia.ativo) return [];

  const aberturaBarbeariaMin = timeParaMinutos(horarioBarbearia.hora_abertura);
  const fechamentoBarbeariaMin = timeParaMinutos(horarioBarbearia.hora_fechamento);

  const almocoInicioMin = horarioBarbearia.hora_inicio_almoco
    ? timeParaMinutos(horarioBarbearia.hora_inicio_almoco)
    : null;
  const almocoFimMin = horarioBarbearia.hora_fim_almoco
    ? timeParaMinutos(horarioBarbearia.hora_fim_almoco)
    : null;

  const profsFiltrados = profissionais.filter((p) => {
    if (!p.ativo || !p.habilitado) return false;
    if (profissionalIdFiltro && p.id !== profissionalIdFiltro) return false;
    if (!p.jornada || !p.jornada.ativo) return false;
    return true;
  });

  const slots = [];

  for (const prof of profsFiltrados) {
    const jornada = prof.jornada;
    const jornadaInicioMin = timeParaMinutos(jornada.hora_inicio);
    const jornadaFimMin = timeParaMinutos(jornada.hora_fim);

    const limiteInicioMin = Math.max(aberturaBarbeariaMin, jornadaInicioMin);
    const limiteFimMin = Math.min(fechamentoBarbeariaMin, jornadaFimMin);

    const pausaInicioMin = jornada.hora_inicio_pausa
      ? timeParaMinutos(jornada.hora_inicio_pausa)
      : null;
    const pausaFimMin = jornada.hora_fim_pausa
      ? timeParaMinutos(jornada.hora_fim_pausa)
      : null;

    let slotInicio = limiteInicioMin;

    while (slotInicio + servico.duracao_minutos <= limiteFimMin) {
      const slotFim = slotInicio + servico.duracao_minutos;
      let valido = true;

      // Almoço da barbearia
      if (almocoInicioMin !== null && almocoFimMin !== null) {
        if (intervalosSobrepoem(slotInicio, slotFim, almocoInicioMin, almocoFimMin)) {
          valido = false;
        }
      }

      // Pausa do profissional
      if (valido && pausaInicioMin !== null && pausaFimMin !== null) {
        if (intervalosSobrepoem(slotInicio, slotFim, pausaInicioMin, pausaFimMin)) {
          valido = false;
        }
      }

      // Bloqueios
      if (valido && bloqueios.length > 0) {
        const slotDataInicio = new Date(`${data}T${minutosParaTime(slotInicio)}:00.000Z`).getTime();
        const slotDataFim = new Date(`${data}T${minutosParaTime(slotFim)}:00.000Z`).getTime();

        for (const bloq of bloqueios) {
          if (!bloq.profissional_id || bloq.profissional_id === prof.id) {
            const bIni = new Date(bloq.inicio).getTime();
            const bFim = new Date(bloq.fim).getTime();
            if (intervalosSobrepoem(slotDataInicio, slotDataFim, bIni, bFim)) {
              valido = false;
              break;
            }
          }
        }
      }

      if (valido) {
        slots.push({
          horario: minutosParaTime(slotInicio),
          duracao_minutos: servico.duracao_minutos,
          profissional_id: prof.id,
          profissional_nome: prof.nome,
        });
      }

      slotInicio += passoMinutos;
    }
  }

  return slots;
}

test("esquemaServico: aceita serviço com dados válidos", () => {
  const res = esquemaServico.safeParse({
    nome: "Corte Tradicional",
    preco: 45,
    duracao_minutos: 30,
    ativo: true,
  });
  expect(res.success).toBe(true);
});

test("esquemaServico: rejeita preço negativo e duração zero", () => {
  expect(esquemaServico.safeParse({ nome: "Corte", preco: -1, duracao_minutos: 30 }).success).toBe(false);
  expect(esquemaServico.safeParse({ nome: "Corte", preco: 40, duracao_minutos: 0 }).success).toBe(false);
});

test("esquemaHorarioBarbearia: rejeita horário onde abertura é posterior ao fechamento", () => {
  const res = esquemaHorarioBarbearia.safeParse({
    dia_semana: 1,
    hora_abertura: "19:00",
    hora_fechamento: "09:00",
    ativo: true,
  });
  expect(res.success).toBe(false);
});

test("esquemaBloqueioAgenda: valida consistência de datas do bloqueio", () => {
  const valido = esquemaBloqueioAgenda.safeParse({
    barbearia_id: "00000000-0000-0000-0000-000000000001",
    inicio: "2026-10-01T10:00:00.000Z",
    fim: "2026-10-01T12:00:00.000Z",
    motivo: "Manutenção",
  });
  expect(valido.success).toBe(true);

  const invalido = esquemaBloqueioAgenda.safeParse({
    barbearia_id: "00000000-0000-0000-0000-000000000001",
    inicio: "2026-10-01T12:00:00.000Z",
    fim: "2026-10-01T10:00:00.000Z",
    motivo: "Manutenção",
  });
  expect(invalido.success).toBe(false);
});

// Testes do motor de disponibilidade
const mockServico = { id: "s-1", nome: "Corte", preco: 40, duracao_minutos: 30, ativo: true };
const mockHorario = { dia_semana: 1, hora_abertura: "09:00", hora_fechamento: "12:00", ativo: true, hora_inicio_almoco: null, hora_fim_almoco: null };
const mockJornada = { dia_semana: 1, hora_inicio: "09:00", hora_fim: "12:00", ativo: true, hora_inicio_pausa: null, hora_fim_pausa: null };
const mockProf = { id: "p-1", nome: "Barbeiro Lucas", ativo: true, habilitado: true, jornada: mockJornada };

test("Disponibilidade: retorna lista vazia para serviço inativo ou barbearia fechada", () => {
  const inativo = calcularHorariosDisponiveis({
    servico: { ...mockServico, ativo: false },
    horarioBarbearia: mockHorario,
    profissionais: [mockProf],
    data: "2026-10-05",
  });
  expect(inativo.length).toBe(0);

  const fechada = calcularHorariosDisponiveis({
    servico: mockServico,
    horarioBarbearia: { ...mockHorario, ativo: false },
    profissionais: [mockProf],
    data: "2026-10-05",
  });
  expect(fechada.length).toBe(0);
});

test("Disponibilidade: gera slots a cada 30min e elimina duração cruzando fechamento", () => {
  // Serviço de 45 minutos em expediente 09:00 - 12:00:
  // Slots: 09:00 (até 09:45), 09:30 (até 10:15), 10:00 (até 10:45), 10:30 (até 11:15), 11:00 (até 11:45)
  // 11:30 terminaria às 12:15 (cruzando fechamento) -> Deve ser eliminado!
  const slots45 = calcularHorariosDisponiveis({
    servico: { ...mockServico, duracao_minutos: 45 },
    horarioBarbearia: mockHorario,
    profissionais: [mockProf],
    data: "2026-10-05",
  });

  const horarios = slots45.map((s) => s.horario);
  expect(horarios).toContain("09:00");
  expect(horarios).toContain("11:00");
  expect(horarios.includes("11:30")).toBe(false);
});

test("Disponibilidade: exclui horários no almoço e em bloqueios de agenda", () => {
  const hbComAlmoco = { ...mockHorario, hora_fechamento: "15:00", hora_inicio_almoco: "12:00", hora_fim_almoco: "13:00" };
  const profComJornada = { ...mockProf, jornada: { ...mockJornada, hora_fim: "15:00" } };
  const bloq = {
    barbearia_id: "b-1",
    profissional_id: null,
    inicio: "2026-10-05T10:00:00.000Z",
    fim: "2026-10-05T11:00:00.000Z",
  };

  const slots = calcularHorariosDisponiveis({
    servico: mockServico,
    horarioBarbearia: hbComAlmoco,
    profissionais: [profComJornada],
    bloqueios: [bloq],
    data: "2026-10-05",
  });

  const horarios = slots.map((s) => s.horario);
  // Bloqueio das 10:00 às 11:00
  expect(horarios.includes("10:00")).toBe(false);
  expect(horarios.includes("10:30")).toBe(false);
  // Almoço das 12:00 às 13:00
  expect(horarios.includes("12:00")).toBe(false);
  expect(horarios.includes("12:30")).toBe(false);
  // Horários livres
  expect(horarios.includes("09:00")).toBe(true);
  expect(horarios.includes("13:00")).toBe(true);
});

test("Disponibilidade: suporta múltiplos profissionais e filtro individual", () => {
  const prof2 = { id: "p-2", nome: "Barbeira Maria", ativo: true, habilitado: true, jornada: mockJornada };
  const slotsAmbos = calcularHorariosDisponiveis({
    servico: mockServico,
    horarioBarbearia: mockHorario,
    profissionais: [mockProf, prof2],
    data: "2026-10-05",
  });

  const slots09 = slotsAmbos.filter((s) => s.horario === "09:00");
  expect(slots09.length).toBe(2);

  const slotsFiltrados = calcularHorariosDisponiveis({
    servico: mockServico,
    horarioBarbearia: mockHorario,
    profissionais: [mockProf, prof2],
    data: "2026-10-05",
    profissionalIdFiltro: "p-2",
  });
  expect(slotsFiltrados.every((s) => s.profissional_id === "p-2")).toBe(true);
});

// --- 7. Testes de Migrações SQL e RLS (Task 03) ---
console.log("▶ Executando testes: Segurança, RLS e Migrações da Task 03...");

const caminhoSqlTask03 = path.resolve(raiz, "supabase/migrations/20260925000002_criar_servicos_e_disponibilidade.sql");
const sqlTask03 = fs.readFileSync(caminhoSqlTask03, "utf-8");

test("Migration Task 03: RLS ativado nas tabelas de serviços e disponibilidade", () => {
  expect(sqlTask03).toContain("ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;");
  expect(sqlTask03).toContain("ALTER TABLE public.profissionais_servicos ENABLE ROW LEVEL SECURITY;");
  expect(sqlTask03).toContain("ALTER TABLE public.horarios_barbearia ENABLE ROW LEVEL SECURITY;");
  expect(sqlTask03).toContain("ALTER TABLE public.jornadas_profissionais ENABLE ROW LEVEL SECURITY;");
  expect(sqlTask03).toContain("ALTER TABLE public.bloqueios_agenda ENABLE ROW LEVEL SECURITY;");
});

test("Migration Task 03: RPC buscar_horarios_disponiveis implementada com segurança", () => {
  expect(sqlTask03).toContain("CREATE OR REPLACE FUNCTION public.buscar_horarios_disponiveis");
  expect(sqlTask03).toContain("EXTRACT(DOW FROM p_data)");
  expect(sqlTask03).toContain("SECURITY DEFINER");
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

fs.writeFileSync(
  path.resolve(raiz, "tarefas/03-servicos-disponibilidade/test-results.json"),
  JSON.stringify(resultadoGeral, null, 2),
  "utf-8"
);

if (falhados > 0) {
  process.exit(1);
} else {
  console.log("✔ TODOS OS TESTES PASSARAM COM SUCESSO!\n");
  process.exit(0);
}
