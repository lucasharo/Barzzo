
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
  Input,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { gerarLinkInfluenciador } from "@barzzo/dominio";
import { obterUrlBaseAppCliente } from "../../utils/url-cliente";
import { formatarData, traduzirErro } from "@barzzo/utilitarios";
import type {
  Influenciador,
  ComissaoInfluenciador,
  Barbearia,
} from "@barzzo/tipos";
import {
  TrendingUp,
  Share2,
  Copy,
  Check,
  DollarSign,
  MousePointerClick,
  Scissors,
  CheckCircle2,
  Clock,
  Award,
} from "lucide-react";

interface CupomBarzzo {
  codigo: string;
  status_aprovacao: "pendente" | "aprovado" | "rejeitado";
  ativo: boolean;
  desconto_primeiro: number | null;
  desconto_demais: number | null;
}

export default function PaginaPainelInfluenciador() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = React.useState(true);
  const [influenciador, setInfluenciador] = React.useState<Influenciador | null>(null);
  const [barbearia, setBarbearia] = React.useState<Barbearia | null>(null);
  const [comissoes, setComissoes] = React.useState<ComissaoInfluenciador[]>([]);
  const [copiado, setCopiado] = React.useState(false);
  const [codigoCupom, setCodigoCupom] = React.useState<string | null>(null);
  const [cupomBarzzo, setCupomBarzzo] = React.useState<CupomBarzzo | null>(null);
  const [novoCodigo, setNovoCodigo] = React.useState("");
  const [salvandoCodigo, setSalvandoCodigo] = React.useState(false);
  const [erroCodigo, setErroCodigo] = React.useState<string | null>(null);

  const [erro, setErro] = React.useState<string | null>(null);

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

      // Buscar perfil de influenciador vinculado a este usuário
      const { data: infDb, error: erroInf } = await (supabase.from("influenciadores") as any)
        .select(`
          *,
          barbearias (*)
        `)
        .eq("usuario_id", session.user.id)
        .eq("ativo", true)
        .maybeSingle();

      if (erroInf || !infDb) {
        // Tentar buscar por email se usuario_id ainda não foi associado
        const { data: infEmail } = await (supabase.from("influenciadores") as any)
          .select(`
            *,
            barbearias (*)
          `)
          .eq("email", session.user.email)
          .eq("ativo", true)
          .maybeSingle();

        if (!infEmail) {
          setErro("Nenhum cadastro de influenciador ativo encontrado para esta conta.");
          return;
        }

        // Vincular usuario_id
        await (supabase.from("influenciadores") as any)
          .update({ usuario_id: session.user.id })
          .eq("id", infEmail.id);

        setInfluenciador(infEmail as Influenciador);
        setBarbearia(infEmail.barbearias as Barbearia);
        await carregarComissoes(infEmail.id);
        await carregarCupom(infEmail.id, infEmail.barbearia_id);
        return;
      }

      setInfluenciador(infDb as Influenciador);
      setBarbearia(infDb.barbearias as Barbearia);
      await carregarComissoes(infDb.id);
      await carregarCupom(infDb.id, infDb.barbearia_id);
    } catch {
      setErro("Falha ao inicializar painel do influenciador.");
    } finally {
      setCarregando(false);
    }
  }

  // O link de divulgação usa o cupom ativo do influenciador (a RPC só devolve os do próprio cadastro).
  async function carregarCupom(infId: string, barbeariaId: string | null) {
    try {
      const supabase = criarClienteSupabaseBrowser();
      if (!barbeariaId) {
        // Influenciador do Barzzo: o cupom é global e depende da aprovação do Admin.
        const { data: meu } = await (supabase.rpc as any)("obter_meu_cupom_barzzo");
        setCupomBarzzo(meu && meu.length > 0 ? (meu[0] as CupomBarzzo) : null);
        return;
      }
      const { data } = await (supabase.rpc as any)("obter_cupons_do_influenciador", {
        p_influenciador_id: infId,
      });
      setCodigoCupom(data && data.length > 0 ? data[0].codigo : null);
    } catch {
      setCodigoCupom(null);
    }
  }

  async function carregarComissoes(infId: string) {
    try {
      const supabase = criarClienteSupabaseBrowser();
      const { data, error } = await (supabase.from("comissoes_influenciadores") as any)
        .select("*")
        .eq("influenciador_id", infId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setComissoes(data as ComissaoInfluenciador[]);
      }
    } catch {
      // Silencioso
    }
  }

  function copiarCodigo() {
    if (!cupomBarzzo) return;
    navigator.clipboard.writeText(cupomBarzzo.codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  async function trocarCodigo(evento: React.FormEvent) {
    evento.preventDefault();
    setErroCodigo(null);
    const codigo = novoCodigo.replace(/\s/g, "").toUpperCase();
    if (!/^[A-Z0-9]{4,20}$/.test(codigo)) {
      setErroCodigo("O cupom deve ter de 4 a 20 letras ou números, sem espaços ou símbolos.");
      return;
    }
    try {
      setSalvandoCodigo(true);
      const supabase = criarClienteSupabaseBrowser();
      const { error } = await (supabase.rpc as any)("alterar_cupom_influenciador_barzzo", { p_codigo: codigo });
      if (error) {
        setErroCodigo(traduzirErro(error, "Não foi possível alterar o cupom."));
        return;
      }
      setNovoCodigo("");
      if (influenciador) await carregarCupom(influenciador.id, null);
    } catch {
      setErroCodigo("Erro de conexão ao alterar o cupom.");
    } finally {
      setSalvandoCodigo(false);
    }
  }

  function copiarLink() {
    if (!barbearia || !influenciador || !codigoCupom) return;
    const link = gerarLinkInfluenciador(obterUrlBaseAppCliente(), barbearia.slug, codigoCupom);

    navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  if (carregando) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando painel de parceiro...</p>
      </div>
    );
  }

  if (erro && !influenciador) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <Card className="p-6 border-dashed border-2">
          <Award className="w-12 h-12 text-[#B45A2B] mx-auto mb-3" />
          <h2 className="text-lg font-bold mb-1">Acesso de Influenciador</h2>
          <p className="text-xs opacity-60 mb-6">
            Você ainda não possui um cadastro de parceiro/promotor ativo em nenhuma barbearia do Barzzo.
          </p>
          <div className="flex flex-col gap-2">
            <Link to="/influenciador/cadastro">
              <Button variante="principal" className="w-full min-h-[44px]">
                Ser influenciador do Barzzo
              </Button>
            </Link>
            <Link to="/painel">
              <Button variante="secundario" className="w-full min-h-[44px]">
                Ir para o Painel Geral
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!influenciador) return null;

  const global = !influenciador.barbearia_id;
  const linkDivulgacao = codigoCupom && barbearia
    ? gerarLinkInfluenciador(obterUrlBaseAppCliente(), barbearia.slug, codigoCupom)
    : null;

  const totalPendente = comissoes
    .filter((c) => c.status === "pendente")
    .reduce((acc, c) => acc + (c.valor_comissao || 0), 0);

  const totalRecebido = comissoes
    .filter((c) => c.status === "paga")
    .reduce((acc, c) => acc + (c.valor_comissao || 0), 0);

  const cortesConcluidos = comissoes.filter((c) => c.status === "paga" || c.status === "pendente").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#B45A2B]/10 text-[#B45A2B] uppercase tracking-wider">
              Portal do Parceiro
            </span>
            <span className="text-xs opacity-50">• {barbearia ? barbearia.nome : "Influenciador do Barzzo"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">
            Olá, {influenciador.nome}!
          </h1>
          <p className="text-sm opacity-70">
            Acompanhe o desempenho das suas divulgações e os repasses de comissão
          </p>
        </div>
      </div>

      {/* Cupom do influenciador do Barzzo */}
      {global && (
        <Card className="p-6 bg-gradient-to-br from-neutral-900 via-[#18181b] to-neutral-950 text-white border-[#B45A2B]/30 shadow-lg">
          {!cupomBarzzo ? (
            <p className="text-sm text-neutral-300">Seu cupom ainda não foi criado.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-[#B45A2B]" />
                    <h2 className="text-lg font-bold">Seu cupom</h2>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/50 border border-neutral-800 font-mono text-lg font-bold text-neutral-100 select-all">
                    {cupomBarzzo.codigo}
                  </div>
                  <span
                    className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                      cupomBarzzo.status_aprovacao === "aprovado" && cupomBarzzo.ativo
                        ? "bg-[#16A34A]/20 text-[#4ade80] border-[#16A34A]/40"
                        : cupomBarzzo.status_aprovacao === "rejeitado"
                        ? "bg-red-500/20 text-red-300 border-red-500/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    }`}
                  >
                    {cupomBarzzo.status_aprovacao === "pendente"
                      ? "Aguardando aprovação do Barzzo"
                      : cupomBarzzo.status_aprovacao === "rejeitado"
                      ? "Recusado: escolha outro cupom"
                      : cupomBarzzo.ativo
                      ? "Aprovado"
                      : "Desativado pelo Barzzo"}
                  </span>
                </div>

                <div className="shrink-0 flex flex-col gap-2">
                  <Button
                    onClick={copiarCodigo}
                    disabled={cupomBarzzo.status_aprovacao !== "aprovado" || !cupomBarzzo.ativo}
                    className="bg-[#B45A2B] hover:bg-[#C46632] text-white gap-2 min-h-[48px] px-6 text-sm font-bold shadow-md"
                  >
                    {copiado ? (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        Cupom copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copiar cupom
                      </>
                    )}
                  </Button>
                  <span className="text-[11px] text-center text-neutral-400">
                    Sua comissão:{" "}
                    <strong className="text-white">
                      {influenciador.tipo_comissao === "percentual"
                        ? `${influenciador.valor_comissao}%`
                        : influenciador.valor_comissao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </strong>{" "}
                    por atendimento
                  </span>
                </div>
              </div>

              <p className="text-xs text-neutral-300 leading-relaxed">
                Quem usar seu cupom ganha{" "}
                <strong className="text-white">{cupomBarzzo.desconto_primeiro ?? 15}%</strong> no primeiro atendimento e{" "}
                <strong className="text-white">{cupomBarzzo.desconto_demais ?? 5}%</strong> nos demais. O cupom vale nas
                barbearias parceiras que aceitaram os influenciadores do Barzzo, e a comissão é paga por elas depois que o
                atendimento é concluído.
              </p>

              {cupomBarzzo.status_aprovacao !== "aprovado" && (
                <form onSubmit={trocarCodigo} className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Input
                    value={novoCodigo}
                    onChange={(e) => setNovoCodigo(e.target.value.toUpperCase())}
                    placeholder="Trocar o cupom (4 a 20 letras ou números)"
                    maxLength={20}
                    className="font-mono uppercase"
                    disabled={salvandoCodigo}
                    aria-label="Novo cupom"
                  />
                  <Button type="submit" variante="secundario" className="min-h-[44px]" disabled={salvandoCodigo || !novoCodigo}>
                    {salvandoCodigo ? "Enviando..." : "Trocar e reenviar"}
                  </Button>
                </form>
              )}
              {erroCodigo && (
                <Alert variante="erro">
                  <AlertDescription>{erroCodigo}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Card de Divulgação */}
      {!global && (
      <Card className="p-6 bg-gradient-to-br from-neutral-900 via-[#18181b] to-neutral-950 text-white border-[#B45A2B]/30 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-[#B45A2B]" />
              <h2 className="text-lg font-bold">Seu Link de Divulgação</h2>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Compartilhe nas suas redes sociais, bio do Instagram e grupos de WhatsApp. Toda reserva concluída que utilizar seu link gera comissão automática!
            </p>
            <div className="p-2.5 rounded-xl bg-black/50 border border-neutral-800 font-mono text-xs text-neutral-200 select-all truncate">
              {linkDivulgacao ?? "Seu cupom de divulgação ainda não foi criado. Peça à barbearia para criar um cupom ativo para você."}
            </div>
          </div>

          <div className="shrink-0 flex flex-col gap-2">
            <Button
              onClick={copiarLink}
              disabled={!linkDivulgacao}
              className="bg-[#B45A2B] hover:bg-[#C46632] text-white gap-2 min-h-[48px] px-6 text-sm font-bold shadow-md"
            >
              {copiado ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  Link Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar Meu Link
                </>
              )}
            </Button>
            <span className="text-[11px] text-center text-neutral-400">
              Sua taxa:{" "}
              <strong className="text-white">
                {influenciador.tipo_comissao === "percentual"
                  ? `${influenciador.valor_comissao}%`
                  : influenciador.valor_comissao.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
              </strong>{" "}
              por corte
            </span>
          </div>
        </div>
      </Card>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-neutral-200 dark:border-neutral-800">
          <span className="text-xs opacity-60 block font-medium">Cliques no Link</span>
          <span className="text-2xl font-black text-neutral-900 dark:text-neutral-100 block mt-1">
            {influenciador.cliques_rastreados}
          </span>
          <span className="text-[11px] opacity-50 block mt-0.5">acessos únicos</span>
        </Card>

        <Card className="p-4 border-neutral-200 dark:border-neutral-800">
          <span className="text-xs opacity-60 block font-medium">Cortes Concluídos</span>
          <span className="text-2xl font-black text-neutral-900 dark:text-neutral-100 block mt-1">
            {cortesConcluidos}
          </span>
          <span className="text-[11px] opacity-50 block mt-0.5">clientes atendidos</span>
        </Card>

        <Card className="p-4 border-neutral-200 dark:border-neutral-800">
          <span className="text-xs opacity-60 block font-medium">A Receber (Pendente)</span>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400 block mt-1">
            {totalPendente.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </span>
          <span className="text-[11px] opacity-50 block mt-0.5">aguardando repasse</span>
        </Card>

        <Card className="p-4 border-neutral-200 dark:border-neutral-800">
          <span className="text-xs opacity-60 block font-medium">Total Já Recebido</span>
          <span className="text-2xl font-black text-[#16A34A] block mt-1">
            {totalRecebido.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </span>
          <span className="text-[11px] opacity-50 block mt-0.5">pago pela barbearia</span>
        </Card>
      </div>

      {/* Extrato de Comissões do Influenciador */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold">Histórico de Comissões</h2>

        {comissoes.length === 0 ? (
          <Card className="text-center py-12 px-4 border-dashed border-2">
            <TrendingUp className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
            <p className="text-xs opacity-60">
              Nenhuma comissão registrada ainda. Assim que seus seguidores concluírem agendamentos, os valores aparecerão aqui.
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden border-neutral-200 dark:border-neutral-800">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Valor do Serviço</th>
                    <th className="py-3 px-4">Sua Comissão</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Acerto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {comissoes.map((com) => {
                    const dataFormatada = formatarData(com.created_at);

                    return (
                      <tr key={com.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50">
                        <td className="py-3 px-4 font-medium">{dataFormatada}</td>
                        <td className="py-3 px-4">
                          {com.valor_servicos.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                        <td className="py-3 px-4 font-bold text-[#B45A2B]">
                          {com.valor_comissao.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              com.status === "paga"
                                ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20"
                                : com.status === "pendente"
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                : "bg-neutral-200 text-neutral-500"
                            }`}
                          >
                            {com.status === "paga"
                              ? "Paga"
                              : com.status === "pendente"
                              ? "Pendente"
                              : "Cancelada"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right opacity-60">
                          {com.paga_em
                            ? `Acertado em ${formatarData(com.paga_em)}`
                            : "Aguardando repasse da barbearia"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
