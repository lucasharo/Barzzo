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
  Input,
  Label,
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import {
  Building2,
  Search,
  Gift,
  ShieldAlert,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

export default function PaginaBarbeariasAdmin() {
  const [carregando, setCarregando] = React.useState(true);
  const [barbearias, setBarbearias] = React.useState<any[]>([]);
  const [busca, setBusca] = React.useState("");
  const [modalRetencaoAberta, setModalRetencaoAberta] = React.useState(false);
  const [barbeariaSelecionada, setBarbeariaSelecionada] = React.useState<any | null>(null);
  const [diasExtensao, setDiasExtensao] = React.useState<number>(30);
  const [motivoRetencao, setMotivoRetencao] = React.useState("");
  const [salvandoBeneficio, setSalvandoBeneficio] = React.useState(false);
  const [sucesso, setSucesso] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);

  const carregarBarbearias = React.useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();

      const { data: bDb, error: erroDb } = await supabase
        .from("barbearias")
        .select("*")
        .order("criado_em", { ascending: false });

      if (erroDb) throw erroDb;
      setBarbearias(bDb || []);
    } catch {
      setErro("Falha ao carregar lista de estabelecimentos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  React.useEffect(() => {
    carregarBarbearias();
  }, [carregarBarbearias]);

  async function handleConcederExtensao() {
    if (!barbeariaSelecionada || !motivoRetencao.trim()) return;

    try {
      setSalvandoBeneficio(true);
      setErro(null);
      setSucesso(null);
      const supabase = criarClienteSupabaseBrowser();

      const { error: erroRpc } = await (supabase.rpc as any)("conceder_extensao_trial", {
        p_barbearia_id: barbeariaSelecionada.id,
        p_dias: diasExtensao,
        p_motivo: motivoRetencao.trim(),
      });

      if (erroRpc) throw erroRpc;

      setSucesso(
        `Benefício concedido com sucesso para "${barbeariaSelecionada.nome}" (+${diasExtensao} dias de trial).`
      );
      setModalRetencaoAberta(false);
      setBarbeariaSelecionada(null);
      setMotivoRetencao("");
      await carregarBarbearias();
    } catch {
      setErro("Erro ao registrar benefício de retenção comercial.");
    } finally {
      setSalvandoBeneficio(false);
    }
  }

  async function handleAlternarSuspensao(barbearia: any) {
    const novoStatus = barbearia.status_assinatura === "suspensa" ? "ativa" : "suspensa";
    const confirmacao = window.confirm(
      `Deseja realmente ${novoStatus === "suspensa" ? "suspender" : "reativar"} a barbearia "${barbearia.nome}"?`
    );
    if (!confirmacao) return;

    try {
      const supabase = criarClienteSupabaseBrowser();
      await (supabase.from("barbearias") as any)
        .update({ status_assinatura: novoStatus })
        .eq("id", barbearia.id);

      // Registrar auditoria
      await (supabase.from("logs_auditoria") as any).insert({
        barbearia_id: barbearia.id,
        acao: novoStatus === "suspensa" ? "suspender_barbearia" : "reativar_barbearia",
        entidade: "barbearias",
        entidade_id: barbearia.id,
        dados_novos: { status_assinatura: novoStatus },
      });

      setSucesso(`Barbearia "${barbearia.nome}" ${novoStatus === "suspensa" ? "suspensa" : "reativada"} com sucesso.`);
      await carregarBarbearias();
    } catch {
      setErro("Não foi possível alterar o status da barbearia.");
    }
  }

  const barbeariasFiltradas = barbearias.filter((b) =>
    (b.nome || "").toLowerCase().includes(busca.toLowerCase()) ||
    (b.slug || "").toLowerCase().includes(busca.toLowerCase()) ||
    (b.cidade || "").toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8 pb-12">
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

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Gestão de Barbearias</h1>
          <p className="text-sm opacity-70 mt-1">
            Supervisão de tenants, planos, retenção comercial e concessão auditada de benefícios.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
          <Input
            placeholder="Buscar por nome, slug ou cidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 text-xs min-h-[44px]"
          />
        </div>
      </div>

      {/* Tabela de Barbearias */}
      <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold opacity-70">
                <tr>
                  <th className="p-4">Barbearia</th>
                  <th className="p-4">Cidade / UF</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Vencimento Trial</th>
                  <th className="p-4 text-right">Ações de Governança</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {carregando ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center">
                      <LoadingSpinner tamanho="md" className="text-[#B45A2B] mx-auto mb-2" />
                      <span className="text-xs opacity-60">Carregando estabelecimentos...</span>
                    </td>
                  </tr>
                ) : barbeariasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center opacity-60">
                      Nenhuma barbearia encontrada.
                    </td>
                  </tr>
                ) : (
                  barbeariasFiltradas.map((b) => {
                    const suspensa = b.status_assinatura === "suspensa";

                    return (
                      <tr key={b.id} className="hover:bg-neutral-500/5">
                        <td className="p-4">
                          <strong className="block font-bold">{b.nome}</strong>
                          <span className="text-xs opacity-50 font-mono">slug: {b.slug}</span>
                        </td>
                        <td className="p-4 opacity-75">
                          {b.cidade ? `${b.cidade} - ${b.estado || "BR"}` : "Não informado"}
                        </td>
                        <td className="p-4">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              b.status_assinatura === "ativa"
                                ? "bg-[#16A34A]/10 text-[#16A34A]"
                                : b.status_assinatura === "trial"
                                ? "bg-[#B45A2B]/10 text-[#B45A2B]"
                                : "bg-[#DC2626]/10 text-[#DC2626]"
                            }`}
                          >
                            {b.status_assinatura}
                          </span>
                        </td>
                        <td className="p-4 opacity-75">
                          {new Date(b.trial_fim).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Conceder Retenção (+30 dias) */}
                            <Button
                              variante="secundario"
                              tamanho="sm"
                              onClick={() => {
                                setBarbeariaSelecionada(b);
                                setModalRetencaoAberta(true);
                              }}
                              className="text-xs min-h-[36px]"
                            >
                              <Gift className="mr-1 h-3.5 w-3.5 text-[#B45A2B]" /> +30 Dias Trial
                            </Button>

                            {/* Suspender / Reativar */}
                            <Button
                              variante={suspensa ? "principal" : "cancelar-destrutivo"}
                              tamanho="sm"
                              onClick={() => handleAlternarSuspensao(b)}
                              className="text-xs min-h-[36px]"
                            >
                              {suspensa ? "Reativar" : "Suspender"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Concessão de Benefício de Retenção */}
      {modalRetencaoAberta && barbeariaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-lg border border-neutral-200 dark:border-neutral-800 shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gift className="h-5 w-5 text-[#B45A2B]" /> Extensão de Trial (Retenção Comercial)
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Barbearia: <strong>{barbeariaSelecionada.nome}</strong>
                </CardDescription>
              </div>
              <button
                type="button"
                onClick={() => setModalRetencaoAberta(false)}
                className="p-1 rounded-lg opacity-60 hover:opacity-100"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dias">Dias de Prorrogação</Label>
                <select
                  id="dias"
                  value={diasExtensao}
                  onChange={(e) => setDiasExtensao(Number(e.target.value))}
                  className="h-10 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
                >
                  <option value={15}>+15 dias adicionais</option>
                  <option value={30}>+30 dias adicionais (Condicionado a proposta semestral)</option>
                  <option value={60}>+60 dias adicionais</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="motivo">
                  Motivo e Justificativa Comercial <span className="text-[#DC2626]">*</span>
                </Label>
                <textarea
                  id="motivo"
                  rows={3}
                  placeholder="Ex: Cliente em negociação do plano Semestral Growth com 5 barbeiros; concedido trial para homologação."
                  value={motivoRetencao}
                  onChange={(e) => setMotivoRetencao(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#B45A2B]"
                />
                <span className="text-[11px] opacity-60">
                  Esta ação é auditada e gravada no histórico permanente da barbearia.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <Button
                  type="button"
                  variante="fantasma"
                  disabled={salvandoBeneficio}
                  onClick={() => setModalRetencaoAberta(false)}
                  className="text-xs min-h-[44px]"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variante="principal"
                  disabled={salvandoBeneficio || motivoRetencao.trim().length < 5}
                  carregando={salvandoBeneficio}
                  onClick={handleConcederExtensao}
                  className="text-xs font-bold min-h-[44px]"
                >
                  Confirmar e Conceder Benefício
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
