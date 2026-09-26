
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
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
  SeletorData,
} from "@barzzo/ui";
import { formatarTelefone } from "@barzzo/utilitarios";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { esquemaCriarAgendamentoManual } from "@barzzo/validacoes";
import {
  calcularHorariosDisponiveis,
  selecionarProfissionalMenorCarga,
} from "@barzzo/dominio";
import type {
  Servico,
  Profissional,
  HorarioBarbearia,
  JornadaProfissional,
  BloqueioAgenda,
  SlotDisponivel,
  Barbearia,
  DiaSemana,
} from "@barzzo/tipos";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Scissors,
  CheckCircle,
  Save,
  Sparkles,
} from "lucide-react";

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
  const [horariosBarbearia, setHorariosBarbearia] = React.useState<Record<number, HorarioBarbearia>>({});
  const [jornadasProfissionais, setJornadasProfissionais] = React.useState<JornadaProfissional[]>([]);
  const [vinculosServicos, setVinculosServicos] = React.useState<{ profissional_id: string; servico_id: string }[]>([]);

  // Seleções
  const [servicoId, setServicoId] = React.useState<string>("");
  const [modoProfissional, setModoProfissional] = React.useState<"qualquer" | "especifico">("qualquer");
  const [profissionalId, setProfissionalId] = React.useState<string>("");
  const [dataAgendamento, setDataAgendamento] = React.useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [slotSelecionado, setSlotSelecionado] = React.useState<string | null>(null);

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
        setServicoId(listaServicos[0].id);
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
        setProfissionalId(listaProfs[0].id);
      }

      // Horários barbearia
      const { data: hbDb } = await supabase.from("horarios_barbearia").select("*").eq("barbearia_id", bId);
      const mapaHb: Record<number, HorarioBarbearia> = {};
      (hbDb || []).forEach((h: HorarioBarbearia) => {
        mapaHb[h.dia_semana] = h;
      });
      setHorariosBarbearia(mapaHb);

      // Jornadas profissionais
      const { data: jpDb } = await supabase.from("jornadas_profissionais").select("*");
      setJornadasProfissionais((jpDb || []) as JornadaProfissional[]);

      // Vínculos de serviços
      const { data: psDb } = await supabase.from("profissionais_servicos").select("profissional_id, servico_id").eq("ativo", true);
      setVinculosServicos((psDb || []) as { profissional_id: string; servico_id: string }[]);
    } catch {
      setErro("Erro ao inicializar formulário de novo agendamento.");
    } finally {
      setCarregando(false);
    }
  }

  // Recalcular slots disponíveis quando mudar o serviço, a data ou o profissional
  React.useEffect(() => {
    if (!servicoId || !dataAgendamento || !barbearia) return;
    recalcularSlots();
  }, [servicoId, dataAgendamento, modoProfissional, profissionalId, barbearia]);

  async function recalcularSlots() {
    try {
      setCalculandoSlots(true);
      setSlotSelecionado(null);
      const supabase = criarClienteSupabaseBrowser();

      const servico = servicos.find((s) => s.id === servicoId);
      if (!servico) return;

      const dataObj = new Date(dataAgendamento + "T12:00:00");
      const diaSemana = dataObj.getDay() as DiaSemana;
      const horarioBarb = horariosBarbearia[diaSemana] || null;

      // Buscar bloqueios e agendamentos existentes na data
      const dataInicio = `${dataAgendamento}T00:00:00.000Z`;
      const dataFim = `${dataAgendamento}T23:59:59.999Z`;

      const { data: bloqDb } = await supabase
        .from("bloqueios_agenda")
        .select("*")
        .eq("barbearia_id", barbearia!.id)
        .lte("inicio", dataFim)
        .gte("fim", dataInicio);

      const { data: agsDb } = await supabase
        .from("agendamentos")
        .select("profissional_id, inicio_previsto, fim_previsto")
        .eq("barbearia_id", barbearia!.id)
        .not("status", "in", '("cancelado","nao_compareceu")')
        .gte("inicio_previsto", dataInicio)
        .lte("inicio_previsto", dataFim);

      const agendamentosExistentes = (agsDb || []).map((ag: any) => ({
        profissional_id: ag.profissional_id,
        inicio: ag.inicio_previsto,
        fim: ag.fim_previsto,
      }));

      // Montar profissionais aptos
      const profsAptos = profissionais.map((p) => {
        const habilitado = vinculosServicos.some(
          (v) => v.profissional_id === p.id && v.servico_id === servicoId
        );
        const jornada = jornadasProfissionais.find(
          (j) => j.profissional_id === p.id && j.dia_semana === diaSemana
        );
        return {
          id: p.id,
          nome: p.nome,
          ativo: p.ativo,
          habilitado,
          jornada: jornada || null,
        };
      });

      const filtroId = modoProfissional === "especifico" ? profissionalId : null;

      const slots = calcularHorariosDisponiveis({
        servico,
        horarioBarbearia: horarioBarb,
        profissionais: profsAptos,
        bloqueios: (bloqDb || []) as BloqueioAgenda[],
        agendamentosExistentes,
        data: dataAgendamento,
        profissionalIdFiltro: filtroId,
      });

      setSlotsDisponiveis(slots);
      if (slots.length > 0) {
        setSlotSelecionado(slots[0].horario);
      }
    } catch {
      setErro("Falha ao calcular slots disponíveis.");
    } finally {
      setCalculandoSlots(false);
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

    if (!slotSelecionado) {
      setErro("Selecione um horário disponível para o agendamento.");
      return;
    }

    const servico = servicos.find((s) => s.id === servicoId);
    if (!servico) {
      setErro("Selecione um serviço válido.");
      return;
    }

    // Definir profissional definitivo
    let profDefinitivoId = profissionalId;

    if (modoProfissional === "qualquer") {
      // Filtrar quais profissionais estão livres neste slot específico
      const profsDisponiveisNoSlot = slotsDisponiveis
        .filter((s) => s.horario === slotSelecionado)
        .map((s) => s.profissional_id);

      // Calcular carga de cada um deles hoje
      const supabase = criarClienteSupabaseBrowser();
      const dataInicio = `${dataAgendamento}T00:00:00.000Z`;
      const dataFim = `${dataAgendamento}T23:59:59.999Z`;

      const { data: agsDia } = await supabase
        .from("agendamentos")
        .select("profissional_id")
        .eq("barbearia_id", barbearia.id)
        .not("status", "in", '("cancelado","nao_compareceu")')
        .gte("inicio_previsto", dataInicio)
        .lte("inicio_previsto", dataFim);

      const contagemCarga: Record<string, number> = {};
      (agsDia || []).forEach((ag: { profissional_id: string }) => {
        contagemCarga[ag.profissional_id] = (contagemCarga[ag.profissional_id] || 0) + 1;
      });

      const candidatos = profissionais
        .filter((p) => profsDisponiveisNoSlot.includes(p.id))
        .map((p) => ({
          id: p.id,
          nome: p.nome,
          ativo: p.ativo,
          totalAgendamentosNoDia: contagemCarga[p.id] || 0,
        }));

      const escolhido = selecionarProfissionalMenorCarga(candidatos);
      if (!escolhido) {
        setErro("Nenhum profissional disponível para o horário selecionado.");
        return;
      }
      profDefinitivoId = escolhido.id;
    }

    // Montar datas ISO
    const inicioPrevisto = new Date(`${dataAgendamento}T${slotSelecionado}:00.000Z`).toISOString();
    const fimEmMinutos =
      parseInt(slotSelecionado.split(":")[0], 10) * 60 +
      parseInt(slotSelecionado.split(":")[1], 10) +
      servico.duracao_minutos;

    const horasFim = Math.floor(fimEmMinutos / 60);
    const minFim = fimEmMinutos % 60;
    const horaFimStr = `${String(horasFim).padStart(2, "0")}:${String(minFim).padStart(2, "0")}`;
    const fimPrevisto = new Date(`${dataAgendamento}T${horaFimStr}:00.000Z`).toISOString();

    const dadosValidacao = {
      barbearia_id: barbearia.id,
      profissional_id: profDefinitivoId,
      cliente_nome: clienteNome,
      cliente_telefone: clienteTelefone ? clienteTelefone : null,
      cliente_email: clienteEmail ? clienteEmail : null,
      cliente_id: null,
      inicio_previsto: inicioPrevisto,
      fim_previsto: fimPrevisto,
      observacoes: observacoes ? observacoes : null,
      servicos: [
        {
          servico_id: servico.id,
          nome_servico: servico.nome,
          preco: Number(servico.preco),
          duracao_minutos: servico.duracao_minutos,
        },
      ],
    };

    const resultadoZod = esquemaCriarAgendamentoManual.safeParse(dadosValidacao);
    if (!resultadoZod.success) {
      setErro(resultadoZod.error.errors[0]?.message || "Verifique os dados preenchidos.");
      return;
    }

    try {
      setSalvando(true);
      const supabase = criarClienteSupabaseBrowser();

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
          preco_total: servico.preco,
          duracao_total_minutos: servico.duracao_minutos,
        })
        .select("id")
        .single();

      if (erroAg || !novoAgendamento) {
        if (erroAg?.message?.includes("uq_agendamento_sem_sobreposicao")) {
          setErro("Conflito de concorrência: Este horário acabou de ser preenchido por outro agendamento. Escolha outro slot.");
          recalcularSlots();
        } else {
          setErro("Erro ao registrar o agendamento no banco de dados.");
        }
        return;
      }

      // 2. Inserir snapshot do serviço
      await supabase.from("agendamentos_servicos").insert({
        agendamento_id: novoAgendamento.id,
        servico_id: servico.id,
        nome_servico: servico.nome,
        preco: servico.preco,
        duracao_minutos: servico.duracao_minutos,
      });

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

  if (carregando) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando dados para agendamento...</p>
      </div>
    );
  }

  const servicoAtual = servicos.find((s) => s.id === servicoId);

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
            <div className="h-10 w-10 rounded-xl bg-[#B45A2B]/10 flex items-center justify-center text-[#B45A2B]">
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
                  <Input
                    id="clienteTelefone"
                    placeholder="(11) 98765-4321"
                    value={clienteTelefone}
                    onChange={(e) => setClienteTelefone(formatarTelefone(e.target.value))}
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

            {/* 2. Seleção de Serviço */}
            <div className="flex flex-col gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#B45A2B]">
                2. Serviço Desejado
              </h3>

              {servicos.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed text-center text-sm opacity-70">
                  Nenhum serviço ativo. Cadastre serviços no catálogo primeiro.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {servicos.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setServicoId(s.id)}
                      className={`p-3 rounded-xl border cursor-pointer select-none transition-all flex flex-col justify-between gap-2 ${
                        servicoId === s.id
                          ? "border-[#B45A2B] bg-[#B45A2B]/5 shadow-sm ring-1 ring-[#B45A2B]"
                          : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 opacity-70"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-bold text-sm">{s.nome}</span>
                        {servicoId === s.id && (
                          <CheckCircle className="h-4 w-4 text-[#B45A2B]" />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs opacity-80 pt-1 border-t border-neutral-200/60 dark:border-neutral-800/60">
                        <span className="font-bold text-[#B45A2B]">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(s.preco))}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {s.duracao_minutos} min
                        </span>
                      </div>
                    </div>
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
                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 cursor-pointer text-sm">
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

                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 cursor-pointer text-sm">
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
                    <select
                      value={profissionalId}
                      onChange={(e) => setProfissionalId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
                    >
                      {profissionais.map((p) => (
                        <option key={p.id} value={p.id} className="dark:bg-[#121214]">
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <SeletorData
                    id="data"
                    rotulo="Data do Atendimento *"
                    valor={dataAgendamento}
                    aoMudar={(novaData) => setDataAgendamento(novaData)}
                    min={new Date().toISOString().split("T")[0]}
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

              {calculandoSlots ? (
                <div className="py-6 text-center text-xs opacity-70">
                  Calculando horários com garantia de não-sobreposição...
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
                      <button
                        key={h}
                        type="button"
                        onClick={() => setSlotSelecionado(h)}
                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                          selecionado
                            ? "bg-[#B45A2B] text-white border-[#B45A2B] shadow-sm"
                            : "border-neutral-200 dark:border-neutral-800 hover:border-[#B45A2B]/60"
                        }`}
                      >
                        {h}
                      </button>
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
              {servicoAtual && slotSelecionado ? (
                <div className="text-xs">
                  <span className="opacity-70">Resumo: </span>
                  <strong>{servicoAtual.nome}</strong> às <strong>{slotSelecionado}</strong> (
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(servicoAtual.preco))})
                </div>
              ) : (
                <div className="text-xs opacity-50">Selecione o serviço e o horário acima.</div>
              )}

              <div className="flex items-center gap-2">
                <Link to="/agenda">
                  <Button variante="fantasma" type="button">
                    Cancelar
                  </Button>
                </Link>
                <Button
                  variante="principal"
                  type="submit"
                  disabled={salvando || !slotSelecionado}
                >
                  <Save className="h-4 w-4 mr-1.5" />
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
