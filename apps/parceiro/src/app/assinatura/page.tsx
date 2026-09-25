"use client";

import * as React from "react";
import Link from "next/link";
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
import type { Barbearia, Plano, Assinatura, CicloAssinatura } from "@barzzo/tipos";
import { calcularEconomiaSemestral } from "@barzzo/dominio";
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

  // Contratação com simulação segura de Mercado Pago no MVP
  async function handleContratarPlano(plano: Plano) {
    if (!barbearia) return;

    try {
      setProcessandoCheckout(true);
      setErro(null);
      setSucesso(null);
      const supabase = criarClienteSupabaseBrowser();

      const valorFinal = ciclo === "semestral" ? plano.preco_semestral : plano.preco_mensal;
      const fakeMpPaymentId = `MP_ASS_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // Disparar processamento transacional de assinatura
      const { data: assId, error: erroAss } = await (supabase.rpc as any)(
        "processar_confirmacao_pagamento_assinatura",
        {
          p_barbearia_id: barbearia.id,
          p_plano_id: plano.id,
          p_ciclo: ciclo,
          p_valor: valorFinal,
          p_mp_payment_id: fakeMpPaymentId,
        }
      );

      if (erroAss) throw erroAss;

      setSucesso(
        `Assinatura do ${plano.nome} (${ciclo === "semestral" ? "Semestral" : "Mensal"}) confirmada com sucesso via Mercado Pago!`
      );
      await carregarDados();
    } catch {
      setErro("Não foi possível processar o pagamento da assinatura.");
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
        <Link href="/onboarding">
          <Button variante="principal" tamanho="lg">
            Iniciar Onboarding
          </Button>
        </Link>
      </div>
    );
  }

  const emTrial = barbearia.status_assinatura === "trial";
  const ativa = barbearia.status_assinatura === "ativa";
  const diasRestantesTrial = calcularDiasRestantes(barbearia.trial_fim);

  return (
    <div className="flex flex-col gap-8 pb-12 max-w-5xl mx-auto">
      {erro && (
        <Alert variante="erro">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {sucesso && (
        <Alert variante="sucesso" className="border-[#16A34A]/30 bg-[#16A34A]/10 text-[#16A34A]">
          <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
          <AlertDescription>{sucesso}</AlertDescription>
        </Alert>
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
              {ativa ? "Assinatura Ativa" : emTrial ? "Período de Testes (Trial)" : "Vencida"}
            </span>
          </div>
          <p className="text-sm opacity-70 mt-1">
            Escolha o plano ideal para a capacidade da sua equipe com pagamento seguro via Mercado Pago.
          </p>
        </div>

        {/* Card Resumo do Status Atual */}
        <div className="p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex items-center gap-3">
          <Clock className="h-5 w-5 text-[#B45A2B]" />
          <div className="text-xs">
            {emTrial ? (
              <>
                <strong className="block font-bold text-sm">
                  {diasRestantesTrial} dia(s) restantes de Trial
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
                  Trial Expirado
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
          const economia = calcularEconomiaSemestral(plano.preco_mensal, plano.preco_semestral);

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
                  {ehPlanoAtual ? "Renovar / Atualizar" : "Assinar com Mercado Pago"}
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
    </div>
  );
}
