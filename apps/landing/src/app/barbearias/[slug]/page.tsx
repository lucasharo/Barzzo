"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { MapPin, Scissors, Clock } from "lucide-react";

interface Barbearia {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
}

export default function PaginaPerfilBarbearia() {
  const params = useParams<{ slug: string }>();
  const [barbearia, setBarbearia] = useState<Barbearia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [naoEncontrado, setNaoEncontrado] = useState(false);

  useEffect(() => {
    async function buscarBarbearia() {
      try {
        const supabase = criarClienteSupabaseBrowser();
        const { data, error } = await supabase
          .from("barbearias")
          .select("id, nome, slug, descricao, endereco, bairro, cidade, estado")
          .eq("slug", params.slug)
          .single();

        if (error || !data) {
          setNaoEncontrado(true);
        } else {
          setBarbearia(data);
        }
      } catch {
        setNaoEncontrado(true);
      } finally {
        setCarregando(false);
      }
    }
    buscarBarbearia();
  }, [params.slug]);

  if (carregando) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 w-full">
        <div className="h-10 w-2/3 rounded-lg bg-[#F6F6F7] dark:bg-[#141416] animate-pulse mb-4" />
        <div className="h-5 w-1/2 rounded-lg bg-[#F6F6F7] dark:bg-[#141416] animate-pulse mb-8" />
        <div className="h-48 rounded-2xl bg-[#F6F6F7] dark:bg-[#141416] animate-pulse" />
      </div>
    );
  }

  if (naoEncontrado || !barbearia) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center w-full">
        <Scissors className="w-14 h-14 mx-auto mb-6 text-neutral-300 dark:text-neutral-700" />
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
          Barbearia nao encontrada
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 mb-8">
          Nao encontramos nenhuma barbearia com este endereco.
        </p>
        <a
          href="/barbearias"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#B45A2B] text-white font-semibold hover:bg-[#C46632] transition-colors"
        >
          Ver todas as barbearias
        </a>
      </div>
    );
  }

  const localizacao = [barbearia.bairro, barbearia.cidade, barbearia.estado]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 w-full">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-white mb-3">
          {barbearia.nome}
        </h1>
        {localizacao && (
          <p className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 mb-2">
            <MapPin className="w-4 h-4 text-[#B45A2B] shrink-0" />
            {localizacao}
          </p>
        )}
        {barbearia.endereco && (
          <p className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
            <Clock className="w-4 h-4 text-[#B45A2B] shrink-0" />
            {barbearia.endereco}
          </p>
        )}
      </div>

      {barbearia.descricao && (
        <div className="mb-10 p-6 rounded-2xl bg-[#F6F6F7] dark:bg-[#141416] border border-neutral-200/60 dark:border-neutral-800/60">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3">
            Sobre a barbearia
          </h2>
          <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
            {barbearia.descricao}
          </p>
        </div>
      )}

      <div className="rounded-2xl bg-gradient-to-br from-[#B45A2B] to-[#984820] p-8 text-center text-white">
        <Scissors className="w-10 h-10 mx-auto mb-4 opacity-80" />
        <h2 className="text-2xl font-bold mb-2">Pronto para agendar?</h2>
        <p className="text-white/80 mb-6 max-w-sm mx-auto">
          Acesse o app para ver horarios disponiveis e confirmar seu agendamento.
        </p>
        <a
          href={`https://app.barzzo.com/barbearias/${barbearia.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-[#B45A2B] font-bold text-lg hover:bg-neutral-100 transition-colors shadow-lg"
        >
          Agendar Agora
        </a>
      </div>
    </div>
  );
}