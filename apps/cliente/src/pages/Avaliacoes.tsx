
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
import {
  validarElegibilidadeAvaliacao,
  esquemaCriarAvaliacao,
} from "@barzzo/dominio";
import type { Avaliacao } from "@barzzo/tipos";
import {
  Star,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Building2,
  Calendar,
  User,
} from "lucide-react";

export default function PaginaAvaliacaoAtendimento() {
  const params = useParams();
  const navigate = useNavigate();
  const agendamentoId = params.agendamento_id as string;

  const [carregando, setCarregando] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [agendamento, setAgendamento] = React.useState<any | null>(null);
  const [avaliacaoExistente, setAvaliacaoExistente] = React.useState<Avaliacao | null>(null);

  const [nota, setNota] = React.useState<number>(5);
  const [notaHover, setNotaHover] = React.useState<number | null>(null);
  const [comentario, setComentario] = React.useState<string>("");

  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (agendamentoId) carregarDados();
  }, [agendamentoId]);

  async function carregarDados() {
    try {
      setCarregando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate(`/entrar?retorno=/avaliacoes/${agendamentoId}`);
        return;
      }

      // 1. Buscar agendamento
      const { data: agDb, error: erroAg } = await (supabase.from("agendamentos") as any)
        .select(`
          id,
          barbearia_id,
          cliente_id,
          cliente_nome,
          profissional_id,
          status,
          inicio_previsto,
          barbearias (
            nome,
            slug
          ),
          profissionais (
            nome
          ),
          agendamentos_servicos (
            nome_servico
          )
        `)
        .eq("id", agendamentoId)
        .eq("cliente_id", session.user.id)
        .single();

      if (erroAg || !agDb) {
        setErro("Agendamento não encontrado ou sem permissão de acesso.");
        return;
      }

      setAgendamento(agDb);

      // 2. Verificar se já existe avaliação
      const { data: avDb } = await (supabase.from("avaliacoes") as any)
        .select("*")
        .eq("agendamento_id", agendamentoId)
        .maybeSingle();

      if (avDb) {
        setAvaliacaoExistente(avDb as Avaliacao);
      }
    } catch {
      setErro("Falha ao consultar dados do atendimento.");
    } finally {
      setCarregando(false);
    }
  }

  async function enviarAvaliacao(e: React.FormEvent) {
    e.preventDefault();
    if (!agendamento) return;

    const validacao = esquemaCriarAvaliacao.safeParse({
      agendamento_id: agendamentoId,
      nota,
      comentario: comentario.trim() || null,
    });

    if (!validacao.success) {
      setErro(validacao.error.errors[0]?.message || "Dados inválidos");
      return;
    }

    try {
      setSalvando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data: novaAv, error } = await (supabase.from("avaliacoes") as any)
        .insert({
          barbearia_id: agendamento.barbearia_id,
          agendamento_id: agendamento.id,
          cliente_id: session.user.id,
          cliente_nome: agendamento.cliente_nome,
          profissional_id: agendamento.profissional_id,
          nota,
          comentario: comentario.trim() || null,
        })
        .select()
        .single();

      if (error) {
        setErro("Não foi possível enviar sua avaliação no momento.");
        return;
      }

      setSucesso("Obrigado pela sua avaliação! Seu feedback ajuda toda a comunidade Barzzo.");
      setAvaliacaoExistente(novaAv as Avaliacao);
    } catch {
      setErro("Erro de conexão ao enviar avaliação.");
    } finally {
      setSalvando(false);
    }
  }

  const legendasNotas: Record<number, string> = {
    1: "Péssimo",
    2: "Ruim",
    3: "Regular",
    4: "Muito Bom",
    5: "Excelente!",
  };

  if (carregando) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-xl flex flex-col items-center justify-center gap-4">
        <LoadingSpinner tamanho="lg" />
        <p className="text-neutral-500 text-sm">Carregando dados da avaliação...</p>
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
        <Link to="/agendamentos">
          <Button variante="secundario" className="min-h-[44px]">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Voltar aos Agendamentos
          </Button>
        </Link>
      </div>
    );
  }

  if (!agendamento) return null;

  const checagemElegibilidade = validarElegibilidadeAvaliacao(agendamento.status);

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl">
      {/* Voltar */}
      <div className="mb-6">
        <Link
          to={`/agendamentos/${agendamento.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-copper-600 transition-colors font-medium min-h-[44px]"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar para o agendamento
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

      {/* Cartão de Resumo do Atendimento */}
      <Card className="p-5 mb-6 border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-copper-50 dark:bg-copper-950/40 text-copper-600 dark:text-copper-400 flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base">{agendamento.barbearias?.nome}</h2>
            <p className="text-xs text-neutral-500 flex items-center gap-2 mt-0.5">
              <span>{agendamento.agendamentos_servicos?.[0]?.nome_servico || "Serviço"}</span>
              <span>•</span>
              <span>Barbeiro: {agendamento.profissionais?.nome || "Equipe"}</span>
            </p>
          </div>
        </div>
      </Card>

      {/* Caso 1: Atendimento não elegível para avaliação */}
      {!checagemElegibilidade.elegivel ? (
        <Card className="text-center p-8 border-neutral-200 dark:border-neutral-800">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold mb-1">Avaliação Indisponível</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
            {checagemElegibilidade.motivo}
          </p>
          <Link to="/agendamentos">
            <Button variante="secundario" className="min-h-[44px]">
              Ver Meus Agendamentos
            </Button>
          </Link>
        </Card>
      ) : avaliacaoExistente ? (
        /* Caso 2: Avaliação já registrada */
        <Card className="p-6 border-neutral-200 dark:border-neutral-800 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
            <div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider block">
                Avaliação Registrada
              </span>
              <h3 className="text-xl font-bold mt-0.5">Sua opinião sobre o atendimento</h3>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((estrela) => (
                <Star
                  key={estrela}
                  className={`w-5 h-5 ${
                    estrela <= avaliacaoExistente.nota
                      ? "text-amber-400 fill-amber-400"
                      : "text-neutral-300 dark:text-neutral-700"
                  }`}
                />
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs text-neutral-400 font-medium block mb-1">Seu Comentário</span>
            <p className="text-sm text-neutral-800 dark:text-neutral-200 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              {avaliacaoExistente.comentario || "Nenhum comentário por escrito registrado."}
            </p>
          </div>

          {/* Resposta da Barbearia se houver */}
          {avaliacaoExistente.resposta_barbearia && (
            <div className="p-4 rounded-xl bg-copper-500/10 border border-copper-500/20 space-y-1">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-copper-600 dark:text-copper-400" />
                <span className="text-xs font-bold text-copper-700 dark:text-copper-300">
                  Resposta da Barbearia:
                </span>
              </div>
              <p className="text-sm text-neutral-800 dark:text-neutral-200 pl-6">
                {avaliacaoExistente.resposta_barbearia}
              </p>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <Link to="/agendamentos">
              <Button variante="secundario" className="min-h-[44px]">
                Voltar aos Agendamentos
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        /* Caso 3: Formulário para criar avaliação */
        <Card className="p-6 border-neutral-200 dark:border-neutral-800">
          <form onSubmit={enviarAvaliacao} className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold">Como foi seu corte / atendimento?</h3>
              <p className="text-xs text-neutral-500 mt-1">
                Selecione uma nota de 1 a 5 estrelas
              </p>

              {/* Seletor de Estrelas */}
              <div
                className="flex items-center justify-center gap-2 my-5"
                onMouseLeave={() => setNotaHover(null)}
              >
                {[1, 2, 3, 4, 5].map((estrela) => {
                  const ativa = (notaHover !== null ? notaHover : nota) >= estrela;
                  return (
                    <button
                      type="button"
                      key={estrela}
                      onClick={() => setNota(estrela)}
                      onMouseEnter={() => setNotaHover(estrela)}
                      className="p-1 text-neutral-300 dark:text-neutral-700 hover:scale-110 transition-transform focus:outline-none min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label={`${estrela} estrelas`}
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          ativa
                            ? "text-amber-400 fill-amber-400"
                            : "hover:text-amber-300"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                {legendasNotas[notaHover || nota]}
              </span>
            </div>

            <div>
              <label className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 block mb-1.5">
                Deixe seu comentário (opcional):
              </label>
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Conte o que achou da pontualidade, atendimento, técnica e do ambiente..."
                rows={4}
                className="w-full text-sm p-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-copper-500"
              />
              <span className="text-xs text-neutral-400 block text-right mt-1">
                {comentario.length}/1000
              </span>
            </div>

            <Button
              type="submit"
              variante="principal"
              disabled={salvando}
              carregando={salvando}
              className="w-full min-h-[44px] font-semibold"
            >
              Publicar Avaliação
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
