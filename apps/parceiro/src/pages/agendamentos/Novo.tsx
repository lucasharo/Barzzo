
import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  InputMascarado,
  Label,
  Alert,
  AlertDescription,
  LoadingSpinner,
  SeletorData,
  Seletor,
} from "@barzzo/ui";
import { dataLocalIso, formatarTelefone, limparTelefone } from "@barzzo/utilitarios";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { obterMembroAtual } from "../../lib/unidade-atual";
import { esquemaCriarAgendamentoManual } from "@barzzo/validacoes";
import type {
  Servico,
  Profissional,
  SlotDisponivel,
  Barbearia,
} from "@barzzo/tipos";
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle,
  Save,
  Sparkles,
} from "lucide-react";

interface ParametrosDisponibilidadeManual {
  p_barbearia_id: string;
  p_servicos_ids: string[];
  p_data: string;
  p_profissional_id: string | null;
}

interface RespostaDisponibilidadeManual {
  data: SlotDisponivel[] | null;
  error: { message: string } | null;
}

function consultarDisponibilidadeManual(
  supabase: ReturnType<typeof criarClienteSupabaseBrowser>,
  parametros: ParametrosDisponibilidadeManual
): Promise<RespostaDisponibilidadeManual> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    nome: "buscar_horarios_disponiveis_multiplos_servicos",
    parametros: ParametrosDisponibilidadeManual
  ) => Promise<RespostaDisponibilidadeManual>;

  return rpc("buscar_horarios_disponiveis_multiplos_servicos", parametros);
}

