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
import {
  geocodificarEndereco,
  buscarSugestoesEndereco,
  obterEnderecoPorCoordenadas,
  salvarEnderecoBuscaSessao,
  obterEnderecoBuscaSessao,
  limparEnderecoBuscaSessao,
  obterEnderecoPerfilLocal,
  formatarEnderecoConta,
  traduzirErro,
  type SugestaoEndereco,
} from "@barzzo/utilitarios";
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

const TAMANHO_PAGINA_BARBEARIAS = 10;
const DURACAO_CACHE_RPC_BUSCA_MS = 1000;
const cacheRpcBuscaBarbearias = new Map<
  string,
  { requisicao: Promise<{ data: unknown; error: unknown }>; expiraEm: number }
>();

function buscarBarbeariasComCache(
  supabase: ReturnType<typeof criarClienteSupabaseBrowser>,
  parametros: Record<string, unknown>,
) {
  const chave = JSON.stringify(parametros);
  const agora = Date.now();
  for (const [chaveExpirada, entradaExpirada] of cacheRpcBuscaBarbearias) {
    if (entradaExpirada.expiraEm <= agora) cacheRpcBuscaBarbearias.delete(chaveExpirada);
  }
  const existente = cacheRpcBuscaBarbearias.get(chave);
  if (existente && existente.expiraEm > agora) return existente.requisicao;

  const requisicao = Promise.resolve(
    supabase.rpc("buscar_barbearias_com_distancia", parametros),
  ).then(({ data, error }) => {
    if (error) throw error;
    return { data, error: null };
  });
  const entrada = { requisicao, expiraEm: Number.POSITIVE_INFINITY };
  cacheRpcBuscaBarbearias.set(chave, entrada);
  void requisicao.then(
    () => {
      entrada.expiraEm = Date.now() + DURACAO_CACHE_RPC_BUSCA_MS;
    },
    () => {
      if (cacheRpcBuscaBarbearias.get(chave) === entrada) {
        cacheRpcBuscaBarbearias.delete(chave);
      }
    },
  );
  return requisicao;
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
  const localidadeParam =
    searchParams.get("localidade") ||
    searchParams.get("cidade") ||
    searchParams.get("bairro") ||
    "";

  const [busca, setBusca] = React.useState(termoInicial);
  const [localidade, setLocalidade] = React.useState(localidadeParam);
  const [carregando, setCarregando] = React.useState(true);
  const [barbearias, setBarbearias] = React.useState<BarbeariaComDistancia[]>([]);
  const [carregandoMais, setCarregandoMais] = React.useState(false);
  const [temMaisBarbearias, setTemMaisBarbearias] = React.useState(true);
  const [rolagemIniciada, setRolagemIniciada] = React.useState(false);
  const [erroBusca, setErroBusca] = React.useState<string | null>(null);
  const fimListaRef = React.useRef<HTMLDivElement>(null);
  const requisicaoBuscaRef = React.useRef(0);
  const carregamentoLoteRef = React.useRef(false);
  const ultimaBuscaInicialRef = React.useRef<string | null>(null);
  const [localizacaoUsuario, setLocalizacaoUsuario] = React.useState<{ lat: number; lng: number } | null>(null);
  const [obtendoLocalizacao, setObtendoLocalizacao] = React.useState(false);
  const [erroLocalizacao, setErroLocalizacao] = React.useState<string | null>(null);
  const [coordenadasEndereco, setCoordenadasEndereco] = React.useState<{ lat: number; lng: number } | null>(null);
  const enderecoAlteradoDuranteLocalizacaoRef = React.useRef(false);
  const [geocodificando, setGeocodificando] = React.useState(false);
  const [inicializacaoEnderecoConcluida, setInicializacaoEnderecoConcluida] = React.useState(false);
  const inicializacaoEnderecoIniciadaRef = React.useRef<string | null>(null);
  const geocodificacaoConcluidaRef = React.useRef<string | null>(null);
  const [sugestoesEndereco, setSugestoesEndereco] = React.useState<SugestaoEndereco[]>([]);
  const [buscandoSugestoes, setBuscandoSugestoes] = React.useState(false);

  // Inicialização inteligente do endereço de busca:
  // 1. URL searchParams (se houver)
  // 2. Endereço salvo na sessão ativa
  // 3. Endereço cadastrado na conta do usuário autenticado
  React.useEffect(() => {
    // O StrictMode repete efeitos de montagem em desenvolvimento. A inicialização
    // pode pedir permissão de GPS e deve acontecer uma única vez por montagem.
    if (inicializacaoEnderecoIniciadaRef.current === localidadeParam) return;
    inicializacaoEnderecoIniciadaRef.current = localidadeParam;
    setInicializacaoEnderecoConcluida(false);

    async function inicializarEnderecoBusca() {
      // Se veio parâmetro na URL, já foi atribuído e salva na sessão
      if (localidadeParam) {
        const enderecoSessao = obterEnderecoBuscaSessao();
        if (enderecoSessao?.texto === localidadeParam) {
          setLocalidade(enderecoSessao.texto);
          if (enderecoSessao.lat != null && enderecoSessao.lng != null) {
            setCoordenadasEndereco({ lat: enderecoSessao.lat, lng: enderecoSessao.lng });
            geocodificacaoConcluidaRef.current = localidadeParam.trim();
            if (enderecoSessao.origem === "gps") {
              setLocalizacaoUsuario({ lat: enderecoSessao.lat, lng: enderecoSessao.lng });
            }
          }
          return;
        }

        salvarEnderecoBuscaSessao({
          texto: localidadeParam,
          origem: "manual",
        });
        return;
      }

      // Se há endereço na sessão ativa, recupera
      const enderecoSessao = obterEnderecoBuscaSessao();
      if (enderecoSessao && enderecoSessao.texto) {
        setLocalidade(enderecoSessao.texto);
        if (enderecoSessao.lat != null && enderecoSessao.lng != null) {
          setCoordenadasEndereco({ lat: enderecoSessao.lat, lng: enderecoSessao.lng });
          geocodificacaoConcluidaRef.current = enderecoSessao.texto.trim();
          if (enderecoSessao.origem === "gps") {
            setLocalizacaoUsuario({ lat: enderecoSessao.lat, lng: enderecoSessao.lng });
          }
        }
        return;
      }

      // Sem endereço na sessão, prioriza a localização atual do dispositivo.
      if (await obterLocalizacaoAtual() || enderecoAlteradoDuranteLocalizacaoRef.current) return;

      // Se não há na sessão, verifica conta do usuário logado
      try {
        const supabase = criarClienteSupabaseBrowser();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const localPerfil = obterEnderecoPerfilLocal(user.id);
          const metaCombinada = { ...(localPerfil || {}), ...(user.user_metadata || {}) };
          const enderecoConta = formatarEnderecoConta(metaCombinada);
          if (enderecoConta && enderecoConta.texto) {
            setLocalidade(enderecoConta.texto);
            if (enderecoConta.lat != null && enderecoConta.lng != null) {
              setCoordenadasEndereco({ lat: enderecoConta.lat, lng: enderecoConta.lng });
              geocodificacaoConcluidaRef.current = enderecoConta.texto.trim();
              salvarEnderecoBuscaSessao({
                texto: enderecoConta.texto,
                lat: enderecoConta.lat,
                lng: enderecoConta.lng,
                bairro: enderecoConta.bairro,
                cidade: enderecoConta.cidade,
                origem: "conta",
              });
            } else {
              salvarEnderecoBuscaSessao({
                texto: enderecoConta.texto,
                bairro: enderecoConta.bairro,
                cidade: enderecoConta.cidade,
                origem: "conta",
              });
            }
          }
        }
      } catch {
        // Silencioso
      }
    }

    void inicializarEnderecoBusca().finally(() => {
      if (inicializacaoEnderecoIniciadaRef.current === localidadeParam) {
        setInicializacaoEnderecoConcluida(true);
      }
    });
  }, [localidadeParam]);

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

  // Controle das sugestões de autocomplete de endereço
  const [sugestoesAbertas, setSugestoesAbertas] = React.useState(false);
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
        setSugestoesAbertas(false);
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



  // Geocodificação com debounce do endereço/localidade digitado
  React.useEffect(() => {
    const termo = localidade.trim();

    if (!inicializacaoEnderecoConcluida) return;

    if (localizacaoUsuario) {
      setGeocodificando(false);
      return;
    }

    if (geocodificacaoConcluidaRef.current === termo) {
      setGeocodificando(false);
      return;
    }

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
          geocodificacaoConcluidaRef.current = termo;
          if (coords) {
            setCoordenadasEndereco({ lat: coords.lat, lng: coords.lng });
            salvarEnderecoBuscaSessao({
              texto: termo,
              lat: coords.lat,
              lng: coords.lng,
              origem: "manual",
            });
          } else {
            setCoordenadasEndereco(null);
          }
        }
      } catch {
        if (!cancelado) {
          geocodificacaoConcluidaRef.current = termo;
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
  }, [inicializacaoEnderecoConcluida, localidade, localizacaoUsuario]);

  // Autocomplete em tempo real de endereços (ViaCEP + OpenStreetMap)
  React.useEffect(() => {
    const termo = localidade.trim();
    if (termo.length < 3) {
      setSugestoesEndereco([]);
      setBuscandoSugestoes(false);
      return;
    }

    let cancelado = false;
    setBuscandoSugestoes(true);

    const timer = setTimeout(async () => {
      try {
        const resultados = await buscarSugestoesEndereco(termo, 5);
        if (!cancelado) {
          setSugestoesEndereco(resultados);
        }
      } catch {
        if (!cancelado) {
          setSugestoesEndereco([]);
        }
      } finally {
        if (!cancelado) {
          setBuscandoSugestoes(false);
        }
      }
    }, 300);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [localidade]);

  React.useEffect(() => {
    // Se está em processo de geocodificar o endereço digitado, aguarda a resolução das coordenadas
    const termoLocalidade = localidade.trim();
    const precisaGeocodificar = termoLocalidade.length >= 3
      && !localizacaoUsuario
      && !coordenadasEndereco
      && geocodificacaoConcluidaRef.current !== termoLocalidade;
    if (!inicializacaoEnderecoConcluida || geocodificando || precisaGeocodificar) return;

    const coordenadasEfetivas = termoLocalidade ? coordenadasEndereco : localizacaoUsuario;
    const chaveBuscaInicial = JSON.stringify({
      latitude: coordenadasEfetivas?.lat ?? null,
      longitude: coordenadasEfetivas?.lng ?? null,
      busca: busca.trim() || null,
      raio: raioDistancia || null,
      faixaPreco,
      notaMinima,
      ordenacao,
      localidade: !coordenadasEfetivas && termoLocalidade
        ? normalizarTexto(termoLocalidade)
        : null,
    });
    if (ultimaBuscaInicialRef.current === chaveBuscaInicial) return;
    ultimaBuscaInicialRef.current = chaveBuscaInicial;
    setRolagemIniciada(false);

    const idRequisicao = ++requisicaoBuscaRef.current;
    carregamentoLoteRef.current = false;
    setCarregando(true);
    setCarregandoMais(false);
    setTemMaisBarbearias(true);
    setErroBusca(null);
    setBarbearias([]);
    carregarBarbearias(0, false, idRequisicao);
  }, [
    inicializacaoEnderecoConcluida,
    busca,
    localidade,
    localizacaoUsuario,
    coordenadasEndereco,
    geocodificando,
    faixaPreco,
    raioDistancia,
    notaMinima,
    ordenacao,
  ]);

  async function carregarBarbearias(offset: number, anexar: boolean, idRequisicao: number) {
    try {
      const supabase = criarClienteSupabaseBrowser();

      const termoLoc = localidade.trim();
      // O endereço digitado no campo de busca tem prioridade absoluta sobre o GPS do dispositivo
      const coordsEfetivas = termoLoc ? coordenadasEndereco : localizacaoUsuario;

      // Busca somente um lote já filtrado e ordenado pelo banco.
      const { data, error } = await buscarBarbeariasComCache(supabase, {
        p_latitude: coordsEfetivas?.lat ?? null,
        p_longitude: coordsEfetivas?.lng ?? null,
        p_busca_nome: busca.trim() || null,
        p_raio_km: raioDistancia || null,
        p_faixa_preco: faixaPreco,
        p_nota_minima: notaMinima,
        p_ordenacao: ordenacao,
        p_busca_localidade: !coordsEfetivas && termoLoc ? normalizarTexto(termoLoc) : null,
        p_limite: TAMANHO_PAGINA_BARBEARIAS,
        p_deslocamento: offset,
      });

      if (error) {
        throw error;
      }

      if (idRequisicao !== requisicaoBuscaRef.current) return;

      const lista: BarbeariaComDistancia[] = ((data || []) as any[]).map((b) => {
        let dist = b.distancia_km !== null && b.distancia_km !== undefined
          ? Number(b.distancia_km)
          : null;

        if (dist === null && coordsEfetivas && b.latitude && b.longitude) {
          dist = Number(calcularDistanciaKm(
            coordsEfetivas.lat,
            coordsEfetivas.lng,
            Number(b.latitude),
            Number(b.longitude)
          ));
        }

        return {
          ...b,
          distancia_calculada: dist,
          preco_corte: b.preco_corte == null ? null : Number(b.preco_corte),
          menor_preco: b.menor_preco == null ? null : Number(b.menor_preco),
          maior_preco: b.maior_preco == null ? null : Number(b.maior_preco),
          media_nota: b.media_nota == null ? 0 : Number(b.media_nota),
          total_avaliacoes: Number(b.total_avaliacoes || 0),
          total_servicos: Number(b.total_servicos || 0),
        };
      });

      setBarbearias((atuais) => anexar ? [...atuais, ...lista] : lista);
      setTemMaisBarbearias(lista.length === TAMANHO_PAGINA_BARBEARIAS);
      setErroBusca(null);
    } catch (erro) {
      if (idRequisicao === requisicaoBuscaRef.current) {
        setErroBusca(traduzirErro(erro, "Não foi possível carregar as barbearias no momento."));
        setTemMaisBarbearias(false);
      }
    } finally {
      if (idRequisicao === requisicaoBuscaRef.current) {
        setCarregando(false);
        setCarregandoMais(false);
        carregamentoLoteRef.current = false;
      }
    }
  }

  React.useEffect(() => {
    if (rolagemIniciada) return;

    const habilitarCargaAutomatica = () => setRolagemIniciada(true);
    const habilitarPelaTecla = (evento: KeyboardEvent) => {
      const alvo = evento.target as HTMLElement | null;
      if (
        alvo?.isContentEditable ||
        alvo?.matches("input, textarea, select") ||
        !["ArrowDown", "PageDown", "End", " "].includes(evento.key)
      ) return;
      setRolagemIniciada(true);
    };

    window.addEventListener("wheel", habilitarCargaAutomatica, { once: true, passive: true });
    window.addEventListener("touchmove", habilitarCargaAutomatica, { once: true, passive: true });
    window.addEventListener("keydown", habilitarPelaTecla);
    return () => {
      window.removeEventListener("wheel", habilitarCargaAutomatica);
      window.removeEventListener("touchmove", habilitarCargaAutomatica);
      window.removeEventListener("keydown", habilitarPelaTecla);
    };
  }, [rolagemIniciada]);

  React.useEffect(() => {
    const sentinela = fimListaRef.current;
    if (!rolagemIniciada || !sentinela || carregando || carregandoMais || !temMaisBarbearias || erroBusca) return;

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting || carregamentoLoteRef.current) return;
        carregamentoLoteRef.current = true;
        setCarregandoMais(true);
        carregarBarbearias(barbearias.length, true, requisicaoBuscaRef.current);
      },
      { rootMargin: "0px" }
    );

    observador.observe(sentinela);
    return () => observador.disconnect();
  }, [barbearias.length, carregando, carregandoMais, erroBusca, rolagemIniciada, temMaisBarbearias]);

  function obterLocalizacaoAtual(): Promise<boolean> {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setErroLocalizacao("Geolocalização não é suportada pelo seu navegador ou dispositivo.");
      return Promise.resolve(false);
    }

    setObtendoLocalizacao(true);
    setErroLocalizacao(null);
    enderecoAlteradoDuranteLocalizacaoRef.current = false;

    return new Promise((resolver) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (enderecoAlteradoDuranteLocalizacaoRef.current) {
            setObtendoLocalizacao(false);
            resolver(false);
            return;
          }

          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocalizacaoUsuario({ lat, lng });
          setCoordenadasEndereco({ lat, lng });

          let enderecoTexto = "";
          let bairroDetectado = "";
          let cidadeDetectada = "";

          try {
            const info = await obterEnderecoPorCoordenadas(lat, lng);
            if (info) {
              enderecoTexto = info.enderecoCompleto || info.titulo;
              bairroDetectado = info.bairro || "";
              cidadeDetectada = info.cidade || "";
            }
          } catch {
            // Fallback silencioso
          }

          if (!enderecoTexto) {
            enderecoTexto = [bairroDetectado, cidadeDetectada].filter(Boolean).join(", ") || "Minha Localização Atual";
          }

          // Preenche o campo de endereço com a localização detectada por GPS
          setLocalidade(enderecoTexto);

          // Grava na sessão
          salvarEnderecoBuscaSessao({
            texto: enderecoTexto,
            lat,
            lng,
            bairro: bairroDetectado || null,
            cidade: cidadeDetectada || null,
            origem: "gps",
          });
          setObtendoLocalizacao(false);

          resolver(true);
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
          resolver(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  function alternarLocalizacao() {
    if (localizacaoUsuario) {
      setLocalizacaoUsuario(null);
      setErroLocalizacao(null);
      setLocalidade("");
      setCoordenadasEndereco(null);
      limparEnderecoBuscaSessao();
      return;
    }

    void obterLocalizacaoAtual();
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

            {/* Campo de Endereço com Autocomplete Flutuante */}
            <div ref={containerEnderecoRef} className="relative flex-1 sm:flex-[1.5] min-w-0">
              <div className="flex items-center px-3 gap-2 min-h-[44px]">
                <button
                  type="button"
                  onClick={alternarLocalizacao}
                  disabled={obtendoLocalizacao}
                  aria-pressed={Boolean(localizacaoUsuario)}
                  aria-label={
                    obtendoLocalizacao
                      ? "Obtendo localização"
                      : localizacaoUsuario
                        ? "Desativar localização atual"
                        : "Usar localização atual"
                  }
                  title={
                    localizacaoUsuario
                      ? "Localização atual ativa. Clique para desativar."
                      : "Usar localização atual"
                  }
                  className={`h-11 w-11 -ml-2 shrink-0 rounded-xl flex items-center justify-center transition-colors disabled:cursor-wait ${
                    localizacaoUsuario
                      ? "bg-[#B45A2B]/10 text-[#B45A2B]"
                      : "text-[#B45A2B] hover:bg-neutral-200/70 dark:hover:bg-neutral-800"
                  }`}
                >
                  <MapPin className={`h-4 w-4 ${obtendoLocalizacao ? "animate-pulse" : ""}`} />
                </button>
                <input
                  type="text"
                  placeholder="Digite rua, bairro, cidade ou CEP..."
                  value={localidade}
                  onFocus={() => {
                    if (sugestoesEndereco.length > 0 || (localidade && localidade.length >= 3)) {
                      setSugestoesAbertas(true);
                    }
                  }}
                  onChange={(e) => {
                    enderecoAlteradoDuranteLocalizacaoRef.current = true;
                    geocodificacaoConcluidaRef.current = null;
                    setLocalidade(e.target.value);
                    setSugestoesAbertas(true);
                    if (localizacaoUsuario) {
                      setLocalizacaoUsuario(null);
                    }
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      setSugestoesAbertas(false);
                      const termo = localidade.trim();
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
                    } else if (e.key === "Escape") {
                      setSugestoesAbertas(false);
                    }
                  }}
                  className="w-full bg-transparent text-sm focus:outline-none placeholder:opacity-50 text-black dark:text-white"
                />
                {geocodificando && (
                  <LoadingSpinner tamanho="sm" />
                )}
                {localidade && !geocodificando && (
                  <button
                    type="button"
                    onClick={() => {
                      enderecoAlteradoDuranteLocalizacaoRef.current = true;
                      setLocalidade("");
                      setCoordenadasEndereco(null);
                      setLocalizacaoUsuario(null);
                      setSugestoesEndereco([]);
                      setSugestoesAbertas(false);
                      limparEnderecoBuscaSessao();
                    }}
                    className="text-xs opacity-50 hover:opacity-100 p-1"
                    title="Limpar endereço"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Lista Flutuante de Sugestões de Autocomplete */}
              {sugestoesAbertas && (buscandoSugestoes || sugestoesEndereco.length > 0) && (
                <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-white dark:bg-[#141416] border border-neutral-200 dark:border-neutral-800 shadow-2xl z-50 overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800 animate-in fade-in zoom-in-95 duration-150 text-left">
                  {buscandoSugestoes && (
                    <div className="p-3 text-xs opacity-70 flex items-center gap-2">
                      <LoadingSpinner tamanho="sm" />
                      <span>Buscando endereços no Brasil...</span>
                    </div>
                  )}
                  {sugestoesEndereco.map((sug) => (
                    <button
                      key={sug.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const texto = sug.enderecoCompleto || sug.titulo;
                        enderecoAlteradoDuranteLocalizacaoRef.current = true;
                        setLocalidade(texto);
                        setCoordenadasEndereco({ lat: sug.lat, lng: sug.lng });
                        setSugestoesAbertas(false);
                        if (localizacaoUsuario) {
                          setLocalizacaoUsuario(null);
                        }
                        salvarEnderecoBuscaSessao({
                          texto,
                          lat: sug.lat,
                          lng: sug.lng,
                          origem: "manual",
                        });
                      }}
                      className="w-full flex items-start gap-3 p-3.5 hover:bg-[#B45A2B]/10 text-left transition-colors group cursor-pointer"
                    >
                      <MapPin className="h-4 w-4 text-[#B45A2B] shrink-0 mt-0.5" />
                      <div className="flex flex-col min-w-0">
                        <strong className="text-xs font-bold text-black dark:text-white group-hover:text-[#B45A2B] transition-colors truncate">
                          {sug.titulo}
                        </strong>
                        <span className="text-[11px] opacity-65 truncate">
                          {sug.subtitulo}
                        </span>
                      </div>
                    </button>
                  ))}
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
      ) : erroBusca && barbearias.length === 0 ? (
        <Card camada="primaria" className="text-center py-10">
          <CardContent>
            <p role="alert" className="text-sm">{erroBusca}</p>
          </CardContent>
        </Card>
      ) : barbearias.length === 0 ? (
        <Card camada="primaria" className="text-center py-16">
          <CardContent className="flex flex-col items-center gap-4">
            <Scissors className="h-12 w-12 text-[#B45A2B]" />
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold text-lg">Nenhuma barbearia encontrada</h3>
              <p className="text-sm opacity-70 max-w-sm">
                Tente ajustar os filtros de busca (preço, raio de distância ou avaliação).
              </p>
            </div>
            {(busca || localidade || totalFiltrosAtivos > 0) && (
              <Button
                variante="secundario"
                tamanho="sm"
                onClick={() => {
                  setBusca("");
                  setLocalidade("");
                  setCoordenadasEndereco(null);
                  setLocalizacaoUsuario(null);
                  setFaixaPreco("todos");
                  setRaioDistancia(null);
                  setNotaMinima(null);
                  setOrdenacao("relevancia");
                  limparEnderecoBuscaSessao();
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
              <div className="relative">
                <div className="h-40 bg-[#EEEEF0] dark:bg-[#1C1C1F] rounded-t-xl flex items-center justify-center relative overflow-hidden">
                  {b.foto_capa_url || b.logo_url ? (
                    <img
                      src={b.foto_capa_url || b.logo_url!}
                      alt={b.nome}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
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
                    <span className="absolute bottom-3 right-3 bg-[#B45A2B] text-white text-[11px] px-2 py-0.5 rounded-full font-bold shadow">
                      {b.distancia_calculada} km de você
                    </span>
                  )}
                </div>

                {b.foto_capa_url && (
                  <div className="absolute bottom-2 left-5 z-10 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-[#B45A2B]/20 bg-[#F6F6F7] text-base font-bold text-[#B45A2B] shadow-md ring-4 ring-[#F6F6F7] dark:bg-[#141416] dark:ring-[#141416]">
                    {b.logo_url ? (
                      <img
                        src={b.logo_url}
                        alt={`Logo de ${b.nome}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      b.nome.slice(0, 2).toUpperCase()
                    )}
                  </div>
                )}
              </div>

              <CardContent className="px-5 pb-5 pt-3 flex flex-col gap-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-bold">{b.nome}</h3>
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
      {!carregando && barbearias.length > 0 && temMaisBarbearias && !erroBusca && (
        <div
          ref={fimListaRef}
          className="flex min-h-12 items-center justify-center py-4"
          aria-live="polite"
          aria-busy={carregandoMais}
        >
          {carregandoMais && <LoadingSpinner tamanho="sm" />}
          <span className="sr-only">{carregandoMais ? "Carregando mais barbearias" : ""}</span>
        </div>
      )}
      {!carregando && erroBusca && barbearias.length > 0 && (
        <p role="alert" className="py-3 text-center text-sm">{erroBusca}</p>
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
