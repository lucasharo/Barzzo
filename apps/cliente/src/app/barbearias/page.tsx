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

function ConteudoListagemBarbearias() {
  const searchParams = useSearchParams();
  const termoInicial = searchParams.get("q") || "";
  const cidadeInicial = searchParams.get("cidade") || "";

  const [busca, setBusca] = React.useState(termoInicial);
  const [cidade, setCidade] = React.useState(cidadeInicial);
  const [carregando, setCarregando] = React.useState(true);
  const [barbearias, setBarbearias] = React.useState<BarbeariaComDistancia[]>([]);
  const [localizacaoUsuario, setLocalizacaoUsuario] = React.useState<{ lat: number; lng: number } | null>(null);
  const [obtendoLocalizacao, setObtendoLocalizacao] = React.useState(false);
  const [erroLocalizacao, setErroLocalizacao] = React.useState<string | null>(null);
  const [mensagemLocalizacao, setMensagemLocalizacao] = React.useState<string | null>(null);

  React.useEffect(() => {
    carregarBarbearias();
  }, [busca, cidade, localizacaoUsuario]);

  async function carregarBarbearias() {
    try {
      setCarregando(true);
      const supabase = criarClienteSupabaseBrowser();

      let query = supabase
        .from("barbearias")
        .select("*, servicos (id, ativo)")
        .eq("ativa", true);

      if (busca.trim()) {
        query = query.ilike("nome", `%${busca.trim()}%`);
      }

      if (cidade.trim()) {
        const partes = cidade.split(/[,-]/).map((p) => p.trim()).filter(Boolean);
        const termoCidade = partes[0] || cidade.trim();
        query = query.ilike("cidade", `%${termoCidade}%`);
        if (partes.length > 1 && partes[1].length <= 2) {
          query = query.ilike("estado", `%${partes[1]}%`);
        }
      }

      const { data, error } = await query.order("nome", { ascending: true });

      if (data) {
        const lista: BarbeariaComDistancia[] = (data as any[]).map((b) => {
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
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000,
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocalizacaoUsuario({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setObtendoLocalizacao(false);
        setMensagemLocalizacao(
          "Localização detectada com sucesso! Barbearias ordenadas pelas mais próximas de você."
        );
        // Se havia filtro manual de cidade, limpar para exibir todas as mais próximas
        if (cidade.trim()) {
          setCidade("");
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
            "O tempo limite para obter sua localização expirou. Tente novamente ou use a busca por cidade."
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

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center p-3 rounded-2xl bg-[#F6F6F7] dark:bg-[#141416] border border-neutral-300 dark:border-neutral-700 shadow-sm">
        <div className="flex-1 flex items-center px-3 gap-2 min-h-[44px]">
          <Search className="h-4 w-4 text-[#B45A2B] shrink-0" />
          <input
            type="text"
            placeholder="Filtrar por nome ou serviço..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-transparent text-sm focus:outline-none placeholder:opacity-50"
          />
        </div>

        <div className="h-6 w-[1px] bg-neutral-300 dark:bg-neutral-700 hidden sm:block self-center" />

        <div className="flex items-center px-3 gap-2 min-h-[44px]">
          <MapPin className="h-4 w-4 opacity-50 shrink-0" />
          <input
            type="text"
            placeholder="Cidade..."
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            className="w-full sm:w-32 bg-transparent text-sm focus:outline-none placeholder:opacity-50"
          />
        </div>
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
                Tente ajustar os filtros de busca ou remover o nome da cidade.
              </p>
            </div>
            {(busca || cidade) && (
              <Button
                variante="secundario"
                tamanho="sm"
                onClick={() => {
                  setBusca("");
                  setCidade("");
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
                  <h3 className="text-lg font-bold">{b.nome}</h3>
                  <p className="text-xs opacity-70 flex items-center gap-1 mt-1">
                    <MapPin className="h-3.5 w-3.5 text-[#B45A2B]" />
                    {b.endereco ? `${b.endereco}, ` : ""}
                    {b.bairro ? `${b.bairro} — ` : ""}
                    {b.cidade || "Localização"}
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
