
import * as React from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import {
  calcularHorariosDisponiveis,
  selecionarProfissionalMenorCarga,
  salvarRascunhoReserva,
  obterRascunhoReserva,
  limparRascunhoReserva,
  calcularDescontoCupom,
} from "@barzzo/dominio";
import { formatarData } from "@barzzo/utilitarios";
import type {
  Barbearia,
  Servico,
  Profissional,
  HorarioBarbearia,
  JornadaProfissional,
  BloqueioAgenda,
  SlotDisponivel,
  DiaSemana,
  RascunhoReserva,
  Cupom,
} from "@barzzo/tipos";
import {
  Scissors,
  User,
  Calendar,
  Clock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Tag,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

function ConteudoWizardReservaCliente() {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const slug = params.slug as string;
  const servicoIdUrl = searchParams.get("servico_id");
  const cupomParamUrl = searchParams.get("cupom");

  const [carregando, setCarregando] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [usuarioAutenticado, setUsuarioAutenticado] = React.useState<boolean>(false);
  const [usuarioId, setUsuarioId] = React.useState<string | null>(null);
  const [usuarioNome, setUsuarioNome] = React.useState<string>("");
  const [usuarioTelefone, setUsuarioTelefone] = React.useState<string>("");

  // Dados da Barbearia
  const [barbearia, setBarbearia] = React.useState<Barbearia | null>(null);
  const [servicos, setServicos] = React.useState<Servico[]>([]);
  const [profissionais, setProfissionais] = React.useState<Profissional[]>([]);
  const [horariosBarbearia, setHorariosBarbearia] = React.useState<Record<number, HorarioBarbearia>>({});
  const [jornadasProfissionais, setJornadasProfissionais] = React.useState<JornadaProfissional[]>([]);
  const [vinculosServicos, setVinculosServicos] = React.useState<{ profissional_id: string; servico_id: string }[]>([]);

  // Wizard Steps: 1 = Serviço, 2 = Profissional, 3 = Data & Horário, 4 = Resumo
  const [passoAtual, setPassoAtual] = React.useState<number>(1);

  // Seleções do Cliente
  const [servicoSelecionado, setServicoSelecionado] = React.useState<Servico | null>(null);
  const [modoProfissional, setModoProfissional] = React.useState<"qualquer" | "especifico">("qualquer");
  const [profissionalSelecionado, setProfissionalSelecionado] = React.useState<Profissional | null>(null);
  const [dataSelecionada, setDataSelecionada] = React.useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [slotSelecionado, setSlotSelecionado] = React.useState<string | null>(null);
  const [observacoes, setObservacoes] = React.useState("");
  const [codigoCupom, setCodigoCupom] = React.useState(cupomParamUrl?.toUpperCase() || "");
  const [cupomAplicado, setCupomAplicado] = React.useState<Cupom | null>(null);
  const [descontoCalculado, setDescontoCalculado] = React.useState<number>(0);
  const [validandoCupom, setValidandoCupom] = React.useState<boolean>(false);
  const [msgCupom, setMsgCupom] = React.useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  // Slots em tempo real
  const [slotsDisponiveis, setSlotsDisponiveis] = React.useState<SlotDisponivel[]>([]);
  const [calculandoSlots, setCalculandoSlots] = React.useState(false);

  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    carregarDadosIniciais();
  }, [slug]);

  React.useEffect(() => {
    if (cupomParamUrl && barbearia && servicoSelecionado && !cupomAplicado && !validandoCupom) {
      void aplicarValidarCupom();
    }
  }, [cupomParamUrl, barbearia, servicoSelecionado]);

  async function carregarDadosIniciais() {
    try {
      setCarregando(true);
      const supabase = criarClienteSupabaseBrowser();

      if (cupomParamUrl) setCodigoCupom(cupomParamUrl.trim().toUpperCase());

      // Verificar sessão (pode ser anônimo!)
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setUsuarioAutenticado(true);
        setUsuarioId(session.user.id);
        const { data: usuarioDb } = await (supabase.from("usuarios") as any)
          .select("nome, telefone")
          .eq("id", session.user.id)
          .single();

        if (usuarioDb) {
          setUsuarioNome(usuarioDb.nome || "");
          setUsuarioTelefone(usuarioDb.telefone || "");
        }
      }

      // Buscar Barbearia por Slug
      const { data: bDb, error: erroB } = await supabase
        .from("barbearias")
        .select("*")
        .eq("slug", slug)
        .eq("ativa", true)
        .single();

      if (erroB || !bDb) {
        setErro("Barbearia não encontrada.");
        return;
      }

      const barb = bDb as Barbearia;
      setBarbearia(barb);

      // Serviços Ativos
      const { data: sDb } = await supabase
        .from("servicos")
        .select("*")
        .eq("barbearia_id", barb.id)
        .eq("ativo", true)
        .order("preco", { ascending: true });

      const listaServicos = (sDb || []) as Servico[];
      setServicos(listaServicos);

      // Profissionais
      const { data: pDb } = await supabase
        .from("profissionais")
        .select("*")
        .eq("barbearia_id", barb.id)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      const listaProfissionais = (pDb || []) as Profissional[];
      setProfissionais(listaProfissionais);

      // Horários
      const { data: hbDb } = await supabase
        .from("horarios_barbearia")
        .select("*")
        .eq("barbearia_id", barb.id);

      const mapaHb: Record<number, HorarioBarbearia> = {};
      (hbDb || []).forEach((h: HorarioBarbearia) => {
        mapaHb[h.dia_semana] = h;
      });
      setHorariosBarbearia(mapaHb);

      // Jornadas
      const { data: jpDb } = await supabase.from("jornadas_profissionais").select("*");
      setJornadasProfissionais((jpDb || []) as JornadaProfissional[]);

      // Vínculos
      const { data: psDb } = await supabase.from("profissionais_servicos").select("profissional_id, servico_id").eq("ativo", true);
      setVinculosServicos((psDb || []) as { profissional_id: string; servico_id: string }[]);

      // Restaurar rascunho de reserva salvo se pertencer a esta barbearia
      const draft = typeof window !== "undefined" ? obterRascunhoReserva() : null;
      if (draft && (draft.barbearia_slug === slug || draft.barbearia_id === barb.id)) {
        const servicoSalvo = listaServicos.find((s) => s.id === draft.servico_id);
        if (servicoSalvo) {
          setServicoSelecionado(servicoSalvo);

          if (draft.profissional_id) {
            const profSalvo = listaProfissionais.find((p) => p.id === draft.profissional_id);
            if (profSalvo) {
              setModoProfissional("especifico");
              setProfissionalSelecionado(profSalvo);
            }
          } else {
            setModoProfissional("qualquer");
            setProfissionalSelecionado(null);
          }

          const hojeStr = new Date().toISOString().split("T")[0];
          if (draft.data && draft.data >= hojeStr) {
            setDataSelecionada(draft.data);
          }

          if (draft.horario) {
            setSlotSelecionado(draft.horario);
          }

          if (draft.observacoes) {
            setObservacoes(draft.observacoes);
          }

          if (draft.codigo_cupom) {
            setCodigoCupom(draft.codigo_cupom);
          }

          if (draft.valor_desconto) {
            setDescontoCalculado(draft.valor_desconto);
          }

          if (draft.horario) {
            setPassoAtual(4); // Avança direto para o resumo final
          } else if (draft.profissional_id || draft.data) {
            setPassoAtual(3);
          } else {
            setPassoAtual(2);
          }
        }
      } else if (servicoIdUrl) {
        const preSel = listaServicos.find((s) => s.id === servicoIdUrl);
        if (preSel) {
          setServicoSelecionado(preSel);
          setPassoAtual(2); // Avança direto para profissional
        }
      }
    } catch {
      setErro("Erro ao inicializar fluxo de reserva.");
    } finally {
      setCarregando(false);
    }
  }

  // Recalcular slots quando no Passo 3
  React.useEffect(() => {
    if (passoAtual === 3 && servicoSelecionado && barbearia) {
      recalcularSlots();
    }
  }, [passoAtual, servicoSelecionado, modoProfissional, profissionalSelecionado, dataSelecionada, barbearia]);

  function converterParaIsoUtc(dataStr: string, horarioStr: string): string {
    const [ano, mes, dia] = dataStr.split("-").map(Number);
    const [h, m] = horarioStr.split(":").map(Number);
    const dataLocal = new Date(ano, mes - 1, dia, h, m, 0, 0);
    return dataLocal.toISOString();
  }

  async function recalcularSlots() {
    try {
      setCalculandoSlots(true);
      setSlotSelecionado(null);
      const supabase = criarClienteSupabaseBrowser();

      const dataObj = new Date(dataSelecionada + "T12:00:00");
      const diaSemana = dataObj.getDay() as DiaSemana;
      const horarioBarb = horariosBarbearia[diaSemana] || null;

      const [ano, mes, dia] = dataSelecionada.split("-").map(Number);
      const dataInicio = new Date(ano, mes - 1, dia, 0, 0, 0, 0).toISOString();
      const dataFim = new Date(ano, mes - 1, dia, 23, 59, 59, 999).toISOString();

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

      // Se o cliente estiver logado, buscar também agendamentos dele no dia para evitar conflitos
      const {
        data: { session },
      } = await supabase.auth.getSession();
      let agendamentosCliente: { inicio: string; fim: string }[] = [];
      if (session?.user?.id) {
        const { data: agsCliDb } = await supabase
          .from("agendamentos")
          .select("inicio_previsto, fim_previsto")
          .eq("cliente_id", session.user.id)
          .not("status", "in", '("cancelado","nao_compareceu")')
          .gte("inicio_previsto", dataInicio)
          .lte("inicio_previsto", dataFim);

        agendamentosCliente = (agsCliDb || []).map((ag: any) => ({
          inicio: ag.inicio_previsto,
          fim: ag.fim_previsto,
        }));
      }

      const profsAptos = profissionais.map((p) => {
        const habilitado = vinculosServicos.some(
          (v) => v.profissional_id === p.id && v.servico_id === servicoSelecionado!.id
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

      const filtroId = modoProfissional === "especifico" ? profissionalSelecionado?.id : null;

      const slots = calcularHorariosDisponiveis({
        servico: servicoSelecionado!,
        horarioBarbearia: horarioBarb,
        profissionais: profsAptos,
        bloqueios: (bloqDb || []) as BloqueioAgenda[],
        agendamentosExistentes,
        data: dataSelecionada,
        profissionalIdFiltro: filtroId,
      });

      // Filtrar slots caso o cliente logado já tenha compromisso no mesmo horário
      const slotsValidos = slots.filter((slot) => {
        if (agendamentosCliente.length === 0) return true;
        const [h, m] = slot.horario.split(":").map(Number);
        const slotIniMs = new Date(ano, mes - 1, dia, h, m, 0, 0).getTime();
        const slotFimMs = slotIniMs + slot.duracao_minutos * 60 * 1000;

        for (const agCli of agendamentosCliente) {
          const cliIniMs = new Date(agCli.inicio).getTime();
          const cliFimMs = new Date(agCli.fim).getTime();
          if (Math.max(slotIniMs, cliIniMs) < Math.min(slotFimMs, cliFimMs)) {
            return false;
          }
        }
        return true;
      });

      setSlotsDisponiveis(slotsValidos);
      if (slotsValidos.length > 0) {
        setSlotSelecionado(slotsValidos[0].horario);
      }
    } catch {
      setErro("Falha ao calcular horários livres.");
    } finally {
      setCalculandoSlots(false);
    }
  }


  async function aplicarValidarCupom() {
    if (!barbearia || !servicoSelecionado) return;
    const codigoLimpo = codigoCupom.trim().toUpperCase();
    if (!codigoLimpo) {
      setCupomAplicado(null);
      setDescontoCalculado(0);
      setMsgCupom(null);
      return;
    }

    try {
      setValidandoCupom(true);
      setMsgCupom(null);
      const supabase = criarClienteSupabaseBrowser();

      // 1. Buscar cupom
      const { data: cupDb } = await (supabase.from("cupons") as any)
        .select("*")
        .eq("barbearia_id", barbearia.id)
        .ilike("codigo", codigoLimpo)
        .eq("ativo", true)
        .maybeSingle();

      if (!cupDb) {
        setCupomAplicado(null);
        setDescontoCalculado(0);
        setMsgCupom({ tipo: "erro", texto: "Cupom não encontrado ou inválido nesta barbearia." });
        return;
      }

      const { data: regrasDb } = await (supabase.from("cupons_regras") as any)
        .select("*")
        .eq("cupom_id", cupDb.id)
        .eq("ativo", true)
        .order("prioridade", { ascending: true });
      cupDb.regras = regrasDb || [];

      // Verificar histórico local para o preview; a RPC revalida tudo na confirmação.
      let totalConcluidos = 0;
      let totalConcluidosGlobal = 0;
      if (usuarioId) {
        const { count } = await (supabase.from("agendamentos") as any)
          .select("id", { count: "exact", head: true })
          .eq("barbearia_id", barbearia.id)
          .eq("cliente_id", usuarioId)
          .eq("status", "concluido");
        totalConcluidos = count || 0;
        const { count: countGlobal } = await (supabase.from("agendamentos") as any)
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", usuarioId)
          .eq("status", "concluido");
        totalConcluidosGlobal = countGlobal || 0;
      }

      // 3. Executar cálculo de domínio
      const resultado = calcularDescontoCupom({
        cupom: cupDb as Cupom,
        valorTotal: Number(servicoSelecionado.preco),
        servicosIds: [servicoSelecionado.id],
        servicos: [{ id: servicoSelecionado.id, preco: Number(servicoSelecionado.preco) }],
        totalAgendamentosConcluidosCliente: totalConcluidos,
        historicoPorEscopo: { barbearia: totalConcluidos, global: totalConcluidosGlobal },
      });

      if (!resultado.valido) {
        setCupomAplicado(null);
        setDescontoCalculado(0);
        setMsgCupom({ tipo: "erro", texto: resultado.motivo_invalido || "Cupom não aplicável." });
        return;
      }

      setCupomAplicado(cupDb as Cupom);
      setDescontoCalculado(resultado.valor_desconto_calculado || 0);
      setMsgCupom({
        tipo: "sucesso",
        texto: `Cupom ${codigoLimpo} aplicado! Desconto de ${(resultado.valor_desconto_calculado || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      });
    } catch {
      setMsgCupom({ tipo: "erro", texto: "Erro ao validar cupom de desconto." });
    } finally {
      setValidandoCupom(false);
    }
  }

  async function handleProsseguirResumo() {
    if (!slotSelecionado) {
      setErro("Selecione um horário disponível para prosseguir.");
      return;
    }
    setErro(null);
    setPassoAtual(4);

    if (barbearia && servicoSelecionado) {
      const precoOriginal = Number(servicoSelecionado.preco);
      const precoFinal = Math.max(0, precoOriginal - descontoCalculado);

      const rascunho: RascunhoReserva = {
        barbearia_id: barbearia.id,
        barbearia_nome: barbearia.nome,
        barbearia_slug: barbearia.slug,
        servico_id: servicoSelecionado.id,
        servico_nome: servicoSelecionado.nome,
        preco: precoOriginal,
        valor_desconto: descontoCalculado > 0 ? descontoCalculado : null,
        preco_final: precoFinal,
        duracao_minutos: servicoSelecionado.duracao_minutos,
        profissional_id: modoProfissional === "especifico" && profissionalSelecionado ? profissionalSelecionado.id : null,
        profissional_nome: modoProfissional === "especifico" && profissionalSelecionado ? profissionalSelecionado.nome : null,
        data: dataSelecionada,
        horario: slotSelecionado,
        observacoes: observacoes ? observacoes : null,
        codigo_cupom: codigoCupom ? codigoCupom.trim().toUpperCase() : null,
      };
      salvarRascunhoReserva(rascunho);
    }

    if (codigoCupom.trim() && !cupomAplicado) {
      aplicarValidarCupom();
    }
  }

  async function handleFinalizarReserva() {
    if (!barbearia || !servicoSelecionado || !slotSelecionado) {
      setErro("Dados da reserva incompletos.");
      return;
    }

    const precoOriginal = Number(servicoSelecionado.preco);
    const precoFinal = Math.max(0, precoOriginal - descontoCalculado);

    const rascunho: RascunhoReserva = {
      barbearia_id: barbearia.id,
      barbearia_nome: barbearia.nome,
      barbearia_slug: barbearia.slug,
      servico_id: servicoSelecionado.id,
      servico_nome: servicoSelecionado.nome,
      preco: precoOriginal,
      valor_desconto: descontoCalculado > 0 ? descontoCalculado : null,
      preco_final: precoFinal,
      duracao_minutos: servicoSelecionado.duracao_minutos,
      profissional_id: modoProfissional === "especifico" && profissionalSelecionado ? profissionalSelecionado.id : null,
      profissional_nome: modoProfissional === "especifico" && profissionalSelecionado ? profissionalSelecionado.nome : null,
      data: dataSelecionada,
      horario: slotSelecionado,
      observacoes: observacoes ? observacoes : null,
      codigo_cupom: codigoCupom ? codigoCupom.trim().toUpperCase() : null,
    };

    // Caso 1: Usuário NÃO está autenticado (Anônimo)
    // Preserva seleção completa no localStorage e redireciona para login/cadastro sem atrito
    if (!usuarioAutenticado) {
      salvarRascunhoReserva(rascunho);
      const urlRetorno = encodeURIComponent(`/reservar/${barbearia.slug}`);
      navigate(`/entrar?retorno=${urlRetorno}`);
      return;
    }

    // Caso 2: Usuário autenticado
    // Cria a reserva definitiva no banco com revalidação
    try {
      setSalvando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();

      let profDefinitivoId = rascunho.profissional_id;

      if (!profDefinitivoId) {
        // Opção "Qualquer Profissional": selecionar menor carga do dia
        const profsNoSlot = slotsDisponiveis
          .filter((s) => s.horario === slotSelecionado)
          .map((s) => s.profissional_id);

        const [ano, mes, dia] = dataSelecionada.split("-").map(Number);
        const dataInicio = new Date(ano, mes - 1, dia, 0, 0, 0, 0).toISOString();
        const dataFim = new Date(ano, mes - 1, dia, 23, 59, 59, 999).toISOString();

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
          .filter((p) => profsNoSlot.includes(p.id))
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

      const [h, m] = slotSelecionado.split(":").map(Number);
      const minFim = h * 60 + m + servicoSelecionado.duracao_minutos;
      const horaFimStr = `${String(Math.floor(minFim / 60)).padStart(2, "0")}:${String(minFim % 60).padStart(2, "0")}`;
      const inicioIso = converterParaIsoUtc(dataSelecionada, slotSelecionado);
      const fimIso = converterParaIsoUtc(dataSelecionada, horaFimStr);

      // 1. Inserir agendamento definitivo com preço com desconto
      const { data: novoAgendamento, error: erroAg } = await (supabase.from("agendamentos") as any)
        .insert({
          barbearia_id: barbearia.id,
          cliente_id: usuarioId,
          cliente_nome: usuarioNome || "Cliente Barzzo",
          cliente_telefone: usuarioTelefone || null,
          profissional_id: profDefinitivoId,
          inicio_previsto: inicioIso,
          fim_previsto: fimIso,
          status: "confirmado",
          origem: "marketplace",
          observacoes: observacoes ? observacoes : null,
          preco_total: precoFinal,
          duracao_total_minutos: servicoSelecionado.duracao_minutos,
        })
        .select("id")
        .single();

      if (erroAg || !novoAgendamento) {
        if (erroAg?.message?.includes("uq_agendamento_cliente_sem_sobreposicao")) {
          setErro("Você já possui um agendamento marcado neste mesmo horário. Por favor, escolha outro horário livre.");
          setPassoAtual(3); // Volta para tela de horário
          recalcularSlots();
        } else if (erroAg?.message?.includes("uq_agendamento_sem_sobreposicao")) {
          setErro("Ops! Este horário acabou de ser ocupado por outro cliente. Por favor, escolha outro slot livre.");
          setPassoAtual(3); // Volta para tela de horário
          recalcularSlots();
        } else {
          setErro("Falha ao registrar o agendamento no sistema.");
        }
        return;
      }

      // 2. Inserir snapshot do serviço
      await (supabase.from("agendamentos_servicos") as any).insert({
        agendamento_id: novoAgendamento.id,
        servico_id: servicoSelecionado.id,
        nome_servico: servicoSelecionado.nome,
        preco: precoOriginal,
        duracao_minutos: servicoSelecionado.duracao_minutos,
      });

      // A confirmação do cupom, do snapshot e dos limites ocorre atomicamente no banco.
      if (codigoCupom.trim()) {
        const { error: erroCupom } = await (supabase.rpc as any)("registrar_uso_cupom", {
          p_barbearia_id: barbearia.id,
          p_cupom_id: cupomAplicado?.id || null,
          p_agendamento_id: novoAgendamento.id,
          p_cliente_id: usuarioId,
          p_codigo: codigoCupom.trim().toUpperCase(),
          p_influenciador_id: null,
        });
        if (erroCupom) {
          await (supabase.rpc as any)("atualizar_status_agendamento", {
            p_agendamento_id: novoAgendamento.id,
            p_novo_status: "cancelado",
          });
          setErro(erroCupom.message || "Não foi possível aplicar o cupom nesta reserva.");
          return;
        }
      }

      limparRascunhoReserva();
      navigate(`/agendamentos/${novoAgendamento.id}?sucesso=true`);
    } catch {
      setErro("Erro inesperado ao confirmar reserva.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Preparando agendamento...</p>
      </div>
    );
  }

  if (!barbearia) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center flex flex-col items-center gap-4">
        <h2 className="text-2xl font-bold">Barbearia não encontrada</h2>
        <Link to="/barbearias">
          <Button variante="secundario">Explorar barbearias</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl w-full mx-auto flex flex-col gap-5 sm:gap-6 py-2 sm:py-4 min-w-0">
      {/* Topo / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-w-0">
        <Link
          to={`/barbearias/${barbearia.slug}`}
          className="text-xs sm:text-sm font-semibold opacity-70 hover:opacity-100 flex items-center gap-1.5 transition-opacity self-start truncate"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" /> Cancelar e voltar ao perfil
        </Link>
        <span className="text-xs font-bold text-[#B45A2B] uppercase tracking-wider truncate max-w-full">
          {barbearia.nome}
        </span>
      </div>

      {erro && (
        <Alert variante="erro">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {/* Indicador Visual de Etapas */}
      <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center text-[10px] sm:text-xs font-semibold min-w-0">
        {[
          { num: 1, label: "Serviço" },
          { num: 2, label: "Barbeiro" },
          { num: 3, label: "Horário" },
          { num: 4, label: "Resumo" },
        ].map((etapa) => (
          <div
            key={etapa.num}
            onClick={() => etapa.num < passoAtual && setPassoAtual(etapa.num)}
            className={`py-2 px-1 rounded-lg border transition-all truncate min-w-0 ${
              passoAtual === etapa.num
                ? "bg-[#B45A2B] text-white border-[#B45A2B] shadow-sm"
                : etapa.num < passoAtual
                ? "bg-neutral-100 dark:bg-neutral-900 border-[#16A34A] text-[#16A34A] cursor-pointer"
                : "bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 opacity-50"
            }`}
          >
            <span className="block truncate">{etapa.num}. {etapa.label}</span>
          </div>
        ))}
      </div>

      {/* ETAPA 1: SELEÇÃO DE SERVIÇO */}
      {passoAtual === 1 && (
        <Card camada="primaria">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <Scissors className="h-5 w-5 text-[#B45A2B] shrink-0" /> 1. Escolha o Serviço
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Selecione o corte, barba ou combo desejado para este atendimento.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 flex flex-col gap-3">
            {servicos.map((s) => {
              const selecionado = servicoSelecionado?.id === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    setServicoSelecionado(s);
                    setPassoAtual(2);
                  }}
                  className={`p-3 sm:p-4 rounded-xl border cursor-pointer select-none transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 ${
                    selecionado
                      ? "border-[#B45A2B] bg-[#B45A2B]/5 shadow-sm ring-1 ring-[#B45A2B]"
                      : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm sm:text-base break-words">{s.nome}</span>
                    {s.descricao && (
                      <p className="text-xs opacity-70 line-clamp-2 mt-0.5">{s.descricao}</p>
                    )}
                    <span className="text-xs opacity-60 mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-[#B45A2B] shrink-0" /> {s.duracao_minutos} minutos
                    </span>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-neutral-800">
                    <span className="font-extrabold text-base sm:text-lg text-[#B45A2B]">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(s.preco))}
                    </span>
                    <Button variante="principal" tamanho="sm">
                      Escolher
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ETAPA 2: SELEÇÃO DE PROFISSIONAL */}
      {passoAtual === 2 && (
        <Card camada="primaria">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <User className="h-5 w-5 text-[#B45A2B] shrink-0" /> 2. Escolha o Profissional
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Serviço selecionado: <strong>{servicoSelecionado?.nome}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 flex flex-col gap-4">
            {/* Opção Qualquer Profissional */}
            <div
              onClick={() => {
                setModoProfissional("qualquer");
                setProfissionalSelecionado(null);
                setPassoAtual(3);
              }}
              className={`p-3 sm:p-4 rounded-xl border cursor-pointer select-none transition-all flex items-center justify-between gap-3 group ${
                modoProfissional === "qualquer"
                  ? "border-[#B45A2B] bg-[#B45A2B]/5 shadow-sm ring-1 ring-[#B45A2B]"
                  : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-900/40"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 text-[#B45A2B] shrink-0" />
                <div className="min-w-0">
                  <span className="font-bold text-sm sm:text-base block truncate">Qualquer Profissional Disponível</span>
                  <span className="text-xs opacity-70 line-clamp-2">
                    Maior variedade de horários livres e menor tempo de espera.
                  </span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-neutral-400 group-hover:text-[#B45A2B] group-hover:translate-x-0.5 transition-all shrink-0" aria-hidden="true" />
            </div>

            <div className="relative my-2 text-center text-xs opacity-50">
              <span className="bg-white dark:bg-[#121214] px-2 relative z-10">ou escolha seu barbeiro</span>
              <div className="absolute inset-0 top-1/2 border-t border-neutral-200 dark:border-neutral-800" />
            </div>

            {/* Lista Nominal de Barbeiros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {profissionais.map((p) => {
                const selecionado = modoProfissional === "especifico" && profissionalSelecionado?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setModoProfissional("especifico");
                      setProfissionalSelecionado(p);
                      setPassoAtual(3);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer select-none transition-all flex items-center justify-between group ${
                      selecionado
                        ? "border-[#B45A2B] bg-[#B45A2B]/5 shadow-sm ring-1 ring-[#B45A2B]"
                        : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-900/40"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center font-bold text-xs shrink-0">
                        {p.nome.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-semibold text-sm truncate">{p.nome}</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-neutral-400 group-hover:text-[#B45A2B] group-hover:translate-x-0.5 transition-all shrink-0" aria-hidden="true" />
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <Button variante="fantasma" onClick={() => setPassoAtual(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ETAPA 3: DATA E HORÁRIO EM TEMPO REAL */}
      {passoAtual === 3 && (
        <Card camada="primaria">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#B45A2B] shrink-0" /> 3. Data e Horário
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {servicoSelecionado?.nome} com{" "}
              {modoProfissional === "qualquer"
                ? "Qualquer Profissional Disponível"
                : profissionalSelecionado?.nome}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 flex flex-col gap-6">
            <div className="max-w-md w-full">
              <SeletorData
                id="data"
                rotulo="Escolha o Dia do Atendimento"
                min={new Date().toISOString().split("T")[0]}
                valor={dataSelecionada}
                aoMudar={(novaData) => setDataSelecionada(novaData)}
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">Horários Livres Encontrados:</span>
                {calculandoSlots && <LoadingSpinner tamanho="sm" />}
              </div>

              {calculandoSlots ? (
                <div className="py-8 text-center text-xs opacity-70">
                  Consultando agenda em tempo real...
                </div>
              ) : slotsDisponiveis.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed text-center text-sm opacity-70 flex flex-col items-center gap-2">
                  <Clock className="h-8 w-8 opacity-40 text-[#B45A2B]" />
                  <span>Não há horários disponíveis para esta data.</span>
                  <span className="text-xs opacity-60">
                    Tente selecionar outro dia no calendário acima.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {Array.from(new Set(slotsDisponiveis.map((s) => s.horario))).map((h) => {
                    const selecionado = slotSelecionado === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setSlotSelecionado(h)}
                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                          selecionado
                            ? "bg-[#B45A2B] text-white border-[#B45A2B] shadow-sm ring-2 ring-[#B45A2B]"
                            : "border-neutral-200 dark:border-neutral-800 hover:border-[#B45A2B]"
                        }`}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <Button variante="fantasma" onClick={() => setPassoAtual(2)} className="w-full sm:w-auto">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button
                variante="principal"
                disabled={!slotSelecionado}
                onClick={handleProsseguirResumo}
                className="w-full sm:w-auto"
              >
                Continuar para Resumo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ETAPA 4: RESUMO E CONFIRMAÇÃO (SEM LOGIN ATÉ AQUI) */}
      {passoAtual === 4 && (
        <Card camada="primaria" className="border-l-4 border-l-[#B45A2B]">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#B45A2B] shrink-0" /> 4. Resumo do Agendamento
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Revise as informações antes de confirmar definitivamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 flex flex-col gap-6">
            {/* Bloco de Resumo */}
            <div className="p-3 sm:p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs uppercase font-bold tracking-wider opacity-60 shrink-0">Barbearia</span>
                <span className="font-bold text-sm sm:text-right break-words">{barbearia.nome}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs uppercase font-bold tracking-wider opacity-60 shrink-0">Localização</span>
                <span className="font-semibold text-xs sm:text-sm sm:text-right break-words">
                  {[barbearia.bairro, barbearia.cidade].filter(Boolean).join(", ") || barbearia.endereco || "Localização informada"}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs uppercase font-bold tracking-wider opacity-60 shrink-0">Serviço</span>
                <span className="font-bold text-sm sm:text-right break-words">{servicoSelecionado?.nome}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs uppercase font-bold tracking-wider opacity-60 shrink-0">Profissional</span>
                <span className="font-bold text-sm sm:text-right break-words">
                  {modoProfissional === "qualquer"
                    ? "Qualquer Profissional Disponível"
                    : profissionalSelecionado?.nome}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs uppercase font-bold tracking-wider opacity-60 shrink-0">Data e Horário</span>
                <span className="font-bold text-sm text-[#B45A2B] sm:text-right">
                  {formatarData(dataSelecionada)} às {slotSelecionado}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between text-xs opacity-75">
                  <span>Valor do Serviço:</span>
                  <span>
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(servicoSelecionado?.preco || 0))}
                  </span>
                </div>

                {descontoCalculado > 0 && (
                  <div className="flex items-center justify-between text-xs font-bold text-[#16A34A]">
                    <span>Desconto ({cupomAplicado?.codigo || codigoCupom}):</span>
                    <span>
                      -{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(descontoCalculado)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 font-extrabold text-base border-t border-neutral-200/60 dark:border-neutral-800/60">
                  <span>Valor Final:</span>
                  <span className="text-[#B45A2B]">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      Math.max(0, Number(servicoSelecionado?.preco || 0) - descontoCalculado)
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Cupom e Observações */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="cupom">Cupom de Desconto / Influenciador</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
                    <Input
                      id="cupom"
                      placeholder="Código (ex: PROMO10)"
                      value={codigoCupom}
                      onChange={(e) => {
                        setCodigoCupom(e.target.value.toUpperCase());
                        setCupomAplicado(null);
                        setDescontoCalculado(0);
                        setMsgCupom(null);
                      }}
                      className="pl-9 font-semibold uppercase"
                    />
                  </div>
                  <Button
                    type="button"
                    variante="secundario"
                    tamanho="sm"
                    disabled={validandoCupom || !codigoCupom.trim()}
                    carregando={validandoCupom}
                    onClick={aplicarValidarCupom}
                    className="min-h-[44px] text-xs font-semibold px-4"
                  >
                    Aplicar
                  </Button>
                </div>

                {msgCupom && (
                  <span
                    className={`text-xs font-semibold mt-0.5 ${
                      msgCupom.tipo === "sucesso"
                        ? "text-[#16A34A]"
                        : "text-[#DC2626]"
                    }`}
                  >
                    {msgCupom.texto}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="obs">Observações para o Barbeiro</Label>
                <Input
                  id="obs"
                  placeholder="Ex: Cabelo liso, barba curta (opcional)"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>
            </div>

            {/* Aviso sobre Autenticação / Identificação */}
            {!usuarioAutenticado ? (
              <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <strong className="block text-sm font-semibold text-blue-500 mb-0.5">
                    Identificação necessária para confirmação
                  </strong>
                  Ao clicar abaixo, sua seleção será salva com segurança e você será direcionado para entrar ou criar sua conta rápida em segundos. Nenhuma escolha será perdida.
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-[#16A34A]/20 bg-[#16A34A]/5 flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-[#16A34A] shrink-0 mt-0.5" />
                <div className="text-xs">
                  <strong className="block text-sm font-semibold text-[#16A34A] mb-0.5">
                    Conectado como {usuarioNome || "Cliente"}
                  </strong>
                  Seu agendamento será confirmado imediatamente no calendário da barbearia.
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <Button variante="fantasma" onClick={() => setPassoAtual(3)} className="w-full sm:w-auto">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>

              <Button
                variante="principal"
                tamanho="lg"
                disabled={salvando}
                onClick={handleFinalizarReserva}
                className="w-full sm:w-auto font-bold text-base shadow-md"
              >
                {salvando
                  ? "Confirmando..."
                  : usuarioAutenticado
                  ? "Confirmar Reserva Definitiva"
                  : "Continuar para Identificação"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function PaginaWizardReservaCliente() {
  return (
    <React.Suspense
      fallback={
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <LoadingSpinner tamanho="lg" />
          <p className="text-sm opacity-70">Carregando fluxo de agendamento...</p>
        </div>
      }
    >
      <ConteudoWizardReservaCliente />
    </React.Suspense>
  );
}
