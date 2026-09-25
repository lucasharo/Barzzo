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
  Alert,
  AlertDescription,
  LoadingSpinner,
  SeletorData,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { traduzirErro } from "@barzzo/utilitarios";
import type {
  Agendamento,
  AgendamentoComDetalhes,
  Profissional,
  Barbearia,
  StatusAgendamento,
} from "@barzzo/tipos";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Plus,
  ChevronLeft,
  ChevronRight,
  Scissors,
  CheckCircle,
  Play,
  Check,
  XCircle,
  AlertCircle,
  ArrowRight,
  Filter,
} from "lucide-react";

export default function PaginaAgendaParceiro() {
  const [carregando, setCarregando] = React.useState(true);
  const [barbearia, setBarbearia] = React.useState<Barbearia | null>(null);
  const [profissionais, setProfissionais] = React.useState<Profissional[]>([]);
  const [agendamentos, setAgendamentos] = React.useState<AgendamentoComDetalhes[]>([]);

  // Filtros de agenda
  const [dataSelecionada, setDataSelecionada] = React.useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [filtroProfissional, setFiltroProfissional] = React.useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = React.useState<string>("todos");

  const [acaoId, setAcaoId] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  React.useEffect(() => {
    carregarBarbeariaEProfissionais();
  }, []);

  React.useEffect(() => {
    if (barbearia?.id) {
      carregarAgendamentos();
    }
  }, [barbearia?.id, dataSelecionada]);

  async function carregarBarbeariaEProfissionais() {
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

      const { data: bDb } = await supabase
        .from("barbearias")
        .select("*")
        .eq("id", membro.barbearia_id)
        .single();

      if (bDb) setBarbearia(bDb as Barbearia);

      const { data: profsDb } = await supabase
        .from("profissionais")
        .select("*")
        .eq("barbearia_id", membro.barbearia_id)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      setProfissionais((profsDb || []) as Profissional[]);
    } catch {
      setErro("Erro ao inicializar agenda.");
    } finally {
      setCarregando(false);
    }
  }

  async function carregarAgendamentos() {
    if (!barbearia?.id) return;
    try {
      const supabase = criarClienteSupabaseBrowser();

      // Buscar agendamentos na data selecionada (do início do dia até o final do dia)
      const dataInicio = `${dataSelecionada}T00:00:00.000Z`;
      const dataFim = `${dataSelecionada}T23:59:59.999Z`;

      const { data: agsDb, error: erroAgs } = await supabase
        .from("agendamentos")
        .select(`
          *,
          profissionais (nome, foto_url),
          agendamentos_servicos (*)
        `)
        .eq("barbearia_id", barbearia.id)
        .gte("inicio_previsto", dataInicio)
        .lte("inicio_previsto", dataFim)
        .order("inicio_previsto", { ascending: true });

      if (erroAgs) {
        setErro("Não foi possível carregar os agendamentos da data.");
        return;
      }

      const listaFormatada: AgendamentoComDetalhes[] = (agsDb || []).map((item: any) => ({
        ...item,
        profissional_nome: item.profissionais?.nome || "Profissional",
        profissional_foto_url: item.profissionais?.foto_url || null,
        servicos: item.agendamentos_servicos || [],
      }));

      setAgendamentos(listaFormatada);
    } catch {
      setErro("Erro inesperado ao consultar agendamentos.");
    }
  }

  function navegarData(dias: number) {
    const d = new Date(dataSelecionada + "T12:00:00");
    d.setDate(d.getDate() + dias);
    setDataSelecionada(d.toISOString().split("T")[0]);
  }

  function irParaHoje() {
    setDataSelecionada(new Date().toISOString().split("T")[0]);
  }

  async function atualizarStatus(agendamentoId: string, novoStatus: StatusAgendamento) {
    try {
      setAcaoId(agendamentoId);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();

      // Usar a RPC de transição atômica
      const { data, error } = await supabase.rpc("atualizar_status_agendamento", {
        p_agendamento_id: agendamentoId,
        p_novo_status: novoStatus,
      });

      if (error) {
        setErro(traduzirErro(error, "Não foi possível atualizar o status do agendamento."));
        return;
      }

      setSucesso(`Status atualizado para ${novoStatus.replace("_", " ")} com sucesso.`);
      setTimeout(() => setSucesso(null), 3000);
      carregarAgendamentos();
    } catch {
      setErro("Erro inesperado ao atualizar status.");
    } finally {
      setAcaoId(null);
    }
  }

  const agendamentosFiltrados = agendamentos.filter((ag) => {
    if (filtroProfissional !== "todos" && ag.profissional_id !== filtroProfissional) {
      return false;
    }
    if (filtroStatus !== "todos" && ag.status !== filtroStatus) {
      return false;
    }
    return true;
  });

  const contagemStatus = {
    confirmados: agendamentos.filter((a) => a.status === "confirmado").length,
    em_atendimento: agendamentos.filter((a) => a.status === "em_atendimento").length,
    concluidos: agendamentos.filter((a) => a.status === "concluido").length,
    cancelados: agendamentos.filter((a) => a.status === "cancelado" || a.status === "nao_compareceu").length,
  };

  function getBadgeStatus(status: StatusAgendamento) {
    switch (status) {
      case "confirmado":
        return {
          classe: "bg-blue-500/10 text-blue-500 border-blue-500/20",
          label: "Confirmado",
        };
      case "em_atendimento":
        return {
          classe: "bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse",
          label: "Em Atendimento",
        };
      case "concluido":
        return {
          classe: "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20",
          label: "Concluído",
        };
      case "cancelado":
        return {
          classe: "bg-neutral-200 dark:bg-neutral-800 text-neutral-500 border-neutral-300 dark:border-neutral-700",
          label: "Cancelado",
        };
      case "nao_compareceu":
        return {
          classe: "bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20",
          label: "Não Compareceu",
        };
      default:
        return {
          classe: "bg-neutral-200 text-neutral-600",
          label: status,
        };
    }
  }

  if (carregando) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando agenda operacional...</p>
      </div>
    );
  }

  const dataFormatadaExtenso = new Date(dataSelecionada + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
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

      {/* Header com Navegador de Data */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold capitalize">{dataFormatadaExtenso}</h1>
            {dataSelecionada === new Date().toISOString().split("T")[0] && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#B45A2B]/10 text-[#B45A2B] font-semibold border border-[#B45A2B]/20">
                Hoje
              </span>
            )}
          </div>
          <p className="text-sm opacity-70 mt-1">
            Controle de atendimentos, fluxo em tempo real e prevenção de concorrência.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-1">
            <button
              onClick={() => navegarData(-1)}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
              title="Dia anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={irParaHoje}
              className="px-2.5 py-1 text-xs font-semibold hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors"
            >
              Hoje
            </button>
            <button
              onClick={() => navegarData(1)}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
              title="Próximo dia"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="w-64 sm:w-72">
            <SeletorData
              valor={dataSelecionada}
              aoMudar={(d) => setDataSelecionada(d)}
            />
          </div>

          <Link href="/agendamentos/novo">
            <Button variante="principal" tamanho="sm">
              <Plus className="h-4 w-4 mr-1.5" /> Novo Agendamento
            </Button>
          </Link>
        </div>
      </div>

      {/* Cards de Métricas do Dia */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col">
          <span className="text-xs opacity-70">Confirmados</span>
          <span className="text-xl font-bold text-blue-500">{contagemStatus.confirmados}</span>
        </div>
        <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col">
          <span className="text-xs opacity-70">Em Atendimento</span>
          <span className="text-xl font-bold text-amber-500">{contagemStatus.em_atendimento}</span>
        </div>
        <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col">
          <span className="text-xs opacity-70">Concluídos</span>
          <span className="text-xl font-bold text-[#16A34A]">{contagemStatus.concluidos}</span>
        </div>
        <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col">
          <span className="text-xs opacity-70">Cancelados / No-show</span>
          <span className="text-xl font-bold opacity-60">{contagemStatus.cancelados}</span>
        </div>
      </div>

      {/* Filtros por Profissional e Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121214]">
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 opacity-50" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold opacity-70">Profissional:</span>
            <select
              value={filtroProfissional}
              onChange={(e) => setFiltroProfissional(e.target.value)}
              className="text-xs rounded border border-neutral-200 dark:border-neutral-800 bg-transparent px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#B45A2B]"
            >
              <option value="todos" className="dark:bg-[#121214]">Todos os profissionais</option>
              {profissionais.map((p) => (
                <option key={p.id} value={p.id} className="dark:bg-[#121214]">{p.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {["todos", "confirmado", "em_atendimento", "concluido", "cancelado"].map((st) => (
            <button
              key={st}
              onClick={() => setFiltroStatus(st)}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                filtroStatus === st
                  ? "bg-[#B45A2B] text-white"
                  : "bg-neutral-100 dark:bg-neutral-900 opacity-70 hover:opacity-100"
              }`}
            >
              {st === "todos"
                ? "Todos"
                : st === "em_atendimento"
                ? "Em Atendimento"
                : st.charAt(0).toUpperCase() + st.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Lista / Grade de Agendamentos */}
      {agendamentosFiltrados.length === 0 ? (
        <Card camada="primaria" className="text-center py-16">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-[#B45A2B]/10 flex items-center justify-center text-[#B45A2B]">
              <CalendarIcon className="h-6 w-6" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold text-lg">Nenhum agendamento encontrado</h3>
              <p className="text-sm opacity-70 max-w-sm">
                Não há atendimentos para os filtros selecionados nesta data.
              </p>
            </div>
            <Link href="/agendamentos/novo">
              <Button variante="principal" tamanho="sm">
                <Plus className="h-4 w-4 mr-1.5" /> Agendar Cliente Manualmente
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {agendamentosFiltrados.map((ag) => {
            const badge = getBadgeStatus(ag.status);
            const horaInicio = new Date(ag.inicio_previsto).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC",
            });
            const horaFim = new Date(ag.fim_previsto).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "UTC",
            });

            const nomeServicos = ag.servicos && ag.servicos.length > 0
              ? ag.servicos.map((s) => s.nome_servico).join(", ")
              : "Serviço";

            return (
              <Card
                key={ag.id}
                camada="primaria"
                className={`transition-all hover:border-[#B45A2B]/40 ${
                  ag.status === "em_atendimento"
                    ? "border-amber-500/50 bg-amber-500/5"
                    : ag.status === "cancelado" || ag.status === "nao_compareceu"
                    ? "opacity-50"
                    : ""
                }`}
              >
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Horário e Dados do Cliente */}
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center justify-center min-w-[75px] py-1.5 px-2 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                      <span className="text-base font-extrabold">{horaInicio}</span>
                      <span className="text-[11px] opacity-60">até {horaFim}</span>
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/agendamentos/${ag.id}`}
                          className="font-bold text-base hover:underline hover:text-[#B45A2B]"
                        >
                          {ag.cliente_nome}
                        </Link>

                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${badge.classe}`}>
                          {badge.label}
                        </span>

                        {ag.cliente_telefone && (
                          <span className="text-xs opacity-60">
                            • {ag.cliente_telefone}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs opacity-80 mt-1">
                        <Scissors className="h-3.5 w-3.5 text-[#B45A2B]" />
                        <span className="font-medium">{nomeServicos}</span>
                        <span>•</span>
                        <span className="font-bold text-[#B45A2B]">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(ag.preco_total))}
                        </span>
                        <span>•</span>
                        <span>{ag.duracao_total_minutos} min</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs opacity-70 mt-1">
                        <User className="h-3.5 w-3.5 text-blue-500" />
                        <span>Profissional: <strong>{ag.profissional_nome}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Ações Operacionais de Transição */}
                  <div className="flex items-center justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-neutral-200 dark:border-neutral-800">
                    {ag.status === "confirmado" && (
                      <>
                        <Button
                          variante="principal"
                          tamanho="sm"
                          disabled={acaoId === ag.id}
                          onClick={() => atualizarStatus(ag.id, "em_atendimento")}
                        >
                          <Play className="h-3.5 w-3.5 mr-1" /> Iniciar
                        </Button>
                        <Button
                          variante="cancelar-destrutivo"
                          tamanho="sm"
                          disabled={acaoId === ag.id}
                          onClick={() => atualizarStatus(ag.id, "cancelado")}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                        </Button>
                      </>
                    )}

                    {ag.status === "em_atendimento" && (
                      <Button
                        variante="principal"
                        tamanho="sm"
                        className="bg-[#16A34A] hover:bg-[#15803D]"
                        disabled={acaoId === ag.id}
                        onClick={() => atualizarStatus(ag.id, "concluido")}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" /> Concluir Atendimento
                      </Button>
                    )}

                    <Link href={`/agendamentos/${ag.id}`}>
                      <Button variante="fantasma" tamanho="sm">
                        Detalhes <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
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
