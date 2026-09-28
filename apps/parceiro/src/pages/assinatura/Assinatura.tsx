
import * as React from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Alert,
  AlertaTemporizado,
  AlertDescription,
  LoadingSpinner,
  Modal,
  Input,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import type { Barbearia, Plano, Assinatura, CicloAssinatura } from "@barzzo/tipos";
import { calcularEconomiaSemestral } from "@barzzo/dominio";
import { traduzirErro } from "@barzzo/utilitarios";
import {
  CreditCard,
  Check,
  Zap,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Users,
  Store,
  RefreshCw,
  Plus,
  Trash2,
  Lock,
} from "lucide-react";

export default function PaginaAssinaturaParceiro() {
  const [carregando, setCarregando] = React.useState(true);
  const [barbearia, setBarbearia] = React.useState<Barbearia | null>(null);
  const [planos, setPlanos] = React.useState<Plano[]>([]);
  const [assinaturaAtual, setAssinaturaAtual] = React.useState<Assinatura | null>(null);
  const [ciclo, setCiclo] = React.useState<CicloAssinatura>("semestral");
  const [planoSelecionadoId, setPlanoSelecionadoId] = React.useState<string | null>(null);
  const [processandoCheckout, setProcessandoCheckout] = React.useState(false);
  const [sucesso, setSucesso] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);

  // Estado para Tokenização de Cartão e Renovação Automática
  const [modalCartaoAberto, setModalCartaoAberto] = React.useState(false);
  const [titularCartao, setTitularCartao] = React.useState("");
  const [numeroCartao, setNumeroCartao] = React.useState("");
  const [mesVencimento, setMesVencimento] = React.useState("");
  const [anoVencimento, setAnoVencimento] = React.useState("");
  const [cvv, setCvv] = React.useState("");
  const [cpfCartao, setCpfCartao] = React.useState("");
  const [salvandoCartao, setSalvandoCartao] = React.useState(false);

  async function lidarComSalvarCartao(e: React.FormEvent) {
    e.preventDefault();
    if (!barbearia) return;

    const publicKey = (import.meta as any).env?.VITE_MERCADO_PAGO_PUBLIC_KEY || "APP_USR-4d05f3e1-8622-43d8-9b71-e459059ef49f";
    const numLimpo = numeroCartao.replace(/\D/g, "");
    const cpfLimpo = cpfCartao.replace(/\D/g, "");

    if (numLimpo.length < 13 || !mesVencimento || !anoVencimento || !cvv || cpfLimpo.length < 11) {
      setErro("Preencha todos os campos do cartão de crédito com dados válidos.");
      return;
    }

    try {
      setSalvandoCartao(true);
      setErro(null);
      setSucesso(null);

      // 1. Tokenizar dados do cartão diretamente com o cofre seguro do Mercado Pago
      const respToken = await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${publicKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_number: numLimpo,
          expiration_month: Number(mesVencimento),
          expiration_year: Number(anoVencimento.length === 2 ? `20${anoVencimento}` : anoVencimento),
          security_code: cvv,
          cardholder: {
            name: titularCartao.toUpperCase(),
            identification: {
              type: "CPF",
              number: cpfLimpo,
            },
          },
        }),
      });

      const tokenData = await respToken.json();

      if (!respToken.ok) {
        throw new Error(tokenData.message || tokenData.cause?.[0]?.description || "Falha ao validar e tokenizar o cartão no Mercado Pago.");
      }

      // 2. Chamar o backend serverless /api/salvar-cartao
      const respSalvar = await fetch("/api/salvar-cartao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barbearia_id: barbearia.id,
          card_token: tokenData.id,
          email: barbearia.email,
          last_four: tokenData.last_four_digits,
          brand: tokenData.payment_method?.id || "master",
        }),
      });

      const salvarData = await respSalvar.json();

      if (!respSalvar.ok) {
        throw new Error(salvarData.error || "Erro ao salvar cartão para renovação automática.");
      }

      setSucesso("Cartão tokenizado e salvo com sucesso! A renovação automática foi ativada.");
      setModalCartaoAberto(false);
      setTitularCartao("");
      setNumeroCartao("");
      setMesVencimento("");
      setAnoVencimento("");
      setCvv("");
      setCpfCartao("");
      await carregarDados();
    } catch (err: any) {
      setErro(traduzirErro(err, "Não foi possível cadastrar o cartão de renovação."));
    } finally {
      setSalvandoCartao(false);
    }
  }

  async function lidarComRemoverCartao() {
    if (!barbearia) return;

    try {
      setCarregando(true);
      setErro(null);
      setSucesso(null);

      const resp = await fetch("/api/remover-cartao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barbearia_id: barbearia.id }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Erro ao desativar renovação automática.");
      }

      setSucesso("Cartão removido. A renovação automática foi desativada.");
      await carregarDados();
    } catch (err: any) {
      setErro(traduzirErro(err, "Falha ao remover o cartão de renovação."));
    } finally {
      setCarregando(false);
    }
  }

  const carregarDados = React.useCallback(async () => {
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

      // 2. Carregar planos ativos ordenados
      const { data: planosDb } = await (supabase.from("planos") as any)
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });

      if (planosDb && planosDb.length > 0) {
        setPlanos(planosDb as Plano[]);
        setPlanoSelecionadoId(planosDb[1]?.id || planosDb[0].id); // Pro ou Solo como default
      }

      // 3. Carregar assinatura atual se existir
      const { data: assDb } = await (supabase.from("assinaturas") as any)
        .select("*, planos(*)")
        .eq("barbearia_id", membro.barbearia_id)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (assDb) {
        setAssinaturaAtual(assDb as Assinatura);
      }
    } catch {
      setErro("Falha ao carregar opções de assinatura.");
    } finally {
      setCarregando(false);
    }
  }, []);

  React.useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Trata o retorno do checkout do Mercado Pago via URL
  React.useEffect(() => {
    async function checarRetornoPagamento() {
      const queryParams = new URLSearchParams(window.location.search);
      const statusUrl = queryParams.get("status") || queryParams.get("collection_status");
      const paymentIdUrl = queryParams.get("payment_id") || queryParams.get("collection_id");
      const extRefStr = queryParams.get("external_reference");

      let planoIdUrl = queryParams.get("plano");
      let cicloUrl = (queryParams.get("ciclo") as CicloAssinatura | null) || "mensal";

      if (extRefStr) {
        try {
          const parsed = JSON.parse(extRefStr);
          if (parsed.plano_id) planoIdUrl = parsed.plano_id;
          if (parsed.ciclo) cicloUrl = parsed.ciclo;
        } catch {
          // Mantém valores da query
        }
      }

      if ((statusUrl === "sucesso" || statusUrl === "approved") && barbearia && planoIdUrl) {
        try {
          // Reconciliação segura server-side
          const resp = await fetch(
            `/api/verificar-assinatura?barbearia_id=${barbearia.id}&plano_id=${planoIdUrl}&ciclo=${cicloUrl}&payment_id=${paymentIdUrl || ""}`
          );
          if (resp.ok) {
            setSucesso("Pagamento via Mercado Pago processado com sucesso! Sua assinatura foi ativada.");
          } else {
            setSucesso("Solicitação de assinatura recebida! Aguardando confirmação final do Mercado Pago.");
          }
          window.history.replaceState({}, "", window.location.pathname);
          await carregarDados();
        } catch {
          setErro("Falha ao sincronizar assinatura após o pagamento.");
        }
      } else if (statusUrl === "falha" || statusUrl === "rejected" || statusUrl === "cancelled") {
        setErro("O pagamento da assinatura não foi concluído no Mercado Pago. Tente novamente.");
        window.history.replaceState({}, "", window.location.pathname);
      } else if (statusUrl === "pending" || statusUrl === "in_process") {
        setSucesso("Pagamento em processamento pelo Mercado Pago. A assinatura será ativada assim que for confirmado.");
        window.history.replaceState({}, "", window.location.pathname);
        await carregarDados();
      }
    }

    if (barbearia) {
      checarRetornoPagamento();
    }
  }, [barbearia, carregarDados]);

  // Redireciona o usuário para a página de checkout oficial do Mercado Pago para pagamento de assinatura
  async function handleContratarPlano(plano: Plano) {
    if (!barbearia) return;

    try {
      setProcessandoCheckout(true);
      setErro(null);
      setSucesso(null);

      const valorFinal = ciclo === "semestral" ? plano.preco_semestral : plano.preco_mensal;

      // 1. Chamada obrigatória à rota backend serverless /api/criar-preferencia
      const resp = await fetch("/api/criar-preferencia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plano_nome: plano.nome,
          valor: valorFinal,
          barbearia_id: barbearia.id,
          plano_id: plano.id,
          ciclo: ciclo,
          email: barbearia.email,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Erro ao conectar com o serviço de pagamentos do Mercado Pago.");
      }

      const data = await resp.json();
      if (data.init_url) {
        window.location.href = data.init_url;
        return;
      }

      throw new Error("Não foi possível obter o link de checkout do Mercado Pago.");
    } catch (err: any) {
      setErro(traduzirErro(err, "Não foi possível abrir o checkout do Mercado Pago. Tente novamente."));
    } finally {
      setProcessandoCheckout(false);
    }
  }

  const formatarMoeda = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

  const calcularDiasRestantes = (dataFim: string) => {
    const diff = new Date(dataFim).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (carregando) {
    return (
      <div className="flex-1 max-w-xl mx-auto py-20 flex flex-col items-center justify-center gap-3">
        <LoadingSpinner tamanho="lg" className="text-[#B45A2B]" />
        <p className="text-sm opacity-70">Carregando planos e assinatura...</p>
      </div>
    );
  }

  if (!barbearia) {
    return (
      <div className="flex-1 max-w-md mx-auto py-16 flex flex-col items-center text-center gap-6">
        <Store className="h-12 w-12 text-[#B45A2B]" />
        <h1 className="text-2xl font-bold">Nenhuma Barbearia Encontrada</h1>
        <p className="text-sm opacity-70">
          Você precisa criar uma barbearia para gerenciar planos de assinatura.
        </p>
        <Link to="/onboarding">
          <Button variante="principal" tamanho="lg">
            Iniciar Onboarding
          </Button>
        </Link>
      </div>
    );
  }

  const emTrial = barbearia.status_assinatura === "trial";
  const ativa = barbearia.status_assinatura === "ativa" || barbearia.status_assinatura === "ativo";
  const diasRestantesTrial = calcularDiasRestantes(barbearia.trial_fim);

  return (
    <div className="flex flex-col gap-8 pb-12 max-w-5xl mx-auto">
      {erro && (
        <AlertaTemporizado variante="erro" duracaoMs={6000} aoExpirar={() => setErro(null)}>
          <AlertDescription>{erro}</AlertDescription>
        </AlertaTemporizado>
      )}

      {sucesso && (
        <AlertaTemporizado variante="sucesso" duracaoMs={5000} aoExpirar={() => setSucesso(null)}>
          <AlertDescription>{sucesso}</AlertDescription>
        </AlertaTemporizado>
      )}

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Planos & Assinatura</h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                ativa
                  ? "bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20"
                  : emTrial
                  ? "bg-[#B45A2B]/10 text-[#B45A2B] border border-[#B45A2B]/20"
                  : "bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/20"
              }`}
            >
              {ativa ? "Assinatura Ativa" : emTrial ? "Período de Testes" : "Vencida"}
            </span>
          </div>
          <p className="text-sm opacity-70 mt-1">
            Escolha o plano ideal para a capacidade da sua equipe com pagamento seguro via Mercado Pago (Cartão de Crédito ou Pix, sem necessidade de ter conta).
          </p>
        </div>

        {/* Card Resumo do Status Atual */}
        <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex items-center gap-3">
          <Clock className="h-5 w-5 text-[#B45A2B]" />
          <div className="text-xs">
            {emTrial ? (
              <>
                <strong className="block font-bold text-sm">
                  {diasRestantesTrial} dia(s) restantes de teste
                </strong>
                <span>Válido até {new Date(barbearia.trial_fim).toLocaleDateString("pt-BR")}</span>
              </>
            ) : ativa && assinaturaAtual ? (
              <>
                <strong className="block font-bold text-sm">
                  {assinaturaAtual.planos?.nome || "Plano Ativo"}
                </strong>
                <span>Renova em {new Date(assinaturaAtual.data_fim).toLocaleDateString("pt-BR")}</span>
              </>
            ) : (
              <>
                <strong className="block font-bold text-sm text-[#DC2626]">
                  Período de Teste Expirado
                </strong>
                <span>Contrate um plano abaixo para manter acesso total</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Alternador de Ciclo: Mensal vs Semestral */}
      <div className="flex flex-col items-center justify-center gap-3 py-2">
        <div className="p-1 rounded-xl bg-neutral-200 dark:bg-neutral-800 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCiclo("mensal")}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all min-h-[44px] ${
              ciclo === "mensal"
                ? "bg-white dark:bg-neutral-900 text-black dark:text-white shadow-sm"
                : "opacity-60 hover:opacity-100"
            }`}
          >
            Faturamento Mensal
          </button>
          <button
            type="button"
            onClick={() => setCiclo("semestral")}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all min-h-[44px] flex items-center gap-1.5 ${
              ciclo === "semestral"
                ? "bg-[#B45A2B] text-white shadow-sm"
                : "opacity-60 hover:opacity-100"
            }`}
          >
            Faturamento Semestral
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 uppercase font-black">
              Economize
            </span>
          </button>
        </div>
        <span className="text-xs opacity-60">
          {ciclo === "semestral"
            ? "Pagamento único a cada 6 meses com até 17% de desconto equivalente"
            : "Cobrança mensal sem fidelidade"}
        </span>
      </div>

      {/* Grade de Planos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {planos.map((plano) => {
          const ehPlanoAtual =
            (ativa && assinaturaAtual?.plano_id === plano.id) ||
            (emTrial && plano.identificador === "pro");
          const preco = ciclo === "semestral" ? plano.preco_semestral : plano.preco_mensal;
          const precoMesEquivalente =
            ciclo === "semestral" ? Number((plano.preco_semestral / 6).toFixed(2)) : plano.preco_mensal;

          return (
            <Card
              key={plano.id}
              className={`border relative flex flex-col justify-between transition-all ${
                ehPlanoAtual
                  ? "border-[#B45A2B] shadow-md ring-1 ring-[#B45A2B]"
                  : "border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
              }`}
            >
              {ehPlanoAtual && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#B45A2B] text-white text-[10px] font-black uppercase tracking-wider shadow">
                  Plano Atual
                </div>
              )}

              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold">{plano.nome}</CardTitle>
                <CardDescription className="text-xs min-h-[36px]">
                  {plano.descricao}
                </CardDescription>

                <div className="mt-4 flex flex-col gap-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-[#B45A2B]">
                      {formatarMoeda(precoMesEquivalente)}
                    </span>
                    <span className="text-xs opacity-60">/mês</span>
                  </div>

                  {ciclo === "semestral" && (
                    <span className="text-[11px] opacity-60">
                      Total: {formatarMoeda(preco)} por 6 meses
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col justify-between gap-6 pt-0">
                <div className="flex flex-col gap-2.5 pt-4 border-t border-neutral-200/80 dark:border-neutral-800">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <Users className="h-4 w-4 text-[#B45A2B] shrink-0" />
                    <span>
                      {plano.limite_profissionais === null
                        ? "Profissionais Ilimitados"
                        : `Até ${plano.limite_profissionais} profissional(is)`}
                    </span>
                  </div>

                  {plano.recursos?.map((rec, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs opacity-80">
                      <Check className="h-4 w-4 text-[#16A34A] shrink-0" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>

                <Button
                  variante={ehPlanoAtual ? "secundario" : "principal"}
                  disabled={processandoCheckout}
                  carregando={processandoCheckout && planoSelecionadoId === plano.id}
                  onClick={() => {
                    setPlanoSelecionadoId(plano.id);
                    handleContratarPlano(plano);
                  }}
                  className="w-full font-bold text-xs min-h-[44px]"
                >
                  <CreditCard className="mr-1.5 h-4 w-4" />
                  {ehPlanoAtual ? "Renovar / Atualizar" : "Assinar com Cartão ou Pix"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Selo de Garantia e Não Intermediação */}
      <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex flex-col sm:flex-row items-center gap-4 text-xs opacity-75">
        <ShieldCheck className="h-6 w-6 text-[#16A34A] shrink-0" />
        <div className="flex-1">
          <strong className="block font-semibold mb-0.5">Segurança & Política Transparente</strong>
          O pagamento via Mercado Pago aplica-se exclusivamente à assinatura mensal/semestral do software Barzzo. O valor dos cortes e serviços prestados aos seus clientes não sofre retenções nem taxas adicionais pelo app.
        </div>
      </div>

      {/* Seção de Renovação Automática com Cartão de Crédito */}
      <Card className="border border-neutral-200/80 dark:border-neutral-800 overflow-hidden">
        <CardHeader className="bg-neutral-50/50 dark:bg-neutral-900/30 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-[#B45A2B]" />
              <CardTitle className="text-base font-bold">Renovação Automática de Assinatura</CardTitle>
            </div>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                barbearia.recorrencia_ativa
                  ? "bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20"
                  : "bg-neutral-200/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
              }`}
            >
              {barbearia.recorrencia_ativa ? "Ativada" : "Desativada"}
            </span>
          </div>
          <CardDescription className="text-xs mt-1">
            Cadastre seu cartão de crédito com criptografia de ponta a ponta via Mercado Pago para garantir o acesso ininterrupto do seu estabelecimento sem precisar refazer checkout manual.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {barbearia.recorrencia_ativa && barbearia.mercado_pago_card_last_four ? (
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-[#B45A2B]">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <strong className="block text-sm font-bold capitalize">
                  {barbearia.mercado_pago_card_brand || "Cartão"} final {barbearia.mercado_pago_card_last_four}
                </strong>
                <span className="text-xs opacity-70">
                  Cobrança automática ao término do período da assinatura atual.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <strong className="block text-sm font-bold">Nenhum cartão para renovação cadastrado</strong>
                <span className="text-xs opacity-70">
                  Evite bloqueios no seu sistema mantendo um cartão seguro ativo.
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {barbearia.recorrencia_ativa ? (
              <Button
                variante="cancelar-destrutivo"
                tamanho="sm"
                onClick={lidarComRemoverCartao}
                className="w-full sm:w-auto font-semibold text-xs"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Desativar Renovação
              </Button>
            ) : (
              <Button
                variante="principal"
                tamanho="sm"
                onClick={() => setModalCartaoAberto(true)}
                className="w-full sm:w-auto font-bold text-xs"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Cadastrar Cartão
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal para Tokenização de Cartão de Crédito */}
      <Modal
        aberto={modalCartaoAberto}
        aoFechar={() => setModalCartaoAberto(false)}
        titulo="Cadastrar Cartão para Renovação"
        descricao="Seus dados de cartão são tokenizados diretamente no cofre seguro do Mercado Pago."
        tamanho="md"
      >
        <form onSubmit={lidarComSalvarCartao} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold mb-1">Nome Impresso no Cartão</label>
            <Input
              type="text"
              placeholder="NOME COMO ESTA NO CARTAO"
              value={titularCartao}
              onChange={(e) => setTitularCartao(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">Número do Cartão</label>
            <Input
              type="text"
              placeholder="0000 0000 0000 0000"
              maxLength={19}
              value={numeroCartao}
              onChange={(e) => setNumeroCartao(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1">Mês (MM)</label>
              <Input
                type="text"
                placeholder="12"
                maxLength={2}
                value={mesVencimento}
                onChange={(e) => setMesVencimento(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Ano (AAAA)</label>
              <Input
                type="text"
                placeholder="2030"
                maxLength={4}
                value={anoVencimento}
                onChange={(e) => setAnoVencimento(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">CVV</label>
              <Input
                type="text"
                placeholder="123"
                maxLength={4}
                value={cvv}
                onChange={(e) => setCvv(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">CPF do Titular</label>
            <Input
              type="text"
              placeholder="000.000.000-00"
              maxLength={14}
              value={cpfCartao}
              onChange={(e) => setCpfCartao(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center gap-2 p-3 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg text-xs opacity-80 mt-1">
            <Lock className="h-4 w-4 text-[#B45A2B] shrink-0" />
            <span>Nenhum número de cartão é armazenado em nossos servidores.</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              type="button"
              variante="fantasma"
              onClick={() => setModalCartaoAberto(false)}
              disabled={salvandoCartao}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variante="principal"
              carregando={salvandoCartao}
              disabled={salvandoCartao}
            >
              Salvar Cartão Seguro
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
