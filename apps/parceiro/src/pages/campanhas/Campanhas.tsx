
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
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
import type { Campanha, Cupom } from "@barzzo/tipos";
import {
  Tag,
  Plus,
  Percent,
  Calendar,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  DollarSign,
  Edit2,
  Eye,
  EyeOff,
} from "lucide-react";

interface CampanhaComCupons extends Campanha {
  cupons?: Cupom[];
}

export default function PaginaCampanhasParceiro() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = React.useState(true);
  const [barbeariaId, setBarbeariaId] = React.useState<string | null>(null);
  const [campanhas, setCampanhas] = React.useState<CampanhaComCupons[]>([]);
  const [cuponsAvulsos, setCuponsAvulsos] = React.useState<Cupom[]>([]);

  const [erro, setErro] = React.useState<string | null>(null);
  const [sucesso, setSucesso] = React.useState<string | null>(null);

  React.useEffect(() => {
    inicializar();
  }, []);

  async function inicializar() {
    try {
      setCarregando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/entrar");
        return;
      }

      const { data: membro, error: erroMembro } = await (supabase.from("membros_equipe") as any)
        .select("barbearia_id")
        .eq("usuario_id", session.user.id)
        .eq("ativo", true)
        .limit(1)
        .single();

      if (erroMembro || !membro) {
        setErro("Você não possui vínculo ativo com nenhuma barbearia.");
        return;
      }

      setBarbeariaId(membro.barbearia_id);
      await carregarDados(membro.barbearia_id);
    } catch {
      setErro("Falha ao inicializar campanhas.");
    } finally {
      setCarregando(false);
    }
  }

  async function carregarDados(bId: string) {
    try {
      const supabase = criarClienteSupabaseBrowser();

      // 1. Buscar campanhas
      const { data: campDb, error: erroCamp } = await (supabase.from("campanhas") as any)
        .select("*")
        .eq("barbearia_id", bId)
        .order("created_at", { ascending: false });

      if (erroCamp) {
        setErro("Não foi possível carregar as campanhas.");
        return;
      }

      // 2. Buscar cupons
      const { data: cupDb, error: erroCup } = await (supabase.from("cupons") as any)
        .select("*")
        .eq("barbearia_id", bId)
        .order("created_at", { ascending: false });

      if (erroCup) {
        setErro("Não foi possível carregar os cupons.");
        return;
      }

      const listaCampanhas = (campDb || []) as Campanha[];
      const listaCupons = (cupDb || []) as Cupom[];

      // Agrupar cupons nas campanhas correspondentes
      const campanhasFormatadas: CampanhaComCupons[] = listaCampanhas.map((camp) => ({
        ...camp,
        cupons: listaCupons.filter((cup) => cup.campanha_id === camp.id),
      }));

      const avulsos = listaCupons.filter((cup) => !cup.campanha_id);

      setCampanhas(campanhasFormatadas);
      setCuponsAvulsos(avulsos);
    } catch {
      setErro("Erro de comunicação ao carregar campanhas e cupons.");
    }
  }

  async function alternarStatusCupom(cupom: Cupom) {
    try {
      const novoStatus = !cupom.ativo;
      const supabase = criarClienteSupabaseBrowser();

      const { error } = await (supabase.from("cupons") as any)
        .update({ ativo: novoStatus, updated_at: new Date().toISOString() })
        .eq("id", cupom.id);

      if (error) {
        setErro("Não foi possível alterar status do cupom.");
        return;
      }

      setSucesso(
        novoStatus
          ? `Cupom ${cupom.codigo} ativado com sucesso!`
          : `Cupom ${cupom.codigo} desativado.`
      );

      if (barbeariaId) await carregarDados(barbeariaId);
    } catch {
      setErro("Erro ao atualizar cupom.");
    }
  }

  // Totais consolidados
  const todosOsCupons = [
    ...campanhas.flatMap((c) => c.cupons || []),
    ...cuponsAvulsos,
  ];
  const totalUsos = todosOsCupons.reduce((acc, c) => acc + (c.usos_atuais || 0), 0);
  const cuponsAtivos = todosOsCupons.filter((c) => c.ativo).length;

  if (carregando) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando promoções e cupons...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5">
            <Tag className="w-7 h-7 text-[#B45A2B]" />
            Campanhas e Cupons
          </h1>
          <p className="text-sm opacity-70 mt-1">
            Crie promoções, cupons de primeira reserva e campanhas sazonais de desconto
          </p>
        </div>

        <Link to="/campanhas/novo">
          <Button className="bg-[#B45A2B] hover:bg-[#C46632] text-white gap-2 min-h-[44px]">
            <Plus className="w-4 h-4" />
            Nova Campanha / Cupom
          </Button>
        </Link>
      </div>

      {erro && (
        <Alert variante="erro">
          <AlertCircle className="w-4 h-4 mr-2" />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {sucesso && (
        <Alert variante="sucesso">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          <AlertDescription>{sucesso}</AlertDescription>
        </Alert>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-neutral-200 dark:border-neutral-800">
          <span className="text-xs opacity-60 block font-medium">Cupons Ativos</span>
          <span className="text-2xl font-black text-neutral-900 dark:text-neutral-100 block mt-1">
            {cuponsAtivos}
          </span>
          <span className="text-[11px] opacity-50 block mt-0.5">
            de {todosOsCupons.length} cadastrados
          </span>
        </Card>

        <Card className="p-4 border-neutral-200 dark:border-neutral-800">
          <span className="text-xs opacity-60 block font-medium">Total de Utilizações</span>
          <span className="text-2xl font-black text-[#B45A2B] block mt-1">
            {totalUsos}
          </span>
          <span className="text-[11px] opacity-50 block mt-0.5">
            resgates em reservas confirmadas
          </span>
        </Card>

        <Card className="p-4 border-neutral-200 dark:border-neutral-800">
          <span className="text-xs opacity-60 block font-medium">Campanhas Estruturadas</span>
          <span className="text-2xl font-black text-neutral-900 dark:text-neutral-100 block mt-1">
            {campanhas.length}
          </span>
          <span className="text-[11px] opacity-50 block mt-0.5">
            ações promocionais registradas
          </span>
        </Card>
      </div>

      {/* Listagem */}
      {todosOsCupons.length === 0 && campanhas.length === 0 ? (
        <Card className="text-center py-16 px-4 border-dashed border-2 border-neutral-200 dark:border-neutral-800">
          <div className="w-12 h-12 rounded-full bg-[#B45A2B]/10 text-[#B45A2B] flex items-center justify-center mx-auto mb-3">
            <Percent className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold mb-1">Nenhuma campanha cadastrada</h3>
          <p className="text-xs opacity-60 max-w-sm mx-auto mb-5">
            Crie cupons de primeira reserva (ex: PRIMEIRA15) ou descontos fixos para estimular agendamentos no início da semana.
          </p>
          <Link to="/campanhas/novo">
            <Button className="bg-[#B45A2B] hover:bg-[#C46632] text-white min-h-[44px]">
              <Plus className="w-4 h-4 mr-1.5" />
              Criar Primeiro Cupom
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Cupons e Campanhas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todosOsCupons.map((cupom) => {
              const expirado = new Date(cupom.data_fim).getTime() < Date.now();
              const limiteAtingido =
                cupom.limite_usos_total !== null &&
                cupom.usos_atuais >= cupom.limite_usos_total;

              return (
                <Card
                  key={cupom.id}
                  className={`p-5 flex flex-col justify-between hover:border-[#B45A2B]/40 transition-colors ${
                    !cupom.ativo || expirado || limiteAtingido
                      ? "opacity-60 bg-neutral-50/50 dark:bg-neutral-900/40"
                      : ""
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header do Card */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-base font-black px-2.5 py-1 rounded-lg bg-[#B45A2B]/10 text-[#B45A2B] tracking-wider border border-[#B45A2B]/20">
                        {cupom.codigo}
                      </span>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          expirado
                            ? "bg-red-500/10 text-red-600 border-red-500/20"
                            : limiteAtingido
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            : cupom.ativo
                            ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20"
                            : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500"
                        }`}
                      >
                        {expirado
                          ? "Expirado"
                          : limiteAtingido
                          ? "Esgotado"
                          : cupom.ativo
                          ? "Ativo"
                          : "Inativo"}
                      </span>
                    </div>

                    {/* Descrição e Valor */}
                    <div>
                      <div className="text-xl font-extrabold text-neutral-900 dark:text-neutral-100 flex items-baseline gap-1">
                        {cupom.tipo_desconto === "percentual" ? (
                          <>
                            <span>{cupom.valor_desconto}%</span>
                            <span className="text-xs font-normal opacity-60">de desconto</span>
                          </>
                        ) : (
                          <>
                            <span>
                              {cupom.valor_desconto.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </span>
                            <span className="text-xs font-normal opacity-60">de desconto</span>
                          </>
                        )}
                      </div>

                      {cupom.descricao && (
                        <p className="text-xs opacity-70 mt-1 line-clamp-2">
                          {cupom.descricao}
                        </p>
                      )}
                    </div>

                    {/* Detalhes e Regras */}
                    <div className="text-[11px] opacity-75 space-y-1 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                      {cupom.apenas_primeira_reserva && (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Apenas 1ª reserva
                        </span>
                      )}

                      {cupom.valor_minimo_reserva > 0 && (
                        <p>
                          Mínimo:{" "}
                          {cupom.valor_minimo_reserva.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </p>
                      )}

                      <p className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-[#B45A2B]" />
                        {cupom.usos_atuais} {cupom.usos_atuais === 1 ? "uso" : "usos"}
                        {cupom.limite_usos_total ? ` / máx ${cupom.limite_usos_total}` : " (sem limite)"}
                      </p>

                      <p className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#B45A2B]" />
                        Até {new Date(cupom.data_fim).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="pt-3 mt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => alternarStatusCupom(cupom)}
                      className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                      aria-label={cupom.ativo ? "Desativar cupom" : "Ativar cupom"}
                    >
                      {cupom.ativo ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>

                    <Link to={`/campanhas/${cupom.id}`}>
                      <Button
                        variante="secundario"
                        tamanho="sm"
                        className="text-xs min-h-[36px] gap-1 font-semibold"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Editar
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
