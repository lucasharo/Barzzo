
import * as React from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import type { Barbearia, MetricasDashboardHoje, Agendamento } from "@barzzo/tipos";
import {
  Calendar,
  Clock,
  DollarSign,
  UserCheck,
  TrendingUp,
  AlertCircle,
  Play,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ArrowRight,
  Store,
  BarChart3,
  Bell,
  Scissors,
} from "lucide-react";

export default function PaginaPainelParceiro() {
  const [carregando, setCarregando] = React.useState(true);
  const [barbearia, setBarbearia] = React.useState<Barbearia | null>(null);
  const [usuarioPapel, setUsuarioPapel] = React.useState<string>("dono");
  const [profissionalId, setProfissionalId] = React.useState<string | null>(null);
  const [metricas, setMetricas] = React.useState<MetricasDashboardHoje>({
    total_hoje: 0,
    proximos: 0,
    em_atendimento: 0,
    concluidos: 0,
    cancelados_no_show: 0,
    faturamento_realizado: 0,
    faturamento_estimado: 0,
    novos_clientes_hoje: 0,
  });
  const [agendamentosHoje, setAgendamentosHoje] = React.useState<any[]>([]);
  const [atualizandoStatusId, setAtualizandoStatusId] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  const carregarPainel = React.useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      // 1. Obter vínculo do membro com a barbearia
      const { data: membro } = await supabase
        .from("membros_barbearia")
        .select("barbearia_id, papel")
        .eq("usuario_id", session.user.id)
        .limit(1)
        .maybeSingle();

      if (!membro?.barbearia_id) {
        setBarbearia(null);
        return;
      }

      setUsuarioPapel(membro.papel);

      // Se for profissional (não dono/gerente), descobrir id de profissional
      let profFiltroId: string | null = null;
      if (membro.papel === "profissional") {
        const { data: profDb } = await supabase
          .from("profissionais")
          .select("id")
          .eq("barbearia_id", membro.barbearia_id)
          .eq("usuario_id", session.user.id)
          .maybeSingle();

        if (profDb) {
          profFiltroId = profDb.id;
          setProfissionalId(profDb.id);
        }
      }

      // 2. Carregar dados da barbearia
      const { data: bDb } = await supabase
        .from("barbearias")
        .select("*")
        .eq("id", membro.barbearia_id)
        .single();

      if (bDb) {
        setBarbearia(bDb as Barbearia);
      }

      // 3. Buscar métricas do dia via RPC ou agregação direta
      const { data: metricasRpc, error: erroRpc } = await (supabase.rpc as any)(
        "obter_metricas_dashboard_hoje",
        {
          p_barbearia_id: membro.barbearia_id,
          p_profissional_id: profFiltroId,
        }
      );

      if (metricasRpc && !erroRpc) {
        setMetricas(metricasRpc);
      }

      // 4. Buscar lista de agendamentos de hoje
      const hojeStr = new Date().toISOString().split("T")[0];
      let queryAg = supabase
        .from("agendamentos")
        .select(`
          id,
          data_hora_inicio,
          data_hora_fim,
          status,
          preco_total,
          duracao_total_minutos,
          cliente_nome,
          cliente_telefone,
          observacoes,
          profissionais (id, nome),
          agendamento_servicos (nome_servico, duracao_minutos, preco)
        `)
        .eq("barbearia_id", membro.barbearia_id)
        .gte("data_hora_inicio", `${hojeStr}T00:00:00.000Z`)
        .lte("data_hora_inicio", `${hojeStr}T23:59:59.999Z`)
        .order("data_hora_inicio", { ascending: true });

      if (profFiltroId) {
        queryAg = queryAg.eq("profissional_id", profFiltroId);
      }

      const { data: agsDb } = await queryAg;
      setAgendamentosHoje(agsDb || []);
    } catch {
      setErro("Falha ao carregar métricas operacionais do painel.");
    } finally {
      setCarregando(false);
    }
  }, []);

  React.useEffect(() => {
    carregarPainel();
  }, [carregarPainel]);

  // Transição rápida de status de atendimento
  async function handleMudarStatus(agendamentoId: string, novoStatus: "em_atendimento" | "concluido") {
    try {
      setAtualizandoStatusId(agendamentoId);
      setErro(null);
      setSucesso(null);
      const supabase = criarClienteSupabaseBrowser();

      const { error: erroRpc } = await (supabase.rpc as any)("atualizar_status_agendamento", {
        p_agendamento_id: agendamentoId,
        p_novo_status: novoStatus,
      });

      if (erroRpc) {
        // Fallback de update direto caso a RPC transacional não tenha sido acionada
        const camposUpdate: any = { status: novoStatus };
        if (novoStatus === "em_atendimento") {
          camposUpdate.inicio_real = new Date().toISOString();
        } else if (novoStatus === "concluido") {
          camposUpdate.fim_real = new Date().toISOString();
        }

        const { error: erroUp } = await (supabase.from("agendamentos") as any)
          .update(camposUpdate)
          .eq("id", agendamentoId);

        if (erroUp) throw erroUp;
      }

      // Se concluiu, disparar processamento de comissão de influenciador se aplicável
      if (novoStatus === "concluido") {
        await (supabase.rpc as any)("processar_comissao_conclusao_atendimento", {
          p_agendamento_id: agendamentoId,
        });
      }

      setSucesso(`Atendimento ${novoStatus === "em_atendimento" ? "iniciado" : "concluído com sucesso"}!`);
      await carregarPainel();
    } catch {
      setErro("Não foi possível atualizar o status do atendimento.");
    } finally {
      setAtualizandoStatusId(null);
    }
  }

  const formatarMoeda = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

  const formatarHora = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "--:--";
    }
  };

  if (carregando) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
        <LoadingSpinner tamanho="lg" className="text-[#B45A2B]" />
        <p className="text-sm opacity-70 font-medium">Carregando métricas do dia...</p>
      </div>
    );
  }

  if (!barbearia) {
    return (
      <div className="flex-1 max-w-xl mx-auto py-12 flex flex-col items-center text-center gap-6">
        <div className="h-16 w-16 rounded-full bg-[#B45A2B]/10 flex items-center justify-center text-[#B45A2B]">
          <Store className="h-8 w-8" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Bem-vindo ao Barzzo Parceiro</h1>
          <p className="text-sm opacity-70">
            Você ainda não possui uma barbearia vinculada. Conclua o onboarding para desbloquear o dashboard operacional.
          </p>
        </div>
        <Link to="/onboarding">
          <Button variante="principal" tamanho="lg">
            Iniciar Onboarding <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Alertas */}
      {erro && (
        <Alert variante="erro">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {sucesso && (
        <Alert variante="sucesso" className="border-[#16A34A]/30 bg-[#16A34A]/10 text-[#16A34A]">
          <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
          <AlertDescription>{sucesso}</AlertDescription>
        </Alert>
      )}

      {/* Cabeçalho do Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Painel Operacional</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] font-semibold border border-[#16A34A]/20">
              Hoje
            </span>
          </div>
          <p className="text-sm opacity-70 mt-1">
            {barbearia.nome} • Visão em tempo real da agenda e receita de hoje
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/agenda">
            <Button variante="principal" tamanho="sm" className="min-h-[44px]">
              <Calendar className="mr-2 h-4 w-4" /> Ver Agenda Completa
            </Button>
          </Link>
          <Link to="/relatorios">
            <Button variante="secundario" tamanho="sm" className="min-h-[44px]">
              <BarChart3 className="mr-2 h-4 w-4" /> Relatórios
            </Button>
          </Link>
        </div>
      </div>

      {/* Cards de Métricas do Dia (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Atendimentos Hoje */}
        <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold opacity-70 uppercase tracking-wider">
                Total do Dia
              </span>
              <span className="text-3xl font-extrabold">{metricas.total_hoje}</span>
              <span className="text-xs font-medium text-[#16A34A]">
                {metricas.concluidos} concluídos
              </span>
            </div>
            <div className="h-12 w-12 rounded-xl bg-[#B45A2B]/10 flex items-center justify-center text-[#B45A2B]">
              <Scissors className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Próximos / Aguardando */}
        <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold opacity-70 uppercase tracking-wider">
                Próximos Clientes
              </span>
              <span className="text-3xl font-extrabold text-[#D97706]">{metricas.proximos}</span>
              <span className="text-xs font-medium opacity-60">
                {metricas.em_atendimento > 0 ? `${metricas.em_atendimento} na cadeira agora` : "Nenhum em atendimento"}
              </span>
            </div>
            <div className="h-12 w-12 rounded-xl bg-[#D97706]/10 flex items-center justify-center text-[#D97706]">
              <Clock className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Faturamento Realizado */}
        <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold opacity-70 uppercase tracking-wider">
                Faturado Hoje
              </span>
              <span className="text-2xl font-extrabold text-[#16A34A]">
                {formatarMoeda(metricas.faturamento_realizado)}
              </span>
              <span className="text-xs font-medium opacity-60">
                + {formatarMoeda(metricas.faturamento_estimado)} a receber
              </span>
            </div>
            <div className="h-12 w-12 rounded-xl bg-[#16A34A]/10 flex items-center justify-center text-[#16A34A]">
              <DollarSign className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Novos Clientes */}
        <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold opacity-70 uppercase tracking-wider">
                Novos Clientes
              </span>
              <span className="text-3xl font-extrabold text-blue-500">
                {metricas.novos_clientes_hoje}
              </span>
              <span className="text-xs font-medium opacity-60">
                {metricas.cancelados_no_show} faltas/cancelamentos
              </span>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <UserCheck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seção Principal: Agenda do Dia e Ações Rápidas */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#B45A2B]" /> Atendimentos Agendados para Hoje
          </h2>
          <span className="text-xs opacity-60">
            {agendamentosHoje.length} agendamento(s)
          </span>
        </div>

        {agendamentosHoje.length === 0 ? (
          <Card className="border border-neutral-200/80 dark:border-neutral-800 text-center py-12">
            <CardContent className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center opacity-60">
                <Calendar className="h-6 w-6" />
              </div>
              <p className="font-semibold text-base">Nenhum atendimento agendado para hoje.</p>
              <p className="text-xs opacity-60 max-w-sm">
                Os clientes que reservarem pelo marketplace ou agendamentos manuais adicionados aparecerão aqui em tempo real.
              </p>
              <Link to="/agenda" className="mt-2">
                <Button variante="principal" tamanho="sm">
                  Criar Agendamento Manual
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {agendamentosHoje.map((ag) => {
              const emExecucao = ag.status === "em_atendimento";
              const concluido = ag.status === "concluido";
              const cancelado = ag.status === "cancelado" || ag.status === "nao_compareceu";
              const confirmado = ag.status === "confirmado";
              const processando = atualizandoStatusId === ag.id;

              return (
                <Card
                  key={ag.id}
                  className={`border transition-all ${
                    emExecucao
                      ? "border-[#B45A2B] bg-[#B45A2B]/5 shadow-sm"
                      : "border-neutral-200/80 dark:border-neutral-800"
                  }`}
                >
                  <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Horário e Identificação */}
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 min-w-[70px]">
                        <span className="text-base font-extrabold text-[#B45A2B]">
                          {formatarHora(ag.data_hora_inicio)}
                        </span>
                        <span className="text-[10px] opacity-60">
                          {ag.duracao_total_minutos} min
                        </span>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base">
                            {ag.cliente_nome || "Cliente sem nome"}
                          </span>
                          {emExecucao && (
                            <span className="animate-pulse text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#B45A2B] text-white">
                              Na Cadeira
                            </span>
                          )}
                          {concluido && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A]">
                              Concluído
                            </span>
                          )}
                          {cancelado && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#DC2626]/10 text-[#DC2626]">
                              {ag.status === "nao_compareceu" ? "Faltou" : "Cancelado"}
                            </span>
                          )}
                        </div>

                        <div className="text-xs opacity-75 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>
                            <strong>Serviço:</strong>{" "}
                            {ag.agendamento_servicos?.map((s: any) => s.nome_servico).join(", ") || "Serviço"}
                          </span>
                          <span>•</span>
                          <span>
                            <strong>Profissional:</strong> {ag.profissionais?.nome || "Qualquer"}
                          </span>
                          <span>•</span>
                          <span className="font-bold text-[#B45A2B]">
                            {formatarMoeda(ag.preco_total)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Ações Rápidas */}
                    <div className="flex items-center gap-2 self-end md:self-center">
                      {confirmado && (
                        <Button
                          variante="principal"
                          tamanho="sm"
                          disabled={processando}
                          carregando={processando}
                          onClick={() => handleMudarStatus(ag.id, "em_atendimento")}
                          className="min-h-[44px] text-xs font-semibold px-4"
                        >
                          <Play className="mr-1.5 h-3.5 w-3.5 fill-current" /> Iniciar
                        </Button>
                      )}

                      {emExecucao && (
                        <Button
                          variante="principal"
                          tamanho="sm"
                          disabled={processando}
                          carregando={processando}
                          onClick={() => handleMudarStatus(ag.id, "concluido")}
                          className="min-h-[44px] text-xs font-semibold px-4 bg-[#16A34A] hover:bg-[#15803D] text-white"
                        >
                          <CheckCircle2 className="mr-1.5 h-4 w-4" /> Concluir Atendimento
                        </Button>
                      )}

                      <Link to={`/agendamentos/${ag.id}`}>
                        <Button variante="fantasma" tamanho="sm" className="min-h-[44px] px-3">
                          Detalhes <ChevronRight className="ml-1 h-4 w-4" />
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
    </div>
  );
}
