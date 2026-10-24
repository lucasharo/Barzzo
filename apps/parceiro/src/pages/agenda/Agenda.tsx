import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  Alert,
  AlertDescription,
  LoadingSpinner,
  Seletor,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { obterMembroAtual } from "../../lib/unidade-atual";
import { traduzirErro } from "@barzzo/utilitarios";
import {
  chaveDiaLocal,
  minutosParaTime,
  profissionaisLivresNaCelula,
  quantidadeColunasAgenda,
  timeParaMinutos,
} from "@barzzo/dominio";
import type {
  AgendamentoComDetalhes,
  BloqueioAgenda,
  JornadaProfissional,
  Profissional,
  Barbearia,
  StatusAgendamento,
} from "@barzzo/tipos";
import { Plus, Filter } from "lucide-react";
import { CarrosselDias } from "./componentes/CarrosselDias";
import { GradeAgenda, type FuncionamentoDia } from "./componentes/GradeAgenda";
import { DetalhesAgendamentoModal } from "../../components/detalhes-agendamento-modal";
import { reagendarAgendamento } from "../../lib/agendamentos";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const DIAS_LONGOS = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado",
];

const FILTROS_STATUS: Array<{ valor: string; rotulo: string }> = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "confirmado", rotulo: "Confirmado" },
  { valor: "em_atendimento", rotulo: "Em Atendimento" },
  { valor: "concluido", rotulo: "Concluído" },
  { valor: "cancelado", rotulo: "Cancelado" },
];

