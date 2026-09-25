"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  LoadingSpinner,
  Alert,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { calcularDistanciaKm } from "@barzzo/dominio";
import type { Barbearia } from "@barzzo/tipos";
import {
  Search,
  MapPin,
  Scissors,
  Star,
  Compass,
  ArrowRight,
  Filter,
  Check,
  X,
} from "lucide-react";

interface BarbeariaComDistancia extends Barbearia {
  distancia_calculada?: number | null;
  total_servicos?: number;
}

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function ConteudoListagemBarbearias() {
  const searchParams = useSearchParams();
  const termoInicial = searchParams.get("q") || "";
  const localidadeInicial =
    searchParams.get("localidade") ||
    searchParams.get("cidade") ||
    searchParams.get("bairro") ||
    "";

  const [busca, setBusca] = React.useState(termoInicial);
  const [localidade, setLocalidade] = React.useState(localidadeInicial);
  const [bairroFiltro, setBairroFiltro] = React.useState("");
  const [bairrosDisponiveis, setBairrosDisponiveis] = React.useState<string[]>([]);
  const [carregando, setCarregando] = React.useState(true);
  const [barbearias, setBarbearias] = React.useState<BarbeariaComDistancia[]>([]);
  const [localizacaoUsuario, setLocalizacaoUsuario] = React.useState<{ lat: number; lng: number } | null>(null);
  const [obtendoLocalizacao, setObtendoLocalizacao] = React.useState(false);
  const [erroLocalizacao, setErroLocalizacao] = React.useState<string | null>(null);
  const [mensagemLocalizacao, setMensagemLocalizacao] = React.useState<string | null>(null);

  // Carregar lista de bairros disponíveis para filtros rápidos
  React.useEffect(() => {
    async function carregarBairros() {
      try {
        const supabase = criarClienteSupabaseBrowser();
        const { data } = await supabase
          .from("barbearias")
          .select("bairro")
          .eq("ativa", true)
          .not("bairro", "is", null);

        if (data) {
          const conjunto = new Set<string>();
          data.forEach((b: any) => {
            if (b.bairro && b.bairro.trim()) {
              conjunto.add(b.bairro.trim());
            }
          });
          setBairrosDisponiveis(Array.from(conjunto).sort());
        }
      } catch {
        // Fallback silencioso
      }
    }
    carregarBairros();
  }, []);

  React.useEffect(() => {
    carregarBarbearias();
  }, [busca, localidade, bairroFiltro, localizacaoUsuario]);

  async function carregarBarbearias() {
    try {
      setCarregando(true);
      const supabase = criarClienteSupabaseBrowser();

      let query = supabase
        .from("barbearias")
        .select("*, servicos (id, ativo, nome)")
        .eq("ativa", true);

      if (busca.trim()) {
        query = query.ilike("nome", `%${busca.trim()}%`);
      }

      const termoLoc = (bairroFiltro || localidade).trim();
      if (termoLoc) {
        const partes = termoLoc.split(/[,-]/).map((p) => p.trim()).filter(Boolean);
        if (partes.length >= 2) {
          if (partes[1].length === 2) {
            query = query
              .or(`cidade.ilike.%${partes[0]}%,bairro.ilike.%${partes[0]}%`)
              .ilike("estado", `%${partes[1]}%`);
          } else {
            query = query.or(
              `and(bairro.ilike.%${partes[0]}%,cidade.ilike.%${partes[1]}%),and(cidade.ilike.%${partes[0]}%,bairro.ilike.%${partes[1]}%),bairro.ilike.%${partes[0]}%,cidade.ilike.%${partes[0]}%`
            );
          }
        } else {
          query = query.or(`cidade.ilike.%${termoLoc}%,bairro.ilike.%${termoLoc}%`);
        }
      }

      const { data, error } = await query.order("nome", { ascending: true });

      if (data) {
        let lista: BarbeariaComDistancia[] = (data as any[]).map((b) => {
          let dist: number | null = null;
          if (localizacaoUsuario && b.latitude && b.longitude) {
            dist = calcularDistanciaKm(
              localizacaoUsuario.lat,
              localizacaoUsuario.lng,
              Number(b.latitude),
              Number(b.longitude)
            );
          }
          const servicosAtivos = (b.servicos || []).filter((s: any) => s.ativo).length;
          return {
            ...b,
            distancia_calculada: dist,
            total_servicos: servicosAtivos,
          };
        });

        // Refinamento em memória para tolerar variações de acentuação no bairro/cidade
        if (termoLoc) {
          const termoNorm = normalizarTexto(termoLoc);
          lista = lista.filter((b) => {
            const bairroNorm = normalizarTexto(b.bairro || "");
            const cidadeNorm = normalizarTexto(b.cidade || "");
            const estadoNorm = normalizarTexto(b.estado || "");
            return (
              bairroNorm.includes(termoNorm) ||
              cidadeNorm.includes(termoNorm) ||
              estadoNorm.includes(termoNorm) ||
              `${bairroNorm} ${cidadeNorm}`.includes(termoNorm) ||
              `${cidadeNorm} ${bairroNorm}`.includes(termoNorm)
            );
          });
        }

        // Se o usuário permitiu localização, ordenar por proximidade
        if (localizacaoUsuario) {
          lista.sort((a, b) => {
            const dA = a.distancia_calculada ?? 999999;
            const dB = b.distancia_calculada ?? 999999;
            return dA - dB;
          });
        }

        setBarbearias(lista);
      }
    } catch {
      // Tratamento silencioso
    } finally {
      setCarregando(false);
    }
  }

  function alternarLocalizacao() {
    // Se já estiver ativa, o clique desativa e volta à ordenação padrão
    if (localizacaoUsuario) {
      setLocalizacaoUsuario(null);
      setMensagemLocalizacao(null);
      setErroLocalizacao(null);
      return;
    }

    if (typeof window === "undefined" || !navigator.geolocation) {
      setErroLocalizacao("Geolocalização não é suportada pelo seu navegador ou dispositivo.");
      return;
    }

    setObtendoLocalizacao(true);
    setErroLocalizacao(null);
    setMensagemLocalizacao(null);

    const opcoesGeo: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    };

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocalizacaoUsuario({ lat, lng });
        setObtendoLocalizacao(false);

        // Tentar obter bairro e cidade por geocodificação reversa rápida
        let bairroDetectado = "";
        let cidadeDetectada = "";

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=pt`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);
          if (res.ok) {
            const dataGeo = await res.json();
            bairroDetectado = dataGeo.locality || dataGeo.district || "";
            cidadeDetectada = dataGeo.city || "";
          }
        } catch {
          // Fallback silencioso para geocodificação
        }

        const localFormatado = [bairroDetectado, cidadeDetectada].filter(Boolean).join(", ");
        if (localFormatado) {
          setMensagemLocalizacao(
            `Localização detectada: ${localFormatado}! Barbearias ordenadas pelas mais próximas de você.`
          );
        } else {
          setMensagemLocalizacao(
            "Localização detectada com sucesso! Barbearias ordenadas pelas mais próximas de você."
          );
        }

        // Limpar filtros manuais para exibir todas as barbearias ordenadas por distância
        if (localidade.trim() || bairroFiltro) {
          setLocalidade("");
          setBairroFiltro("");
        }
      },
      (err) => {
        setObtendoLocalizacao(false);
        if (err.code === 1) {
          setErroLocalizacao(
            "Permissão de localização negada pelo navegador. Permita o acesso à localização para ordenar as barbearias por proximidade."
          );
        } else if (err.code === 2) {
          setErroLocalizacao(
            "Não foi possível determinar sua localização atual. Você pode buscar digitando sua cidade ou bairro no campo de pesquisa."
          );
        } else if (err.code === 3) {
          setErroLocalizacao(
            "O tempo limite para obter sua localização expirou. Tente novamente ou use a busca por cidade/bairro."
          );
        } else {
          setErroLocalizacao("Ocorreu um erro ao obter sua localização. Tente novamente.");
        }
      },
      opcoesGeo
    );
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Header com Filtros */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Barbearias Disponíveis</h1>
          <p className="text-sm opacity-70 mt-1">
            Encontre o local ideal perto de você para cortar cabelo, alinhar barba e muito mais.
          </p>
        </div>

        <button
          type="button"
          onClick={alternarLocalizacao}
          disabled={obtendoLocalizacao}
          className={`text-xs font-semibold px-3.5 py-2 rounded-lg border flex items-center gap-2 transition-all self-start md:self-auto min-h-[44px] ${
            localizacaoUsuario
              ? "bg-[#B45A2B] text-white border-[#B45A2B] shadow-sm hover:bg-[#C46632]"
              : "border-neutral-300 dark:border-neutral-700 hover:border-[#B45A2B] text-black dark:text-white"
          }`}
          title={
            localizacaoUsuario
              ? "Localização ativada. Clique para desativar e voltar à ordenação padrão."
              : "Usar minha localização para ordenar barbearias por proximidade"
          }
        >
          {obtendoLocalizacao ? (
            <>
              <Compass className="h-4 w-4 animate-spin text-[#B45A2B]" />
              <span>Detectando localização...</span>
            </>
          ) : localizacaoUsuario ? (
            <>
              <Check className="h-4 w-4 text-white" />
              <span>Localização ativa</span>
              <X className="h-3.5 w-3.5 ml-1 opacity-75 hover:opacity-100" />
            </>
          ) : (
            <>
              <Compass className="h-4 w-4 text-[#B45A2B]" />
              <span>Usar minha localização</span>
            </>
          )}
        </button>
      </div>

      {/* Avisos Informativos de Localização */}
      {erroLocalizacao && (
        <Alert variante="alerta" className="flex items-center justify-between">
          <span>{erroLocalizacao}</span>
          <button
            type="button"
            onClick={() => setErroLocalizacao(null)}
            className="text-xs font-bold underline ml-4 hover:opacity-80 shrink-0"
          >
            Fechar
          </button>
        </Alert>
      )}

      {mensagemLocalizacao && (
        <Alert variante="sucesso" className="flex items-center justify-between">
          <span>{mensagemLocalizacao}</span>
          <button
            type="button"
            onClick={() => setMensagemLocalizacao(null)}
            className="text-xs font-bold underline ml-4 hover:opacity-80 shrink-0"
          >
            Fechar
          </button>
        </Alert>
      )}

      {/* Barra de Filtros (Pesquisa por Nome/Serviço e Cidade/Bairro) */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center p-3 rounded-2xl bg-[#F6F6F7] dark:bg-[#141416] border border-neutral-300 dark:border-neutral-700 shadow-sm">
          <div className="flex-1 flex items-center px-3 gap-2 min-h-[44px]">
            <Search className="h-4 w-4 text-[#B45A2B] shrink-0" />
            <input
              type="text"
              placeholder="Filtrar por nome ou serviço..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-transparent text-sm focus:outline-none placeholder:opacity-50 text-black dark:text-white"
            />
          </div>

          <div className="h-6 w-[1px] bg-neutral-300 dark:bg-neutral-700 hidden sm:block self-center" />

          <div className="flex items-center px-3 gap-2 min-h-[44px]">
            <MapPin className="h-4 w-4 text-[#B45A2B] shrink-0" />
            <input
              type="text"
              placeholder="Cidade ou Bairro..."
              value={localidade}
              onChange={(e) => {
                setLocalidade(e.target.value);
                setBairroFiltro("");
              }}
              className="w-full sm:w-44 bg-transparent text-sm focus:outline-none placeholder:opacity-50 text-black dark:text-white"
            />
            {(localidade || bairroFiltro) && (
              <button
                type="button"
                onClick={() => {
                  setLocalidade("");
                  setBairroFiltro("");
                }}
                className="text-xs opacity-50 hover:opacity-100 p-1"
                title="Limpar localização"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Chips de Bairros Disponíveis para Acesso Rápido */}
        {bairrosDisponiveis.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-neutral-500 dark:text-neutral-400 font-medium shrink-0 flex items-center gap-1 mr-1">
              <MapPin className="h-3 w-3 text-[#B45A2B]" /> Bairros:
            </span>
            <button
              type="button"
              onClick={() => {
                setBairroFiltro("");
                setLocalidade("");
              }}
              className={`px-3 py-1 rounded-full border transition-colors shrink-0 ${
                !bairroFiltro && !localidade
                  ? "bg-[#B45A2B] text-white border-[#B45A2B] font-semibold"
                  : "border-neutral-200 dark:border-neutral-800 hover:border-[#B45A2B] text-black dark:text-white"
              }`}
            >
              Todos
            </button>
            {bairrosDisponiveis.map((bNome) => {
              const ativo =
                bairroFiltro === bNome ||
                normalizarTexto(localidade) === normalizarTexto(bNome);
              return (
                <button
                  key={bNome}
                  type="button"
                  onClick={() => {
                    if (ativo) {
                      setBairroFiltro("");
                      setLocalidade("");
                    } else {
                      setBairroFiltro(bNome);
                      setLocalidade(bNome);
                    }
                  }}
                  className={`px-3 py-1 rounded-full border transition-colors shrink-0 ${
                    ativo
                      ? "bg-[#B45A2B] text-white border-[#B45A2B] font-semibold"
                      : "border-neutral-200 dark:border-neutral-800 hover:border-[#B45A2B] text-black dark:text-white"
                  }`}
                >
                  {bNome}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Lista de Resultados */}
      {carregando ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <LoadingSpinner tamanho="lg" />
          <p className="text-sm opacity-70">Consultando barbearias do marketplace...</p>
        </div>
      ) : barbearias.length === 0 ? (
        <Card camada="primaria" className="text-center py-16">
          <CardContent className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-[#B45A2B]/10 flex items-center justify-center text-[#B45A2B]">
              <Scissors className="h-6 w-6" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold text-lg">Nenhuma barbearia encontrada</h3>
              <p className="text-sm opacity-70 max-w-sm">
                Tente ajustar os filtros de busca ou remover o filtro de cidade/bairro.
              </p>
            </div>
            {(busca || localidade || bairroFiltro) && (
              <Button
                variante="secundario"
                tamanho="sm"
                onClick={() => {
                  setBusca("");
                  setLocalidade("");
                  setBairroFiltro("");
                }}
              >
                Limpar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {barbearias.map((b) => (
            <Card
              key={b.id}
              camada="primaria"
              className="hover:border-[#B45A2B]/60 transition-all hover:shadow-md flex flex-col justify-between"
            >
              <div className="h-40 bg-[#EEEEF0] dark:bg-[#1C1C1F] rounded-t-xl flex items-center justify-center relative overflow-hidden">
                {b.logo_url ? (
                  <img src={b.logo_url} alt={b.nome} className="w-full h-full object-cover" />
                ) : (
                  <Scissors className="h-12 w-12 opacity-30 text-[#B45A2B]" />
                )}
                <span className="absolute top-3 right-3 bg-black/75 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-semibold backdrop-blur-sm">
                  <Star className="h-3.5 w-3.5 text-[#EAB308] fill-[#EAB308]" />
                  5.0
                </span>

                {b.distancia_calculada !== undefined && b.distancia_calculada !== null && (
                  <span className="absolute bottom-3 left-3 bg-[#B45A2B] text-white text-[11px] px-2 py-0.5 rounded-full font-bold shadow">
                    {b.distancia_calculada} km de você
                  </span>
                )}
              </div>

              <CardContent className="p-5 flex flex-col gap-4">
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
                        .join(", ") || "Localização não informada"}
                    </span>
                  </p>
                </div>

                <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                  <span className="text-xs opacity-75">
                    <strong>{b.total_servicos || 0}</strong> serviços ativos
                  </span>

                  <Link href={`/barbearias/${b.slug}`}>
                    <Button variante="principal" tamanho="sm">
                      Ver Perfil <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PaginaListagemBarbearias() {
  return (
    <React.Suspense
      fallback={
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <LoadingSpinner tamanho="lg" />
          <p className="text-sm opacity-70">Carregando barbearias...</p>
        </div>
      }
    >
      <ConteudoListagemBarbearias />
    </React.Suspense>
  );
}
