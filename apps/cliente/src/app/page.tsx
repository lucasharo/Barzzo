"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, LoadingSpinner } from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import type { Barbearia } from "@barzzo/tipos";
import {
  Search,
  MapPin,
  Scissors,
  Star,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
} from "lucide-react";

export default function PaginaInicialCliente() {
  const router = useRouter();
  const [termoBusca, setTermoBusca] = React.useState("");
  const [localidadeBusca, setLocalidadeBusca] = React.useState("São Paulo, SP");
  const [barbearias, setBarbearias] = React.useState<Barbearia[]>([]);
  const [carregando, setCarregando] = React.useState(true);

  React.useEffect(() => {
    async function carregarDestaques() {
      try {
        setCarregando(true);
        const supabase = criarClienteSupabaseBrowser();
        const { data } = await supabase
          .from("barbearias")
          .select("*")
          .eq("ativa", true)
          .limit(6);

        if (data && data.length > 0) {
          setBarbearias(data as Barbearia[]);
        }
      } catch {
        // Fallback silencioso
      } finally {
        setCarregando(false);
      }
    }
    carregarDestaques();
  }, []);

  function handlePesquisar(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (termoBusca.trim()) params.set("q", termoBusca.trim());
    if (localidadeBusca.trim()) {
      params.set("localidade", localidadeBusca.trim());
      params.set("cidade", localidadeBusca.trim());
    }
    router.push(`/barbearias?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-12 py-6">
      {/* Hero de Busca Pública */}
      <section className="text-center flex flex-col items-center gap-4 py-8">
        <span className="text-xs uppercase tracking-widest font-semibold px-3 py-1 rounded-full bg-[#B45A2B]/10 text-[#B45A2B] border border-[#B45A2B]/20">
          Marketplace Oficial Barzzo
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight max-w-2xl leading-tight">
          Agende seu corte na barbearia ideal, sem complicação
        </h1>
        <p className="text-sm sm:text-base md:text-lg opacity-80 max-w-xl">
          Consulte horários livres em tempo real, escolha seu barbeiro favorito e reserve em poucos toques.
        </p>

        {/* Barra de Pesquisa Pública */}
        <form
          onSubmit={handlePesquisar}
          className="w-full max-w-2xl mt-4 flex flex-col sm:flex-row gap-2 p-2 rounded-2xl bg-[#F6F6F7] dark:bg-[#141416] border border-neutral-300 dark:border-neutral-700 shadow-md"
        >
          <div className="flex-1 flex items-center px-3 gap-2 min-h-[44px]">
            <Search className="h-5 w-5 text-[#B45A2B] shrink-0" />
            <input
              type="text"
              placeholder="Buscar barbearia, corte, barba..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              className="w-full bg-transparent text-sm focus:outline-none placeholder:opacity-50"
            />
          </div>

          <div className="h-8 w-[1px] bg-neutral-300 dark:bg-neutral-700 hidden sm:block self-center" />

          <div className="flex items-center px-3 gap-2 min-h-[44px]">
            <MapPin className="h-5 w-5 opacity-60 shrink-0 text-[#B45A2B]" />
            <input
              type="text"
              placeholder="Cidade ou Bairro"
              value={localidadeBusca}
              onChange={(e) => setLocalidadeBusca(e.target.value)}
              className="w-full sm:w-40 bg-transparent text-sm focus:outline-none placeholder:opacity-50"
            />
          </div>

          <Button variante="principal" tamanho="md" type="submit" className="shrink-0 min-h-[44px]">
            Pesquisar
          </Button>
        </form>

        {/* Categorias Rápidas */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {["Corte Tradicional", "Barba Terapia", "Degradê Navalhado", "Combo Completo", "Pigmentação"].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setTermoBusca(cat);
                router.push(`/barbearias?q=${encodeURIComponent(cat)}`);
              }}
              className="text-xs px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800 hover:border-[#B45A2B] bg-white/50 dark:bg-neutral-900/50 transition-colors"
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Destaques das barbearias */}
      <section className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Barbearias Recomendadas</h2>
            <p className="text-sm opacity-70">
              Profissionais capacitados e horários disponíveis hoje
            </p>
          </div>
          <Link
            href="/barbearias"
            className="text-sm font-semibold text-[#B45A2B] hover:underline flex items-center gap-1"
          >
            Ver todas <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {carregando ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <LoadingSpinner tamanho="lg" />
            <p className="text-sm opacity-70">Localizando barbearias...</p>
          </div>
        ) : barbearias.length === 0 ? (
          <Card camada="primaria" className="text-center py-12">
            <CardContent className="flex flex-col items-center gap-3">
              <Scissors className="h-10 w-10 opacity-40 text-[#B45A2B]" />
              <h3 className="font-bold text-base">Nenhuma barbearia cadastrada ainda</h3>
              <p className="text-sm opacity-70 max-w-sm">
                As barbearias cadastradas pelos parceiros aparecem aqui em tempo real.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {barbearias.map((b) => (
              <Card
                key={b.id}
                camada="primaria"
                className="hover:border-[#B45A2B]/60 transition-all hover:shadow-md flex flex-col justify-between"
              >
                <div className="h-36 bg-[#EEEEF0] dark:bg-[#1C1C1F] rounded-t-xl flex items-center justify-center relative overflow-hidden">
                  {b.logo_url ? (
                    <img src={b.logo_url} alt={b.nome} className="w-full h-full object-cover" />
                  ) : (
                    <Scissors className="h-10 w-10 opacity-30 text-[#B45A2B]" />
                  )}
                  <span className="absolute top-3 right-3 bg-black/75 text-white text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold backdrop-blur-sm">
                    <Star className="h-3 w-3 text-[#EAB308] fill-[#EAB308]" />
                    5.0 (Novo)
                  </span>
                </div>

                <CardContent className="p-5 flex flex-col gap-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold">{b.nome}</h3>
                      {b.bairro && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#B45A2B]/10 text-[#B45A2B] border border-[#B45A2B]/20 shrink-0">
                          {b.bairro}
                        </span>
                      )}
                    </div>
                    <p className="text-xs opacity-70 flex items-center gap-1 mt-1.5">
                      <MapPin className="h-3.5 w-3.5 text-[#B45A2B] shrink-0" />
                      <span className="truncate">
                        {[
                          b.endereco,
                          b.bairro,
                          b.cidade ? `${b.cidade}${b.estado ? ` - ${b.estado}` : ""}` : null,
                        ]
                          .filter(Boolean)
                          .join(", ") || "Localização central"}
                      </span>
                    </p>
                  </div>

                  <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                    <span className="text-xs font-medium text-[#16A34A] flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Disponível hoje
                    </span>
                    <Link href={`/barbearias/${b.slug}`}>
                      <Button variante="principal" tamanho="sm">
                        Agendar Horário
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Como Funciona o Barzzo */}
      <section className="py-8 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex flex-col gap-2 p-4 rounded-xl bg-neutral-50/50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
          <div className="h-10 w-10 rounded-lg bg-[#B45A2B]/10 flex items-center justify-center text-[#B45A2B] font-bold">
            1
          </div>
          <h4 className="font-bold text-base mt-2">Escolha o serviço e horário</h4>
          <p className="text-xs opacity-70">
            Navegue pelos serviços, preços e selecione o horário disponível que melhor se encaixa no seu dia.
          </p>
        </div>

        <div className="flex flex-col gap-2 p-4 rounded-xl bg-neutral-50/50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
          <div className="h-10 w-10 rounded-lg bg-[#B45A2B]/10 flex items-center justify-center text-[#B45A2B] font-bold">
            2
          </div>
          <h4 className="font-bold text-base mt-2">Identificação apenas no final</h4>
          <p className="text-xs opacity-70">
            Nenhuma barreira de login prévio. Você monta seu agendamento e só precisa se identificar no resumo.
          </p>
        </div>

        <div className="flex flex-col gap-2 p-4 rounded-xl bg-neutral-50/50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
          <div className="h-10 w-10 rounded-lg bg-[#B45A2B]/10 flex items-center justify-center text-[#B45A2B] font-bold">
            3
          </div>
          <h4 className="font-bold text-base mt-2">Chegue e seja atendido</h4>
          <p className="text-xs opacity-70">
            Sem filas ou espera demorada. A barbearia recebe seu agendamento na hora com confirmação instantânea.
          </p>
        </div>
      </section>
    </div>
  );
}
