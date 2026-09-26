import * as React from "react";
import { Link } from "react-router-dom";
import { useParams, useNavigate } from "react-router-dom";
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
import type { StatusAgendamento } from "@barzzo/tipos";
import {
  Calendar,
  Clock,
  Scissors,
  MapPin,
  User,
  AlertCircle,
  ArrowLeft,
  Phone,
  XCircle,
  Star,
  CheckCircle2,
} from "lucide-react";

interface AgendamentoDetalhe {
  id: string;
  barbearia_id: string;
  cliente_id: string | null;
  profissional_id: string;
  inicio_previsto: string;
  fim_previsto: string;
  status: StatusAgendamento;
  origem: string;
  observacoes: string | null;
  preco_total?: number;
  duracao_total_minutos?: number;
  criado_em?: string;
  barbearias: {
    nome: string;
    slug: string;
    telefone: string | null;
    endereco: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
  } | null;
  profissionais: {
    nome: string;
    foto_url: string | null;
  } | null;
  agendamentos_servicos: Array<{
    id: string;
    nome_servico: string;
    preco: number;
    duracao_minutos: number;
  }>;
  avaliacoes?: Array<{ id: string }>;
}

export default function PaginaDetalhesAgendamentoCliente() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [carregando, setCarregando] = React.useState(true);
  const [agendamento, setAgendamento] = React.useState<AgendamentoDetalhe | null>(null);
  const [cancelando, setCancelando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);
  const [solicitandoCancelamento, setSolicitandoCancelamento] = React.useState(false);

  React.useEffect(() => {
    if (id) carregarDetalhes();
  }, [id]);

  async function carregarDetalhes() {
    try {
      setCarregando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate(`/entrar?retorno=/agendamentos/${id}`);
        return;
      }

      const { data, error } = await supabase
        .from("agendamentos")
        .select(`
          *,
          barbearias (
            nome,
            slug,
            telefone,
            endereco,
            bairro,
            cidade,
            estado
          ),
          profissionais (
            nome,
            foto_url
          ),
          agendamentos_servicos (
            id,
            nome_servico,
            preco,
            duracao_minutos
          ),
          avaliacoes (
            id
          )
        `)
        .eq("id", id)
        .eq("cliente_id", session.user.id)
        .single();

      if (error || !data) {
        setErro("Agendamento não encontrado ou sem permissão de acesso.");
        return;
      }

      setAgendamento(data as AgendamentoDetalhe);
    } catch {
      setErro("Falha ao comunicar com os servidores.");
    } finally {
      setCarregando(false);
    }
  }

  async function cancelarAgendamento() {
    if (!agendamento) return;
    try {
      setCancelando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();
      const { error } = await supabase
        .from("agendamentos")
        .update({ status: "cancelado" })
        .eq("id", agendamento.id);

      if (error) {
        setErro("Não foi possível cancelar o agendamento. Tente novamente ou entre em contato com a barbearia.");
        return;
      }

      setAgendamento((prev) => prev ? { ...prev, status: "cancelado" } : null);
      setSucesso("Agendamento cancelado com sucesso.");
      setSolicitandoCancelamento(false);
    } catch {
      setErro("Erro ao processar o cancelamento.");
    } finally {
      setCancelando(false);
    }
  }

  function getBadgeStatus(status: StatusAgendamento) {
    switch (status) {
      case "confirmado":
        return {
          label: "Confirmado",
          classe: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
          icone: <CheckCircle2 className="w-4 h-4" />,
        };
      case "pendente":
        return {
          label: "Aguardando Confirmação",
          classe: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
          icone: <Clock className="w-4 h-4" />,
        };
      case "em_atendimento":
        return {
          label: "Em Atendimento",
          classe: "bg-copper-500/10 text-copper-600 border border-copper-500/20 animate-pulse",
          icone: <Scissors className="w-4 h-4" />,
        };
      case "concluido":
        return {
          label: "Atendimento Concluído",
          classe: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
          icone: <CheckCircle2 className="w-4 h-4" />,
        };
      case "cancelado":
        return {
          label: "Cancelado",
          classe: "bg-neutral-500/10 text-neutral-500 border border-neutral-500/20",
          icone: <XCircle className="w-4 h-4" />,
        };
      case "nao_compareceu":
        return {
          label: "Não Compareceu",
          classe: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
          icone: <AlertCircle className="w-4 h-4" />,
        };
      default:
        return {
          label: status,
          classe: "bg-neutral-500/10 text-neutral-500 border border-neutral-500/20",
          icone: null,
        };
    }
  }

  if (carregando) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-3xl flex flex-col items-center justify-center gap-4">
        <LoadingSpinner tamanho="lg" />
        <p className="text-neutral-500 text-sm">Carregando detalhes do agendamento...</p>
      </div>
    );
  }

  if (erro && !agendamento) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
        <Alert variante="erro" className="mb-6">
          <AlertCircle className="w-4 h-4 mr-2" />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
        <Link to="/agendamentos">
          <Button variante="secundario" className="min-h-[44px]">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar aos Agendamentos
          </Button>
        </Link>
      </div>
    );
  }

  if (!agendamento) return null;

  const statusConfig = getBadgeStatus(agendamento.status);
  const dataObj = new Date(agendamento.inicio_previsto);
  const dataLegivel = dataObj.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const horaInicio = dataObj.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const horaFim = new Date(agendamento.fim_previsto).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalPreco =
    agendamento.preco_total != null
      ? Number(agendamento.preco_total)
      : agendamento.agendamentos_servicos.reduce((acc, s) => acc + (Number(s.preco) || 0), 0);

  const podeCancelar =
    ["confirmado", "pendente"].includes(agendamento.status) &&
    new Date(agendamento.inicio_previsto) > new Date();

  const podeAvaliar =
    agendamento.status === "concluido" &&
    (!agendamento.avaliacoes || agendamento.avaliacoes.length === 0);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Navegação Breadcrumb */}
      <div className="mb-6">
        <Link
          to="/agendamentos"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-copper-600 transition-colors font-medium min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Meus Agendamentos
        </Link>
      </div>

      {erro && (
        <Alert variante="erro" className="mb-6">
          <AlertCircle className="w-4 h-4 mr-2" />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {sucesso && (
        <Alert variante="sucesso" className="mb-6">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          <AlertDescription>{sucesso}</AlertDescription>
        </Alert>
      )}

      {/* Cabeçalho com Status e Código */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Detalhes do Agendamento</h1>
          <p className="text-sm text-neutral-500 mt-1 font-mono">Código: #{agendamento.id.slice(0, 8)}</p>
        </div>

        <div
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold ${statusConfig.classe}`}
        >
          {statusConfig.icone}
          <span>{statusConfig.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Coluna Principal */}
        <div className="md:col-span-2 flex flex-col gap-5">
          {/* Card: Barbearia e Local */}
          <Card className="border-neutral-200 dark:border-neutral-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-copper-600" />
                {agendamento.barbearias?.nome || "Barbearia"}
              </CardTitle>
              {agendamento.barbearias && (
                <CardDescription>
                  {[
                    agendamento.barbearias.endereco,
                    agendamento.barbearias.bairro,
                    agendamento.barbearias.cidade,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </CardDescription>
              )}
            </CardHeader>
            {agendamento.barbearias?.telefone && (
              <CardContent className="pt-0">
                <a
                  href={`tel:${agendamento.barbearias.telefone}`}
                  className="text-sm text-copper-600 dark:text-copper-400 hover:underline flex items-center gap-1.5 min-h-[44px]"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {agendamento.barbearias.telefone}
                </a>
              </CardContent>
            )}
          </Card>

          {/* Card: Data e Horário */}
          <Card className="border-neutral-200 dark:border-neutral-800">
            <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="w-6 h-6 text-copper-600 dark:text-copper-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-medium text-neutral-400 block">Data</span>
                  <span className="font-semibold capitalize text-neutral-800 dark:text-neutral-200">
                    {dataLegivel}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-6 h-6 text-copper-600 dark:text-copper-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-medium text-neutral-400 block">Horário</span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {horaInicio} às {horaFim}
                  </span>
                  <span className="text-xs text-neutral-500 block">
                    Duração: {agendamento.duracao_total_minutos || agendamento.agendamentos_servicos.reduce((a, s) => a + s.duracao_minutos, 0)} min
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: Profissional */}
          {agendamento.profissionais && (
            <Card className="border-neutral-200 dark:border-neutral-800">
              <CardContent className="p-5 flex items-center gap-3">
                <User className="w-6 h-6 text-copper-600 dark:text-copper-400 flex-shrink-0" />
                <div>
                  <span className="text-xs font-medium text-neutral-400 block">Profissional Responsável</span>
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {agendamento.profissionais.nome}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Card: Serviços */}
          <Card className="border-neutral-200 dark:border-neutral-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Scissors className="w-4 h-4 text-copper-600" /> Serviços Contratados
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col gap-2">
                {agendamento.agendamentos_servicos.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800/80 last:border-0"
                  >
                    <div>
                      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        {s.nome_servico}
                      </span>
                      <span className="text-xs text-neutral-500 block">{s.duracao_minutos} min</span>
                    </div>
                    <span className="font-semibold text-copper-600 dark:text-copper-400 text-sm">
                      {Number(s.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                ))}

                {/* Total */}
                <div className="flex items-center justify-between pt-2 mt-1 border-t border-neutral-200 dark:border-neutral-800">
                  <span className="font-bold text-sm">Total</span>
                  <span className="font-black text-base text-copper-600 dark:text-copper-400">
                    {totalPreco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Observações */}
          {agendamento.observacoes && (
            <Card className="border-neutral-200 dark:border-neutral-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-neutral-500">Observações para a Barbearia</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                  {agendamento.observacoes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Coluna Lateral: Ações */}
        <div className="flex flex-col gap-4">
          {/* Ações Principais */}
          {podeAvaliar && (
            <Link to={`/avaliacoes/${agendamento.id}`}>
              <Button
                variante="principal"
                className="w-full gap-2 min-h-[44px] shadow-sm"
              >
                <Star className="w-4 h-4" />
                Avaliar Atendimento
              </Button>
            </Link>
          )}

          {agendamento.barbearias && (
            <Link to={`/reservar/${agendamento.barbearias.slug}`}>
              <Button variante="secundario" className="w-full gap-2 min-h-[44px]">
                <Calendar className="w-4 h-4" />
                Agendar Novamente
              </Button>
            </Link>
          )}

          {/* Cancelamento */}
          {podeCancelar && (
            <Card className="border-red-500/20 dark:border-red-900/30 bg-red-500/5">
              <CardContent className="p-4 flex flex-col gap-3">
                <h4 className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Cancelar Agendamento
                </h4>

                {!solicitandoCancelamento ? (
                  <>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      Precisa cancelar por algum imprevisto? Você pode cancelar até antes do horário marcado.
                    </p>
                    <Button
                      variante="cancelar-simples"
                      onClick={() => setSolicitandoCancelamento(true)}
                      className="w-full min-h-[44px] text-sm"
                    >
                      Solicitar Cancelamento
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-neutral-700 dark:text-neutral-300 font-medium">
                      Tem certeza que deseja cancelar? Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variante="secundario"
                        onClick={() => setSolicitandoCancelamento(false)}
                        className="flex-1 min-h-[44px] text-sm"
                      >
                        Manter
                      </Button>
                      <Button
                        variante="cancelar-simples"
                        onClick={cancelarAgendamento}
                        carregando={cancelando}
                        className="flex-1 min-h-[44px] text-sm font-semibold"
                      >
                        Confirmar
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Informação de Suporte */}
          <div className="text-xs text-neutral-500 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800">
            Precisa de ajuda com este agendamento? Entre em contato diretamente com a barbearia pelo telefone indicado acima.
          </div>
        </div>
      </div>
    </div>
  );
}
