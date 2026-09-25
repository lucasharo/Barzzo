"use client";

import * as React from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Label,
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import type { BloqueioAgenda, Profissional, Barbearia } from "@barzzo/tipos";
import { esquemaBloqueioAgenda } from "@barzzo/validacoes";
import {
  CalendarX2,
  Plus,
  Trash2,
  Calendar,
  Clock,
  User,
  Store,
  AlertCircle,
  CheckCircle,
  X,
  Filter,
} from "lucide-react";

interface BloqueioComProfissional extends BloqueioAgenda {
  profissional_nome?: string;
}

export default function PaginaBloqueiosAgenda() {
  const [carregando, setCarregando] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [excluindoId, setExcluindoId] = React.useState<string | null>(null);

  const [barbearia, setBarbearia] = React.useState<Barbearia | null>(null);
  const [profissionais, setProfissionais] = React.useState<Profissional[]>([]);
  const [bloqueios, setBloqueios] = React.useState<BloqueioComProfissional[]>([]);

  // Estado do formulário de novo bloqueio
  const [exibindoForm, setExibindoForm] = React.useState(false);
  const [profissionalId, setProfissionalId] = React.useState<string>("geral");
  const [inicio, setInicio] = React.useState("");
  const [fim, setFim] = React.useState("");
  const [motivo, setMotivo] = React.useState("");

  const [filtro, setFiltro] = React.useState<"ativos" | "todos">("ativos");
  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  React.useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    try {
      setCarregando(true);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data: membro } = await supabase
        .from("membros_barbearia")
        .select("barbearia_id")
        .eq("usuario_id", session.user.id)
        .limit(1)
        .maybeSingle();

      if (!membro || !membro.barbearia_id) {
        setErro("Nenhuma barbearia vinculada.");
        return;
      }

      // Barbearia
      const { data: bDb } = await supabase
        .from("barbearias")
        .select("*")
        .eq("id", membro.barbearia_id)
        .single();

      if (bDb) setBarbearia(bDb as Barbearia);

      // Profissionais
      const { data: profsDb } = await supabase
        .from("profissionais")
        .select("*")
        .eq("barbearia_id", membro.barbearia_id)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      const listaProfs = (profsDb || []) as Profissional[];
      setProfissionais(listaProfs);

      // Bloqueios
      const { data: bloqDb, error: erroBloq } = await supabase
        .from("bloqueios_agenda")
        .select("*")
        .eq("barbearia_id", membro.barbearia_id)
        .order("inicio", { ascending: true });

      if (erroBloq) {
        setErro("Não foi possível carregar os bloqueios de agenda.");
        return;
      }

      const mapaProfs: Record<string, string> = {};
      listaProfs.forEach((p) => {
        mapaProfs[p.id] = p.nome;
      });

      const listaBloqueios = ((bloqDb || []) as BloqueioAgenda[]).map((b) => ({
        ...b,
        profissional_nome: b.profissional_id ? mapaProfs[b.profissional_id] || "Profissional" : undefined,
      }));

      setBloqueios(listaBloqueios);
    } catch {
      setErro("Erro ao consultar dados de bloqueios.");
    } finally {
      setCarregando(false);
    }
  }

  async function handleCriarBloqueio(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!barbearia) {
      setErro("Barbearia não identificada.");
      return;
    }

    if (!inicio || !fim) {
      setErro("Preencha data e hora de início e término.");
      return;
    }

    const dataInicioIso = new Date(inicio).toISOString();
    const dataFimIso = new Date(fim).toISOString();
    const pId = profissionalId === "geral" ? null : profissionalId;

    const validacao = esquemaBloqueioAgenda.safeParse({
      barbearia_id: barbearia.id,
      profissional_id: pId,
      inicio: dataInicioIso,
      fim: dataFimIso,
      motivo,
    });

    if (!validacao.success) {
      const primeiroErro = validacao.error.errors[0]?.message || "Verifique os dados preenchidos.";
      setErro(primeiroErro);
      return;
    }

    try {
      setSalvando(true);
      const supabase = criarClienteSupabaseBrowser();

      const { data: novo, error: erroInsert } = await supabase
        .from("bloqueios_agenda")
        .insert({
          barbearia_id: barbearia.id,
          profissional_id: pId,
          inicio: dataInicioIso,
          fim: dataFimIso,
          motivo: validacao.data.motivo,
        })
        .select("*")
        .single();

      if (erroInsert || !novo) {
        setErro("Não foi possível salvar o bloqueio de agenda.");
        return;
      }

      const nomeProf = pId ? profissionais.find((p) => p.id === pId)?.nome : undefined;
      setBloqueios((prev) => [...prev, { ...(novo as BloqueioAgenda), profissional_nome: nomeProf }]);

      setSucesso("Bloqueio cadastrado com sucesso!");
      setExibindoForm(false);
      setMotivo("");
      setInicio("");
      setFim("");
      setProfissionalId("geral");
      setTimeout(() => setSucesso(null), 3000);
    } catch {
      setErro("Erro inesperado ao cadastrar bloqueio.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleRemoverBloqueio(id: string) {
    if (!confirm("Deseja realmente remover este bloqueio? Os horários voltarão a ficar disponíveis.")) {
      return;
    }

    try {
      setExcluindoId(id);
      const supabase = criarClienteSupabaseBrowser();
      const { error } = await supabase.from("bloqueios_agenda").delete().eq("id", id);

      if (error) {
        setErro("Erro ao excluir o bloqueio.");
        return;
      }

      setBloqueios((prev) => prev.filter((b) => b.id !== id));
      setSucesso("Bloqueio removido com sucesso.");
      setTimeout(() => setSucesso(null), 3000);
    } catch {
      setErro("Erro inesperado ao remover bloqueio.");
    } finally {
      setExcluindoId(null);
    }
  }

  const agoraIso = new Date().toISOString();
  const bloqueiosFiltrados = bloqueios.filter((b) => {
    if (filtro === "ativos") {
      return b.fim >= agoraIso;
    }
    return true;
  });

  const totalAtivos = bloqueios.filter((b) => b.fim >= agoraIso).length;

  if (carregando) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando bloqueios da agenda...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8">
      {erro && (
        <Alert variante="erro">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {sucesso && (
        <Alert variante="sucesso">
          <AlertDescription>{sucesso}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold">Bloqueios de Agenda</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#B45A2B]/10 text-[#B45A2B] font-semibold border border-[#B45A2B]/20">
              {totalAtivos} {totalAtivos === 1 ? "ativo" : "ativos"}
            </span>
          </div>
          <p className="text-sm opacity-70 mt-1">
            Suspenda horários pontuais por motivo de folga, reforma, consulta ou feriados locais.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/servicos">
            <Button variante="fantasma" tamanho="sm">
              Serviços
            </Button>
          </Link>
          <Button
            variante={exibindoForm ? "secundario" : "principal"}
            tamanho="sm"
            onClick={() => setExibindoForm(!exibindoForm)}
          >
            {exibindoForm ? (
              <>
                <X className="h-4 w-4 mr-1.5" /> Fechar
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1.5" /> Novo Bloqueio
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Formulário Expansível de Novo Bloqueio */}
      {exibindoForm && (
        <Card camada="primaria" className="border-l-4 border-l-[#B45A2B]">
          <CardHeader>
            <CardTitle className="text-lg">Cadastrar Novo Bloqueio de Horário</CardTitle>
            <CardDescription>
              Selecione o profissional afetado ou bloqueie todos os atendimentos da barbearia.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleCriarBloqueio} className="flex flex-col gap-5">
              {/* Escopo do Bloqueio */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="escopo">Escopo do Bloqueio *</Label>
                <select
                  id="escopo"
                  value={profissionalId}
                  onChange={(e) => setProfissionalId(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
                >
                  <option value="geral" className="dark:bg-[#121214]">
                    🏢 Toda a Barbearia (Geral - fecha todos os agendamentos)
                  </option>
                  {profissionais.map((p) => (
                    <option key={p.id} value={p.id} className="dark:bg-[#121214]">
                      👤 Apenas para {p.nome}
                    </option>
                  ))}
                </select>
                <span className="text-xs opacity-60">
                  Bloqueios gerais impedem agendamento com qualquer barbeiro durante o intervalo.
                </span>
              </div>

              {/* Início e Término */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="inicio">Data e Hora de Início *</Label>
                  <Input
                    id="inicio"
                    type="datetime-local"
                    value={inicio}
                    onChange={(e) => setInicio(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="fim">Data e Hora de Término *</Label>
                  <Input
                    id="fim"
                    type="datetime-local"
                    value={fim}
                    onChange={(e) => setFim(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Motivo */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="motivo">Motivo do Bloqueio *</Label>
                <Input
                  id="motivo"
                  placeholder="Ex: Feriado municipal, manutenção de cadeiras, consulta médica..."
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  required
                />
              </div>

              {/* Botões */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <Button
                  type="button"
                  variante="fantasma"
                  tamanho="sm"
                  onClick={() => setExibindoForm(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variante="principal"
                  tamanho="sm"
                  disabled={salvando}
                >
                  {salvando ? "Salvando..." : "Confirmar Bloqueio"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <div className="flex items-center justify-between">
        <span className="text-xs opacity-60">
          Mostrando {bloqueiosFiltrados.length} {bloqueiosFiltrados.length === 1 ? "bloqueio" : "bloqueios"}
        </span>

        <div className="flex items-center gap-2">
          <Button
            variante={filtro === "ativos" ? "principal" : "fantasma"}
            tamanho="sm"
            onClick={() => setFiltro("ativos")}
          >
            Vigentes e Futuros ({totalAtivos})
          </Button>
          <Button
            variante={filtro === "todos" ? "principal" : "fantasma"}
            tamanho="sm"
            onClick={() => setFiltro("todos")}
          >
            Histórico Completo ({bloqueios.length})
          </Button>
        </div>
      </div>

      {/* Lista de Bloqueios */}
      {bloqueiosFiltrados.length === 0 ? (
        <Card camada="primaria" className="text-center py-12">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-[#B45A2B]/10 flex items-center justify-center text-[#B45A2B]">
              <CalendarX2 className="h-6 w-6" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold text-lg">Nenhum bloqueio cadastrado</h3>
              <p className="text-sm opacity-70 max-w-sm">
                Não há períodos de indisponibilidade registrados. A agenda seguirá normalmente os horários de funcionamento e jornadas.
              </p>
            </div>
            <Button
              variante="principal"
              tamanho="sm"
              onClick={() => setExibindoForm(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Adicionar Primeiro Bloqueio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {bloqueiosFiltrados.map((bloq) => {
            const ehPassado = bloq.fim < agoraIso;
            const dataInicioFmt = new Date(bloq.inicio).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            const dataFimFmt = new Date(bloq.fim).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <Card
                key={bloq.id}
                camada="primaria"
                className={`transition-colors ${
                  ehPassado ? "opacity-50 bg-neutral-100/40 dark:bg-neutral-900/40" : ""
                }`}
              >
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                        bloq.profissional_id
                          ? "bg-blue-500/10 text-blue-500"
                          : "bg-[#B45A2B]/10 text-[#B45A2B]"
                      }`}
                    >
                      {bloq.profissional_id ? (
                        <User className="h-5 w-5" />
                      ) : (
                        <Store className="h-5 w-5" />
                      )}
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{bloq.motivo}</span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                            bloq.profissional_id
                              ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                              : "bg-[#B45A2B]/10 text-[#B45A2B] border-[#B45A2B]/20"
                          }`}
                        >
                          {bloq.profissional_id
                            ? `Profissional: ${bloq.profissional_nome || "Individual"}`
                            : "Toda a Barbearia"}
                        </span>
                        {ehPassado && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                            Expirado
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs opacity-75 mt-1">
                        <Calendar className="h-3.5 w-3.5 text-[#B45A2B]" />
                        <span>
                          {dataInicioFmt} até {dataFimFmt}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <Button
                      variante="cancelar-destrutivo"
                      tamanho="sm"
                      onClick={() => handleRemoverBloqueio(bloq.id)}
                      disabled={excluindoId === bloq.id}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      {excluindoId === bloq.id ? "Removendo..." : "Remover"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
