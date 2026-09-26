
import * as React from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import type {
  Barbearia,
  PeriodoFiltro,
  RelatorioGeral,
  DesempenhoProfissionalItem,
  DesempenhoMarketingItem,
} from "@barzzo/tipos";
import {
  calcularTicketMedio,
  calcularDatasPeriodo,
  calcularDiferencaPrevistoReal,
  calcularTaxaOcupacao,
} from "@barzzo/dominio";
import {
  BarChart3,
  Calendar,
  DollarSign,
  Scissors,
  Users,
  Clock,
  TrendingUp,
  Tag,
  Share2,
  AlertCircle,
  Filter,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default function PaginaRelatoriosParceiro() {
  const [carregando, setCarregando] = React.useState(true);
  const [barbearia, setBarbearia] = React.useState<Barbearia | null>(null);
  const [abaAtiva, setAbaAtiva] = React.useState<"geral" | "profissionais" | "marketing">("geral");
  const [periodo, setPeriodo] = React.useState<PeriodoFiltro>("7d");
  const [dataInicio, setDataInicio] = React.useState<string>("");
  const [dataFim, setDataFim] = React.useState<string>("");
  const [profissionais, setProfissionais] = React.useState<any[]>([]);
  const [profissionalFiltro, setProfissionalFiltro] = React.useState<string>("todos");

  // Dados dos relatórios
  const [relatorioGeral, setRelatorioGeral] = React.useState<RelatorioGeral | null>(null);
  const [relatorioProfissionais, setRelatorioProfissionais] = React.useState<DesempenhoProfissionalItem[]>([]);
  const [relatorioMarketing, setRelatorioMarketing] = React.useState<DesempenhoMarketingItem[]>([]);
  const [erro, setErro] = React.useState<string | null>(null);

  // Inicializar datas baseadas no período
  React.useEffect(() => {
    if (periodo !== "personalizado") {
      const datas = calcularDatasPeriodo(periodo);
      setDataInicio(datas.dataInicio);
      setDataFim(datas.dataFim);
    }
  }, [periodo]);

  const carregarRelatorios = React.useCallback(async () => {
    if (!dataInicio || !dataFim) return;

    try {
      setCarregando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      // 1. Obter barbearia
      const { data: membro } = await supabase
        .from("membros_barbearia")
        .select("barbearia_id, papel")
        .eq("usuario_id", session.user.id)
        .limit(1)
        .maybeSingle();

      if (!membro?.barbearia_id) {
        setBarbearia(null);
        return;
      }

      const { data: bDb } = await supabase
        .from("barbearias")
        .select("*")
        .eq("id", membro.barbearia_id)
        .single();

      if (bDb) setBarbearia(bDb as Barbearia);

      // Carregar profissionais da barbearia para o dropdown
      const { data: profsDb } = await supabase
        .from("profissionais")
        .select("id, nome, foto_url")
        .eq("barbearia_id", membro.barbearia_id)
        .eq("ativo", true);
      setProfissionais(profsDb || []);

      const profIdQuery = profissionalFiltro === "todos" ? null : profissionalFiltro;

      // 2. Carregar agendamentos do período para computar métricas consolidadas
      let queryAg = supabase
        .from("agendamentos")
        .select(`
          id,
          data_hora_inicio,
          data_hora_fim,
          inicio_real,
          fim_real,
          status,
          preco_total,
          duracao_total_minutos,
          profissional_id,
          profissionais (id, nome, foto_url),
          agendamento_servicos (nome_servico, duracao_minutos, preco)
        `)
        .eq("barbearia_id", membro.barbearia_id)
        .gte("data_hora_inicio", `${dataInicio}T00:00:00.000Z`)
        .lte("data_hora_inicio", `${dataFim}T23:59:59.999Z`);

      if (profIdQuery) {
        queryAg = queryAg.eq("profissional_id", profIdQuery);
      }

      const { data: ags, error: erroAgs } = await queryAg;
      if (erroAgs) throw erroAgs;

      const lista = ags || [];
      const concluidos = lista.filter((a) => a.status === "concluido");
      const cancelados = lista.filter((a) => a.status === "cancelado");
      const noShow = lista.filter((a) => a.status === "nao_compareceu");

      const faturamentoTotal = concluidos.reduce((acc, a) => acc + Number(a.preco_total || 0), 0);
      const ticketMedio = calcularTicketMedio(faturamentoTotal, concluidos.length);

      // Médias de duração
      let somaPrevista = 0;
      let somaReal = 0;
      let countReal = 0;

      concluidos.forEach((a) => {
        somaPrevista += Number(a.duracao_total_minutos || 0);
        if (a.inicio_real && a.fim_real) {
          const analise = calcularDiferencaPrevistoReal(
            a.duracao_total_minutos,
            a.inicio_real,
            a.fim_real
          );
          somaReal += analise.duracaoRealMinutos;
          countReal++;
        }
      });

      setRelatorioGeral({
        periodo_inicio: dataInicio,
        periodo_fim: dataFim,
        total_agendamentos: lista.length,
        concluidos: concluidos.length,
        cancelados: cancelados.length,
        no_show: noShow.length,
        faturamento_total: Number(faturamentoTotal.toFixed(2)),
        ticket_medio: ticketMedio,
        duracao_prevista_media_min: concluidos.length > 0 ? Number((somaPrevista / concluidos.length).toFixed(1)) : 0,
        duracao_real_media_min: countReal > 0 ? Number((somaReal / countReal).toFixed(1)) : 0,
      });

      // 3. Desempenho por Profissional
      const mapaProfs = new Map<string, DesempenhoProfissionalItem>();
      (profsDb || []).forEach((p) => {
        mapaProfs.set(p.id, {
          profissional_id: p.id,
          nome: p.nome,
          foto_url: p.foto_url,
          total_atendimentos: 0,
          faturamento_gerado: 0,
          ticket_medio: 0,
          duracao_prevista_media_min: 0,
          duracao_real_media_min: 0,
          taxa_ocupacao_percentual: 0,
          servicos_mais_realizados: [],
        });
      });

      concluidos.forEach((a) => {
        if (!a.profissional_id) return;
        const item = mapaProfs.get(a.profissional_id);
        if (item) {
          item.total_atendimentos += 1;
          item.faturamento_gerado += Number(a.preco_total || 0);
        }
      });

      // Calcular ticket médio e consolidar lista
      const listaProfs: DesempenhoProfissionalItem[] = [];
      mapaProfs.forEach((item) => {
        item.faturamento_gerado = Number(item.faturamento_gerado.toFixed(2));
        item.ticket_medio = calcularTicketMedio(item.faturamento_gerado, item.total_atendimentos);
        listaProfs.push(item);
      });
      setRelatorioProfissionais(listaProfs);

      // 4. Desempenho de Marketing (Cupons e Influenciadores)
      const { data: cuponsDb } = await (supabase.from("cupons") as any)
        .select("*")
        .eq("barbearia_id", membro.barbearia_id);

      const { data: comissoesDb } = await (supabase.from("comissoes_influenciadores") as any)
        .select("*, influenciadores(nome, codigo_ref)")
        .eq("barbearia_id", membro.barbearia_id);

      const marketingItens: DesempenhoMarketingItem[] = [];

      (cuponsDb || []).forEach((c: any) => {
        marketingItens.push({
          tipo: "cupom",
          identificador: c.codigo,
          total_utilizacoes: c.usos_atuais || 0,
          faturamento_gerado: 0, // Estimativa agregada
          total_descontos_concedidos: 0,
        });
      });

      // Agrupar comissões por influenciador
      const mapaInf = new Map<string, DesempenhoMarketingItem>();
      (comissoesDb || []).forEach((com: any) => {
        const cod = com.influenciadores?.codigo_ref || "REF";
        const nome = com.influenciadores?.nome || "Influenciador";
        if (!mapaInf.has(cod)) {
          mapaInf.set(cod, {
            tipo: "influenciador",
            identificador: cod,
            nome_parceiro: nome,
            total_utilizacoes: 0,
            faturamento_gerado: 0,
            comissoes_geradas: 0,
            comissoes_pagas: 0,
          });
        }
        const item = mapaInf.get(cod)!;
        item.total_utilizacoes += 1;
        item.faturamento_gerado += Number(com.valor_servicos || 0);
        item.comissoes_geradas = (item.comissoes_geradas || 0) + Number(com.valor_comissao || 0);
        if (com.status === "paga") {
          item.comissoes_pagas = (item.comissoes_pagas || 0) + Number(com.valor_comissao || 0);
        }
      });

      mapaInf.forEach((v) => marketingItens.push(v));
      setRelatorioMarketing(marketingItens);
    } catch {
      setErro("Falha ao gerar relatórios consolidados.");
    } finally {
      setCarregando(false);
    }
  }, [dataInicio, dataFim, profissionalFiltro]);

  React.useEffect(() => {
    carregarRelatorios();
  }, [carregarRelatorios]);

  const formatarMoeda = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

  return (
    <div className="flex flex-col gap-8 pb-12">
      {erro && (
        <Alert variante="erro">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Relatórios & Inteligência</h1>
          <p className="text-sm opacity-70 mt-1">
            Métricas de faturamento, ticket médio, equipe e marketing da barbearia.
          </p>
        </div>

        <Link to="/painel">
          <Button variante="secundario" tamanho="sm" className="min-h-[44px]">
            Voltar ao Painel
          </Button>
        </Link>
      </div>

      {/* Barra de Filtros e Seletores de Período */}
      <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Período Rápido */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: "hoje", rotulo: "Hoje" },
                { id: "7d", rotulo: "Últimos 7 dias" },
                { id: "30d", rotulo: "Últimos 30 dias" },
                { id: "mes_atual", rotulo: "Mês Atual" },
                { id: "personalizado", rotulo: "Personalizado" },
              ] as const
            ).map((p) => (
              <Button
                key={p.id}
                type="button"
                variante={periodo === p.id ? "principal" : "secundario"}
                tamanho="sm"
                onClick={() => setPeriodo(p.id)}
                className="min-h-[44px] text-xs font-semibold px-3"
              >
                {p.rotulo}
              </Button>
            ))}
          </div>

          {/* Datas Customizadas e Filtro Profissional */}
          <div className="flex flex-wrap items-center gap-3">
            {periodo === "personalizado" && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="h-10 text-xs"
                />
                <span className="text-xs opacity-50">até</span>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="h-10 text-xs"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 opacity-50 shrink-0" />
              <select
                value={profissionalFiltro}
                onChange={(e) => setProfissionalFiltro(e.target.value)}
                className="h-10 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
              >
                <option value="todos">Todos os Profissionais</option>
                {profissionais.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navegação por Abas */}
      <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <button
          type="button"
          onClick={() => setAbaAtiva("geral")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors min-h-[44px] ${
            abaAtiva === "geral"
              ? "border-[#B45A2B] text-[#B45A2B]"
              : "border-transparent opacity-60 hover:opacity-100"
          }`}
        >
          <BarChart3 className="h-4 w-4" /> Visão Geral
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva("profissionais")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors min-h-[44px] ${
            abaAtiva === "profissionais"
              ? "border-[#B45A2B] text-[#B45A2B]"
              : "border-transparent opacity-60 hover:opacity-100"
          }`}
        >
          <Users className="h-4 w-4" /> Desempenho da Equipe
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva("marketing")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors min-h-[44px] ${
            abaAtiva === "marketing"
              ? "border-[#B45A2B] text-[#B45A2B]"
              : "border-transparent opacity-60 hover:opacity-100"
          }`}
        >
          <Tag className="h-4 w-4" /> Marketing & Cupons
        </button>
      </div>

      {carregando ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <LoadingSpinner tamanho="lg" className="text-[#B45A2B]" />
          <p className="text-sm opacity-70">Processando dados analíticos...</p>
        </div>
      ) : (
        <>
          {/* ABA 1: VISÃO GERAL */}
          {abaAtiva === "geral" && relatorioGeral && (
            <div className="flex flex-col gap-6">
              {/* KPIs Gerais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
                  <CardContent className="p-5 flex flex-col gap-1">
                    <span className="text-xs font-semibold opacity-70 uppercase tracking-wider">
                      Faturamento Total
                    </span>
                    <span className="text-2xl font-extrabold text-[#16A34A]">
                      {formatarMoeda(relatorioGeral.faturamento_total)}
                    </span>
                    <span className="text-xs opacity-60">
                      {relatorioGeral.concluidos} atendimentos concluídos
                    </span>
                  </CardContent>
                </Card>

                <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
                  <CardContent className="p-5 flex flex-col gap-1">
                    <span className="text-xs font-semibold opacity-70 uppercase tracking-wider">
                      Ticket Médio
                    </span>
                    <span className="text-2xl font-extrabold text-[#B45A2B]">
                      {formatarMoeda(relatorioGeral.ticket_medio)}
                    </span>
                    <span className="text-xs opacity-60">por atendimento concluído</span>
                  </CardContent>
                </Card>

                <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
                  <CardContent className="p-5 flex flex-col gap-1">
                    <span className="text-xs font-semibold opacity-70 uppercase tracking-wider">
                      Total Agendamentos
                    </span>
                    <span className="text-2xl font-extrabold">
                      {relatorioGeral.total_agendamentos}
                    </span>
                    <span className="text-xs opacity-60">
                      Taxa de conversão:{" "}
                      {relatorioGeral.total_agendamentos > 0
                        ? `${Math.round((relatorioGeral.concluidos / relatorioGeral.total_agendamentos) * 100)}%`
                        : "0%"}
                    </span>
                  </CardContent>
                </Card>

                <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
                  <CardContent className="p-5 flex flex-col gap-1">
                    <span className="text-xs font-semibold opacity-70 uppercase tracking-wider">
                      Cancelamentos / No-show
                    </span>
                    <span className="text-2xl font-extrabold text-[#DC2626]">
                      {relatorioGeral.cancelados + relatorioGeral.no_show}
                    </span>
                    <span className="text-xs opacity-60">
                      {relatorioGeral.cancelados} cancelados • {relatorioGeral.no_show} no-show
                    </span>
                  </CardContent>
                </Card>
              </div>

              {/* Comparativo de Duração Prevista x Real */}
              <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-5 w-5 text-[#B45A2B]" /> Eficiência Operacional — Tempo Médio
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row items-center justify-around gap-6 py-4">
                  <div className="flex flex-col items-center text-center">
                    <span className="text-xs opacity-60 uppercase font-semibold">
                      Duração Prevista Média
                    </span>
                    <span className="text-3xl font-extrabold text-blue-500 mt-1">
                      {relatorioGeral.duracao_prevista_media_min} min
                    </span>
                    <span className="text-xs opacity-50 mt-1">Configurado nos serviços</span>
                  </div>

                  <div className="h-12 w-px bg-neutral-200 dark:bg-neutral-800 hidden sm:block" />

                  <div className="flex flex-col items-center text-center">
                    <span className="text-xs opacity-60 uppercase font-semibold">
                      Duração Real Média
                    </span>
                    <span className="text-3xl font-extrabold text-[#B45A2B] mt-1">
                      {relatorioGeral.duracao_real_media_min > 0
                        ? `${relatorioGeral.duracao_real_media_min} min`
                        : "Sem dados reais"}
                    </span>
                    <span className="text-xs opacity-50 mt-1">Tempo na cadeira</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ABA 2: DESEMPENHO DA EQUIPE */}
          {abaAtiva === "profissionais" && (
            <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5 text-[#B45A2B]" /> Ranking de Produção da Equipe
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold opacity-70">
                      <tr>
                        <th className="p-4">Profissional</th>
                        <th className="p-4">Atendimentos</th>
                        <th className="p-4">Faturamento</th>
                        <th className="p-4">Ticket Médio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {relatorioProfissionais.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center opacity-60">
                            Nenhum profissional registrado com atendimentos no período.
                          </td>
                        </tr>
                      ) : (
                        relatorioProfissionais.map((p) => (
                          <tr key={p.profissional_id} className="hover:bg-neutral-500/5">
                            <td className="p-4 font-bold flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-[#B45A2B]/10 text-[#B45A2B] flex items-center justify-center font-bold">
                                {p.nome.slice(0, 2).toUpperCase()}
                              </div>
                              {p.nome}
                            </td>
                            <td className="p-4 font-semibold">{p.total_atendimentos}</td>
                            <td className="p-4 font-extrabold text-[#16A34A]">
                              {formatarMoeda(p.faturamento_gerado)}
                            </td>
                            <td className="p-4 font-medium text-[#B45A2B]">
                              {formatarMoeda(p.ticket_medio)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ABA 3: MARKETING & CUPONS */}
          {abaAtiva === "marketing" && (
            <div className="flex flex-col gap-6">
              <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tag className="h-5 w-5 text-[#B45A2B]" /> Desempenho de Cupons e Influenciadores
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold opacity-70">
                        <tr>
                          <th className="p-4">Tipo</th>
                          <th className="p-4">Código / Identificador</th>
                          <th className="p-4">Utilizações</th>
                          <th className="p-4">Faturamento Gerado</th>
                          <th className="p-4">Comissão / Desconto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                        {relatorioMarketing.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center opacity-60">
                              Nenhuma ação de marketing ativa com utilizações no período.
                            </td>
                          </tr>
                        ) : (
                          relatorioMarketing.map((m, idx) => (
                            <tr key={idx} className="hover:bg-neutral-500/5">
                              <td className="p-4">
                                <span
                                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                    m.tipo === "cupom"
                                      ? "bg-blue-500/10 text-blue-500"
                                      : "bg-purple-500/10 text-purple-500"
                                  }`}
                                >
                                  {m.tipo === "cupom" ? "Cupom" : "Influenciador"}
                                </span>
                              </td>
                              <td className="p-4 font-mono font-bold">
                                {m.identificador}
                                {m.nome_parceiro && (
                                  <span className="block font-sans text-xs opacity-60">
                                    {m.nome_parceiro}
                                  </span>
                                )}
                              </td>
                              <td className="p-4 font-semibold">{m.total_utilizacoes}</td>
                              <td className="p-4 font-extrabold text-[#16A34A]">
                                {formatarMoeda(m.faturamento_gerado)}
                              </td>
                              <td className="p-4 font-medium">
                                {m.comissoes_geradas !== undefined
                                  ? `Comissão: ${formatarMoeda(m.comissoes_geradas)}`
                                  : "Desconto Direto"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
