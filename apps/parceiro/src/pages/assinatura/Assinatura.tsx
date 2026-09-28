import * as React from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  AlertaTemporizado,
  AlertDescription,
  LoadingSpinner,
  Modal,
  Input,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import type { Barbearia, Plano, Assinatura, CicloAssinatura } from "@barzzo/tipos";
import {
  traduzirErro,
  detectarBandeiraCartao,
  formatarNumeroCartao,
  formatarValidadeCartao,
  formatarCpf,
} from "@barzzo/utilitarios";
import {
  CreditCard,
  Check,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Users,
  Store,
  RefreshCw,
  Plus,
  Trash2,
  Lock,
  ArrowUpRight,
  Ban,
} from "lucide-react";

export default function PaginaAssinaturaParceiro() {
  const [carregando, setCarregando] = React.useState(true);
  const [barbearia, setBarbearia] = React.useState<Barbearia | null>(null);
  const [planos, setPlanos] = React.useState<Plano[]>([]);
  const [assinaturaAtual, setAssinaturaAtual] = React.useState<Assinatura | null>(null);
  const [ciclo, setCiclo] = React.useState<CicloAssinatura>("semestral");
  const [processando, setProcessando] = React.useState(false);
  const [sucesso, setSucesso] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);

  // Modais
  const [planoAlvo, setPlanoAlvo] = React.useState<Plano | null>(null);
  const [modalUpgradeAberto, setModalUpgradeAberto] = React.useState(false);
  const [modalCancelarAberto, setModalCancelarAberto] = React.useState(false);
  const [modalTrocarCartaoAberto, setModalTrocarCartaoAberto] = React.useState(false);
  const [usandoNovoCartaoNoUpgrade, setUsandoNovoCartaoNoUpgrade] = React.useState(false);

  // Campos de Cartão
  const [titularCartao, setTitularCartao] = React.useState("");
  const [numeroCartao, setNumeroCartao] = React.useState("");
  const [validadeCartao, setValidadeCartao] = React.useState("");
  const [cvv, setCvv] = React.useState("");
  const [cpfCartao, setCpfCartao] = React.useState("");

  // Detecção dinâmica de bandeira e formato
  const infoBandeira = React.useMemo(() => detectarBandeiraCartao(numeroCartao), [numeroCartao]);

  const formatarMoeda = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

  const calcularDiasRestantes = (dataFim?: string | null) => {
    if (!dataFim) return 0;
    const diff = new Date(dataFim).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

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
      }

      // 3. Carregar assinatura atual se existir
      const { data: assDb } = await (supabase.from("assinaturas") as any)
        .select("*, planos(*)")
        .eq("barbearia_id", membro.barbearia_id)
        .eq("status", "ativa")
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (assDb) {
        setAssinaturaAtual(assDb as Assinatura);
      } else {
        setAssinaturaAtual(null);
      }
    } catch {
      setErro("Falha ao carregar planos e assinatura.");
    } finally {
      setCarregando(false);
    }
  }, []);

  React.useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const limparFormularioCartao = () => {
    setTitularCartao("");
    setNumeroCartao("");
    setValidadeCartao("");
    setCvv("");
    setCpfCartao("");
    setUsandoNovoCartaoNoUpgrade(false);
  };

  function validarDadosCartao(): {
    valido: boolean;
    erroMsg?: string;
    numLimpo?: string;
    mes?: number;
    ano?: number;
    cvvLimpo?: string;
    cpfLimpo?: string;
  } {
    const numLimpo = numeroCartao.replace(/\D/g, "");
    const cvvLimpo = cvv.replace(/\D/g, "");
    const cpfLimpo = cpfCartao.replace(/\D/g, "");

    if (!titularCartao.trim() || titularCartao.trim().length < 3) {
      return { valido: false, erroMsg: "Informe o nome impresso no cartão." };
    }

    if (numLimpo.length < 13 || numLimpo.length > 19) {
      return {
        valido: false,
        erroMsg: `Número de cartão inválido. O cartão ${infoBandeira.nome} possui ${infoBandeira.tamanhoMaximo} dígitos.`,
      };
    }

    const [mesStr, anoStr] = validadeCartao.split("/");
    const mes = Number(mesStr);
    const ano = Number(anoStr?.length === 2 ? `20${anoStr}` : anoStr);
    const anoAtual = new Date().getFullYear();
    const mesAtual = new Date().getMonth() + 1;

    if (!mes || mes < 1 || mes > 12 || !ano || ano < anoAtual || (ano === anoAtual && mes < mesAtual)) {
      return { valido: false, erroMsg: "Informe uma data de validade (MM/AA) válida e futura." };
    }

    if (cvvLimpo.length !== infoBandeira.tamanhoCvv) {
      return {
        valido: false,
        erroMsg: `O código de segurança (CVV) para cartões ${infoBandeira.nome} deve ter exatamente ${infoBandeira.tamanhoCvv} dígitos.`,
      };
    }

    if (cpfLimpo.length !== 11) {
      return { valido: false, erroMsg: "Informe um CPF válido com 11 dígitos." };
    }

    return {
      valido: true,
      numLimpo,
      mes,
      ano,
      cvvLimpo,
      cpfLimpo,
    };
  }

  // 1. Ação para Assinar ou Fazer Upgrade com Cartão
  async function lidarComConfirmarAssinaturaOuUpgrade(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!barbearia || !planoAlvo) return;

    try {
      setProcessando(true);
      setErro(null);
      setSucesso(null);

      const temCartaoSalvo = barbearia.recorrencia_ativa && barbearia.mercado_pago_card_last_four;
      const deveUsarCartaoSalvo = temCartaoSalvo && !usandoNovoCartaoNoUpgrade;

      let cardToken = null;
      let lastFour = null;
      let brand = null;

      // Se precisar de novo cartão, validar e tokenizar no Mercado Pago
      if (!deveUsarCartaoSalvo) {
        const validacao = validarDadosCartao();
        if (!validacao.valido) {
          setErro(validacao.erroMsg || "Verifique os dados do cartão.");
          setProcessando(false);
          return;
        }

        const publicKey = (import.meta as any).env?.VITE_MERCADO_PAGO_PUBLIC_KEY || "APP_USR-4d05f3e1-8622-43d8-9b71-e459059ef49f";

        const respToken = await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${publicKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            card_number: validacao.numLimpo,
            expiration_month: validacao.mes,
            expiration_year: validacao.ano,
            security_code: validacao.cvvLimpo,
            cardholder: {
              name: titularCartao.toUpperCase().trim(),
              identification: {
                type: "CPF",
                number: validacao.cpfLimpo,
              },
            },
          }),
        });

        const tokenData = await respToken.json();
        if (!respToken.ok) {
          throw new Error(tokenData.message || tokenData.cause?.[0]?.description || "Falha ao validar o cartão no Mercado Pago.");
        }

        cardToken = tokenData.id;
        lastFour = tokenData.last_four_digits;
        brand = tokenData.payment_method?.id || infoBandeira.id;
      }

      // Enviar para o backend unificado /api/assinar-com-cartao
      const resp = await fetch("/api/assinar-com-cartao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barbearia_id: barbearia.id,
          plano_id: planoAlvo.id,
          ciclo,
          usar_cartao_salvo: deveUsarCartaoSalvo,
          card_token: cardToken,
          email: barbearia.email,
          last_four: lastFour,
          brand: brand,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Erro ao processar a assinatura.");
      }

      setSucesso(data.mensagem || "Plano ativado com sucesso! A renovação automática está ativa.");
      setModalUpgradeAberto(false);
      limparFormularioCartao();
      await carregarDados();
    } catch (err: any) {
      setErro(traduzirErro(err, "Não foi possível concluir a assinatura. Verifique os dados do cartão."));
    } finally {
      setProcessando(false);
    }
  }

  // 2. Ação para Salvar/Trocar Cartão de Renovação
  async function lidarComTrocarCartao(e: React.FormEvent) {
    e.preventDefault();
    if (!barbearia) return;

    try {
      setProcessando(true);
      setErro(null);
      setSucesso(null);

      const validacao = validarDadosCartao();
      if (!validacao.valido) {
        setErro(validacao.erroMsg || "Verifique os dados do cartão.");
        setProcessando(false);
        return;
      }

      const publicKey = (import.meta as any).env?.VITE_MERCADO_PAGO_PUBLIC_KEY || "APP_USR-4d05f3e1-8622-43d8-9b71-e459059ef49f";

      const respToken = await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${publicKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_number: validacao.numLimpo,
          expiration_month: validacao.mes,
          expiration_year: validacao.ano,
          security_code: validacao.cvvLimpo,
          cardholder: {
            name: titularCartao.toUpperCase().trim(),
            identification: {
              type: "CPF",
              number: validacao.cpfLimpo,
            },
          },
        }),
      });

      const tokenData = await respToken.json();
      if (!respToken.ok) {
        throw new Error(tokenData.message || "Falha ao tokenizar o cartão.");
      }

      const respSalvar = await fetch("/api/salvar-cartao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barbearia_id: barbearia.id,
          card_token: tokenData.id,
          email: barbearia.email,
          last_four: tokenData.last_four_digits || validacao.numLimpo?.slice(-4),
          brand: tokenData.payment_method?.id || infoBandeira.id,
          expiration: validadeCartao,
        }),
      });

      if (!respSalvar.ok) {
        const errSalvar = await respSalvar.json();
        throw new Error(errSalvar.error || "Erro ao salvar cartão.");
      }

      setSucesso("Cartão de renovação cadastrado com sucesso!");
      setModalTrocarCartaoAberto(false);
      limparFormularioCartao();
      await carregarDados();
    } catch (err: any) {
      setErro(traduzirErro(err, "Falha ao atualizar o cartão de renovação."));
    } finally {
      setProcessando(false);
    }
  }

  // 3. Ação para Cancelar Renovação Automática
  async function lidarComCancelarAssinatura() {
    if (!barbearia) return;

    try {
      setProcessando(true);
      setErro(null);
      setSucesso(null);

      const resp = await fetch("/api/cancelar-assinatura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barbearia_id: barbearia.id }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Erro ao solicitar cancelamento.");
      }

      setSucesso(
        data.data_limite
          ? `Renovação automática desativada. Seu acesso permanecerá 100% liberado até ${new Date(
              data.data_limite
            ).toLocaleDateString("pt-BR")}.`
          : "Renovação automática desativada com sucesso."
      );
      setModalCancelarAberto(false);
      await carregarDados();
    } catch (err: any) {
      setErro(traduzirErro(err, "Falha ao cancelar a renovação da assinatura."));
    } finally {
      setProcessando(false);
    }
  }

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
  const diasRestantes = calcularDiasRestantes(assinaturaAtual?.data_fim || barbearia.trial_fim);
  const planoAtualId = assinaturaAtual?.plano_id || (emTrial ? planos.find((p) => p.identificador === "pro")?.id : null);
  const planoAtual = planos.find((p) => p.id === planoAtualId);
  const ordemAtual = planoAtual?.ordem ?? 0;

  // Cálculo de Pró-rata para o modal de Upgrade/Assinatura
  const precoNovoPlano = planoAlvo
    ? ciclo === "semestral"
      ? planoAlvo.preco_semestral
      : planoAlvo.preco_mensal
    : 0;

  let creditoRestante = 0;
  if (assinaturaAtual && ativa && planoAlvo && planoAlvo.id !== assinaturaAtual.plano_id) {
    const diasTotais = assinaturaAtual.ciclo === "semestral" ? 180 : 30;
    const valorDiario = Number(assinaturaAtual.valor) / diasTotais;
    creditoRestante = Math.min(
      Number(assinaturaAtual.valor),
      Math.max(0, Number((valorDiario * diasRestantes).toFixed(2)))
    );
  }
  const valorFinalACobrar = Math.max(0, Number((precoNovoPlano - creditoRestante).toFixed(2)));

  return (
    <div className="flex flex-col gap-8 pb-12 max-w-5xl mx-auto">
      {erro && (
        <AlertaTemporizado variante="erro" duracaoMs={6000} aoExpirar={() => setErro(null)}>
          <AlertDescription>{erro}</AlertDescription>
        </AlertaTemporizado>
      )}

      {sucesso && (
        <AlertaTemporizado variante="sucesso" duracaoMs={6000} aoExpirar={() => setSucesso(null)}>
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
              {ativa ? "Assinatura Ativa" : emTrial ? "Período de Testes (30 dias)" : "Vencida"}
            </span>
          </div>
          <p className="text-sm opacity-70 mt-1">
            Gerencie seu plano com renovação automática contínua e faturamento seguro via cartão de crédito.
          </p>
        </div>

        {/* Card Resumo do Status Atual */}
        <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex items-center gap-3">
          <Clock className="h-5 w-5 text-[#B45A2B]" />
          <div className="text-xs">
            {emTrial ? (
              <>
                <strong className="block font-bold text-sm">
                  {diasRestantes} dia(s) restantes de teste
                </strong>
                <span>Válido até {new Date(barbearia.trial_fim).toLocaleDateString("pt-BR")}</span>
              </>
            ) : ativa && assinaturaAtual ? (
              <>
                <strong className="block font-bold text-sm">
                  {assinaturaAtual.planos?.nome || "Plano Ativo"} ({assinaturaAtual.ciclo === "semestral" ? "Semestral" : "Mensal"})
                </strong>
                <span>
                  {barbearia.recorrencia_ativa
                    ? `Próxima renovação automática em ${new Date(assinaturaAtual.data_fim).toLocaleDateString("pt-BR")}`
                    : `Vigência até ${new Date(assinaturaAtual.data_fim).toLocaleDateString("pt-BR")} (Renovação desativada)`}
                </span>
              </>
            ) : (
              <>
                <strong className="block font-bold text-sm text-[#DC2626]">
                  Assinatura Vencida
                </strong>
                <span>Selecione um plano abaixo para reativar seu acesso e agendamentos</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cartão de Crédito Cadastrado & Gestão da Renovação */}
      <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-neutral-200/60 dark:bg-neutral-800 text-[#B45A2B]">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            {barbearia.recorrencia_ativa && barbearia.mercado_pago_card_last_four ? (
              <>
                <div className="flex items-center gap-2">
                  <strong className="text-sm font-bold capitalize">
                    {barbearia.mercado_pago_card_brand || "Cartão"} final {barbearia.mercado_pago_card_last_four}
                  </strong>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] font-bold uppercase">
                    Renovação Automática Ativa
                  </span>
                </div>
                <p className="text-xs opacity-70 mt-0.5">
                  Cobrança automática ao final do ciclo.
                </p>
              </>
            ) : (
              <>
                <strong className="text-sm font-bold">Nenhum cartão cadastrado para renovação</strong>
                <p className="text-xs opacity-70 mt-0.5">
                  Cadastre um cartão para evitar bloqueios no encerramento do plano ou teste.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {barbearia.recorrencia_ativa ? (
            <>
              <Button
                variante="secundario"
                tamanho="sm"
                onClick={() => {
                  limparFormularioCartao();
                  setModalTrocarCartaoAberto(true);
                }}
                className="text-xs font-semibold"
              >
                Alterar Cartão
              </Button>
              <Button
                variante="cancelar-destrutivo"
                tamanho="sm"
                onClick={() => setModalCancelarAberto(true)}
                className="text-xs font-semibold"
              >
                Cancelar Assinatura
              </Button>
            </>
          ) : (
            <Button
              variante="principal"
              tamanho="sm"
              onClick={() => {
                limparFormularioCartao();
                setModalTrocarCartaoAberto(true);
              }}
              className="text-xs font-bold w-full sm:w-auto"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Cadastrar Cartão Seguro
            </Button>
          )}
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
            ? "Pagamento único a cada 6 meses com até 17% de economia"
            : "Cobrança mensal sem fidelidade"}
        </span>
      </div>

      {/* Grade de Planos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {planos.map((plano) => {
          const ehPlanoAtual =
            (ativa && assinaturaAtual?.plano_id === plano.id) ||
            (emTrial && plano.identificador === "pro");
          const ehUpgrade = plano.ordem > ordemAtual;
          const ehDowngrade = plano.ordem < ordemAtual;
          const downgradeBloqueado = ehDowngrade && diasRestantes > 7 && !emTrial;

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
                  Seu Plano Atual
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

                <div className="flex flex-col gap-1.5 pt-2">
                  {ehPlanoAtual ? (
                    <div className="p-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-center text-xs font-semibold opacity-80">
                      {barbearia.recorrencia_ativa
                        ? "Renovação Automática Ativa"
                        : "Vigência em Andamento"}
                    </div>
                  ) : ehUpgrade ? (
                    <Button
                      variante="principal"
                      onClick={() => {
                        setPlanoAlvo(plano);
                        limparFormularioCartao();
                        setModalUpgradeAberto(true);
                      }}
                      className="w-full font-bold text-xs min-h-[44px]"
                    >
                      <ArrowUpRight className="mr-1.5 h-4 w-4" />
                      Fazer Upgrade
                    </Button>
                  ) : downgradeBloqueado ? (
                    <div className="flex flex-col gap-1">
                      <Button
                        variante="secundario"
                        disabled
                        className="w-full font-semibold text-xs min-h-[44px] opacity-40 cursor-not-allowed"
                      >
                        <Ban className="mr-1.5 h-4 w-4" />
                        Plano Menor
                      </Button>
                      <span className="text-[10px] text-center text-neutral-500 leading-tight">
                        Disponível nos últimos 7 dias da vigência atual.
                      </span>
                    </div>
                  ) : (
                    <Button
                      variante="secundario"
                      onClick={() => {
                        setPlanoAlvo(plano);
                        limparFormularioCartao();
                        setModalUpgradeAberto(true);
                      }}
                      className="w-full font-bold text-xs min-h-[44px]"
                    >
                      Mudar para este Plano
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Selo de Segurança e Política Transparente */}
      <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex flex-col sm:flex-row items-center gap-4 text-xs opacity-75">
        <ShieldCheck className="h-6 w-6 text-[#16A34A] shrink-0" />
        <div className="flex-1">
          <strong className="block font-semibold mb-0.5">Segurança & Pagamentos Transparentes</strong>
          Seus dados de cartão são tokenizados diretamente no cofre seguro do Mercado Pago com criptografia bancária. O valor da assinatura é exclusivo para manutenção do software Barzzo, sem taxas sobre os atendimentos aos seus clientes.
        </div>
      </div>

      {/* MODAL 1: Contratação / Upgrade de Plano */}
      <Modal
        aberto={modalUpgradeAberto && !!planoAlvo}
        aoFechar={() => setModalUpgradeAberto(false)}
        titulo={`Assinar ${planoAlvo?.nome || "Plano"}`}
        descricao={`Ciclo ${ciclo === "semestral" ? "Semestral" : "Mensal"} com renovação automática`}
        tamanho="md"
      >
        {planoAlvo && (
          <div className="flex flex-col gap-5">
            {/* Demonstrativo Pró-rata */}
            <div className="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span>Valor do Novo Plano ({ciclo}):</span>
                <span className="font-semibold">{formatarMoeda(precoNovoPlano)}</span>
              </div>

              {creditoRestante > 0 && (
                <div className="flex items-center justify-between text-[#16A34A] font-medium">
                  <span>Desconto proporcional ({diasRestantes} dias restantes):</span>
                  <span>- {formatarMoeda(creditoRestante)}</span>
                </div>
              )}

              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700 flex items-center justify-between text-sm">
                <strong className="font-bold">Total a Pagar Hoje:</strong>
                <strong className="text-base font-extrabold text-[#B45A2B]">
                  {formatarMoeda(valorFinalACobrar)}
                </strong>
              </div>

              <span className="text-[11px] opacity-60 text-right block">
                Inicia novo ciclo cheio de {ciclo === "semestral" ? "180" : "30"} dias a partir de hoje.
              </span>
            </div>

            {/* Opção de Usar Cartão Salvo */}
            {barbearia.recorrencia_ativa && barbearia.mercado_pago_card_last_four && !usandoNovoCartaoNoUpgrade ? (
              <div className="flex flex-col gap-3">
                <div className="p-3.5 rounded-xl border border-[#B45A2B]/40 bg-[#B45A2B]/5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="h-5 w-5 text-[#B45A2B]" />
                    <div className="text-xs">
                      <strong className="block font-bold capitalize">
                        {barbearia.mercado_pago_card_brand || "Cartão"} final {barbearia.mercado_pago_card_last_four}
                      </strong>
                      <span className="opacity-70">Cartão seguro cadastrado</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variante="fantasma"
                    tamanho="sm"
                    onClick={() => setUsandoNovoCartaoNoUpgrade(true)}
                    className="text-xs text-[#B45A2B] font-bold"
                  >
                    Usar Outro Cartão
                  </Button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                  <Button
                    type="button"
                    variante="fantasma"
                    onClick={() => setModalUpgradeAberto(false)}
                    disabled={processando}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variante="principal"
                    carregando={processando}
                    disabled={processando}
                    onClick={() => lidarComConfirmarAssinaturaOuUpgrade()}
                  >
                    Confirmar e Pagar {formatarMoeda(valorFinalACobrar)}
                  </Button>
                </div>
              </div>
            ) : (
              /* Formulário de Novo Cartão */
              <form onSubmit={lidarComConfirmarAssinaturaOuUpgrade} className="flex flex-col gap-4">
                {barbearia.recorrencia_ativa && barbearia.mercado_pago_card_last_four && (
                  <button
                    type="button"
                    onClick={() => setUsandoNovoCartaoNoUpgrade(false)}
                    className="text-xs text-[#B45A2B] font-bold text-left underline"
                  >
                    ← Voltar para o cartão salvo (final {barbearia.mercado_pago_card_last_four})
                  </button>
                )}

                <div>
                  <label className="block text-xs font-bold mb-1">Nome Impresso no Cartão</label>
                  <Input
                    type="text"
                    placeholder="NOME COMO ESTÁ NO CARTÃO"
                    value={titularCartao}
                    onChange={(e) => setTitularCartao(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold">Número do Cartão</label>
                    {infoBandeira.id !== "outros" && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#B45A2B]/10 text-[#B45A2B] border border-[#B45A2B]/20 animate-in fade-in">
                        {infoBandeira.nome}
                      </span>
                    )}
                  </div>
                  <Input
                    type="text"
                    placeholder={
                      infoBandeira.id === "amex"
                        ? "0000 000000 00000"
                        : infoBandeira.id === "diners"
                        ? "0000 000000 0000"
                        : "0000 0000 0000 0000"
                    }
                    maxLength={infoBandeira.id === "amex" ? 17 : infoBandeira.id === "diners" ? 16 : 19}
                    value={numeroCartao}
                    onChange={(e) => setNumeroCartao(formatarNumeroCartao(e.target.value))}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">Validade (MM/AA)</label>
                    <Input
                      type="text"
                      placeholder="11/30"
                      maxLength={5}
                      value={validadeCartao}
                      onChange={(e) => setValidadeCartao(formatarValidadeCartao(e.target.value))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      CVV ({infoBandeira.tamanhoCvv} dígitos)
                    </label>
                    <Input
                      type="text"
                      placeholder={infoBandeira.tamanhoCvv === 4 ? "1234" : "123"}
                      maxLength={infoBandeira.tamanhoCvv}
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, infoBandeira.tamanhoCvv))}
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
                    onChange={(e) => setCpfCartao(formatarCpf(e.target.value))}
                    required
                  />
                </div>

                <div className="flex items-center gap-2 p-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs opacity-75">
                  <Lock className="h-4 w-4 text-[#B45A2B] shrink-0" />
                  <span>Tokenização bancária de ponta a ponta.</span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                  <Button
                    type="button"
                    variante="fantasma"
                    onClick={() => setModalUpgradeAberto(false)}
                    disabled={processando}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variante="principal"
                    carregando={processando}
                    disabled={processando}
                  >
                    Pagar e Ativar ({formatarMoeda(valorFinalACobrar)})
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>

      {/* MODAL 2: Alterar Cartão de Renovação */}
      <Modal
        aberto={modalTrocarCartaoAberto}
        aoFechar={() => setModalTrocarCartaoAberto(false)}
        titulo="Cadastrar Cartão de Renovação"
        descricao="O cartão cadastrado será utilizado para as futuras renovações automáticas"
        tamanho="md"
      >
        <form onSubmit={lidarComTrocarCartao} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold mb-1">Nome Impresso no Cartão</label>
            <Input
              type="text"
              placeholder="NOME COMO ESTÁ NO CARTÃO"
              value={titularCartao}
              onChange={(e) => setTitularCartao(e.target.value)}
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold">Número do Cartão</label>
              {infoBandeira.id !== "outros" && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#B45A2B]/10 text-[#B45A2B] border border-[#B45A2B]/20 animate-in fade-in">
                  {infoBandeira.nome}
                </span>
              )}
            </div>
            <Input
              type="text"
              placeholder={
                infoBandeira.id === "amex"
                  ? "0000 000000 00000"
                  : infoBandeira.id === "diners"
                  ? "0000 000000 0000"
                  : "0000 0000 0000 0000"
              }
              maxLength={infoBandeira.id === "amex" ? 17 : infoBandeira.id === "diners" ? 16 : 19}
              value={numeroCartao}
              onChange={(e) => setNumeroCartao(formatarNumeroCartao(e.target.value))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1">Validade (MM/AA)</label>
              <Input
                type="text"
                placeholder="11/30"
                maxLength={5}
                value={validadeCartao}
                onChange={(e) => setValidadeCartao(formatarValidadeCartao(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">
                CVV ({infoBandeira.tamanhoCvv} dígitos)
              </label>
              <Input
                type="text"
                placeholder={infoBandeira.tamanhoCvv === 4 ? "1234" : "123"}
                maxLength={infoBandeira.tamanhoCvv}
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, infoBandeira.tamanhoCvv))}
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
              onChange={(e) => setCpfCartao(formatarCpf(e.target.value))}
              required
            />
          </div>

          <div className="flex items-center gap-2 p-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs opacity-75">
            <Lock className="h-4 w-4 text-[#B45A2B] shrink-0" />
            <span>Nenhum valor será cobrado agora. O cartão fica salvo para o término do plano.</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              type="button"
              variante="fantasma"
              onClick={() => setModalTrocarCartaoAberto(false)}
              disabled={processando}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variante="principal"
              carregando={processando}
              disabled={processando}
            >
              Salvar Cartão
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Confirmação de Cancelamento */}
      <Modal
        aberto={modalCancelarAberto}
        aoFechar={() => setModalCancelarAberto(false)}
        titulo="Cancelar Renovação Automática?"
        descricao="Entenda o que acontece após o cancelamento"
        tamanho="md"
      >
        <div className="flex flex-col gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Acesso mantido até o final do período</strong>
              <span>
                Seu acesso ao sistema continuará 100% ativo até{" "}
                <strong>
                  {assinaturaAtual
                    ? new Date(assinaturaAtual.data_fim).toLocaleDateString("pt-BR")
                    : "o fim do período"}
                </strong>
                . Você pode continuar agendando e atendendo normalmente até essa data.
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 flex flex-col gap-2">
            <strong className="font-semibold text-neutral-800 dark:text-neutral-200">
              O que acontece após a data de término?
            </strong>
            <ul className="list-disc list-inside space-y-1 opacity-80">
              <li>Sua barbearia será ocultada da busca pública no app de clientes.</li>
              <li>A criação de novos agendamentos manuais será bloqueada.</li>
              <li>Sua conta e histórico de clientes continuarão salvos para reativação a qualquer momento.</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              type="button"
              variante="fantasma"
              onClick={() => setModalCancelarAberto(false)}
              disabled={processando}
            >
              Manter Assinatura
            </Button>
            <Button
              type="button"
              variante="cancelar-destrutivo"
              carregando={processando}
              disabled={processando}
              onClick={lidarComCancelarAssinatura}
            >
              Confirmar Cancelamento
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
