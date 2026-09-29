import * as React from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Button, Card, CardContent, LoadingSpinner } from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import {
  buscarSugestoesEndereco,
  geocodificarEndereco,
  salvarEnderecoBuscaSessao,
  obterEnderecoBuscaSessao,
  obterEnderecoPerfilLocal,
  formatarEnderecoConta,
  type SugestaoEndereco,
} from "@barzzo/utilitarios";
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
  const navigate = useNavigate();
  const [termoBusca, setTermoBusca] = React.useState("");
  const [localidadeBusca, setLocalidadeBusca] = React.useState("São Paulo, SP");
  const [coordenadasBusca, setCoordenadasBusca] = React.useState<{ lat: number; lng: number } | null>(null);
  const [sugestoesEndereco, setSugestoesEndereco] = React.useState<SugestaoEndereco[]>([]);
  const [buscandoSugestoes, setBuscandoSugestoes] = React.useState(false);
  const [dropdownAberto, setDropdownAberto] = React.useState(false);
  const containerEnderecoRef = React.useRef<HTMLDivElement>(null);
  const [barbearias, setBarbearias] = React.useState<Barbearia[]>([]);
  const [carregando, setCarregando] = React.useState(true);

  // Inicializar endereço: 1º Sessão ativa, 2º Endereço da conta do usuário autenticado
  React.useEffect(() => {
    async function inicializarEndereco() {
      const enderecoSessao = obterEnderecoBuscaSessao();
      if (enderecoSessao && enderecoSessao.texto) {
        setLocalidadeBusca(enderecoSessao.texto);
        if (enderecoSessao.lat && enderecoSessao.lng) {
          setCoordenadasBusca({ lat: enderecoSessao.lat, lng: enderecoSessao.lng });
        }
        return;
      }

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
            setLocalidadeBusca(enderecoConta.texto);
            if (enderecoConta.lat && enderecoConta.lng) {
              setCoordenadasBusca({ lat: enderecoConta.lat, lng: enderecoConta.lng });
              salvarEnderecoBuscaSessao({
                texto: enderecoConta.texto,
                lat: enderecoConta.lat,
                lng: enderecoConta.lng,
                bairro: enderecoConta.bairro,
                cidade: enderecoConta.cidade,
                origem: "conta",
              });
            } else {
              geocodificarEndereco(enderecoConta.texto).then((coords) => {
                if (coords) {
                  setCoordenadasBusca({ lat: coords.lat, lng: coords.lng });
                  salvarEnderecoBuscaSessao({
                    texto: enderecoConta.texto,
                    lat: coords.lat,
                    lng: coords.lng,
                    bairro: enderecoConta.bairro,
                    cidade: enderecoConta.cidade,
                    origem: "conta",
                  });
                }
              });
            }
          }
        }
      } catch {
        // Silencioso
      }
    }

    inicializarEndereco();
  }, []);

  React.useEffect(() => {
    async function carregarDestaques() {
      try {
        setCarregando(true);
        const supabase = criarClienteSupabaseBrowser();
        const { data } = await supabase.rpc("buscar_barbearias_com_distancia", {
          p_latitude: null,
          p_longitude: null,
          p_busca_nome: null,
          p_raio_km: null,
        });

        if (data && data.length > 0) {
          let validas = (data as any[])
            .filter((b) => {
              const st = b.status_assinatura;
              if (st === "vencida" || st === "inadimplente" || st === "suspensa") return false;
              if (st === "trial" && b.trial_fim && new Date(b.trial_fim) < new Date()) return false;
              return true;
            })
            .slice(0, 6);

          if (validas.length > 0) {
            try {
              const ids = validas.map((item) => item.id);
              const { data: fotosData } = await (supabase.from("galeria_fotos") as any)
                .select("barbearia_id, foto_url, destaque_capa, ordem, created_at")
                .in("barbearia_id", ids);

              if (fotosData && fotosData.length > 0) {
                const mapaCapa: Record<string, string> = {};
                fotosData.forEach((f: any) => {
                  if (f.destaque_capa) {
                    mapaCapa[f.barbearia_id] = f.foto_url;
                  } else if (!mapaCapa[f.barbearia_id]) {
                    mapaCapa[f.barbearia_id] = f.foto_url;
                  }
                });

                validas = validas.map((item) => ({
                  ...item,
                  foto_capa_url: mapaCapa[item.id] || item.foto_capa_url || null,
                }));
              }
            } catch {
              // Silencioso
            }
          }

          setBarbearias(validas as Barbearia[]);
        }
      } catch {
        // Fallback silencioso
      } finally {
        setCarregando(false);
      }
    }
    carregarDestaques();
  }, []);

  React.useEffect(() => {
    function lidarComCliqueFora(e: MouseEvent) {
      if (
        containerEnderecoRef.current &&
        !containerEnderecoRef.current.contains(e.target as Node)
      ) {
        setDropdownAberto(false);
      }
    }
    document.addEventListener("mousedown", lidarComCliqueFora);
    return () => document.removeEventListener("mousedown", lidarComCliqueFora);
  }, []);

  React.useEffect(() => {
    const termo = localidadeBusca.trim();
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
  }, [localidadeBusca]);

  function handlePesquisar(e: React.FormEvent) {
    e.preventDefault();
    const loc = localidadeBusca.trim();
    if (loc) {
      salvarEnderecoBuscaSessao({
        texto: loc,
        lat: coordenadasBusca?.lat ?? null,
        lng: coordenadasBusca?.lng ?? null,
        origem: "manual",
      });
    }

    const params = new URLSearchParams();
    if (termoBusca.trim()) params.set("q", termoBusca.trim());
    if (loc) {
      params.set("localidade", loc);
      params.set("cidade", loc);
    }
    navigate(`/barbearias?${params.toString()}`);
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
          <div className="flex-1 min-w-0 flex items-center px-3 gap-2 min-h-[44px]">
            <Search className="h-5 w-5 text-[#B45A2B] shrink-0" />
            <input
              type="text"
              placeholder="Buscar pelo nome..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              className="w-full bg-transparent text-sm focus:outline-none placeholder:opacity-50"
            />
          </div>

          <div className="h-8 w-[1px] bg-neutral-300 dark:bg-neutral-700 hidden sm:block self-center" />

          <div
            ref={containerEnderecoRef}
            className="relative flex-1 sm:flex-[1.4] min-w-0 flex items-center px-3 gap-2 min-h-[44px]"
          >
            <MapPin className="h-5 w-5 opacity-60 shrink-0 text-[#B45A2B]" />
            <input
              type="text"
              placeholder="Bairro, Cidade, Rua ou CEP..."
              value={localidadeBusca}
              onFocus={() => {
                if (sugestoesEndereco.length > 0 || localidadeBusca.length >= 3) {
                  setDropdownAberto(true);
                }
              }}
              onChange={(e) => {
                setLocalidadeBusca(e.target.value);
                setDropdownAberto(true);
              }}
              className="w-full bg-transparent text-sm focus:outline-none placeholder:opacity-50"
            />
            {buscandoSugestoes && <LoadingSpinner tamanho="sm" />}

            {/* Popover de Sugestões de Endereço */}
            {dropdownAberto && (buscandoSugestoes || sugestoesEndereco.length > 0) && (
              <div className="absolute left-0 right-0 top-full mt-2 p-3 rounded-2xl bg-white dark:bg-[#141416] border border-neutral-200 dark:border-neutral-800 shadow-2xl z-50 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-150 text-left">
                <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200 dark:border-neutral-800">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#B45A2B]">
                    Sugestões de Localização
                  </span>
                  {buscandoSugestoes && <LoadingSpinner tamanho="sm" />}
                </div>

                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                  {sugestoesEndereco.map((sug) => (
                    <button
                      key={sug.id}
                      type="button"
                      onClick={() => {
                        const texto = sug.enderecoCompleto || sug.titulo;
                        setLocalidadeBusca(texto);
                        setCoordenadasBusca({ lat: sug.lat, lng: sug.lng });
                        salvarEnderecoBuscaSessao({
                          texto,
                          lat: sug.lat,
                          lng: sug.lng,
                          origem: "manual",
                        });
                        setDropdownAberto(false);
                        const params = new URLSearchParams();
                        if (termoBusca.trim()) params.set("q", termoBusca.trim());
                        params.set("localidade", texto);
                        navigate(`/barbearias?${params.toString()}`);
                      }}
                      className="flex items-start gap-2 p-2 rounded-lg hover:bg-[#B45A2B]/10 text-left transition-colors group cursor-pointer"
                    >
                      <MapPin className="h-4 w-4 text-[#B45A2B] shrink-0 mt-0.5" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-black dark:text-white truncate group-hover:text-[#B45A2B]">
                          {sug.titulo}
                        </span>
                        <span className="text-[11px] opacity-60 truncate">
                          {sug.subtitulo}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                navigate(`/barbearias?q=${encodeURIComponent(cat)}`);
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
            to="/barbearias"
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
                  {b.foto_capa_url || b.logo_url ? (
                    <img
                      src={b.foto_capa_url || b.logo_url!}
                      alt={b.nome}
                      className="w-full h-full object-cover"
                    />
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
                    <Link to={`/barbearias/${b.slug}`}>
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
          <span className="text-2xl font-black text-[#B45A2B]">
            01
          </span>
          <h4 className="font-bold text-base mt-1">Escolha o serviço e horário</h4>
          <p className="text-xs opacity-70">
            Navegue pelos serviços, preços e selecione o horário disponível que melhor se encaixa no seu dia.
          </p>
        </div>

        <div className="flex flex-col gap-2 p-4 rounded-xl bg-neutral-50/50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
          <span className="text-2xl font-black text-[#B45A2B]">
            02
          </span>
          <h4 className="font-bold text-base mt-1">Identificação apenas no final</h4>
          <p className="text-xs opacity-70">
            Nenhuma barreira de login prévio. Você monta seu agendamento e só precisa se identificar no resumo.
          </p>
        </div>

        <div className="flex flex-col gap-2 p-4 rounded-xl bg-neutral-50/50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
          <span className="text-2xl font-black text-[#B45A2B]">
            03
          </span>
          <h4 className="font-bold text-base mt-1">Chegue e seja atendido</h4>
          <p className="text-xs opacity-70">
            Sem filas ou espera demorada. A barbearia recebe seu agendamento na hora com confirmação instantânea.
          </p>
        </div>
      </section>
    </div>
  );
}
