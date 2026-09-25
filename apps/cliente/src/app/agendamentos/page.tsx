"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  ChevronRight,
  User,
  AlertCircle,
  Plus,
  RefreshCw,
  XCircle,
  CheckCircle2,
} from "lucide-react";

interface AgendamentoCliente {
  id: string;
  barbearia_id: string;
  cliente_id: string;
  profissional_id: string;
  inicio_previsto: string;
  fim_previsto: string;
  status: StatusAgendamento;
  origem: string;
  observacoes: string | null;
  created_at: string;
  barbearias: {
    nome: string;
    slug: string;
    telefone: string | null;
    endereco_logradouro: string;
    endereco_numero: string;
    endereco_bairro: string;
    endereco_cidade: string;
  } | null;
  profissionais: {
    nome: string;
    foto_url: string | null;
  } | null;
  agendamentos_servicos: Array<{
    id: string;
    nome_servico: string;
    preco_centavos: number;
    duracao_minutos: number;
  }>;
}

export default function PaginaMeusAgendamentos() {
  const router = useRouter();
  const [carregando, setCarregando] = React.useState(true);
  const [autenticado, setAutenticado] = React.useState<boolean | null>(null);
  const [agendamentos, setAgendamentos] = React.useState<AgendamentoCliente[]>([]);
  const [abaAtiva, setAbaAtiva] = React.useState<"proximos" | "historico">("proximos");
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    carregarAgendamentos();
  }, []);

  async function carregarAgendamentos() {
    try {
      setCarregando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setAutenticado(false);
        setCarregando(false);
        return;
      }

      setAutenticado(true);

      const { data, error } = await supabase
        .from("agendamentos")
        .select(`
          *,
          barbearias (
            nome,
            slug,
            telefone,
            endereco_logradouro,
            endereco_numero,
            endereco_bairro,
            endereco_cidade
          ),
          profissionais (
            nome,
            foto_url
          ),
          agendamentos_servicos (
            id,
            nome_servico,
            preco_centavos,
            duracao_minutos
          )
        `)
        .eq("cliente_id", session.user.id)
        .order("inicio_previsto", { ascending: false });

      if (error) {
        setErro("Não foi possível carregar seus agendamentos no momento.");
        return;
      }

      setAgendamentos((data || []) as AgendamentoCliente[]);
    } catch {
      setErro("Falha ao comunicar com os servidores.");
    } finally {
      setCarregando(false);
    }
  }

  function getBadgeStatus(status: StatusAgendamento) {
    switch (status) {
      case "confirmado":
        return {
          label: "Confirmado",
          classe: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
          icone: <CheckCircle2 className="w-3.5 h-3.5" />,
        };
      case "pendente":
        return {
          label: "Pendente",
          classe: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
          icone: <Clock className="w-3.5 h-3.5" />,
        };
      case "em_atendimento":
        return {
          label: "Em Atendimento",
          classe: "bg-copper-500/10 text-copper-600 dark:text-copper-400 border border-copper-500/20 animate-pulse",
          icone: <Scissors className="w-3.5 h-3.5" />,
        };
      case "concluido":
        return {
          label: "Concluído",
          classe: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
          icone: <CheckCircle2 className="w-3.5 h-3.5" />,
        };
      case "cancelado":
        return {
          label: "Cancelado",
          classe: "bg-neutral-500/10 text-neutral-500 border border-neutral-500/20",
          icone: <XCircle className="w-3.5 h-3.5" />,
        };
      case "nao_compareceu":
        return {
          label: "Não compareceu",
          classe: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
          icone: <AlertCircle className="w-3.5 h-3.5" />,
        };
      default:
        return {
          label: status,
          classe: "bg-neutral-500/10 text-neutral-500 border border-neutral-500/20",
          icone: null,
        };
    }
  }

  const agoraIso = new Date().toISOString();

  const agendamentosProximos = agendamentos.filter((a) => {
    const ehFuturo = a.inicio_previsto >= agoraIso;
    const ehAtivo = ["pendente", "confirmado", "em_atendimento"].includes(a.status);
    return ehFuturo && ehAtivo;
  });

  const agendamentosHistorico = agendamentos.filter((a) => {
    const ehPassado = a.inicio_previsto < agoraIso;
    const ehFinalizado = ["concluido", "cancelado", "nao_compareceu"].includes(a.status);
    return ehPassado || ehFinalizado;
  });

  const listaAtual = abaAtiva === "proximos" ? agendamentosProximos : agendamentosHistorico;

  if (carregando) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-4xl flex flex-col items-center justify-center gap-4">
        <LoadingSpinner tamanho="lg" />
        <p className="text-neutral-500 text-sm">Carregando seus agendamentos...</p>
      </div>
    );
  }

  if (autenticado === false) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-lg">
        <Card className="text-center p-8 border-neutral-200 dark:border-neutral-800">
          <div className="w-16 h-16 rounded-full bg-copper-500/10 text-copper-600 dark:text-copper-400 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Acesse seus agendamentos</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6">
            Faça login na sua conta do Barzzo para visualizar seus horários reservados, histórico de cortes e detalhes de contato.
          </p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => router.push("/entrar?retorno=/agendamentos")}
              className="w-full bg-copper-600 hover:bg-copper-700 text-white min-h-[44px]"
            >
              Fazer login no Barzzo
            </Button>
            <Button
              variante="secundario"
              onClick={() => router.push("/barbearias")}
              className="w-full min-h-[44px]"
            >
              Explorar barbearias
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Meus Agendamentos</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Acompanhe seus horários confirmados e histórico de atendimentos
          </p>
        </div>
        <Link href="/barbearias">
          <Button className="bg-copper-600 hover:bg-copper-700 text-white gap-2 min-h-[44px] shadow-sm">
            <Plus className="w-4 h-4" />
            Novo Agendamento
          </Button>
        </Link>
      </div>

      {erro && (
        <Alert variante="erro" className="mb-6">
          <AlertCircle className="w-4 h-4 mr-2" />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {/* Seletor de Abas */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-6" role="tablist">
        <button
          role="tab"
          aria-selected={abaAtiva === "proximos"}
          onClick={() => setAbaAtiva("proximos")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors min-h-[44px] flex items-center gap-2 ${
            abaAtiva === "proximos"
              ? "border-copper-600 text-copper-600 dark:text-copper-400 font-semibold"
              : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          }`}
        >
          Próximos
          <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
            {agendamentosProximos.length}
          </span>
        </button>

        <button
          role="tab"
          aria-selected={abaAtiva === "historico"}
          onClick={() => setAbaAtiva("historico")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors min-h-[44px] flex items-center gap-2 ${
            abaAtiva === "historico"
              ? "border-copper-600 text-copper-600 dark:text-copper-400 font-semibold"
              : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          }`}
        >
          Histórico
          <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
            {agendamentosHistorico.length}
          </span>
        </button>
      </div>

      {/* Lista de Agendamentos */}
      {listaAtual.length === 0 ? (
        <Card className="text-center py-12 px-4 border-dashed border-2 border-neutral-200 dark:border-neutral-800">
          <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold mb-1">
            {abaAtiva === "proximos"
              ? "Nenhum agendamento futuro"
              : "Nenhum histórico de agendamento"}
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mb-5">
            {abaAtiva === "proximos"
              ? "Você não possui horários marcados no momento. Que tal encontrar uma barbearia agora?"
              : "Seus atendimentos concluídos e cancelados aparecerão aqui."}
          </p>
          {abaAtiva === "proximos" && (
            <Link href="/barbearias">
              <Button className="bg-copper-600 hover:bg-copper-700 text-white min-h-[44px]">
                Encontrar Barbearias
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {listaAtual.map((item) => {
            const statusConfig = getBadgeStatus(item.status);
            const dataObj = new Date(item.inicio_previsto);
            const dataLegivel = dataObj.toLocaleDateString("pt-BR", {
              weekday: "short",
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
            const horaInicio = dataObj.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const horaFim = new Date(item.fim_previsto).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            });

            const totalCentavos = item.agendamentos_servicos.reduce(
              (acc, s) => acc + s.preco_centavos,
              0
            );

            return (
              <Card
                key={item.id}
                className="overflow-hidden hover:border-copper-500/40 transition-colors shadow-sm"
              >
                <div className="p-5 sm:p-6 flex flex-col gap-4">
                  {/* Topo do Card: Barbearia e Status */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link
                        href={item.barbearias ? `/barbearias/${item.barbearias.slug}` : "#"}
                        className="text-lg font-bold hover:text-copper-600 dark:hover:text-copper-400 transition-colors"
                      >
                        {item.barbearias?.nome || "Barbearia"}
                      </Link>
                      {item.barbearias && (
                        <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          <span>
                            {item.barbearias.endereco_bairro},{" "}
                            {item.barbearias.endereco_cidade}
                          </span>
                        </p>
                      )}
                    </div>

                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusConfig.classe}`}
                    >
                      {statusConfig.icone}
                      <span>{statusConfig.label}</span>
                    </div>
                  </div>

                  {/* Informações Centrais: Horário, Serviços, Profissional */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3 border-y border-neutral-100 dark:border-neutral-800 text-sm">
                    {/* Data e Horário */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-copper-50 dark:bg-copper-950/40 text-copper-600 dark:text-copper-400 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs text-neutral-400 block font-medium">Quando</span>
                        <span className="font-medium capitalize text-neutral-800 dark:text-neutral-200">
                          {dataLegivel}
                        </span>
                        <span className="text-xs text-neutral-500 block">
                          {horaInicio} às {horaFim}
                        </span>
                      </div>
                    </div>

                    {/* Serviços */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-copper-50 dark:bg-copper-950/40 text-copper-600 dark:text-copper-400 flex items-center justify-center flex-shrink-0">
                        <Scissors className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <span className="text-xs text-neutral-400 block font-medium">Serviços</span>
                        <span className="font-medium text-neutral-800 dark:text-neutral-200 block truncate">
                          {item.agendamentos_servicos.map((s) => s.nome_servico).join(", ") ||
                            "Atendimento padrão"}
                        </span>
                        <span className="text-xs font-semibold text-copper-600 dark:text-copper-400">
                          {(totalCentavos / 100).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Profissional */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-copper-50 dark:bg-copper-950/40 text-copper-600 dark:text-copper-400 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs text-neutral-400 block font-medium">Profissional</span>
                        <span className="font-medium text-neutral-800 dark:text-neutral-200">
                          {item.profissionais?.nome || "Qualquer disponível"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rodapé do Card com Ações */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-neutral-400">
                      Código: #{item.id.slice(0, 8)}
                    </span>
                    <div className="flex items-center gap-2">
                      {abaAtiva === "historico" && item.barbearias && (
                        <Link href={`/reservar/${item.barbearias.slug}`}>
                          <Button
                            variante="secundario"
                            tamanho="sm"
                            className="min-h-[36px] text-xs gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Agendar Novamente
                          </Button>
                        </Link>
                      )}
                      <Link href={`/agendamentos/${item.id}`}>
                        <Button
                          variante="fantasma"
                          tamanho="sm"
                          className="min-h-[36px] text-xs gap-1 font-semibold text-copper-600 dark:text-copper-400 hover:bg-copper-50 dark:hover:bg-copper-950/30"
                        >
                          Detalhes
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
