import * as React from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
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
  AlertaTemporizado,
  Modal,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import {
  calcularDistanciaKm,
  calcularMediaAvaliacoes,
  obterPrecoCorte,
} from "@barzzo/dominio";
import { geocodificarEndereco } from "@barzzo/utilitarios";
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
  SlidersHorizontal,
  ArrowUpDown,
  ChevronDown,
} from "lucide-react";

interface BarbeariaComDistancia extends Barbearia {
  distancia_calculada?: number | null;
  total_servicos?: number;
  menor_preco?: number | null;
  maior_preco?: number | null;
  preco_corte?: number | null;
  media_nota?: number;
  total_avaliacoes?: number;
}

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function ConteudoListagemBarbearias() {
  const [searchParams] = useSearchParams();
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
  const [coordenadasEndereco, setCoordenadasEndereco] = React.useState<{ lat: number; lng: number } | null>(null);
  const [geocodificando, setGeocodificando] = React.useState(false);

  // Novos estados para filtros de Preço, Distância, Nota e Ordenação
  const [faixaPreco, setFaixaPreco] = React.useState<"todos" | "ate-35" | "ate-50" | "ate-75" | "acima-75">("todos");
  const [raioDistancia, setRaioDistancia] = React.useState<number | null>(null);
  const [notaMinima, setNotaMinima] = React.useState<number | null>(null);
  const [ordenacao, setOrdenacao] = React.useState<"relevancia" | "distancia" | "menor-preco" | "maior-preco" | "melhor-nota">("relevancia");
  const [modalFiltrosAberto, setModalFiltrosAberto] = React.useState(false);

  // Estados temporários do modal (rascunho até o clique em "Aplicar")
  const [tempFaixaPreco, setTempFaixaPreco] = React.useState<"todos" | "ate-35" | "ate-50" | "ate-75" | "acima-75">("todos");
  const [tempRaioDistancia, setTempRaioDistancia] = React.useState<number | null>(null);
  const [tempNotaMinima, setTempNotaMinima] = React.useState<number | null>(null);

  // Controle do menu popover de endereço e bairros
  const [dropdownEnderecoAberto, setDropdownEnderecoAberto] = React.useState(false);
  const containerEnderecoRef = React.useRef<HTMLDivElement>(null);

  // Controle do seletor customizado de ordenação
  const [dropdownOrdenacaoAberto, setDropdownOrdenacaoAberto] = React.useState(false);
  const containerOrdenacaoRef = React.useRef<HTMLDivElement>(null);

  const opcoesOrdenacao = [
    { id: "relevancia", rotuloCompleto: "Ordenar: Relevância" },
    { id: "distancia", rotuloCompleto: "Ordenar: Mais Próximas" },
    { id: "menor-preco", rotuloCompleto: "Ordenar: Menor Preço" },
    { id: "maior-preco", rotuloCompleto: "Ordenar: Maior Preço" },
    { id: "melhor-nota", rotuloCompleto: "Ordenar: Melhor Avaliadas" },
  ] as const;

  React.useEffect(() => {
    function lidarComCliqueFora(e: MouseEvent) {
      if (
        containerEnderecoRef.current &&
        !containerEnderecoRef.current.contains(e.target as Node)
      ) {
        setDropdownEnderecoAberto(false);
      }
      if (
        containerOrdenacaoRef.current &&
        !containerOrdenacaoRef.current.contains(e.target as Node)
      ) {
        setDropdownOrdenacaoAberto(false);
      }
    }
    document.addEventListener("mousedown", lidarComCliqueFora);
    return () => document.removeEventListener("mousedown", lidarComCliqueFora);
  }, []);

  // Contagem de filtros ativos (excluindo busca textual)
  const totalFiltrosAtivos = React.useMemo(() => {
    let count = 0;
    if (faixaPreco !== "todos") count++;
    if (raioDistancia !== null) count++;
    if (notaMinima !== null) count++;
    return count;
  }, [faixaPreco, raioDistancia, notaMinima]);

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

  // Geocodificação com debounce do endereço/localidade digitado
  React.useEffect(() => {
    const termo = (bairroFiltro || localidade).trim();

    if (!termo) {
      setCoordenadasEndereco(null);
      setGeocodificando(false);
      return;
    }

    // Se o termo for muito curto (menos de 3 caracteres), aguarda
    if (termo.length < 3) {
      setCoordenadasEndereco(null);
      setGeocodificando(false);
      return;
    }

    let cancelado = false;
    setGeocodificando(true);

    const timer = setTimeout(async () => {
      try {
        const coords = await geocodificarEndereco(termo);
        if (!cancelado) {
          if (coords) {
            setCoordenadasEndereco({ lat: coords.lat, lng: coords.lng });
          } else {
            setCoordenadasEndereco(null);
          }
        }
      } catch {
        if (!cancelado) {
          setCoordenadasEndereco(null);
        }
      } finally {
        if (!cancelado) {
          setGeocodificando(false);
        }
      }
    }, 400);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [localidade, bairroFiltro]);

  React.useEffect(() => {
    // Se está em processo de geocodificar o endereço digitado, aguarda a resolução das coordenadas
    if (geocodificando) return;
    carregarBarbearias();
  }, [
    busca,
    localidade,
    bairroFiltro,
    localizacaoUsuario,
    coordenadasEndereco,
    geocodificando,
    faixaPreco,
    raioDistancia,
    notaMinima,
    ordenacao,
  ]);

  async function carregarBarbearias() {
    try {
      setCarregando(true);
      const supabase = criarClienteSupabaseBrowser();

      const termoLoc = (bairroFiltro || localidade).trim();
      // O endereço digitado no campo de busca tem prioridade absoluta sobre o GPS do dispositivo
      const coordsEfetivas = termoLoc ? coordenadasEndereco : localizacaoUsuario;

      // Chamada da RPC no PostgreSQL que calcula distância e estatísticas
      const { data, error } = await supabase.rpc("buscar_barbearias_com_distancia", {
        p_latitude: coordsEfetivas?.lat ?? null,
        p_longitude: coordsEfetivas?.lng ?? null,
        p_busca_nome: busca.trim() || null,
        p_raio_km: raioDistancia || null,
      });

      if (error) {
        console.error("Erro na RPC buscar_barbearias_com_distancia:", error);
      }

      if (data) {
        let lista: BarbeariaComDistancia[] = (data as any[]).map((b) => {
          const dist =
            b.distancia_km !== null && b.distancia_km !== undefined
              ? Number(b.distancia_km)
              : null;
          const precoCorte =
            b.preco_corte !== null && b.preco_corte !== undefined
              ? Number(b.preco_corte)
              : null;
          const menorPreco =
            b.menor_preco !== null && b.menor_preco !== undefined
              ? Number(b.menor_preco)
              : null;
          const maiorPreco =
            b.maior_preco !== null && b.maior_preco !== undefined
              ? Number(b.maior_preco)
              : null;
          const mediaNota =
            b.media_nota !== null && b.media_nota !== undefined
              ? Number(b.media_nota)
              : 0;
          const totalAvaliacoes = Number(b.total_avaliacoes || 0);
          const totalServicos = Number(b.total_servicos || 0);

          return {
            ...b,
            distancia_calculada: dist,
            preco_corte: precoCorte,
            menor_preco: menorPreco,
            maior_preco: maiorPreco,
            media_nota: mediaNota,
            total_avaliacoes: totalAvaliacoes,
            total_servicos: totalServicos,
          };
        });

        // Refinamento de busca textual de endereço SOMENTE se não houver coordenadas geocodificadas
        if (!coordsEfetivas && termoLoc) {
          const termoNorm = normalizarTexto(termoLoc);
          const termoDigitos = termoLoc.replace(/\D/g, "");
          lista = lista.filter((b) => {
            const bairroNorm = normalizarTexto(b.bairro || "");
            const cidadeNorm = normalizarTexto(b.cidade || "");
            const estadoNorm = normalizarTexto(b.estado || "");
            const enderecoNorm = normalizarTexto(b.endereco || "");
            const cepDigitos = (b.cep || "").replace(/\D/g, "");

            return (
              bairroNorm.includes(termoNorm) ||
              cidadeNorm.includes(termoNorm) ||
              estadoNorm.includes(termoNorm) ||
              enderecoNorm.includes(termoNorm) ||
              (termoDigitos.length >= 4 && cepDigitos.includes(termoDigitos)) ||
              `${bairroNorm} ${cidadeNorm}`.includes(termoNorm) ||
              `${cidadeNorm} ${bairroNorm}`.includes(termoNorm) ||
              `${enderecoNorm} ${bairroNorm}`.includes(termoNorm)
            );
          });
        }

        // Filtro por faixa de preço
        if (faixaPreco !== "todos") {
          lista = lista.filter((b) => {
            const precoReferencia = b.preco_corte ?? b.menor_preco;
            if (precoReferencia === null || precoReferencia === undefined) return false;
            if (faixaPreco === "ate-35") return precoReferencia <= 35;
            if (faixaPreco === "ate-50") return precoReferencia <= 50;
            if (faixaPreco === "ate-75") return precoReferencia <= 75;
            if (faixaPreco === "acima-75") return precoReferencia > 75;
            return true;
          });
        }

        // Filtro por raio de distância (garantia adicional no frontend)
        if (raioDistancia !== null && coordsEfetivas) {
          lista = lista.filter((b) => {
            if (b.distancia_calculada === null || b.distancia_calculada === undefined) return false;
            return b.distancia_calculada <= raioDistancia;
          });
        }

        // Filtro por nota mínima
        if (notaMinima !== null) {
          lista = lista.filter((b) => {
            if ((b.total_avaliacoes || 0) === 0) return false;
            return (b.media_nota || 0) >= notaMinima;
          });
        }

        // Ordenação
        lista.sort((a, b) => {
          if (ordenacao === "distancia" && coordsEfetivas) {
            const dA = a.distancia_calculada ?? 999999;
            const dB = b.distancia_calculada ?? 999999;
            return dA - dB;
          }
          if (ordenacao === "menor-preco") {
            const pA = a.preco_corte ?? a.menor_preco ?? 999999;
            const pB = b.preco_corte ?? b.menor_preco ?? 999999;
            return pA - pB;
          }
          if (ordenacao === "maior-preco") {
            const pA = a.preco_corte ?? a.menor_preco ?? 0;
            const pB = b.preco_corte ?? b.menor_preco ?? 0;
            return pB - pA;
          }
          if (ordenacao === "melhor-nota") {
            const nA = a.media_nota ?? 0;
            const nB = b.media_nota ?? 0;
            if (nB !== nA) return nB - nA;
            return (b.total_avaliacoes ?? 0) - (a.total_avaliacoes ?? 0);
          }
          // Padrão: se houver coordenadas (GPS ou endereço pesquisado), ordena por proximidade!
          if (coordsEfetivas) {
            const dA = a.distancia_calculada ?? 999999;
            const dB = b.distancia_calculada ?? 999999;
            return dA - dB;
          }
          return a.nome.localeCompare(b.nome);
        });

        setBarbearias(lista);
      }
    } catch {
      // Tratamento silencioso
    } finally {
      setCarregando(false);
    }
  }

  function alternarLocalizacao() {
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

        setLocalidade("");
        setBairroFiltro("");
        setCoordenadasEndereco(null);
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
        <AlertaTemporizado
          variante="alerta"
          duracaoMs={8000}
          aoExpirar={() => setErroLocalizacao(null)}
        >
          <span>{erroLocalizacao}</span>
        </AlertaTemporizado>
      )}

      {mensagemLocalizacao && (
        <AlertaTemporizado
          variante="sucesso"
          duracaoMs={5000}
          aoExpirar={() => setMensagemLocalizacao(null)}
        >
          <span>{mensagemLocalizacao}</span>
        </AlertaTemporizado>
      )}

      {coordenadasEndereco && (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#B45A2B]/10 border border-[#B45A2B]/20 text-xs text-[#B45A2B] font-medium">
          <MapPin className="h-4 w-4 shrink-0" />
          <span>
            Exibindo barbearias com distâncias calculadas a partir de &quot;{bairroFiltro || localidade}&quot; e ordenadas pelas mais próximas.
          </span>
        </div>
      )}

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col gap-3">
        {/* Linha Principal de Busca e Ações de Filtro */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          <div className="flex-1 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center p-2 sm:p-2.5 rounded-2xl bg-[#F6F6F7] dark:bg-[#141416] border border-neutral-300 dark:border-neutral-700 shadow-sm">
            {/* Campo de Busca por Nome */}
            <div className="flex-1 min-w-0 flex items-center px-3 gap-2 min-h-[44px]">
              <Search className="h-4 w-4 text-[#B45A2B] shrink-0" />
              <input
                type="text"
                placeholder="Buscar pelo nome..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full bg-transparent text-sm focus:outline-none placeholder:opacity-50 text-black dark:text-white"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  className="text-xs opacity-50 hover:opacity-100 p-1"
                  title="Limpar nome"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="h-6 w-[1px] bg-neutral-300 dark:bg-neutral-700 hidden sm:block self-center" />

            {/* Campo de Endereço com Popover Integrado */}
            <div ref={containerEnderecoRef} className="relative flex-1 sm:flex-[1.5] min-w-0">
              <div
                className="flex items-center px-3 gap-2 min-h-[44px] cursor-pointer"
                onClick={() => setDropdownEnderecoAberto(true)}
              >
                <MapPin className="h-4 w-4 text-[#B45A2B] shrink-0" />
                <input
                  type="text"
                  placeholder="Bairro, Cidade, Rua ou CEP..."
                  value={bairroFiltro || localidade}
                  onFocus={() => setDropdownEnderecoAberto(true)}
                  onChange={(e) => {
                    setLocalidade(e.target.value);
                    setBairroFiltro("");
                    if (localizacaoUsuario) {
                      setLocalizacaoUsuario(null);
                      setMensagemLocalizacao(null);
                    }
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      const termo = (bairroFiltro || localidade).trim();
                      if (termo.length >= 3) {
                        setGeocodificando(true);
                        try {
                          const coords = await geocodificarEndereco(termo);
                          if (coords) {
                            setCoordenadasEndereco({ lat: coords.lat, lng: coords.lng });
                          } else {
                            setCoordenadasEndereco(null);
                          }
                        } catch {
                          setCoordenadasEndereco(null);
                        } finally {
                          setGeocodificando(false);
                        }
                      }
                    }
                  }}
                  className="w-full bg-transparent text-sm focus:outline-none placeholder:opacity-50 text-black dark:text-white"
                />
                {geocodificando && (
                  <LoadingSpinner tamanho="sm" />
                )}
                {(localidade || bairroFiltro) && !geocodificando && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocalidade("");
                      setBairroFiltro("");
                      setCoordenadasEndereco(null);
                    }}
                    className="text-xs opacity-50 hover:opacity-100 p-1"
                    title="Limpar localização"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <ChevronDown
                  className={`h-3.5 w-3.5 opacity-50 transition-transform ${
                    dropdownEnderecoAberto ? "rotate-180" : ""
                  }`}
                />
              </div>

              {/* Popover / Dropdown de Endereço e Bairros */}
              {dropdownEnderecoAberto && (
                <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-md p-4 rounded-2xl bg-white dark:bg-[#141416] border border-neutral-200 dark:border-neutral-800 shadow-2xl z-50 flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-black dark:text-white">
                      <MapPin className="h-3.5 w-3.5 text-[#B45A2B]" />
                      <span>Endereço de Busca</span>
                    </div>
                    {(localidade || bairroFiltro) && (
                      <button
                        type="button"
                        onClick={() => {
                          setLocalidade("");
                          setBairroFiltro("");
                          setCoordenadasEndereco(null);
                        }}
                        className="text-[11px] font-semibold text-[#DC2626] hover:underline"
                      >
                        Limpar endereço
                      </button>
                    )}
                  </div>

                  {/* Ação rápida: Usar GPS */}
                  <button
                    type="button"
                    onClick={() => {
                      alternarLocalizacao();
                      setDropdownEnderecoAberto(false);
                    }}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-[#B45A2B] bg-[#F6F6F7] dark:bg-[#0A0A0B] text-xs font-semibold text-left transition-colors text-black dark:text-white"
                  >
                    <Compass className="h-4 w-4 text-[#B45A2B] shrink-0" />
                    <div className="flex flex-col">
                      <span>Usar minha localização atual</span>
                      <span className="text-[10px] opacity-60 font-normal">
                        Ordenar barbearias mais próximas por GPS
                      </span>
                    </div>
                  </button>

                  {/* Bairros Cadastrados no Marketplace */}
                  {bairrosDisponiveis.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">
                        Bairros com Barbearias
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                        <button
                          type="button"
                          onClick={() => {
                            setBairroFiltro("");
                            setLocalidade("");
                            setCoordenadasEndereco(null);
                            setDropdownEnderecoAberto(false);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs transition-colors border ${
                            !bairroFiltro && !localidade
                              ? "bg-[#B45A2B] text-white border-[#B45A2B] font-semibold"
                              : "border-neutral-200 dark:border-neutral-800 hover:border-[#B45A2B] text-black dark:text-white"
                          }`}
                        >
                          Todos os bairros
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
                                setBairroFiltro(bNome);
                                setLocalidade(bNome);
                                if (localizacaoUsuario) {
                                  setLocalizacaoUsuario(null);
                                  setMensagemLocalizacao(null);
                                }
                                setDropdownEnderecoAberto(false);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs transition-colors border ${
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
                    </div>
                  )}

                  <div className="text-[11px] opacity-60 leading-relaxed border-t border-neutral-200 dark:border-neutral-800 pt-2">
                    💡 Dica: Você pode digitar o seu <strong>Bairro</strong>, <strong>Cidade</strong>, <strong>Rua/Avenida</strong> ou <strong>CEP</strong> no campo de busca.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Botão de Filtros Avançados e Seletor de Ordenação */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setTempFaixaPreco(faixaPreco);
                setTempRaioDistancia(raioDistancia);
                setTempNotaMinima(notaMinima);
                setModalFiltrosAberto(true);
              }}
              className={`min-h-[44px] px-4 py-2 rounded-2xl border flex items-center gap-2 text-xs font-semibold transition-all select-none ${
                modalFiltrosAberto || totalFiltrosAtivos > 0
                  ? "bg-[#B45A2B] text-white border-[#B45A2B] shadow-sm hover:bg-[#C46632]"
                  : "bg-[#F6F6F7] dark:bg-[#141416] border-neutral-300 dark:border-neutral-700 hover:border-[#B45A2B] text-black dark:text-white"
              }`}
              aria-label="Abrir filtros avançados"
              aria-expanded={modalFiltrosAberto}
            >
              <SlidersHorizontal className="h-4 w-4 shrink-0" />
              <span>Filtros</span>
              {totalFiltrosAtivos > 0 && (
                <span className="h-5 min-w-5 px-1 rounded-full bg-white text-black font-bold text-[10px] flex items-center justify-center">
                  {totalFiltrosAtivos}
                </span>
              )}
            </button>

            {/* Seletor Customizado de Ordenação */}
            <div ref={containerOrdenacaoRef} className="relative flex-1 sm:flex-initial">
              <button
                type="button"
                onClick={() => setDropdownOrdenacaoAberto(!dropdownOrdenacaoAberto)}
                aria-haspopup="listbox"
                aria-expanded={dropdownOrdenacaoAberto}
                aria-label="Opções de ordenação"
                className={`w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-2xl border flex items-center justify-between gap-2.5 text-xs font-semibold transition-all select-none cursor-pointer ${
                  dropdownOrdenacaoAberto
                    ? "border-[#B45A2B] bg-[#F6F6F7] dark:bg-[#141416] text-black dark:text-white shadow-sm"
                    : "bg-[#F6F6F7] dark:bg-[#141416] border-neutral-300 dark:border-neutral-700 hover:border-[#B45A2B] text-black dark:text-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-[#B45A2B] shrink-0" />
                  <span className="truncate">
                    {opcoesOrdenacao.find((o) => o.id === ordenacao)?.rotuloCompleto || "Ordenar: Relevância"}
                  </span>
                </div>
                <ChevronDown
                  className={`h-3.5 w-3.5 opacity-50 shrink-0 transition-transform duration-200 ${
                    dropdownOrdenacaoAberto ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Menu Dropdown de Ordenação Customizado */}
              {dropdownOrdenacaoAberto && (
                <div
                  role="listbox"
                  className="absolute right-0 top-full mt-2 w-56 p-1.5 rounded-2xl bg-white dark:bg-[#141416] border border-neutral-200 dark:border-neutral-800 shadow-2xl z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150"
                >
                  {opcoesOrdenacao.map((opcao) => {
                    const ativo = ordenacao === opcao.id;
                    return (
                      <button
                        key={opcao.id}
                        type="button"
                        role="option"
                        aria-selected={ativo}
                        onClick={() => {
                          setOrdenacao(opcao.id as any);
                          setDropdownOrdenacaoAberto(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors text-left ${
                          ativo
                            ? "bg-[#B45A2B]/10 text-[#B45A2B] font-bold"
                            : "text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800/80"
                        }`}
                      >
                        <span>{opcao.rotuloCompleto}</span>
                        {ativo && <Check className="h-3.5 w-3.5 text-[#B45A2B] shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal de Filtros Refinados */}
        <Modal
          aberto={modalFiltrosAberto}
          aoFechar={() => setModalFiltrosAberto(false)}
          titulo="Filtros Refinados"
          descricao="Ajuste os critérios para encontrar a barbearia ideal"
          tamanho="md"
          rodape={
            <div className="grid grid-cols-2 gap-3 w-full">
              <Button
                type="button"
                variante="cancelar-simples"
                tamanho="md"
                onClick={() => {
                  setTempFaixaPreco("todos");
                  setTempRaioDistancia(null);
                  setTempNotaMinima(null);
                }}
                className="w-full min-h-[44px]"
              >
                Limpar
              </Button>
              <Button
                type="button"
                variante="principal"
                tamanho="md"
                onClick={() => {
                  setFaixaPreco(tempFaixaPreco);
                  setRaioDistancia(tempRaioDistancia);
                  setNotaMinima(tempNotaMinima);
                  setModalFiltrosAberto(false);
                }}
                className="w-full min-h-[44px]"
              >
                Aplicar
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-6 py-1">
            {/* Filtro por Faixa de Preço do Corte */}
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider opacity-70">
                Preço do Corte
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "todos", rotulo: "Qualquer valor" },
                  { id: "ate-35", rotulo: "Até R$ 35" },
                  { id: "ate-50", rotulo: "Até R$ 50" },
                  { id: "ate-75", rotulo: "Até R$ 75" },
                  { id: "acima-75", rotulo: "R$ 75+" },
                ].map((opcao) => {
                  const ativo = tempFaixaPreco === opcao.id;
                  return (
                    <button
                      key={opcao.id}
                      type="button"
                      onClick={() => setTempFaixaPreco(opcao.id as any)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors min-h-[38px] ${
                        ativo
                          ? "bg-[#B45A2B] text-white border-[#B45A2B] font-semibold shadow-sm"
                          : "bg-white dark:bg-[#141416] border-neutral-300 dark:border-neutral-700 hover:border-[#B45A2B] text-black dark:text-white"
                      }`}
                    >
                      {opcao.rotulo}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filtro por Raio de Distância */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider opacity-70">
                  Distância Máxima
                </span>
                {!localizacaoUsuario && (
                  <button
                    type="button"
                    onClick={alternarLocalizacao}
                    className="text-[11px] font-semibold text-[#B45A2B] hover:underline flex items-center gap-1"
                  >
                    <Compass className="h-3 w-3" /> Ativar GPS
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { valor: null, rotulo: "Qualquer" },
                  { valor: 2, rotulo: "Até 2 km" },
                  { valor: 5, rotulo: "Até 5 km" },
                  { valor: 10, rotulo: "Até 10 km" },
                  { valor: 25, rotulo: "Até 25 km" },
                ].map((opcao) => {
                  const ativo = tempRaioDistancia === opcao.valor;
                  return (
                    <button
                      key={String(opcao.valor)}
                      type="button"
                      onClick={() => {
                        if (!localizacaoUsuario && opcao.valor !== null) {
                          alternarLocalizacao();
                        }
                        setTempRaioDistancia(opcao.valor);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors min-h-[38px] ${
                        ativo
                          ? "bg-[#B45A2B] text-white border-[#B45A2B] font-semibold shadow-sm"
                          : "bg-white dark:bg-[#141416] border-neutral-300 dark:border-neutral-700 hover:border-[#B45A2B] text-black dark:text-white"
                      }`}
                    >
                      {opcao.rotulo}
                    </button>
                  );
                })}
              </div>
              {!localizacaoUsuario && (
                <span className="text-[11px] opacity-60">
                  * Requer localização ativa para calcular a distância exata.
                </span>
              )}
            </div>

            {/* Filtro por Avaliação Mínima */}
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider opacity-70">
                Avaliação dos Clientes
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { valor: null, rotulo: "Todas as notas" },
                  { valor: 4.5, rotulo: "★ 4.5+" },
                  { valor: 4.0, rotulo: "★ 4.0+" },
                  { valor: 3.5, rotulo: "★ 3.5+" },
                ].map((opcao) => {
                  const ativo = tempNotaMinima === opcao.valor;
                  return (
                    <button
                      key={String(opcao.valor)}
                      type="button"
                      onClick={() => setTempNotaMinima(opcao.valor)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors min-h-[38px] ${
                        ativo
                          ? "bg-[#B45A2B] text-white border-[#B45A2B] font-semibold shadow-sm"
                          : "bg-white dark:bg-[#141416] border-neutral-300 dark:border-neutral-700 hover:border-[#B45A2B] text-black dark:text-white"
                      }`}
                    >
                      {opcao.rotulo}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>

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
                Tente ajustar os filtros de busca (preço, raio de distância ou avaliação).
              </p>
            </div>
            {(busca || localidade || bairroFiltro || totalFiltrosAtivos > 0) && (
              <Button
                variante="secundario"
                tamanho="sm"
                onClick={() => {
                  setBusca("");
                  setLocalidade("");
                  setBairroFiltro("");
                  setFaixaPreco("todos");
                  setRaioDistancia(null);
                  setNotaMinima(null);
                  setOrdenacao("relevancia");
                }}
              >
                Limpar todos os filtros
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

                {/* Nota e Total de Avaliações Reais */}
                <span className="absolute top-3 right-3 bg-black/75 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-semibold backdrop-blur-sm">
                  <Star className="h-3.5 w-3.5 text-[#EAB308] fill-[#EAB308]" />
                  {b.total_avaliacoes && b.total_avaliacoes > 0 ? (
                    <span>
                      {b.media_nota}{" "}
                      <span className="opacity-70 text-[10px]">({b.total_avaliacoes})</span>
                    </span>
                  ) : (
                    <span>Novo</span>
                  )}
                </span>

                {/* Distância */}
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
                  <div className="flex flex-col">
                    {b.preco_corte ? (
                      <span className="text-xs font-semibold text-[#B45A2B]">
                        Corte a partir de{" "}
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(b.preco_corte)}
                      </span>
                    ) : b.menor_preco ? (
                      <span className="text-xs font-semibold text-[#B45A2B]">
                        A partir de{" "}
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(b.menor_preco)}
                      </span>
                    ) : (
                      <span className="text-xs opacity-75">
                        <strong>{b.total_servicos || 0}</strong> serviços ativos
                      </span>
                    )}
                  </div>

                  <Link to={`/barbearias/${b.slug}`}>
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
