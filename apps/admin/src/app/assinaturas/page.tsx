"use client";

import * as React from "react";
import {
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
import { CreditCard, Calendar, CheckCircle, Clock, AlertTriangle } from "lucide-react";

export default function PaginaAssinaturasAdmin() {
  const [carregando, setCarregando] = React.useState(true);
  const [assinaturas, setAssinaturas] = React.useState<any[]>([]);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function carregarAssinaturas() {
      try {
        setCarregando(true);
        setErro(null);
        const supabase = criarClienteSupabaseBrowser();

        const { data: assDb, error: erroDb } = await (supabase.from("assinaturas") as any)
          .select("*, barbearias(nome, slug), planos(nome, identificador)")
          .order("criado_em", { ascending: false });

        if (erroDb) throw erroDb;
        setAssinaturas(assDb || []);
      } catch {
        setErro("Não foi possível carregar as assinaturas ativas.");
      } finally {
        setCarregando(false);
      }
    }

    carregarAssinaturas();
  }, []);

  const formatarMoeda = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

  return (
    <div className="flex flex-col gap-8 pb-12">
      {erro && (
        <Alert variante="erro">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Gestão de Assinaturas</h1>
        <p className="text-sm opacity-70 mt-1">
          Controle de planos SaaS, faturamento e renovações das barbearias parceiras.
        </p>
      </div>

      {/* Tabela de Assinaturas */}
      <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold opacity-70">
                <tr>
                  <th className="p-4">Barbearia</th>
                  <th className="p-4">Plano</th>
                  <th className="p-4">Ciclo</th>
                  <th className="p-4">Valor Cobrado</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Vigência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {carregando ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <LoadingSpinner tamanho="md" className="text-[#B45A2B] mx-auto mb-2" />
                      <span className="text-xs opacity-60">Carregando assinaturas...</span>
                    </td>
                  </tr>
                ) : assinaturas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center opacity-60">
                      Nenhuma assinatura paga registrada no momento.
                    </td>
                  </tr>
                ) : (
                  assinaturas.map((ass) => (
                    <tr key={ass.id} className="hover:bg-neutral-500/5">
                      <td className="p-4 font-bold">{ass.barbearias?.nome || "Barbearia"}</td>
                      <td className="p-4 font-semibold text-[#B45A2B]">
                        {ass.planos?.nome || ass.plano_id}
                      </td>
                      <td className="p-4 uppercase text-xs font-mono">{ass.ciclo}</td>
                      <td className="p-4 font-bold text-[#16A34A]">{formatarMoeda(ass.valor)}</td>
                      <td className="p-4">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] uppercase">
                          {ass.status}
                        </span>
                      </td>
                      <td className="p-4 opacity-75">
                        {new Date(ass.data_inicio).toLocaleDateString("pt-BR")} até{" "}
                        {new Date(ass.data_fim).toLocaleDateString("pt-BR")}
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
