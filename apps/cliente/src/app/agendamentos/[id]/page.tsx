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
  ChevronLeft,
  User,
  Phone,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Navigation,
  Star,
} from "lucide-react";

interface AgendamentoCompleto {
  id: string;
  barbearia_id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
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
    endereco_complemento: string | null;
    endereco_bairro: string;
    endereco_cidade: string;
    endereco_estado: string;
    endereco_cep: string;
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

export default function PaginaDetalhesAgendamentoCliente() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [carregando, setCarregando] = React.useState(true);
  const [cancelando, setCancelando] = React.useState(false);
  const [modalCancelamentoAberto, setModalCancelamentoAberto] = React.useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = React.useState("");
  const [agendamento, setAgendamento] = React.useState<AgendamentoCompleto | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

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
        router.push(`/entrar?retorno=/agendamentos/${id}`);
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
            endereco_logradouro,
            endereco_numero,
            endereco_complemento,
            endereco_bairro,
            endereco_cidade,
            endereco_estado,
            endereco_cep
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
        .eq("id", id)
        .eq("cliente_id", session.user.id)
        .single();

      if (error || !data) {
        setErro("Agendamento não encontrado ou sem permissão de acesso.");
        return;
      }

      setAgendamento(data as AgendamentoCompleto);
    } catch {
      setErro("Falha ao carregar detalhes do agendamento.");
    } finally {
      setCarregando(false);
    }
  }

  async function executarCancelamento() {
    if (!agendamento) return;
    try {
      setCancelando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();

      const novaObs = agendamento.observacoes
        ? `${agendamento.observacoes} | Cancelado pelo cliente${motivoCancelamento ? `: ${motivoCancelamento}` : ""}`
        : `Cancelado pelo cliente${motivoCancelamento ? `: ${motivoCancelamento}` : ""}`;

      const { error } = await (supabase.from("agendamentos") as any)
        .update({
          status: "cancelado",
          observacoes: novaObs,
          updated_at: new Date().toISOString(),
        })
        .eq("id", agendamento.id);

      if (error) {
        setErro("Não foi possível cancelar o agendamento no momento.");
        return;
      }

      setSucesso("Agendamento cancelado com sucesso. O horário foi liberado.");
      setAgendamento({
        ...agendamento,
        status: "cancelado",
        observacoes: novaObs,
      });
      setModalCancelamentoAberto(false);
    } catch {
      setErro("Falha de conexão ao cancelar agendamento.");
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
          label: "Pendente",
          classe: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
          icone: <Clock className="w-4 h-4" />,
        };
      case "em_atendimento":
        return {
          label: "Em Atendimento",
          classe: "bg-copper-500/10 text-copper-600 dark:text-copper-400 border border-copper-500/20 animate-pulse",
          icone: <Scissors className="w-4 h-4" />,
        };
      case "concluido":
        return {
          label: "Concluído",
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
          label: "Não compareceu",
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
      <div className="container mx-auto px-4 py-16 max-w-2xl flex flex-col items-center justify-center gap-4">
        <LoadingSpinner tamanho="lg" />
        <p className="text-neutral-500 text-sm">Carregando detalhes do agendamento...</p>
      </div>
    );
  }

  if (erro && !agendamento) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center">
        <Alert variante="erro" className="mb-6">
          <AlertCircle className="w-4 h-4 mr-2" />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
        <Link href="/agendamentos">
          <Button variante="secundario" className="min-h-[44px]">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Voltar aos Meus Agendamentos
          </Button>
        </Link>
      </div>
    );
  }

  if (!agendamento) return null;

  const dataObj = new Date(agendamento.inicio_previsto);
  const dataLegivel = dataObj.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
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

  const totalCentavos = agendamento.agendamentos_servicos.reduce(
    (acc, s) => acc + s.preco_centavos,
    0
  );

  const duracaoTotal = agendamento.agendamentos_servicos.reduce(
    (acc, s) => acc + s.duracao_minutos,
    0
  );

  const agoraIso = new Date().toISOString();
  const podeCancelar =
    ["pendente", "confirmado"].includes(agendamento.status) &&
    agendamento.inicio_previsto > agoraIso;

  const enderecoCompleto = agendamento.barbearias
    ? `${agendamento.barbearias.endereco_logradouro}, ${agendamento.barbearias.endereco_numero}${
        agendamento.barbearias.endereco_complemento ? ` (${agendamento.barbearias.endereco_complemento})` : ""
      }, ${agendamento.barbearias.endereco_bairro}, ${agendamento.barbearias.endereco_cidade} - ${agendamento.barbearias.endereco_estado}`
    : "";

  const linkGoogleMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`;
  const statusConfig = getBadgeStatus(agendamento.status);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Navegação Superior */}
      <div className="mb-6">
        <Link
          href="/agendamentos"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-copper-600 dark:hover:text-copper-400 transition-colors font-medium min-h-[44px]"
        >
          <ChevronLeft className="w-4 h-4" />
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

      {/* Cartão Principal do Agendamento */}
      <Card className="overflow-hidden shadow-sm border-neutral-200 dark:border-neutral-800 mb-6">
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-copper-600 dark:text-copper-400 tracking-wider uppercase block">
              Agendamento Barzzo
            </span>
            <h1 className="text-xl sm:text-2xl font-bold mt-0.5">
              Protocolo #{agendamento.id.slice(0, 8)}
            </h1>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${statusConfig.classe}`}
          >
            {statusConfig.icone}
            <span>{statusConfig.label}</span>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Seção Barbearia */}
          {agendamento.barbearias && (
            <div>
              <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                Barbearia
              </h2>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div>
                  <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                    {agendamento.barbearias.nome}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-copper-600 dark:text-copper-400 flex-shrink-0 mt-0.5" />
                    <span>{enderecoCompleto}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={linkGoogleMaps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex"
                  >
                    <Button
                      variante="secundario"
                      tamanho="sm"
                      className="min-h-[40px] text-xs gap-1.5"
                    >
                      <Navigation className="w-3.5 h-3.5 text-copper-600 dark:text-copper-400" />
                      Como Chegar
                    </Button>
                  </a>
                  {agendamento.barbearias.telefone && (
                    <a href={`tel:${agendamento.barbearias.telefone}`} className="inline-flex">
                      <Button
                        variante="secundario"
                        tamanho="sm"
                        className="min-h-[40px] text-xs gap-1.5"
                      >
                        <Phone className="w-3.5 h-3.5 text-copper-600 dark:text-copper-400" />
                        Ligar
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Seção Data, Horário e Profissional */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <span className="text-xs text-neutral-400 block font-medium">Data e Horário</span>
              <div className="flex items-center gap-2 mt-2">
                <Calendar className="w-4 h-4 text-copper-600 dark:text-copper-400" />
                <span className="font-semibold capitalize text-sm">
                  {dataLegivel}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="w-4 h-4 text-copper-600 dark:text-copper-400" />
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                  {horaInicio} às {horaFim} ({duracaoTotal} min)
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <span className="text-xs text-neutral-400 block font-medium">Profissional Atendente</span>
              <div className="flex items-center gap-2.5 mt-2">
                <div className="w-8 h-8 rounded-full bg-copper-100 dark:bg-copper-950/60 text-copper-700 dark:text-copper-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {agendamento.profissionais?.nome?.[0] || "P"}
                </div>
                <div>
                  <span className="font-semibold text-sm block">
                    {agendamento.profissionais?.nome || "Qualquer disponível"}
                  </span>
                  <span className="text-xs text-neutral-500">Barbeiro selecionado</span>
                </div>
              </div>
            </div>
          </div>

          {/* Seção Serviços Contratados */}
          <div>
            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Serviços Selecionados
            </h2>
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800">
              {agendamento.agendamentos_servicos.map((servico) => (
                <div key={servico.id} className="p-3.5 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200 block">
                      {servico.nome_servico}
                    </span>
                    <span className="text-xs text-neutral-400">{servico.duracao_minutos} min</span>
                  </div>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {(servico.preco_centavos / 100).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>
              ))}

              <div className="p-4 bg-neutral-50 dark:bg-neutral-900/60 flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100 block">
                    Total a pagar na barbearia
                  </span>
                  <span className="text-xs text-neutral-500">
                    Pagamento efetuado diretamente no estabelecimento
                  </span>
                </div>
                <span className="text-lg font-bold text-copper-600 dark:text-copper-400">
                  {(totalCentavos / 100).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Observações */}
          {agendamento.observacoes && (
            <div>
              <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                Observações
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-300 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
                {agendamento.observacoes}
              </p>
            </div>
          )}

          {/* Banner de Avaliação (quando concluído) */}
          {agendamento.status === "concluido" && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Como foi seu corte?</p>
                  <p className="text-xs text-neutral-500">
                    Sua avaliação ajuda a comunidade Barzzo e a barbearia a melhorar.
                  </p>
                </div>
              </div>
              <Button
                tamanho="sm"
                variante="secundario"
                className="border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 min-h-[40px]"
                onClick={() => alert("O módulo de avaliações completas será aberto na Task 06!")}
              >
                Avaliar Atendimento
              </Button>
            </div>
          )}

          {/* Ações de Cancelamento */}
          {podeCancelar && !modalCancelamentoAberto && (
            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
              <Button
                variante="cancelar-simples"
                onClick={() => setModalCancelamentoAberto(true)}
                className="min-h-[44px]"
              >
                Cancelar este Agendamento
              </Button>
            </div>
          )}

          {/* Modal / Caixa de Confirmação de Cancelamento */}
          {modalCancelamentoAberto && (
            <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-red-900 dark:text-red-200">
                    Confirmar cancelamento da reserva?
                  </h4>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                    O horário será imediatamente liberado para outros clientes.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                  Motivo do cancelamento (opcional):
                </label>
                <input
                  type="text"
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                  placeholder="Ex: Imprevisto no trabalho, reagendamento..."
                  className="w-full text-xs p-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-copper-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  variante="secundario"
                  tamanho="sm"
                  onClick={() => setModalCancelamentoAberto(false)}
                  disabled={cancelando}
                  className="min-h-[40px] text-xs"
                >
                  Voltar
                </Button>
                <Button
                  variante="cancelar-destrutivo"
                  tamanho="sm"
                  onClick={executarCancelamento}
                  disabled={cancelando}
                  className="min-h-[40px] text-xs font-semibold gap-1.5"
                >
                  {cancelando ? (
                    <>
                      <LoadingSpinner tamanho="sm" />
                      Cancelando...
                    </>
                  ) : (
                    "Confirmar Cancelamento"
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
