"use client";

import * as React from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { Star, ShieldAlert, CheckCircle2, MessageSquare } from "lucide-react";

export default function PaginaAvaliacoesAdmin() {
  const [carregando, setCarregando] = React.useState(true);
  const [avaliacoes, setAvaliacoes] = React.useState<any[]>([]);
  const [sucesso, setSucesso] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);

  const carregarAvaliacoes = React.useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();

      const { data: avDb, error: erroDb } = await (supabase.from("avaliacoes") as any)
        .select("*, barbearias(nome), usuarios(nome)")
        .order("criado_em", { ascending: false });

      if (erroDb) throw erroDb;
      setAvaliacoes(avDb || []);
    } catch {
      setErro("Falha ao carregar lista de avaliações.");
    } finally {
      setCarregando(false);
    }
  }, []);

  React.useEffect(() => {
    carregarAvaliacoes();
  }, [carregarAvaliacoes]);

  return (
    <div className="flex flex-col gap-8 pb-12">
      {erro && (
        <Alert variante="erro">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Moderação de Avaliações</h1>
        <p className="text-sm opacity-70 mt-1">
          Supervisão das notas e comentários deixados pelos clientes no marketplace.
        </p>
      </div>

      {/* Lista de Avaliações */}
      <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold opacity-70">
                <tr>
                  <th className="p-4">Barbearia</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Nota</th>
                  <th className="p-4">Comentário</th>
                  <th className="p-4">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {carregando ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center">
                      <LoadingSpinner tamanho="md" className="text-[#B45A2B] mx-auto mb-2" />
                      <span className="text-xs opacity-60">Carregando avaliações...</span>
                    </td>
                  </tr>
                ) : avaliacoes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center opacity-60">
                      Nenhuma avaliação registrada no sistema.
                    </td>
                  </tr>
                ) : (
                  avaliacoes.map((av) => (
                    <tr key={av.id} className="hover:bg-neutral-500/5">
                      <td className="p-4 font-bold">{av.barbearias?.nome || "Barbearia"}</td>
                      <td className="p-4 opacity-80">{av.usuarios?.nome || "Cliente"}</td>
                      <td className="p-4">
                        <span className="flex items-center gap-1 font-bold text-[#D97706]">
                          <Star className="h-4 w-4 fill-current" /> {av.nota}.0
                        </span>
                      </td>
                      <td className="p-4 opacity-80 max-w-md">
                        {av.comentario || <em className="opacity-50">Sem comentário textual</em>}
                      </td>
                      <td className="p-4 opacity-60">
                        {new Date(av.criado_em).toLocaleDateString("pt-BR")}
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
