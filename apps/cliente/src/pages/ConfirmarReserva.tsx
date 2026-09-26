
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
  obterRascunhoReserva,
  limparRascunhoReserva,
  calcularHorariosDisponiveis,
  selecionarProfissionalMenorCarga,
} from "@barzzo/dominio";
import type {
  RascunhoReserva,
  SlotDisponivel,
  Profissional,
  HorarioBarbearia,
  JornadaProfissional,
  BloqueioAgenda,
  DiaSemana,
} from "@barzzo/tipos";
import {
  CheckCircle,
  Calendar,
  Clock,
  Scissors,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  User,
} from "lucide-react";

export default function PaginaConfirmacaoReservaPosLogin() {
  const params = useParams();
  const navigate = useNavigate();
  const slug = params.slug as string;

  const [carregando, setCarregando] = React.useState(true);
  const [confirmando, setConfirmando] = React.useState(false);
  const [concluido, setConcluido] = React.useState(false);
  const [agendamentoIdCriado, setAgendamentoIdCriado] = React.useState<string | null>(null);

  const [rascunho, setRascunho] = React.useState<RascunhoReserva | null>(null);
  const [horarioConflitante, setHorarioConflitante] = React.useState(false);
  const [horariosAlternativos, setHorariosAlternativos] = React.useState<SlotDisponivel[]>([]);
  const [novoSlotEscolhido, setNovoSlotEscolhido] = React.useState<string | null>(null);

  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    processarConfirmacao();
  }, []);

  async function processarConfirmacao() {
    try {
      setCarregando(true);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        // Redireciona para entrar se por algum motivo a sessão não existir
        navigate(`/entrar?retorno=${encodeURIComponent(`/reservar/${slug}/confirmar`)}`);
        return;
      }

      const draft = obterRascunhoReserva();
      if (!draft || draft.barbearia_slug !== slug) {
        setErro("Rascunho de reserva não encontrado ou expirado.");
        setCarregando(false);
        return;
      }

      setRascunho(draft);

      // Revalidar disponibilidade do slot em tempo real
      const livre = await verificarSeHorarioEstaLivre(draft);

      if (!livre) {
        setHorarioConflitante(true);
        await carregarHorariosAlternativos(draft);
      } else {
        // Horário livre! Confirmar reserva imediatamente
        await efetivarReserva(draft, session.user.id);
      }
    } catch {
      setErro("Falha ao processar a confirmação da sua reserva.");
    } finally {
      setCarregando(false);
    }
  }

  async function verificarSeHorarioEstaLivre(draft: RascunhoReserva): Promise<boolean> {
    try {
      const supabase = criarClienteSupabaseBrowser();
      const dataInicioIso = new Date(`${draft.data}T${draft.horario}:00.000Z`).toISOString();
      const [h, m] = draft.horario.split(":").map(Number);
      const minFim = h * 60 + m + draft.duracao_minutos;
      const horaFimStr = `${String(Math.floor(minFim / 60)).padStart(2, "0")}:${String(minFim % 60).padStart(2, "0")}`;
      const dataFimIso = new Date(`${draft.data}T${horaFimStr}:00.000Z`).toISOString();

      // Checar se há agendamento sobreposto
      let query = supabase
        .from("agendamentos")
        .select("id")
        .eq("barbearia_id", draft.barbearia_id)
        .not("status", "in", '("cancelado","nao_compareceu")')
        .lt("inicio_previsto", dataFimIso)
        .gt("fim_previsto", dataInicioIso);

      if (draft.profissional_id) {
        query = query.eq("profissional_id", draft.profissional_id);
      }

      const { data } = await query;
      return !data || data.length === 0;
    } catch {
      return false;
    }
  }

  async function carregarHorariosAlternativos(draft: RascunhoReserva) {
    try {
      const supabase = criarClienteSupabaseBrowser();
      const dataObj = new Date(draft.data + "T12:00:00");
      const diaSemana = dataObj.getDay() as DiaSemana;

      const { data: hbDb } = await supabase
        .from("horarios_barbearia")
        .select("*")
        .eq("barbearia_id", draft.barbearia_id)
        .eq("dia_semana", diaSemana)
        .single();

      const { data: profsDb } = await supabase
        .from("profissionais")
        .select("*")
        .eq("barbearia_id", draft.barbearia_id)
        .eq("ativo", true);

      const { data: sDb } = await supabase
        .from("servicos")
        .select("*")
        .eq("id", draft.servico_id)
        .single();

      const { data: jpDb } = await supabase
        .from("jornadas_profissionais")
        .select("*")
        .eq("dia_semana", diaSemana);

      const { data: psDb } = await supabase
        .from("profissionais_servicos")
        .select("profissional_id, servico_id")
        .eq("servico_id", draft.servico_id)
        .eq("ativo", true);

      if (!sDb || !hbDb || !profsDb) return;

      const profsAptos = (profsDb as Profissional[]).map((p) => {
        const habilitado = (psDb || []).some((v: any) => v.profissional_id === p.id);
        const jornada = (jpDb || []).find((j: any) => j.profissional_id === p.id);
        return {
          id: p.id,
          nome: p.nome,
          ativo: p.ativo,
          habilitado,
          jornada: jornada || null,
        };
      });

      const slots = calcularHorariosDisponiveis({
        servico: sDb,
        horarioBarbearia: hbDb,
        profissionais: profsAptos,
        data: draft.data,
        profissionalIdFiltro: draft.profissional_id,
      });

      setHorariosAlternativos(slots);
      if (slots.length > 0) {
        setNovoSlotEscolhido(slots[0].horario);
      }
    } catch {
      // Silencioso
    }
  }

  async function efetivarReserva(draft: RascunhoReserva, authUserId: string) {
    try {
      setConfirmando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();

      const { data: usuarioDb } = await (supabase.from("usuarios") as any)
        .select("nome, telefone")
        .eq("id", authUserId)
        .single();

      const inicioIso = new Date(`${draft.data}T${draft.horario}:00.000Z`).toISOString();
      const [h, m] = draft.horario.split(":").map(Number);
      const minFim = h * 60 + m + draft.duracao_minutos;
      const horaFimStr = `${String(Math.floor(minFim / 60)).padStart(2, "0")}:${String(minFim % 60).padStart(2, "0")}`;
      const fimIso = new Date(`${draft.data}T${horaFimStr}:00.000Z`).toISOString();

      let profId = draft.profissional_id;
      if (!profId) {
        // Se for qualquer profissional, busca o primeiro profissional ativo da barbearia
        const { data: pDb } = await (supabase.from("profissionais") as any)
          .select("id")
          .eq("barbearia_id", draft.barbearia_id)
          .eq("ativo", true)
          .limit(1)
          .single();
        profId = pDb?.id;
      }

      if (!profId) {
        setErro("Nenhum profissional disponível para o atendimento.");
        return;
      }

      const precoFinal = draft.preco_final ?? draft.preco;

      // Inserir agendamento definitivo
      const { data: novoAgendamento, error: erroAg } = await (supabase.from("agendamentos") as any)
        .insert({
          barbearia_id: draft.barbearia_id,
          cliente_id: authUserId,
          cliente_nome: usuarioDb?.nome || "Cliente Barzzo",
          cliente_telefone: usuarioDb?.telefone || null,
          profissional_id: profId,
          inicio_previsto: inicioIso,
          fim_previsto: fimIso,
          status: "confirmado",
          origem: "marketplace",
          observacoes: draft.observacoes,
          preco_total: precoFinal,
          duracao_total_minutos: draft.duracao_minutos,
        })
        .select("id")
        .single();

      if (erroAg || !novoAgendamento) {
        if (erroAg?.message?.includes("uq_agendamento_sem_sobreposicao")) {
          setHorarioConflitante(true);
          await carregarHorariosAlternativos(draft);
        } else {
          setErro("Falha ao salvar agendamento.");
        }
        return;
      }

      // Inserir snapshot do serviço
      await (supabase.from("agendamentos_servicos") as any).insert({
        agendamento_id: novoAgendamento.id,
        servico_id: draft.servico_id,
        nome_servico: draft.servico_nome,
        preco: draft.preco,
        duracao_minutos: draft.duracao_minutos,
      });

      // Se houver cupom utilizado, incrementar uso
      const codigoCupomLimpo = draft.codigo_cupom?.trim().toUpperCase();
      let cupomId: string | null = null;

      if (codigoCupomLimpo) {
        const { data: cupDb } = await (supabase.from("cupons") as any)
          .select("id, usos_atuais")
          .eq("barbearia_id", draft.barbearia_id)
          .ilike("codigo", codigoCupomLimpo)
          .maybeSingle();

        if (cupDb) {
          cupomId = cupDb.id;
          await (supabase.from("cupons") as any)
            .update({ usos_atuais: cupDb.usos_atuais + 1 })
            .eq("id", cupDb.id);
        }

        // Se o código for de influenciador, registrar indicação
        const { data: infDb } = await (supabase.from("influenciadores") as any)
          .select("id")
          .eq("barbearia_id", draft.barbearia_id)
          .ilike("codigo_ref", codigoCupomLimpo)
          .eq("ativo", true)
          .maybeSingle();

        if (infDb) {
          await (supabase.from("indicacoes") as any).insert({
            barbearia_id: draft.barbearia_id,
            influenciador_id: infDb.id,
            cupom_id: cupomId,
            agendamento_id: novoAgendamento.id,
            cliente_id: authUserId,
            codigo_ref_usado: codigoCupomLimpo,
            status: "pendente",
          });
        }
      }

      // Limpar rascunho persistido e atribuição
      limparRascunhoReserva();
      if (typeof window !== "undefined") {
        localStorage.removeItem("@barzzo:atribuicao_influenciador");
      }
      setAgendamentoIdCriado(novoAgendamento.id);
      setConcluido(true);
    } catch {
      setErro("Erro inesperado ao registrar reserva.");
    } finally {
      setConfirmando(false);
    }
  }

  async function handleEscolherNovoSlot() {
    if (!rascunho || !novoSlotEscolhido) return;
    const rascunhoAtualizado = { ...rascunho, horario: novoSlotEscolhido };
    setRascunho(rascunhoAtualizado);
    setHorarioConflitante(false);

    const supabase = criarClienteSupabaseBrowser();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      await efetivarReserva(rascunhoAtualizado, session.user.id);
    }
  }

  if (carregando || confirmando) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm font-semibold">
          {confirmando ? "Confirmando seu agendamento..." : "Recuperando sua seleção..."}
        </p>
      </div>
    );
  }

  // TELA DE SUCESSO DEFINITIVO
  if (concluido) {
    return (
      <div className="max-w-xl mx-auto py-12 flex flex-col items-center text-center gap-6">
        <div className="h-16 w-16 rounded-full bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center border border-[#16A34A]/20">
          <CheckCircle className="h-8 w-8" />
        </div>

        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#16A34A]">
            Agendamento Confirmado!
          </h1>
          <p className="text-sm opacity-75 mt-2">
            Sua reserva foi gravada com sucesso na agenda da barbearia.
          </p>
        </div>

        {rascunho && (
          <Card camada="primaria" className="w-full text-left p-4">
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="opacity-60">Barbearia:</span>
                <span className="font-bold">{rascunho.barbearia_nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">Serviço:</span>
                <span className="font-bold">{rascunho.servico_nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">Horário:</span>
                <span className="font-bold text-[#B45A2B]">
                  {rascunho.data} às {rascunho.horario}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <span className="opacity-60">Valor:</span>
                <span className="font-bold">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(rascunho.preco)}
                </span>
              </div>
            </div>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          <Link to="/agendamentos" className="w-full">
            <Button variante="principal" tamanho="lg" className="w-full">
              Ver Meus Agendamentos <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // TELA DE CONFLITO DE CONCORRÊNCIA DURANTE O LOGIN
  if (horarioConflitante) {
    return (
      <div className="max-w-xl mx-auto py-10 flex flex-col gap-6">
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="block text-sm font-bold text-amber-500 mb-1">
              Horário acabou de ser ocupado!
            </strong>
            Enquanto você se autenticava, outro cliente acabou de reservar o horário das {rascunho?.horario}.
            Não se preocupe: seu serviço continua salvo! Escolha outro dos horários livres abaixo para confirmar:
          </div>
        </div>

        <Card camada="primaria">
          <CardHeader>
            <CardTitle className="text-base font-bold">
              Horários Livres para {rascunho?.data}:
            </CardTitle>
            <CardDescription>
              Selecione um horário alternativo para finalizar:
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {horariosAlternativos.length === 0 ? (
              <p className="text-sm opacity-60">
                Não há outros horários livres nesta data.{" "}
                <Link to={`/reservar/${slug}`} className="text-[#B45A2B] font-semibold underline">
                  Escolha outra data.
                </Link>
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {Array.from(new Set(horariosAlternativos.map((s) => s.horario))).map((h) => {
                  const sel = novoSlotEscolhido === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setNovoSlotEscolhido(h)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                        sel
                          ? "bg-[#B45A2B] text-white border-[#B45A2B] ring-2 ring-[#B45A2B]"
                          : "border-neutral-200 dark:border-neutral-800 hover:border-[#B45A2B]"
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <Link to={`/reservar/${slug}`}>
                <Button variante="fantasma" tamanho="sm">
                  Trocar Data
                </Button>
              </Link>
              <Button
                variante="principal"
                disabled={!novoSlotEscolhido}
                onClick={handleEscolherNovoSlot}
              >
                Confirmar com {novoSlotEscolhido}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-12 text-center flex flex-col items-center gap-4">
      {erro && (
        <Alert variante="erro">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center gap-3">
        <Link to={`/reservar/${slug}`}>
          <Button variante="principal">Voltar para o agendamento</Button>
        </Link>
        <Link to="/barbearias">
          <Button variante="secundario">Explorar outras barbearias</Button>
        </Link>
      </div>
    </div>
  );
}
