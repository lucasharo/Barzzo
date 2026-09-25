"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { Calendar, Clock, DollarSign } from "lucide-react";

export default function PaginaAgendamentosAdmin() {
  const [carregando, setCarregando] = React.useState(true);
  const [agendamentos, setAgendamentos] = React.useState<any[]>([]);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function carregarAgendamentos() {
      try {
        setCarregando(true);
        setErro(null);
        const supabase = criarClienteSupabaseBrowser();

        const { data: agsDb, error: erroDb } = await supabase
          .from("agendamentos")
          .select("id, cliente_nome, preco_total, data_hora_inicio, status, barbearias(nome), profissionais(nome)")
          .order("data_hora_inicio", { ascending: false })
          .limit(50);

        if (erroDb) throw erroDb;
        setAgendamentos(agsDb || []);
      } catch {
        setErro("Não foi possível carregar os agendamentos.");
      } finally {
        setCarregando(false);
      }
    }

    carregarAgendamentos();
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
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Supervisão de Agendamentos</h1>
        <p className="text-sm opacity-70 mt-1">
          Histórico e fluxo de reservas realizadas em todo o marketplace Barzzo.
        </p>
      </div>

      {/* Tabela de Agendamentos */}
      <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold opacity-70">
                <tr>
                  <th className="p-4">Barbearia</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Profissional</th>
                  <th className="p-4">Data/Hora</th>
                  <th className="p-4">Valor</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {carregando ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <LoadingSpinner tamanho="md" className="text-[#B45A2B] mx-auto mb-2" />
                      <span className="text-xs opacity-60">Carregando agendamentos...</span>
                    </td>
                  </tr>
                ) : agendamentos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center opacity-60">
                      Nenhum agendamento registrado no sistema.
                    </td>
                  </tr>
                ) : (
                  agendamentos.map((ag) => (
                    <tr key={ag.id} className="hover:bg-neutral-500/5">
                      <td className="p-4 font-bold">{ag.barbearias?.nome || "Barbearia"}</td>
                      <td className="p-4 opacity-80">{ag.cliente_nome || "Cliente Anônimo"}</td>
                      <td className="p-4 opacity-80">{ag.profissionais?.nome || "Qualquer"}</td>
                      <td className="p-4 opacity-75">
                        {new Date(ag.data_hora_inicio).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-4 font-bold text-[#B45A2B]">{formatarMoeda(ag.preco_total)}</td>
                      <td className="p-4">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 uppercase">
                          {ag.status}
                        </span>
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
