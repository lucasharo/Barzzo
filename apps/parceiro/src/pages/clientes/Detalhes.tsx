
import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { esquemaCriarObservacaoCliente } from "@barzzo/validacoes";
import { formatarTelefone } from "@barzzo/utilitarios";
import type {
  ClienteBarbearia,
  ObservacaoCliente,
  MetricasClienteCRM,
  StatusAgendamento,
} from "@barzzo/tipos";
import {
  Users,
  ChevronLeft,
  Calendar,
  DollarSign,
  Scissors,
  Lock,
  Plus,
  Clock,
  Phone,
  Mail,
  AlertCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

interface AgendamentoHistorico {
  id: string;
  inicio_previsto: string;
  fim_previsto: string;
  status: StatusAgendamento;
  preco_total: number;
  observacoes: string | null;
  profissionais: { nome: string } | null;
  agendamentos_servicos: Array<{ nome_servico: string; preco: number }>;
}

export default function PaginaFichaClienteCRM() {
  const params = useParams();
  const navigate = useNavigate();
  const id = params.id as string;

  const [carregando, setCarregando] = React.useState(true);
  const [salvandoNota, setSalvandoNota] = React.useState(false);
  const [cliente, setCliente] = React.useState<ClienteBarbearia | null>(null);
  const [metricas, setMetricas] = React.useState<MetricasClienteCRM | null>(null);
  const [observacoes, setObservacoes] = React.useState<ObservacaoCliente[]>([]);
  const [agendamentos, setAgendamentos] = React.useState<AgendamentoHistorico[]>([]);

  // Formulário de nova nota interna
  const [novaNota, setNovaNota] = React.useState("");

  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (id) carregarDados();
  }, [id]);

  async function carregarDados() {
    try {
      setCarregando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/entrar");
        return;
      }

      // 1. Buscar cliente
      const { data: cDb, error: erroC } = await (supabase.from("clientes_barbearia") as any)
        .select("*")
        .eq("id", id)
        .single();

      if (erroC || !cDb) {
        setErro("Cliente não encontrado ou você não possui acesso a esta barbearia.");
        return;
      }

      setCliente(cDb as ClienteBarbearia);

      // 2. Buscar observações internas da equipe
      const { data: obsDb } = await (supabase.from("observacoes_clientes") as any)
        .select("*")
        .eq("cliente_barbearia_id", id)
        .order("created_at", { ascending: false });

      setObservacoes((obsDb || []) as ObservacaoCliente[]);

      // 3. Buscar histórico de agendamentos deste cliente nesta barbearia
      const { data: agsDb } = await (supabase.from("agendamentos") as any)
        .select(`
          id,
          inicio_previsto,
          fim_previsto,
          status,
          preco_total,
          observacoes,
          profissionais (
            nome
          ),
          agendamentos_servicos (
            nome_servico,
            preco
          )
        `)
        .eq("barbearia_id", cDb.barbearia_id)
        .or(
          cDb.usuario_id
            ? `cliente_id.eq.${cDb.usuario_id},cliente_telefone.eq.${cDb.telefone}`
            : `cliente_telefone.eq.${cDb.telefone}`
        )
        .order("inicio_previsto", { ascending: false });

      const listaAgs = (agsDb || []) as AgendamentoHistorico[];
      setAgendamentos(listaAgs);

      // 4. Calcular métricas operacionais
      const concluidos = listaAgs.filter((a) => a.status === "concluido");
      const cancelados = listaAgs.filter((a) => a.status === "cancelado");
      const noShows = listaAgs.filter((a) => a.status === "nao_compareceu");
      const totalGasto = concluidos.reduce((acc, a) => acc + (a.preco_total || 0), 0) * 100;

      // Profissional mais frequente
      const contagemProf: Record<string, number> = {};
      concluidos.forEach((a) => {
        const nomeProf = a.profissionais?.nome;
        if (nomeProf) contagemProf[nomeProf] = (contagemProf[nomeProf] || 0) + 1;
      });
      const profMaisFrequente = Object.entries(contagemProf).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0] || null;

      const ultimoAtendimento = concluidos[0]?.inicio_previsto || null;

      setMetricas({
        total_agendamentos: listaAgs.length,
        concluidos: concluidos.length,
        cancelados: cancelados.length,
        no_shows: noShows.length,
        total_gasto_centavos: totalGasto,
        ultimo_atendimento: ultimoAtendimento,
        profissional_mais_frequente_nome: profMaisFrequente,
      });
    } catch {
      setErro("Falha ao carregar a ficha do cliente.");
    } finally {
      setCarregando(false);
    }
  }

  async function adicionarObservacao(e: React.FormEvent) {
    e.preventDefault();
    if (!cliente) return;

    const validacao = esquemaCriarObservacaoCliente.safeParse({ texto: novaNota.trim() });
    if (!validacao.success) {
      setErro(validacao.error.errors[0]?.message || "Texto da nota inválido");
      return;
    }

    try {
      setSalvandoNota(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data: usuarioAtual } = await (supabase.from("usuarios") as any)
        .select("nome")
        .eq("id", session.user.id)
        .single();

      const autorNome = usuarioAtual?.nome || "Membro da Equipe";

      const { data: novaObsDb, error } = await (supabase.from("observacoes_clientes") as any)
        .insert({
          barbearia_id: cliente.barbearia_id,
          cliente_barbearia_id: cliente.id,
          autor_id: session.user.id,
          autor_nome: autorNome,
          texto: novaNota.trim(),
        })
        .select()
        .single();

      if (error) {
        setErro("Não foi possível salvar a observação interna.");
        return;
      }

      setSucesso("Observação confidencial salva com sucesso!");
      setObservacoes((ant) => [novaObsDb as ObservacaoCliente, ...ant]);
      setNovaNota("");
    } catch {
      setErro("Erro de comunicação ao registrar nota.");
    } finally {
      setSalvandoNota(false);
    }
  }

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
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando ficha do cliente...</p>
      </div>
    );
  }

  if (erro && !cliente) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <Alert variante="erro" className="mb-6">
          <AlertCircle className="w-4 h-4 mr-2" />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
        <Link to="/clientes">
          <Button variante="secundario" className="min-h-[44px]">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Voltar aos Clientes
          </Button>
        </Link>
      </div>
    );
  }

  if (!cliente) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Navegação */}
      <div>
        <Link
          to="/clientes"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-[#B45A2B] transition-colors font-medium min-h-[44px]"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar para Lista de Clientes
        </Link>
      </div>

      {erro && (
        <Alert variante="erro">
          <AlertCircle className="w-4 h-4 mr-2" />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {sucesso && (
        <Alert variante="sucesso">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          <AlertDescription>{sucesso}</AlertDescription>
        </Alert>
      )}

      {/* Header do Cliente */}
      <Card className="p-6 border-neutral-200 dark:border-neutral-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#B45A2B]/15 text-[#B45A2B] flex items-center justify-center font-bold text-2xl shrink-0">
              {cliente.nome[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{cliente.nome}</h1>
                {cliente.usuario_id && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20">
                    Conta App Barzzo
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs opacity-75 mt-1">
                {cliente.telefone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-[#B45A2B]" />
                    {formatarTelefone(cliente.telefone)}
                  </span>
                )}
                {cliente.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-[#B45A2B]" />
                    {cliente.email}
                  </span>
                )}
                <span>
                  Cadastrado em {new Date(cliente.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
            </div>
          </div>

          <Link to="/agenda">
            <Button className="bg-[#B45A2B] hover:bg-[#C46632] text-white min-h-[44px] gap-1.5 text-xs">
              <Calendar className="w-4 h-4" />
              Novo Agendamento
            </Button>
          </Link>
        </div>
      </Card>

      {/* Métricas do Cliente */}
      {metricas && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4 border-neutral-200 dark:border-neutral-800">
            <span className="text-xs opacity-60 block font-medium">Total de Atendimentos</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-neutral-900 dark:text-neutral-100">
                {metricas.concluidos}
              </span>
              <span className="text-xs opacity-50">/ {metricas.total_agendamentos} total</span>
            </div>
          </Card>

          <Card className="p-4 border-neutral-200 dark:border-neutral-800">
            <span className="text-xs opacity-60 block font-medium">Total Gasto Estimado</span>
            <span className="text-2xl font-black text-[#B45A2B] block mt-1">
              {(metricas.total_gasto_centavos / 100).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>
          </Card>

          <Card className="p-4 border-neutral-200 dark:border-neutral-800">
            <span className="text-xs opacity-60 block font-medium">Cancelamentos / Faltas</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-bold text-neutral-700 dark:text-neutral-300">
                {metricas.cancelados} canc.
              </span>
              {metricas.no_shows > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-600 border border-red-500/20">
                  {metricas.no_shows} no-show
                </span>
              )}
            </div>
          </Card>

          <Card className="p-4 border-neutral-200 dark:border-neutral-800">
            <span className="text-xs opacity-60 block font-medium">Barbeiro Mais Frequente</span>
            <span className="text-base font-bold text-neutral-900 dark:text-neutral-100 block truncate mt-1">
              {metricas.profissional_mais_frequente_nome || "Variado"}
            </span>
          </Card>
        </div>
      )}

      {/* Grid Principal: Notas Internas (Esquerda) e Histórico de Agendamentos (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Observações Internas da Barbearia */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-5 border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#B45A2B]" />
                <h3 className="font-bold text-sm">Notas Internas da Equipe</h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20">
                Confidencial
              </span>
            </div>

            <p className="text-[11px] opacity-60 my-2">
              Observações privadas sobre preferências, alergias ou detalhes de corte. O cliente nunca visualiza estas notas.
            </p>

            <form onSubmit={adicionarObservacao} className="space-y-2 mt-3">
              <textarea
                value={novaNota}
                onChange={(e) => setNovaNota(e.target.value)}
                placeholder="Ex: Usa navalha, prefere tesoura no topo, alérgico a perfume..."
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
              />
              <Button
                type="submit"
                disabled={salvandoNota || !novaNota.trim()}
                carregando={salvandoNota}
                tamanho="sm"
                className="w-full bg-[#B45A2B] hover:bg-[#C46632] text-white min-h-[36px] text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Adicionar Nota Interna
              </Button>
            </form>

            <div className="mt-5 space-y-3">
              {observacoes.length === 0 ? (
                <p className="text-xs opacity-50 italic text-center py-4">
                  Nenhuma anotação registrada ainda.
                </p>
              ) : (
                observacoes.map((obs) => (
                  <div
                    key={obs.id}
                    className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px] opacity-60">
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {obs.autor_nome}
                      </span>
                      <span>
                        {new Date(obs.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap">
                      {obs.texto}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Histórico de Agendamentos */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5 border-neutral-200 dark:border-neutral-800">
            <h3 className="font-bold text-base mb-1">Histórico de Atendimentos</h3>
            <p className="text-xs opacity-60 mb-4">
              Todos os agendamentos registrados para este cliente na sua barbearia
            </p>

            {agendamentos.length === 0 ? (
              <p className="text-xs opacity-50 italic text-center py-8">
                Nenhum agendamento encontrado no sistema.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
                {agendamentos.map((ag) => {
                  const statusConf = getBadgeStatus(ag.status);
                  const dataFormatada = new Date(ag.inicio_previsto).toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });
                  const horaFormatada = new Date(ag.inicio_previsto).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div key={ag.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm capitalize">{dataFormatada}</span>
                          <span className="opacity-60">às {horaFormatada}</span>
                        </div>
                        <p className="text-xs text-neutral-700 dark:text-neutral-300 mt-1">
                          <span className="font-medium">
                            {ag.agendamentos_servicos?.map((s) => s.nome_servico).join(", ") || "Atendimento"}
                          </span>
                          {" • "}
                          <span className="opacity-70">
                            Barbeiro: {ag.profissionais?.nome || "Qualquer"}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <span className="font-bold text-sm text-[#B45A2B]">
                          {(ag.preco_total || 0).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusConf.classe}`}>
                          {statusConf.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