function inicioDoDia(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

function somarDias(data: Date, dias: number): Date {
  const nova = new Date(data);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

export default function PaginaAgendaParceiro() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = React.useState(true);
  const [barbearia, setBarbearia] = React.useState<Barbearia | null>(null);
  const [profissionais, setProfissionais] = React.useState<Profissional[]>([]);
  const [funcionamento, setFuncionamento] = React.useState<Record<number, FuncionamentoDia | null>>({});
  const [agendamentos, setAgendamentos] = React.useState<AgendamentoComDetalhes[]>([]);
  const [jornadas, setJornadas] = React.useState<JornadaProfissional[]>([]);
  const [bloqueios, setBloqueios] = React.useState<BloqueioAgenda[]>([]);
  const [aviso, setAviso] = React.useState<string | null>(null);

  // Primeiro dia da janela exibida (um dia no celular, vários em telas largas)
  const [inicio, setInicio] = React.useState<Date>(() => inicioDoDia(new Date()));
  const [colunas, setColunas] = React.useState(1);
  const [filtroProfissional, setFiltroProfissional] = React.useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = React.useState<string>("todos");
  const [selecionado, setSelecionado] = React.useState<AgendamentoComDetalhes | null>(null);

  const [acaoId, setAcaoId] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  // A quantidade de dias acompanha a largura disponível para a grade.
  const observadorRef = React.useRef<ResizeObserver | null>(null);
  const medirLargura = React.useCallback((elemento: HTMLDivElement | null) => {
    observadorRef.current?.disconnect();
    if (!elemento) return;
    const atualizar = () => setColunas(quantidadeColunasAgenda(elemento.clientWidth));
    atualizar();
    observadorRef.current = new ResizeObserver(atualizar);
    observadorRef.current.observe(elemento);
  }, []);

  React.useEffect(() => {
    carregarBarbeariaEProfissionais();
  }, []);

  // Carrega o mês inteiro do carrossel e, se a janela passar dele, os dias seguintes.
  const inicioConsulta = new Date(Math.min(new Date(inicio.getFullYear(), inicio.getMonth(), 1).getTime(), inicio.getTime()));
  const fimConsulta = somarDias(
    new Date(Math.max(new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0).getTime(), somarDias(inicio, colunas - 1).getTime())),
    1
  );
  const chaveConsulta = `${chaveDiaLocal(inicioConsulta)}_${chaveDiaLocal(fimConsulta)}`;
  const consultaAtual = React.useRef(0);

  React.useEffect(() => {
    if (barbearia?.id) {
      carregarAgendamentos();
    }
  }, [barbearia?.id, chaveConsulta]);

  async function carregarBarbeariaEProfissionais() {
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

      const { data: bDb } = await supabase
        .from("barbearias")
        .select("*")
        .eq("id", membro.barbearia_id)
        .single();

      if (bDb) setBarbearia(bDb as Barbearia);

      const { data: profsDb } = await supabase
        .from("profissionais")
        .select("*")
        .eq("barbearia_id", membro.barbearia_id)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      const listaProfs = (profsDb || []) as Profissional[];
      setProfissionais(listaProfs);

      if (listaProfs.length > 0) {
        const { data: jornadasDb } = await supabase
          .from("jornadas_profissionais")
          .select("*")
          .in("profissional_id", listaProfs.map((p) => p.id));
        setJornadas((jornadasDb || []) as JornadaProfissional[]);
      }

      const { data: horariosDb } = await supabase
        .from("horarios_barbearia")
        .select("dia_semana, hora_abertura, hora_fechamento, hora_inicio_almoco, hora_fim_almoco")
        .eq("barbearia_id", membro.barbearia_id)
        .eq("ativo", true);

      const mapa: Record<number, FuncionamentoDia | null> = {};
      (horariosDb || []).forEach(
        (h: {
          dia_semana: number;
          hora_abertura: string;
          hora_fechamento: string;
          hora_inicio_almoco: string | null;
          hora_fim_almoco: string | null;
        }) => {
          mapa[h.dia_semana] = {
            abertura: timeParaMinutos(h.hora_abertura),
            fechamento: timeParaMinutos(h.hora_fechamento),
            almocoInicio: h.hora_inicio_almoco ? timeParaMinutos(h.hora_inicio_almoco) : null,
            almocoFim: h.hora_fim_almoco ? timeParaMinutos(h.hora_fim_almoco) : null,
          };
        }
      );
      setFuncionamento(mapa);
    } catch {
      setErro("Erro ao inicializar agenda.");
    } finally {
      setCarregando(false);
    }
  }

  async function carregarAgendamentos() {
    if (!barbearia?.id) return;
    const execucao = ++consultaAtual.current;
    try {
      const supabase = criarClienteSupabaseBrowser();

      const { data: bloqueiosDb } = await supabase
        .from("bloqueios_agenda")
        .select("*")
        .eq("barbearia_id", barbearia.id)
        .lt("inicio", fimConsulta.toISOString())
        .gt("fim", inicioConsulta.toISOString());

      const { data: agsDb, error: erroAgs } = await supabase
        .from("agendamentos")
        .select(`
          *,
          profissionais (nome, foto_url),
          agendamentos_servicos (*)
        `)
        .eq("barbearia_id", barbearia.id)
        .gte("inicio_previsto", inicioConsulta.toISOString())
        .lt("inicio_previsto", fimConsulta.toISOString())
        .order("inicio_previsto", { ascending: true });

      // Uma consulta mais nova já assumiu: descarta esta resposta antiga.
      if (execucao !== consultaAtual.current) return;

      if (erroAgs) {
        setErro("Não foi possível carregar os agendamentos do período.");
        return;
      }

      const listaFormatada: AgendamentoComDetalhes[] = (agsDb || []).map((item: any) => ({
        ...item,
        profissional_nome: item.profissionais?.nome || "Profissional",
        profissional_foto_url: item.profissionais?.foto_url || null,
        servicos: item.agendamentos_servicos || [],
      }));

      setAgendamentos(listaFormatada);
      setBloqueios((bloqueiosDb || []) as BloqueioAgenda[]);
    } catch {
      setErro("Erro inesperado ao consultar agendamentos.");
    }
  }

  async function atualizarStatus(agendamentoId: string, novoStatus: StatusAgendamento) {
    try {
      setAcaoId(agendamentoId);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();

      // Usar a RPC de transição atômica
      const { error } = await supabase.rpc("atualizar_status_agendamento", {
        p_agendamento_id: agendamentoId,
        p_novo_status: novoStatus,
      });

      if (error) {
        setErro(traduzirErro(error, "Não foi possível atualizar o status do agendamento."));
        return;
      }

      setSelecionado(null);
      setSucesso(`Status atualizado para ${novoStatus.replace("_", " ")} com sucesso.`);
      setTimeout(() => setSucesso(null), 3000);
      carregarAgendamentos();
    } catch {
      setErro("Erro inesperado ao atualizar status.");
    } finally {
      setAcaoId(null);
    }
  }

  async function reagendar(
    agendamentoId: string,
    novo: { inicioIso: string; fimIso: string; profissionalId: string }
  ): Promise<string | null> {
    const erroReagendamento = await reagendarAgendamento(agendamentoId, novo);
    if (erroReagendamento) return erroReagendamento;

    setSelecionado(null);
    setSucesso("Agendamento reagendado com sucesso!");
    setTimeout(() => setSucesso(null), 3000);
    carregarAgendamentos();
    return null;
  }

  function irParaHoje() {
    setInicio(inicioDoDia(new Date()));
  }

  function mudarMes(delta: number) {
    setInicio(new Date(inicio.getFullYear(), inicio.getMonth() + delta, 1));
  }

  // Profissionais que podem atender na célula de 15 min (respeita o filtro de profissional).
  function profissionaisLivres(dia: Date, minutos: number): string[] {
    const candidatos =
      filtroProfissional === "todos" ? profissionais : profissionais.filter((p) => p.id === filtroProfissional);
    return profissionaisLivresNaCelula({
      dia,
      minutos,
      funcionamento: funcionamento[dia.getDay()] ?? null,
      profissionais: candidatos.map((p) => ({
        id: p.id,
        jornadas: jornadas.filter((j) => j.profissional_id === p.id),
      })),
      bloqueios,
      agendamentos,
    });
  }

  function criarNoHorario(dia: Date, minutos: number) {
    const livres = profissionaisLivres(dia, minutos);
    const parametros = new URLSearchParams({ data: chaveDiaLocal(dia), hora: minutosParaTime(minutos) });
    // Com um único profissional livre (ou filtrado), o formulário já vem com ele escolhido.
    if (livres.length === 1) parametros.set("profissional", livres[0]);
    navigate(`/agendamentos/novo?${parametros.toString()}`);
  }

  function avisarHorarioIndisponivel() {
    setAviso("Esse horário não está disponível para agendamento (fora do expediente, já passou, pausa, bloqueio ou ocupado).");
    setTimeout(() => setAviso(null), 3500);
  }

  const agendamentosFiltrados = agendamentos.filter((ag) => {
    if (filtroProfissional !== "todos" && ag.profissional_id !== filtroProfissional) return false;
    if (filtroStatus !== "todos" && ag.status !== filtroStatus) return false;
    return true;
  });

  const dias = Array.from({ length: colunas }, (_, i) => somarDias(inicio, i));
  const chavesVisiveis = new Set(dias.map(chaveDiaLocal));

  const contagens: Record<string, number> = {};
  for (const ag of agendamentosFiltrados) {
    if (ag.status === "cancelado" || ag.status === "nao_compareceu") continue;
    const chave = chaveDiaLocal(new Date(ag.inicio_previsto));
    contagens[chave] = (contagens[chave] || 0) + 1;
  }

  const diasAbertos: Record<number, boolean> = {};
  for (let d = 0; d < 7; d++) diasAbertos[d] = !!funcionamento[d];

  const visiveis = agendamentos.filter(
    (ag) =>
      chavesVisiveis.has(chaveDiaLocal(new Date(ag.inicio_previsto))) &&
      (filtroProfissional === "todos" || ag.profissional_id === filtroProfissional)
  );
  const contagemStatus = {
    confirmados: visiveis.filter((a) => a.status === "confirmado").length,
    em_atendimento: visiveis.filter((a) => a.status === "em_atendimento").length,
    concluidos: visiveis.filter((a) => a.status === "concluido").length,
    cancelados: visiveis.filter((a) => a.status === "cancelado" || a.status === "nao_compareceu").length,
  };

  const ultimoDia = dias[dias.length - 1];
  const titulo =
    colunas === 1
      ? `${DIAS_LONGOS[inicio.getDay()]}, ${inicio.getDate()} de ${MESES[inicio.getMonth()]}`
      : inicio.getMonth() === ultimoDia.getMonth()
      ? `${inicio.getDate()} a ${ultimoDia.getDate()} de ${MESES[inicio.getMonth()]}`
      : `${inicio.getDate()} de ${MESES[inicio.getMonth()]} a ${ultimoDia.getDate()} de ${MESES[ultimoDia.getMonth()]}`;

  if (carregando) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando agenda operacional...</p>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-4 overflow-x-clip">
      {erro && (
        <Alert variante="erro">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {sucesso && (
        <Alert variante="sucesso">
          <AlertDescription>{sucesso}</AlertDescription>
        </Alert>
      )}

      {aviso && (
        <Alert variante="alerta">
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{titulo}</h1>
          <p className="text-sm opacity-70 mt-1">
            {colunas === 1 ? "Um dia por vez." : `${colunas} dias lado a lado.`} Toque num horário vazio para agendar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Seletor
            valor={filtroProfissional}
            aoMudar={(v) => setFiltroProfissional(v)}
            opcoes={[
              { valor: "todos", rotulo: "Todos os profissionais" },
              ...profissionais.map((p) => ({ valor: p.id, rotulo: p.nome })),
            ]}
            icone={<Filter className="h-4 w-4" />}
            tamanho="sm"
            className="w-full sm:w-[220px]"
          />
          <Link to="/agendamentos/novo" className="w-full sm:w-auto">
            <Button variante="principal" tamanho="sm" className="w-full min-h-[44px]">
              <Plus className="h-4 w-4 mr-1.5" /> Novo Agendamento
            </Button>
          </Link>
        </div>
      </div>

      <CarrosselDias
        inicio={inicio}
        colunas={colunas}
        contagens={contagens}
        diasAbertos={diasAbertos}
        aoSelecionarDia={(dia) => setInicio(inicioDoDia(dia))}
        aoMudarMes={mudarMes}
        aoPaginar={(delta) => setInicio(somarDias(inicio, delta))}
        aoIrParaHoje={irParaHoje}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTROS_STATUS.map((st) => (
            <button
              key={st.valor}
              type="button"
              onClick={() => setFiltroStatus(st.valor)}
              className={`text-xs px-3 min-h-[36px] rounded-full border font-medium whitespace-nowrap transition-colors ${
                filtroStatus === st.valor
                  ? "bg-[#B45A2B] border-[#B45A2B] text-white"
                  : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900"
              }`}
            >
              {st.rotulo}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-85">
          <span><b>{contagemStatus.confirmados}</b> confirmados</span>
          <span><b>{contagemStatus.em_atendimento}</b> em atendimento</span>
          <span><b>{contagemStatus.concluidos}</b> concluídos</span>
          <span><b>{contagemStatus.cancelados}</b> cancelados/no-show</span>
        </div>
      </div>

      <div ref={medirLargura}>
        <GradeAgenda
          dias={dias}
          agendamentos={agendamentosFiltrados}
          funcionamento={funcionamento}
          aoSelecionarAgendamento={setSelecionado}
          aoSelecionarHorario={criarNoHorario}
          celulaLivre={(dia, minutos) => profissionaisLivres(dia, minutos).length > 0}
          aoSelecionarHorarioIndisponivel={avisarHorarioIndisponivel}
        />
      </div>

      <DetalhesAgendamentoModal
        agendamento={selecionado}
        aoFechar={() => setSelecionado(null)}
        carregandoAcao={!!selecionado && acaoId === selecionado.id}
        aoAlterarStatus={atualizarStatus}
        profissionais={profissionais}
        aoReagendar={reagendar}
      />
    </div>
  );
}
