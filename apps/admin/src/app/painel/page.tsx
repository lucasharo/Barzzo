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
import type { MetricasAdminGlobal } from "@barzzo/tipos";
import {
  Building2,
  Users,
  CreditCard,
  Calendar,
  DollarSign,
  TrendingUp,
  Shield,
  Activity,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function PaginaPainelAdmin() {
  const [carregando, setCarregando] = React.useState(true);
  const [metricas, setMetricas] = React.useState<MetricasAdminGlobal>({
    total_barbearias: 0,
    barbearias_ativas: 0,
    barbearias_trial: 0,
    total_assinantes: 0,
    mrr_estimado: 0,
    total_agendamentos: 0,
    total_usuarios: 0,
  });
  const [barbeariasRecentes, setBarbeariasRecentes] = React.useState<any[]>([]);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function carregarDadosAdmin() {
      try {
        setCarregando(true);
        setErro(null);
        const supabase = criarClienteSupabaseBrowser();

        // 1. Obter métricas globais via RPC
        const { data: mRpc, error: erroRpc } = await (supabase.rpc as any)(
          "obter_metricas_admin_global"
        );

        if (mRpc && !erroRpc) {
          setMetricas(mRpc);
        }

        // 2. Obter barbearias recentes
        const { data: bRecentes } = await supabase
          .from("barbearias")
          .select("id, nome, slug, cidade, status_assinatura, trial_fim, criado_em")
          .order("criado_em", { ascending: false })
          .limit(5);

        setBarbeariasRecentes(bRecentes || []);
      } catch {
        setErro("Não foi possível carregar as métricas operacionais do sistema.");
      } finally {
        setCarregando(false);
      }
    }

    carregarDadosAdmin();
  }, []);

  const formatarMoeda = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

  if (carregando) {
    return (
      <div className="flex-1 max-w-xl mx-auto py-20 flex flex-col items-center justify-center gap-3">
        <LoadingSpinner tamanho="lg" className="text-[#B45A2B]" />
        <p className="text-sm opacity-70 font-medium">Carregando painel de governança...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      {erro && (
        <Alert variante="erro">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Painel Executivo</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#B45A2B]/10 text-[#B45A2B] font-bold border border-[#B45A2B]/20">
              Barzzo Global
            </span>
          </div>
          <p className="text-sm opacity-70 mt-1">
            Visão consolidada de receita recorrente (MRR), base de barbearias, assinantes e agendamentos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/barbearias">
            <Button variante="principal" tamanho="sm" className="min-h-[44px]">
              <Building2 className="mr-1.5 h-4 w-4" /> Gerenciar Barbearias
            </Button>
          </Link>
          <Link href="/logs">
            <Button variante="secundario" tamanho="sm" className="min-h-[44px]">
              <Shield className="mr-1.5 h-4 w-4" /> Ver Auditoria
            </Button>
          </Link>
        </div>
      </div>

      {/* Grade de KPIs Globais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR Estimado */}
        <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold opacity-70 uppercase tracking-wider">
                MRR (Receita Recorrente)
              </span>
              <span className="text-2xl font-extrabold text-[#16A34A]">
                {formatarMoeda(metricas.mrr_estimado)}
              </span>
              <span className="text-xs opacity-60">
                {metricas.total_assinantes} assinantes ativos
              </span>
            </div>
            <div className="h-12 w-12 rounded-xl bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center">
              <DollarSign className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Total Barbearias */}
        <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold opacity-70 uppercase tracking-wider">
                Total de Barbearias
              </span>
              <span className="text-2xl font-extrabold text-[#B45A2B]">
                {metricas.total_barbearias}
              </span>
              <span className="text-xs opacity-60">
                {metricas.barbearias_ativas} ativas • {metricas.barbearias_trial} em trial
              </span>
            </div>
            <div className="h-12 w-12 rounded-xl bg-[#B45A2B]/10 text-[#B45A2B] flex items-center justify-center">
              <Building2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Agendamentos no Marketplace */}
        <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold opacity-70 uppercase tracking-wider">
                Agendamentos Globais
              </span>
              <span className="text-2xl font-extrabold text-blue-500">
                {metricas.total_agendamentos}
              </span>
              <span className="text-xs opacity-60">realizados na plataforma</span>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Calendar className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Usuários Cadastrados */}
        <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold opacity-70 uppercase tracking-wider">
                Contas de Usuário
              </span>
              <span className="text-2xl font-extrabold text-purple-500">
                {metricas.total_usuarios}
              </span>
              <span className="text-xs opacity-60">clientes e profissionais</span>
            </div>
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barbearias Recentes e Ações de Retenção */}
      <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#B45A2B]" /> Últimas Barbearias Registradas
            </CardTitle>
            <CardDescription className="text-xs">
              Acompanhe novos cadastros e a vigência de trials de 30 dias.
            </CardDescription>
          </div>
          <Link href="/barbearias">
            <Button variante="fantasma" tamanho="sm" className="text-xs">
              Ver todas →
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold opacity-70">
                <tr>
                  <th className="p-4">Barbearia</th>
                  <th className="p-4">Cidade</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Fim do Trial</th>
                  <th className="p-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {barbeariasRecentes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center opacity-60">
                      Nenhuma barbearia cadastrada no momento.
                    </td>
                  </tr>
                ) : (
                  barbeariasRecentes.map((b) => (
                    <tr key={b.id} className="hover:bg-neutral-500/5">
                      <td className="p-4 font-bold flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-[#B45A2B]/10 text-[#B45A2B] flex items-center justify-center font-bold text-xs">
                          {b.nome.slice(0, 2).toUpperCase()}
                        </div>
                        {b.nome}
                      </td>
                      <td className="p-4 opacity-75">{b.cidade || "Não informada"}</td>
                      <td className="p-4">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            b.status_assinatura === "ativa"
                              ? "bg-[#16A34A]/10 text-[#16A34A]"
                              : b.status_assinatura === "trial"
                              ? "bg-[#B45A2B]/10 text-[#B45A2B]"
                              : "bg-[#DC2626]/10 text-[#DC2626]"
                          }`}
                        >
                          {b.status_assinatura.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 opacity-75">
                        {new Date(b.trial_fim).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-4 text-right">
                        <Link href="/barbearias">
                          <Button variante="secundario" tamanho="sm" className="text-xs min-h-[36px]">
                            Gerenciar
                          </Button>
                        </Link>
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
  );
}
