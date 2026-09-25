"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import { calcularComparativoTempo, validarTransicaoStatus } from "@barzzo/dominio";
import type {
  AgendamentoComDetalhes,
  StatusAgendamento,
  Profissional,
} from "@barzzo/tipos";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Scissors,
  Play,
  Check,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Timer,
} from "lucide-react";

export default function PaginaDetalhesAgendamento() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [carregando, setCarregando] = React.useState(true);
  const [atualizandoStatus, setAtualizandoStatus] = React.useState(false);
  const [reagendando, setReagendando] = React.useState(false);

  const [agendamento, setAgendamento] = React.useState<AgendamentoComDetalhes | null>(null);
  const [profissionais, setProfissionais] = React.useState<Profissional[]>([]);

  // Estados de reagendamento
  const [exibindoReagendamento, setExibindoReagendamento] = React.useState(false);
  const [novaData, setNovaData] = React.useState("");
  const [novoHorarioInicio, setNovoHorarioInicio] = React.useState("09:00");
  const [novoProfissionalId, setNovoProfissionalId] = React.useState<string>("");

  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  React.useEffect(() => {
    carregarAgendamento();
  }, [id]);

  async function carregarAgendamento() {
    try {
      setCarregando(true);
      const supabase = criarClienteSupabaseBrowser();

      const { data, error } = await supabase
        .from("agendamentos")
        .select(`
          *,
          profissionais (nome, foto_url),
          agendamentos_servicos (*)
        `)
        .eq("id", id)
        .single();

      if (error || !data) {
        setErro("Agendamento não encontrado.");
        return;
      }

      const ag: AgendamentoComDetalhes = {
        ...data,
        profissional_nome: data.profissionais?.nome || "Profissional",
        profissional_foto_url: data.profissionais?.foto_url || null,
        servicos: data.agendamentos_servicos || [],
      };

      setAgendamento(ag);
      setNovoProfissionalId(ag.profissional_id);
      setNovaData(new Date(ag.inicio_previsto).toISOString().split("T")[0]);

      // Carregar lista de profissionais para reagendamento se necessário
      const { data: profsDb } = await supabase
        .from("profissionais")
        .select("*")
        .eq("barbearia_id", ag.barbearia_id)
        .eq("ativo", true);

      setProfissionais((profsDb || []) as Profissional[]);
    } catch {
      setErro("Erro ao consultar agendamento.");
    } finally {
      setCarregando(false);
    }
  }

  async function handleMudarStatus(novoStatus: StatusAgendamento) {
    if (!agendamento) return;
    if (!validarTransicaoStatus(agendamento.status, novoStatus)) {
      setErro(`Transição de ${agendamento.status} para ${novoStatus} não é permitida.`);
      return;
    }

    try {
      setAtualizandoStatus(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();

      const { data, error } = await supabase.rpc("atualizar_status_agendamento", {
        p_agendamento_id: agendamento.id,
        p_novo_status: novoStatus,
      });

      if (error) {
        setErro(error.message || "Não foi possível atualizar o status.");
        return;
      }

      setSucesso(`Status atualizado para ${novoStatus.replace("_", " ")} com sucesso!`);
      setTimeout(() => setSucesso(null), 3000);
      carregarAgendamento();
    } catch {
      setErro("Erro inesperado ao alterar status.");
    } finally {
      setAtualizandoStatus(false);
    }
  }

  async function handleReagendar(e: React.FormEvent) {
    e.preventDefault();
    if (!agendamento) return;
    setErro(null);
    setSucesso(null);

    const inicioIso = new Date(`${novaData}T${novoHorarioInicio}:00.000Z`).toISOString();
    const duracaoTotal = agendamento.duracao_total_minutos;

    const [h, m] = novoHorarioInicio.split(":").map(Number);
    const minFim = h * 60 + m + duracaoTotal;
    const horaFimStr = `${String(Math.floor(minFim / 60)).padStart(2, "0")}:${String(minFim % 60).padStart(2, "0")}`;
    const fimIso = new Date(`${novaData}T${horaFimStr}:00.000Z`).toISOString();

    try {
      setReagendando(true);
      const supabase = criarClienteSupabaseBrowser();

      const { data, error } = await supabase.rpc("reagendar_agendamento", {
        p_agendamento_id: agendamento.id,
        p_novo_inicio: inicioIso,
        p_novo_fim: fimIso,
        p_novo_profissional_id: novoProfissionalId,
      });

      if (error) {
        if (error.message.includes("conflitante") || error.message.includes("exclusion_violation")) {
          setErro("Conflito de horário: O profissional já tem um agendamento neste horário.");
        } else {
          setErro(error.message || "Erro ao reagendar.");
        }
        return;
      }

      setSucesso("Agendamento reagendado com sucesso!");
      setExibindoReagendamento(false);
      setTimeout(() => setSucesso(null), 3000);
      carregarAgendamento();
    } catch {
      setErro("Erro inesperado ao reagendar.");
    } finally {
      setReagendando(false);
    }
  }

  if (carregando) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando detalhes do agendamento...</p>
      </div>
    );
  }

  if (!agendamento) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center flex flex-col items-center gap-4">
        <AlertTriangle className="h-10 w-10 text-[#DC2626]" />
        <h2 className="text-xl font-bold">Agendamento não encontrado</h2>
        <Link href="/agenda">
          <Button variante="secundario">Voltar para a Agenda</Button>
        </Link>
      </div>
    );
  }

  const comparativo = calcularComparativoTempo(
    agendamento.inicio_previsto,
    agendamento.fim_previsto,
    agendamento.inicio_real,
    agendamento.fim_real
  );

  const inicioPrevistoFmt = new Date(agendamento.inicio_previsto).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  const fimPrevistoFmt = new Date(agendamento.fim_previsto).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  const inicioRealFmt = agendamento.inicio_real
    ? new Date(agendamento.inicio_real).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;

  const fimRealFmt = agendamento.fim_real
    ? new Date(agendamento.fim_real).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          href="/agenda"
          className="text-sm font-semibold opacity-70 hover:opacity-100 flex items-center gap-1.5 transition-opacity"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para a Agenda
        </Link>
      </div>

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

      {/* Card Principal de Detalhes */}
      <Card camada="primaria">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider opacity-60">
                Agendamento #{agendamento.id.slice(0, 8)}
              </span>
              <CardTitle className="text-2xl font-bold mt-1">
                {agendamento.cliente_nome}
              </CardTitle>
              {agendamento.cliente_telefone && (
                <CardDescription>{agendamento.cliente_telefone}</CardDescription>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border ${
                  agendamento.status === "confirmado"
                    ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                    : agendamento.status === "em_atendimento"
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse"
                    : agendamento.status === "concluido"
                    ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20"
                    : agendamento.status === "nao_compareceu"
                    ? "bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20"
                    : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500 border-neutral-300 dark:border-neutral-700"
                }`}
              >
                {agendamento.status.replace("_", " ")}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          {/* Snapshot dos Serviços Contratados */}
          <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#B45A2B]">
              Serviços Contratados (Snapshot)
            </h4>

            {agendamento.servicos && agendamento.servicos.length > 0 ? (
              <div className="flex flex-col divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
                {agendamento.servicos.map((s) => (
                  <div key={s.id} className="py-2 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Scissors className="h-4 w-4 text-[#B45A2B]" />
                      <span className="font-semibold">{s.nome_servico}</span>
                      <span className="text-xs opacity-60">({s.duracao_minutos} min)</span>
                    </div>
                    <span className="font-bold">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(s.preco))}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm opacity-60">Nenhum snapshot de serviço registrado.</div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-800 font-bold text-sm">
              <span>Total:</span>
              <span className="text-base text-[#B45A2B]">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(agendamento.preco_total))}
              </span>
            </div>
          </div>

          {/* Horários: Previsto vs Real */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider opacity-60 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[#B45A2B]" /> Horário Previsto
              </span>
              <span className="text-sm font-semibold">{inicioPrevistoFmt} às {fimPrevistoFmt}</span>
              <span className="text-xs opacity-70">Duração estimada: {agendamento.duracao_total_minutos} min</span>
            </div>

            <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider opacity-60 flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5 text-blue-500" /> Execução Real
              </span>
              {agendamento.inicio_real ? (
                <>
                  <span className="text-sm font-semibold">
                    Iniciado às {inicioRealFmt} {fimRealFmt ? `• Fim às ${fimRealFmt}` : "(em andamento)"}
                  </span>
                  {comparativo.duracaoRealMinutos !== null && (
                    <span className="text-xs opacity-70">
                      Duração real: {comparativo.duracaoRealMinutos} min
                      {comparativo.diferencaDuracaoMinutos !== null && comparativo.diferencaDuracaoMinutos !== 0 && (
                        <span> ({comparativo.diferencaDuracaoMinutos > 0 ? `+${comparativo.diferencaDuracaoMinutos}` : comparativo.diferencaDuracaoMinutos} min)</span>
                      )}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xs opacity-50 italic">Atendimento ainda não iniciado.</span>
              )}
            </div>
          </div>

          {/* Profissional e Observações */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-[#B45A2B]" />
              <span>Profissional Responsável: <strong>{agendamento.profissional_nome}</strong></span>
            </div>

            {agendamento.observacoes && (
              <div className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 text-xs">
                <strong className="block mb-0.5">Observações:</strong>
                {agendamento.observacoes}
              </div>
            )}
          </div>

          {/* Seção de Reagendamento */}
          {exibindoReagendamento && agendamento.status === "confirmado" && (
            <form onSubmit={handleReagendar} className="p-4 rounded-xl border border-[#B45A2B] bg-[#B45A2B]/5 flex flex-col gap-4">
              <h4 className="font-bold text-sm text-[#B45A2B] flex items-center gap-2">
                <RotateCcw className="h-4 w-4" /> Reagendar Horário
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="novaData">Nova Data</Label>
                  <Input
                    id="novaData"
                    type="date"
                    value={novaData}
                    onChange={(e) => setNovaData(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="novoHorario">Novo Horário de Início</Label>
                  <Input
                    id="novoHorario"
                    type="time"
                    value={novoHorarioInicio}
                    onChange={(e) => setNovoHorarioInicio(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="novoProf">Profissional</Label>
                  <select
                    id="novoProf"
                    value={novoProfissionalId}
                    onChange={(e) => setNovoProfissionalId(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#B45A2B]"
                  >
                    {profissionais.map((p) => (
                      <option key={p.id} value={p.id} className="dark:bg-[#121214]">
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variante="fantasma"
                  tamanho="sm"
                  onClick={() => setExibindoReagendamento(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variante="principal"
                  tamanho="sm"
                  disabled={reagendando}
                >
                  {reagendando ? "Salvando..." : "Confirmar Reagendamento"}
                </Button>
              </div>
            </form>
          )}

          {/* Botões Operacionais da Máquina de Estados */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              {agendamento.status === "confirmado" && !exibindoReagendamento && (
                <Button
                  variante="secundario"
                  tamanho="sm"
                  onClick={() => setExibindoReagendamento(true)}
                >
                  <RotateCcw className="h-4 w-4 mr-1.5" /> Reagendar
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {agendamento.status === "confirmado" && (
                <>
                  <Button
                    variante="cancelar-destrutivo"
                    tamanho="sm"
                    disabled={atualizandoStatus}
                    onClick={() => handleMudarStatus("nao_compareceu")}
                  >
                    Não Compareceu
                  </Button>
                  <Button
                    variante="cancelar-destrutivo"
                    tamanho="sm"
                    disabled={atualizandoStatus}
                    onClick={() => handleMudarStatus("cancelado")}
                  >
                    <XCircle className="h-4 w-4 mr-1.5" /> Cancelar
                  </Button>
                  <Button
                    variante="principal"
                    tamanho="sm"
                    disabled={atualizandoStatus}
                    onClick={() => handleMudarStatus("em_atendimento")}
                  >
                    <Play className="h-4 w-4 mr-1.5" /> Iniciar Atendimento
                  </Button>
                </>
              )}

              {agendamento.status === "em_atendimento" && (
                <>
                  <Button
                    variante="cancelar-destrutivo"
                    tamanho="sm"
                    disabled={atualizandoStatus}
                    onClick={() => handleMudarStatus("cancelado")}
                  >
                    <XCircle className="h-4 w-4 mr-1.5" /> Cancelar
                  </Button>
                  <Button
                    variante="principal"
                    tamanho="sm"
                    className="bg-[#16A34A] hover:bg-[#15803D]"
                    disabled={atualizandoStatus}
                    onClick={() => handleMudarStatus("concluido")}
                  >
                    <Check className="h-4 w-4 mr-1.5" /> Concluir Atendimento
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
