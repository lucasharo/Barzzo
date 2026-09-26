"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { MapPin, Scissors } from "lucide-react";

interface Barbearia {
  id: string;
  nome: string;
  slug: string;
  bairro: string | null;
  cidade: string | null;
}

export default function PaginaBarbearias() {
  const [barbearias, setBarbearias] = useState<Barbearia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function buscarBarbearias() {
      try {
        const supabase = criarClienteSupabaseBrowser();
        const { data, error } = await supabase
          .from("barbearias")
          .select("id, nome, slug, bairro, cidade")
          .eq("ativa", true)
          .order("nome");

        if (error) throw error;
        setBarbearias(data ?? []);
      } catch {
        setErro("Não foi possível carregar as barbearias. Tente novamente.");
      } finally {
        setCarregando(false);
      }
    }
    buscarBarbearias();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 w-full">
      {/* Cabeçalho */}
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-white mb-3">
          Barbearias
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          Encontre a barbearia ideal e agende seu horário agora mesmo.
        </p>
      </div>

      {/* Estados */}
      {carregando && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-2xl bg-[#F6F6F7] dark:bg-[#141416] animate-pulse"
            />
          ))}
        </div>
      )}

      {erro && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-center text-red-600 dark:text-red-400">
          {erro}
        </div>
      )}

      {!carregando && !erro && barbearias.length === 0 && (
        <div className="text-center py-20 text-neutral-500 dark:text-neutral-400">
          <Scissors className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Nenhuma barbearia encontrada por enquanto.</p>
        </div>
      )}

      {!carregando && !erro && barbearias.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {barbearias.map((barbearia) => (
            <article
              key={barbearia.id}
              className="flex flex-col justify-between p-6 rounded-2xl bg-[#F6F6F7] dark:bg-[#141416] border border-neutral-200/60 dark:border-neutral-800/60 hover:border-[#B45A2B]/40 transition-all"
            >
              <div className="mb-6">
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
                  {barbearia.nome}
                </h2>
                {(barbearia.bairro || barbearia.cidade) && (
                  <p className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                    <MapPin className="w-4 h-4 shrink-0 text-[#B45A2B]" />
                    {[barbearia.bairro, barbearia.cidade]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href={`/barbearias/${barbearia.slug}`}
                  className="flex-1 text-center py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#B45A2B] hover:text-[#B45A2B] transition-colors"
                >
                  Ver perfil
                </Link>
                <a
                  href={`https://app.barzzo.com/barbearias/${barbearia.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center py-2 rounded-lg bg-[#B45A2B] hover:bg-[#C46632] active:bg-[#984820] text-white text-sm font-semibold transition-colors"
                >
                  Agendar
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
