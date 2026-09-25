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
import { Share2, Users, DollarSign } from "lucide-react";

export default function PaginaInfluenciadoresAdmin() {
  const [carregando, setCarregando] = React.useState(true);
  const [influenciadores, setInfluenciadores] = React.useState<any[]>([]);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function carregarInfluenciadores() {
      try {
        setCarregando(true);
        setErro(null);
        const supabase = criarClienteSupabaseBrowser();

        const { data: infDb, error: erroDb } = await (supabase.from("influenciadores") as any)
          .select("*, barbearias(nome)")
          .order("criado_em", { ascending: false });

        if (erroDb) throw erroDb;
        setInfluenciadores(infDb || []);
      } catch {
        setErro("Não foi possível carregar os influenciadores parceiros.");
      } finally {
        setCarregando(false);
      }
    }

    carregarInfluenciadores();
  }, []);

  return (
    <div className="flex flex-col gap-8 pb-12">
      {erro && (
        <Alert variante="erro">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Rede de Influenciadores</h1>
        <p className="text-sm opacity-70 mt-1">
          Supervisão dos promotores de barbearias, códigos de indicação e cliques rastreados.
        </p>
      </div>

      {/* Tabela de Influenciadores */}
      <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold opacity-70">
                <tr>
                  <th className="p-4">Parceiro</th>
                  <th className="p-4">Barbearia</th>
                  <th className="p-4">Código Ref</th>
                  <th className="p-4">Comissão</th>
                  <th className="p-4">Cliques</th>
                  <th className="p-4">Chave Pix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {carregando ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <LoadingSpinner tamanho="md" className="text-[#B45A2B] mx-auto mb-2" />
                      <span className="text-xs opacity-60">Carregando parceiros...</span>
                    </td>
                  </tr>
                ) : influenciadores.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center opacity-60">
                      Nenhum influenciador parceiro cadastrado no ecossistema.
                    </td>
                  </tr>
                ) : (
                  influenciadores.map((inf) => (
                    <tr key={inf.id} className="hover:bg-neutral-500/5">
                      <td className="p-4 font-bold">{inf.nome}</td>
                      <td className="p-4 opacity-75">{inf.barbearias?.nome || "Barbearia"}</td>
                      <td className="p-4 font-mono font-bold text-[#B45A2B]">{inf.codigo_ref}</td>
                      <td className="p-4 font-medium">
                        {inf.tipo_comissao === "percentual"
                          ? `${inf.valor_comissao}%`
                          : `R$ ${Number(inf.valor_comissao).toFixed(2)}`}
                      </td>
                      <td className="p-4 font-bold">{inf.cliques_rastreados || 0}</td>
                      <td className="p-4 opacity-75">{inf.chave_pix || "Não informada"}</td>
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