export default function PaginaNovoAgendamentoManual() {
  const navigate = useNavigate();

  const [carregando, setCarregando] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [barbearia, setBarbearia] = React.useState<Barbearia | null>(null);

  // Dados do formulário
  const [clienteNome, setClienteNome] = React.useState("");
  const [clienteTelefone, setClienteTelefone] = React.useState("");
  const [clienteEmail, setClienteEmail] = React.useState("");
  const [observacoes, setObservacoes] = React.useState("");

  // Catálogo e equipe
  const [servicos, setServicos] = React.useState<Servico[]>([]);
  const [profissionais, setProfissionais] = React.useState<Profissional[]>([]);

  // Seleções
  const [servicosIds, setServicosIds] = React.useState<string[]>([]);
  const [modoProfissional, setModoProfissional] = React.useState<"qualquer" | "especifico">("qualquer");
  const [profissionalId, setProfissionalId] = React.useState<string>("");
  // A agenda em calendário abre este formulário já com data, hora e, se couber, profissional
  // (?data=AAAA-MM-DD&hora=HH:MM&profissional=ID).
  const [parametros] = useSearchParams();
  const horaPreSelecionada = parametros.get("hora");
  const [dataAgendamento, setDataAgendamento] = React.useState<string>(() => {
    const data = parametros.get("data");
    return data && /^\d{4}-\d{2}-\d{2}$/.test(data) && data >= dataLocalIso() ? data : dataLocalIso();
  });
  const [slotSelecionado, setSlotSelecionado] = React.useState<string | null>(null);
  const [horaIndisponivel, setHoraIndisponivel] = React.useState<string | null>(null);

  // Slots calculados
  const [slotsDisponiveis, setSlotsDisponiveis] = React.useState<SlotDisponivel[]>([]);
  const [calculandoSlots, setCalculandoSlots] = React.useState(false);

  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  React.useEffect(() => {
    carregarDadosIniciais();
  }, []);

  async function carregarDadosIniciais() {
    try {
      setCarregando(true);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data: membro } = await obterMembroAtual(supabase, session.user.id, "barbearia_id");

      if (!membro || !membro.barbearia_id) {
        setErro("Nenhuma barbearia vinculada.");
        return;
      }

      const bId = membro.barbearia_id;

      // Barbearia
      const { data: bDb } = await supabase.from("barbearias").select("*").eq("id", bId).single();
      if (bDb) setBarbearia(bDb as Barbearia);

      // Serviços ativos
      const { data: sDb } = await supabase
        .from("servicos")
        .select("*")
        .eq("barbearia_id", bId)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      const listaServicos = (sDb || []) as Servico[];
      setServicos(listaServicos);
      if (listaServicos.length > 0) {
        setServicosIds([listaServicos[0].id]);
      }

      // Profissionais ativos
      const { data: pDb } = await supabase
        .from("profissionais")
        .select("*")
        .eq("barbearia_id", bId)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      const listaProfs = (pDb || []) as Profissional[];
      setProfissionais(listaProfs);
      if (listaProfs.length > 0) {
        const preSelecionado = listaProfs.find((p) => p.id === parametros.get("profissional"));
        setProfissionalId((preSelecionado ?? listaProfs[0]).id);
        if (preSelecionado) setModoProfissional("especifico");
      }

    } catch {
      setErro("Erro ao inicializar formulário de novo agendamento.");
    } finally {
      setCarregando(false);
    }
  }

  // A RPC calcula a agenda com a duração e os vínculos atuais de todos os serviços.
  const calculoAtual = React.useRef(0);
  React.useEffect(() => {
    if (servicosIds.length === 0 || !dataAgendamento || !barbearia) {
      calculoAtual.current += 1;
      setSlotsDisponiveis([]);
      setSlotSelecionado(null);
      setHoraIndisponivel(null);
      setCalculandoSlots(false);
      return;
    }
    recalcularSlots();
  }, [
    servicosIds,
    dataAgendamento,
    modoProfissional,
    profissionalId,
    barbearia,
  ]);

  function converterParaIsoUtc(dataStr: string, horarioStr: string): string {
    const [ano, mes, dia] = dataStr.split("-").map(Number);
    const [h, m] = horarioStr.split(":").map(Number);
    const dataLocal = new Date(ano, mes - 1, dia, h, m, 0, 0);
    return dataLocal.toISOString();
  }

  async function recalcularSlots() {
    const execucao = ++calculoAtual.current;
    try {
      setCalculandoSlots(true);
      setSlotSelecionado(null);
      setHoraIndisponivel(null);
      setSlotsDisponiveis([]);
      const supabase = criarClienteSupabaseBrowser();
      const { data: slotsDb, error: erroSlots } = await consultarDisponibilidadeManual(supabase, {
        p_barbearia_id: barbearia!.id,
        p_servicos_ids: servicosIds,
        p_data: dataAgendamento,
        p_profissional_id: modoProfissional === "especifico" ? profissionalId : null,
      });

      if (execucao !== calculoAtual.current) return;
      if (erroSlots) throw erroSlots;

      const slots = (slotsDb || []) as SlotDisponivel[];

      setSlotsDisponiveis(slots);
      const veioDaAgenda = !!horaPreSelecionada && dataAgendamento === parametros.get("data");
      const preSelecionado = veioDaAgenda ? slots.find((slot) => slot.horario === horaPreSelecionada) : undefined;
      // Se o horário clicado na agenda não comporta todos os serviços, avisa em vez de trocar em silêncio.
      setHoraIndisponivel(veioDaAgenda && !preSelecionado ? horaPreSelecionada : null);
      if (slots.length > 0) {
        setSlotSelecionado((preSelecionado ?? slots[0]).horario);
      }
    } catch {
      setErro("Não foi possível calcular os horários para os serviços selecionados.");
    } finally {
      if (execucao === calculoAtual.current) setCalculandoSlots(false);
    }
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!barbearia) {
      setErro("Barbearia não identificada.");
      return;
    }

    const emTrial = barbearia.status_assinatura === "trial";
    const trialVencido = emTrial && barbearia.trial_fim && new Date(barbearia.trial_fim) < new Date();
    const assinaturaVencida = barbearia.status_assinatura === "vencida" || barbearia.status_assinatura === "inadimplente";

    if (trialVencido || assinaturaVencida) {
      setErro("Sua assinatura ou período de testes está expirado. Acesse a aba Planos & Assinatura para reativar e realizar agendamentos.");
      return;
    }

    if (!slotSelecionado) {
      setErro("Selecione um horário disponível para o agendamento.");
      return;
    }

    if (servicosIds.length === 0 || servicosIds.length > 4) {
      setErro("Selecione de um a quatro serviços.");
      return;
    }

    try {
      setSalvando(true);
      const supabase = criarClienteSupabaseBrowser();
      const { data: servicosDb, error: erroServicos } = await supabase
        .from("servicos")
        .select("id, nome, preco, duracao_minutos")
        .eq("barbearia_id", barbearia.id)
        .eq("ativo", true)
        .in("id", servicosIds);

      if (erroServicos || !servicosDb || servicosDb.length !== servicosIds.length) {
        setErro("Um dos serviços foi alterado ou desativado. Atualize a seleção e tente novamente.");
        return;
      }

      const snapshotsServicos = servicosIds.map((id) => {
        const servico = servicosDb.find((item) => item.id === id);
        return servico
          ? {
              servico_id: servico.id,
              nome_servico: servico.nome,
              preco: Number(servico.preco),
              duracao_minutos: Number(servico.duracao_minutos),
            }
          : null;
      });

      if (snapshotsServicos.some((servico) => !servico)) {
        setErro("Não foi possível carregar os serviços selecionados. Tente novamente.");
        return;
      }

      const snapshotsValidos = snapshotsServicos.filter((servico) => servico !== null);
      const { data: slotsRevalidados, error: erroRevalidacao } = await consultarDisponibilidadeManual(supabase, {
        p_barbearia_id: barbearia.id,
        p_servicos_ids: servicosIds,
        p_data: dataAgendamento,
        p_profissional_id: modoProfissional === "especifico" ? profissionalId : null,
      });

      if (erroRevalidacao) {
        setErro("Não foi possível revalidar a disponibilidade. Atualize os horários e tente novamente.");
        return;
      }

      const horarioValidado = ((slotsRevalidados || []) as SlotDisponivel[]).find(
        (slot) => slot.horario === slotSelecionado
      );
      if (!horarioValidado) {
        setErro("Este horário não comporta mais todos os serviços. Escolha outro horário.");
        recalcularSlots();
        return;
      }

      const profDefinitivoId = horarioValidado.profissional_id;
      const duracaoTotal = Number(horarioValidado.duracao_minutos);
      const duracaoSnapshots = snapshotsValidos.reduce((total, servico) => total + servico.duracao_minutos, 0);
      if (duracaoSnapshots !== duracaoTotal) {
        setErro("A duração de um serviço mudou. Atualize a seleção antes de confirmar.");
        recalcularSlots();
        return;
      }
      const precoTotal = snapshotsValidos.reduce((total, servico) => total + servico.preco, 0);

      const [h, m] = slotSelecionado.split(":").map(Number);
      const fimEmMinutos = h * 60 + m + duracaoTotal;
      const horasFim = Math.floor(fimEmMinutos / 60);
      const minFim = fimEmMinutos % 60;
      const horaFimStr = `${String(horasFim).padStart(2, "0")}:${String(minFim).padStart(2, "0")}`;

      const dadosValidacao = {
        barbearia_id: barbearia.id,
        profissional_id: profDefinitivoId,
        cliente_nome: clienteNome,
        cliente_telefone: clienteTelefone ? (limparTelefone(clienteTelefone) || null) : null,
        cliente_email: clienteEmail ? clienteEmail : null,
        cliente_id: null,
        inicio_previsto: converterParaIsoUtc(dataAgendamento, slotSelecionado),
        fim_previsto: converterParaIsoUtc(dataAgendamento, horaFimStr),
        observacoes: observacoes ? observacoes : null,
        servicos: snapshotsValidos,
      };

      const resultadoZod = esquemaCriarAgendamentoManual.safeParse(dadosValidacao);
      if (!resultadoZod.success) {
        setErro(resultadoZod.error.errors[0]?.message || "Verifique os dados preenchidos.");
        return;
      }

      // 1. Inserir agendamento
      const { data: novoAgendamento, error: erroAg } = await supabase
        .from("agendamentos")
        .insert({
          barbearia_id: barbearia.id,
          profissional_id: profDefinitivoId,
          cliente_nome: resultadoZod.data.cliente_nome,
          cliente_telefone: resultadoZod.data.cliente_telefone,
          cliente_email: resultadoZod.data.cliente_email,
          cliente_id: null,
          inicio_previsto: resultadoZod.data.inicio_previsto,
          fim_previsto: resultadoZod.data.fim_previsto,
          status: "confirmado",
          origem: "parceiro",
          observacoes: resultadoZod.data.observacoes,
          preco_total: precoTotal,
          duracao_total_minutos: duracaoTotal,
        })
        .select("id")
        .single();

      if (erroAg || !novoAgendamento) {
        if (erroAg?.message?.includes("uq_agendamento_cliente_sem_sobreposicao")) {
          setErro("O cliente já possui outro agendamento neste mesmo horário.");
          recalcularSlots();
        } else if (erroAg?.message?.includes("uq_agendamento_sem_sobreposicao")) {
          setErro("Conflito de concorrência: Este horário acabou de ser preenchido por outro agendamento. Escolha outro slot.");
          recalcularSlots();
        } else {
          setErro("Erro ao registrar o agendamento no banco de dados.");
        }
        return;
      }

      // 2. Gravar uma linha de snapshot para cada serviço contratado.
      const { error: erroSnapshots } = await supabase.from("agendamentos_servicos").insert(
        resultadoZod.data.servicos.map((servico) => ({
          agendamento_id: novoAgendamento.id,
          servico_id: servico.servico_id,
          nome_servico: servico.nome_servico,
          preco: servico.preco,
          duracao_minutos: servico.duracao_minutos,
        }))
      );

      if (erroSnapshots) {
        const { error: erroAoDesfazer } = await supabase
          .from("agendamentos")
          .delete()
          .eq("id", novoAgendamento.id);
        setErro(
          erroAoDesfazer
            ? "O agendamento foi criado, mas não foi possível associar todos os serviços. Entre em contato com o suporte."
            : "Não foi possível salvar os serviços do agendamento. O horário foi liberado. Tente novamente."
        );
        return;
      }

      setSucesso("Agendamento criado com sucesso!");
      setTimeout(() => {
        navigate("/agenda");
      }, 1200);
    } catch {
      setErro("Erro inesperado ao salvar o agendamento.");
    } finally {
      setSalvando(false);
    }
  }

  function alternarServico(servicoId: string) {
    setErro(null);
    setHoraIndisponivel(null);
    if (servicosIds.includes(servicoId)) {
      setServicosIds(servicosIds.filter((id) => id !== servicoId));
      return;
    }

    if (servicosIds.length >= 4) {
      setErro("Você pode selecionar até quatro serviços por agendamento.");
      return;
    }

    setServicosIds([...servicosIds, servicoId]);
  }

  if (carregando) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando dados para agendamento...</p>
      </div>
    );
  }

  const servicosSelecionados = servicosIds
    .map((id) => servicos.find((servico) => servico.id === id))
    .filter((servico): servico is Servico => Boolean(servico));
  const precoTotal = servicosSelecionados.reduce((total, servico) => total + Number(servico.preco), 0);
  const duracaoTotal = servicosSelecionados.reduce((total, servico) => total + servico.duracao_minutos, 0);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          to="/agenda"
          className="text-sm font-semibold opacity-70 hover:opacity-100 flex items-center gap-1.5 transition-opacity"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para a Agenda
        </Link>
      </div>

      <Card camada="primaria">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 flex items-center justify-center text-[#B45A2B]">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">Novo Agendamento Manual</CardTitle>
              <CardDescription>
                Agende um cliente atendido no balcão, WhatsApp ou telefone.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {erro && (
            <Alert variante="erro" className="mb-6">
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          {sucesso && (
            <Alert variante="sucesso" className="mb-6">
              <AlertDescription>{sucesso}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSalvar} className="flex flex-col gap-6">
            {/* 1. Dados do Cliente */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#B45A2B]">
                1. Informações do Cliente
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="clienteNome">Nome Completo *</Label>
                  <Input
                    id="clienteNome"
                    placeholder="Ex: Rodrigo Silva"
                    value={clienteNome}
                    onChange={(e) => setClienteNome(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="clienteTelefone">Telefone / WhatsApp</Label>
                  <InputMascarado
                    id="clienteTelefone"
                    type="tel"
                    placeholder="(11) 98765-4321"
                    value={clienteTelefone}
                    mascara={formatarTelefone}
                    onChangeValor={setClienteTelefone}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="clienteEmail">E-mail (Opcional)</Label>
                <Input
                  id="clienteEmail"
                  type="email"
                  placeholder="rodrigo@email.com"
                  value={clienteEmail}
                  onChange={(e) => setClienteEmail(e.target.value)}
                />
              </div>
            </div>

            {/* 2. Seleção de Serviços */}
            <div className="flex flex-col gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#B45A2B]">
                2. Serviços Desejados
              </h3>
              <p className="text-sm opacity-70" aria-live="polite">
                Selecione de um a quatro serviços. {servicosIds.length}/4 selecionados.
              </p>

              {servicos.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed text-center text-sm opacity-70">
                  Nenhum serviço ativo. Cadastre serviços no catálogo primeiro.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {servicos.map((s) => (
                    <Button
                      key={s.id}
                      type="button"
                      variante="fantasma"
                      aria-pressed={servicosIds.includes(s.id)}
                      onClick={() => alternarServico(s.id)}
                      leftIcon={
                        <CheckCircle
                          aria-hidden="true"
                          className={`h-5 w-5 ${servicosIds.includes(s.id) ? "text-[#B45A2B]" : "opacity-50"}`}
                        />
                      }
                      className={`h-auto min-h-[76px] w-full justify-start border px-4 py-3 text-left ${
                        servicosIds.includes(s.id)
                          ? "border-[#B45A2B] bg-[#B45A2B]/10 ring-1 ring-[#B45A2B]"
                          : "border-neutral-200 dark:border-neutral-800"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-sm">{s.nome}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-80">
                          <span className="font-bold text-[#B45A2B]">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(s.preco))}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock aria-hidden="true" className="h-3 w-3" /> {s.duracao_minutos} min
                          </span>
                        </span>
                      </span>
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Seleção de Profissional e Data */}
            <div className="flex flex-col gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#B45A2B]">
                3. Profissional e Data
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Barbeiro Atendente</Label>
                  <div className="flex flex-col gap-2">
                    <label className="flex min-h-[48px] items-center gap-2 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name="modoProf"
                        checked={modoProfissional === "qualquer"}
                        onChange={() => setModoProfissional("qualquer")}
                        className="text-[#B45A2B] focus:ring-[#B45A2B]"
                      />
                      <span className="font-medium flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-[#B45A2B]" />
                        Qualquer Profissional Disponível
                      </span>
                    </label>

                    <label className="flex min-h-[48px] items-center gap-2 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 cursor-pointer text-sm">
                      <input
                        type="radio"
                        name="modoProf"
                        checked={modoProfissional === "especifico"}
                        onChange={() => setModoProfissional("especifico")}
                        className="text-[#B45A2B] focus:ring-[#B45A2B]"
                      />
                      <span className="font-medium">Profissional Específico</span>
                    </label>
                  </div>

                  {modoProfissional === "especifico" && (
                    <Seletor
                      className="mt-1 w-full"
                      valor={profissionalId}
                      aoMudar={setProfissionalId}
                      placeholder="Selecione o profissional"
                      opcoes={profissionais.map((p) => ({
                        valor: p.id,
                        rotulo: p.nome,
                      }))}
                    />
                  )}
                </div>

                <div>
                  <SeletorData
                    id="data"
                    rotulo="Data do Atendimento *"
                    valor={dataAgendamento}
                    aoMudar={(novaData) => setDataAgendamento(novaData)}
                    min={dataLocalIso()}
                  />
                  <span className="text-xs opacity-60 mt-1 block">
                    O sistema verifica jornada, pausas e bloqueios para a data.
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Horários Disponíveis */}
            <div className="flex flex-col gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#B45A2B]">
                  4. Horários Livres Encontrados
                </h3>
                {calculandoSlots && <LoadingSpinner tamanho="sm" />}
              </div>

              {horaIndisponivel && !calculandoSlots && (
                <Alert variante="alerta">
                  <AlertDescription>
                    O horário das {horaIndisponivel} escolhido na agenda não comporta todos os serviços com o profissional
                    selecionado. Escolha outro horário abaixo.
                  </AlertDescription>
                </Alert>
              )}

              {calculandoSlots ? (
                <div className="py-6 text-center text-xs opacity-70">
                  Calculando horários com garantia de não-sobreposição...
                </div>
              ) : servicosIds.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed text-center text-sm opacity-70">
                  Selecione ao menos um serviço para consultar os horários.
                </div>
              ) : slotsDisponiveis.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed text-center text-sm opacity-70">
                  Nenhum horário livre encontrado para os critérios selecionados nesta data.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {/* Agrupar horários únicos */}
                  {Array.from(new Set(slotsDisponiveis.map((s) => s.horario))).map((h) => {
                    const selecionado = slotSelecionado === h;
                    return (
                      <Button
                        key={h}
                        type="button"
                        variante="fantasma"
                        leftIcon={
                          <Clock aria-hidden="true" className={`h-3.5 w-3.5 ${selecionado ? "text-white" : "text-[#B45A2B]"}`} />
                        }
                        onClick={() => setSlotSelecionado(h)}
                        className={`h-11 min-h-[44px] px-3 text-xs font-bold border transition-all ${
                          selecionado
                            ? "bg-[#B45A2B] text-white border-[#B45A2B] shadow-sm hover:bg-[#C46632]"
                            : "border-neutral-200 dark:border-neutral-800 hover:border-[#B45A2B]/60"
                        }`}
                      >
                        {h}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 5. Observações */}
            <div className="flex flex-col gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <Label htmlFor="obs">Observações Adicionais (Opcional)</Label>
              <textarea
                id="obs"
                rows={2}
                placeholder="Ex: Cliente tem preferência por máquina zero na lateral."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm placeholder:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
              />
            </div>

            {/* Resumo e Ação */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              {servicosSelecionados.length > 0 && slotSelecionado ? (
                <div className="text-xs">
                  <span className="opacity-70">Resumo: </span>
                  <strong>{servicosSelecionados.map((servico) => servico.nome).join(" + ")}</strong> às <strong>{slotSelecionado}</strong>
                  <span className="block mt-1">
                    {duracaoTotal} min · {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(precoTotal)}
                  </span>
                </div>
              ) : (
                <div className="text-xs opacity-50">Selecione os serviços e o horário acima.</div>
              )}

              <div className="flex items-center gap-2">
                <Link to="/agenda">
                  <Button variante="fantasma" type="button" leftIcon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />}>
                    Cancelar
                  </Button>
                </Link>
                <Button
                  variante="principal"
                  type="submit"
                  disabled={salvando || !slotSelecionado}
                  leftIcon={<Save aria-hidden="true" className="h-4 w-4" />}
                >
                  {salvando ? "Confirmando..." : "Confirmar Agendamento"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
