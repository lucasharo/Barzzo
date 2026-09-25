"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import {
  NOMES_DIAS_SEMANA,
  type Barbearia,
  type Servico,
  type Profissional,
  type HorarioBarbearia,
  type DiaSemana,
  type Avaliacao,
  type ResumoReputacaoBarbearia,
  type FotoGaleria,
  type Produto,
} from "@barzzo/tipos";
import { formatarResumoReputacao } from "@barzzo/dominio";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Scissors,
  User,
  Star,
  Calendar,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Heart,
  MessageSquare,
  Images,
  Package,
  ZoomIn,
  X,
  ExternalLink,
} from "lucide-react";

function ConteudoPerfilPublicoBarbearia() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const refParam = searchParams.get("ref") || searchParams.get("cupom");

  const [carregando, setCarregando] = React.useState(true);
  const [barbearia, setBarbearia] = React.useState<Barbearia | null>(null);
  const [servicos, setServicos] = React.useState<Servico[]>([]);
  const [profissionais, setProfissionais] = React.useState<Profissional[]>([]);
  const [horarios, setHorarios] = React.useState<HorarioBarbearia[]>([]);

  // Estados de Galeria e Produtos
  const [fotosGaleria, setFotosGaleria] = React.useState<FotoGaleria[]>([]);
  const [produtos, setProdutos] = React.useState<Produto[]>([]);
  const [fotoAmpliada, setFotoAmpliada] = React.useState<FotoGaleria | null>(null);

  // Estados de Avaliações e Favoritos
  const [avaliacoes, setAvaliacoes] = React.useState<Avaliacao[]>([]);
  const [resumoReputacao, setResumoReputacao] = React.useState<ResumoReputacaoBarbearia>({
    media_nota: 0,
    total_avaliacoes: 0,
    distribuicao_estrelas: { estrela_5: 0, estrela_4: 0, estrela_3: 0, estrela_2: 0, estrela_1: 0 },
  });
  const [favoritado, setFavoritado] = React.useState(false);
  const [favoritoId, setFavoritoId] = React.useState<string | null>(null);
  const [alternandoFavorito, setAlternandoFavorito] = React.useState(false);

  React.useEffect(() => {
    carregarPerfil();
  }, [slug]);

  async function carregarPerfil() {
    try {
      setCarregando(true);
      const supabase = criarClienteSupabaseBrowser();

      // 1. Barbearia por slug
      const { data: bDb, error: erroB } = await (supabase.from("barbearias") as any)
        .select("*")
        .eq("slug", slug)
        .eq("ativa", true)
        .single();

      if (erroB || !bDb) {
        setBarbearia(null);
        return;
      }

      const barb = bDb as Barbearia;
      setBarbearia(barb);

      // Rastrear clique do influenciador e persistir atribuição
      if (refParam && typeof window !== "undefined") {
        try {
          localStorage.setItem("@barzzo:atribuicao_influenciador", refParam.toUpperCase());
          await (supabase.rpc as any)("registrar_clique_influenciador", {
            p_barbearia_id: barb.id,
            p_codigo_ref: refParam.toUpperCase(),
          });
        } catch {
          // Silencioso
        }
      }

      // 2. Serviços ativos da barbearia
      const { data: sDb } = await (supabase.from("servicos") as any)
        .select("*")
        .eq("barbearia_id", barb.id)
        .eq("ativo", true)
        .order("preco", { ascending: true });

      setServicos((sDb || []) as Servico[]);

      // 3. Profissionais da barbearia
      const { data: pDb } = await (supabase.from("profissionais") as any)
        .select("*")
        .eq("barbearia_id", barb.id)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      setProfissionais((pDb || []) as Profissional[]);

      // 4. Horários de funcionamento
      const { data: hDb } = await (supabase.from("horarios_barbearia") as any)
        .select("*")
        .eq("barbearia_id", barb.id)
        .order("dia_semana", { ascending: true });

      setHorarios((hDb || []) as HorarioBarbearia[]);

      // 5. Avaliações públicas da barbearia
      const { data: avDb } = await (supabase.from("avaliacoes") as any)
        .select(`
          *,
          profissionais (
            nome
          )
        `)
        .eq("barbearia_id", barb.id)
        .order("created_at", { ascending: false });

      const listaAv = (avDb || []) as Avaliacao[];
      setAvaliacoes(listaAv);
      setResumoReputacao(formatarResumoReputacao(listaAv));

      // 6. Verificar se o cliente logado favoritou esta barbearia
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const { data: favDb } = await (supabase.from("favoritos") as any)
          .select("id")
          .eq("barbearia_id", barb.id)
          .eq("cliente_id", session.user.id)
          .maybeSingle();

        if (favDb) {
          setFavoritado(true);
          setFavoritoId(favDb.id);
        } else {
          setFavoritado(false);
          setFavoritoId(null);
        }
      }

      // 7. Fotos da galeria
      const { data: gDb } = await (supabase.from("galeria_fotos") as any)
        .select("*")
        .eq("barbearia_id", barb.id)
        .order("destaque_capa", { ascending: false })
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: false });

      setFotosGaleria((gDb || []) as FotoGaleria[]);

      // 8. Produtos físicos ativos disponíveis no balcão
      const { data: prodDb } = await (supabase.from("produtos") as any)
        .select("*")
        .eq("barbearia_id", barb.id)
        .eq("ativo", true)
        .order("destaque", { ascending: false })
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });

      setProdutos((prodDb || []) as Produto[]);
    } catch {
      // Silencioso
    } finally {
      setCarregando(false);
    }
  }

  async function alternarFavorito() {
    if (!barbearia) return;
    try {
      setAlternandoFavorito(true);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push(`/entrar?retorno=/barbearias/${slug}`);
        return;
      }

      if (favoritado && favoritoId) {
        // Remover dos favoritos
        await (supabase.from("favoritos") as any).delete().eq("id", favoritoId);
        setFavoritado(false);
        setFavoritoId(null);
      } else {
        // Adicionar aos favoritos
        const { data: novoFav } = await (supabase.from("favoritos") as any)
          .insert({
            cliente_id: session.user.id,
            barbearia_id: barbearia.id,
          })
          .select("id")
          .single();

        if (novoFav) {
          setFavoritado(true);
          setFavoritoId(novoFav.id);
        }
      }
    } catch {
      // Silencioso
    } finally {
      setAlternandoFavorito(false);
    }
  }

  if (carregando) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <LoadingSpinner tamanho="lg" />
        <p className="text-sm opacity-70">Carregando perfil da barbearia...</p>
      </div>
    );
  }

  if (!barbearia) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center flex flex-col items-center gap-4">
        <Scissors className="h-12 w-12 text-[#B45A2B] opacity-40" />
        <h2 className="text-2xl font-bold">Barbearia não encontrada</h2>
        <p className="text-sm opacity-70">
          O estabelecimento que você está procurando não existe ou não está mais ativo no Barzzo.
        </p>
        <Link href="/barbearias">
          <Button variante="secundario">Explorar outras barbearias</Button>
        </Link>
      </div>
    );
  }

  const hojeIndex = new Date().getDay() as DiaSemana;
  const horarioHoje = horarios.find((h) => h.dia_semana === hojeIndex);
  const fotoCapa = fotosGaleria.find((f) => f.destaque_capa) || fotosGaleria[0];

  return (
    <div className="flex flex-col gap-8 py-4">
      <Link
        href="/barbearias"
        className="text-sm font-semibold opacity-70 hover:opacity-100 flex items-center gap-1.5 self-start transition-opacity"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Barbearias
      </Link>

      {/* Banner / Header da Barbearia */}
      <div className="relative rounded-2xl bg-[#F6F6F7] dark:bg-[#141416] border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
        {fotoCapa && (
          <div className="h-40 sm:h-52 w-full relative overflow-hidden bg-neutral-900">
            <img
              src={fotoCapa.foto_url}
              alt={barbearia.nome}
              className="w-full h-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          </div>
        )}

        <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
        <div className="flex items-start md:items-center gap-5">
          <div className="h-20 w-20 md:h-24 md:w-24 rounded-2xl bg-[#B45A2B]/10 border border-[#B45A2B]/20 flex items-center justify-center text-[#B45A2B] shrink-0 overflow-hidden font-bold text-2xl">
            {barbearia.logo_url ? (
              <img src={barbearia.logo_url} alt={barbearia.nome} className="w-full h-full object-cover" />
            ) : (
              barbearia.nome.slice(0, 2).toUpperCase()
            )}
          </div>

          <div className="flex flex-col gap-1.5 flex-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-extrabold">{barbearia.nome}</h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] font-semibold border border-[#16A34A]/20">
                  Ativa no Barzzo
                </span>
                {resumoReputacao.total_avaliacoes > 0 ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {resumoReputacao.media_nota} ({resumoReputacao.total_avaliacoes})
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-500 font-medium">
                    Novo no Barzzo
                  </span>
                )}
              </div>

              {/* Botão de Favoritar */}
              <button
                onClick={alternarFavorito}
                disabled={alternandoFavorito}
                aria-label={favoritado ? "Remover dos favoritos" : "Salvar nos favoritos"}
                className={`p-2.5 rounded-xl border transition-all min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 text-xs font-semibold ${
                  favoritado
                    ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-red-500 hover:border-red-300 dark:hover:border-red-900"
                }`}
              >
                <Heart
                  className={`w-4 h-4 transition-transform ${
                    favoritado ? "fill-red-500 text-red-500 scale-110" : ""
                  }`}
                />
                <span className="hidden sm:inline">
                  {favoritado ? "Favoritada" : "Favoritar"}
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm opacity-75">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-[#B45A2B] shrink-0" />
                {barbearia.endereco ? `${barbearia.endereco}, ` : ""}
              </span>
              {barbearia.bairro && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#B45A2B]/10 text-[#B45A2B] border border-[#B45A2B]/20">
                  {barbearia.bairro}
                </span>
              )}
              <span>
                {barbearia.cidade}/{barbearia.estado}
              </span>
            </div>

            {barbearia.telefone && (
              <p className="text-xs opacity-70 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-[#B45A2B]" /> {barbearia.telefone}
              </p>
            )}
          </div>
        </div>

        {/* CTA Principal de Agendamento */}
        <div className="flex flex-col sm:flex-row md:flex-col items-stretch gap-2.5 shrink-0">
          <Link href={`/reservar/${barbearia.slug}`}>
            <Button variante="principal" tamanho="lg" className="w-full text-base font-bold shadow-md">
              <Calendar className="h-5 w-5 mr-2" /> Agendar Horário Agora
            </Button>
          </Link>
          {horarioHoje ? (
            <span className="text-xs text-center opacity-75 flex items-center justify-center gap-1">
              <Clock className="h-3.5 w-3.5 text-[#16A34A]" />
              Hoje: {horarioHoje.ativo ? `${horarioHoje.hora_abertura.slice(0, 5)} às ${horarioHoje.hora_fechamento.slice(0, 5)}` : "Fechado"}
            </span>
          ) : (
            <span className="text-xs text-center opacity-50">Consulte horários da semana</span>
          )}
        </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Catálogo de Serviços (Coluna Principal) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Serviços Disponíveis</h2>
              <p className="text-sm opacity-70">
                Escolha o serviço desejado para agendar diretamente com a equipe.
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800">
              {servicos.length} {servicos.length === 1 ? "serviço" : "serviços"}
            </span>
          </div>

          {servicos.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed text-center text-sm opacity-70">
              Nenhum serviço disponível no momento.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {servicos.map((servico) => (
                <Card
                  key={servico.id}
                  camada="primaria"
                  className="hover:border-[#B45A2B]/40 transition-colors"
                >
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-[#B45A2B]/10 flex items-center justify-center text-[#B45A2B] shrink-0">
                        <Scissors className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col">
                        <h3 className="font-bold text-base">{servico.nome}</h3>
                        {servico.descricao && (
                          <p className="text-xs opacity-70 mt-0.5 line-clamp-2">
                            {servico.descricao}
                          </p>
                        )}
                        <span className="text-xs opacity-60 mt-1 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-[#B45A2B]" />
                          Duração: {servico.duracao_minutos} minutos
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-200 dark:border-neutral-800">
                      <span className="text-lg font-extrabold text-[#B45A2B]">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(servico.preco))}
                      </span>

                      <Link href={`/reservar/${barbearia.slug}?servico_id=${servico.id}`}>
                        <Button variante="principal" tamanho="sm">
                          Escolher
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Equipe de Profissionais */}
          <div className="flex flex-col gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <h2 className="text-xl font-bold">Equipe de Barbeiros</h2>
            {profissionais.length === 0 ? (
              <p className="text-sm opacity-60">Nenhum barbeiro listado.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {profissionais.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center gap-3"
                  >
                    <div className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center font-bold text-xs shrink-0">
                      {p.foto_url ? (
                        <img src={p.foto_url} alt={p.nome} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        p.nome.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="text-sm font-bold truncate">{p.nome}</span>
                      <span className="text-[11px] opacity-60">Barbeiro Oficial</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seção Galeria de Fotos */}
          {fotosGaleria.length > 0 && (
            <div className="flex flex-col gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Images className="w-5 h-5 text-[#B45A2B]" />
                    Galeria do Estabelecimento
                  </h2>
                  <p className="text-sm opacity-70">
                    Conheça o espaço, os cortes e a estrutura da barbearia.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800">
                  {fotosGaleria.length} {fotosGaleria.length === 1 ? "foto" : "fotos"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {fotosGaleria.map((foto) => (
                  <button
                    key={foto.id}
                    type="button"
                    onClick={() => setFotoAmpliada(foto)}
                    className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#B45A2B] text-left"
                    aria-label={`Ver foto: ${foto.titulo || "Foto da barbearia"}`}
                  >
                    <img
                      src={foto.foto_url}
                      alt={foto.titulo || "Foto da galeria"}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold">
                      <ZoomIn className="w-4 h-4" />
                      <span>Ampliar</span>
                    </div>
                    {foto.titulo && (
                      <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[11px] px-2 py-1 truncate">
                        {foto.titulo}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Seção Produtos Disponíveis no Balcão */}
          {produtos.length > 0 && (
            <div className="flex flex-col gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Package className="w-5 h-5 text-[#B45A2B]" />
                    Produtos Disponíveis
                  </h2>
                  <p className="text-sm opacity-70">
                    Cosméticos e produtos para barba e cabelo disponíveis para compra presencial.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800">
                  {produtos.length} {produtos.length === 1 ? "produto" : "produtos"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {produtos.map((prod) => (
                  <Card
                    key={prod.id}
                    camada="primaria"
                    className="overflow-hidden flex flex-col justify-between hover:border-[#B45A2B]/40 transition-colors"
                  >
                    <div>
                      <div className="h-36 w-full bg-neutral-100 dark:bg-neutral-900 relative overflow-hidden flex items-center justify-center border-b border-neutral-100 dark:border-neutral-800">
                        {prod.foto_url ? (
                          <img
                            src={prod.foto_url}
                            alt={prod.nome}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-10 h-10 text-neutral-300 dark:text-neutral-700" />
                        )}
                        {prod.destaque && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-sm flex items-center gap-1">
                            <Star className="w-3 h-3 fill-white" /> Destaque
                          </span>
                        )}
                      </div>

                      <div className="p-3.5 space-y-1.5">
                        <h3 className="font-bold text-sm line-clamp-1">{prod.nome}</h3>
                        {prod.descricao && (
                          <p className="text-xs opacity-70 line-clamp-2 leading-relaxed">
                            {prod.descricao}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="p-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 flex items-center justify-between">
                      <span className="text-base font-extrabold text-[#B45A2B]">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(Number(prod.preco))}
                      </span>
                      <span className="text-[11px] font-medium text-neutral-500 bg-neutral-200/60 dark:bg-neutral-800 px-2 py-0.5 rounded">
                        Venda no balcão
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Seção de Avaliações e Reputação */}
          <div className="flex flex-col gap-4 pt-4 border-t border-neutral-200/60 dark:border-neutral-800/60">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                  Avaliações dos Clientes
                </h2>
                <p className="text-sm opacity-70">
                  Opiniões verificadas de clientes que realizaram atendimento.
                </p>
              </div>
              {resumoReputacao.total_avaliacoes > 0 && (
                <div className="text-right">
                  <span className="text-2xl font-black text-amber-500">
                    {resumoReputacao.media_nota}
                  </span>
                  <span className="text-xs opacity-60 block">de 5.0 estrelas</span>
                </div>
              )}
            </div>

            {avaliacoes.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center">
                <Star className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-2" />
                <p className="text-sm font-semibold">Ainda não há avaliações registradas</p>
                <p className="text-xs opacity-60 mt-1">
                  Agende seu horário e compartilhe sua experiência com a comunidade!
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {avaliacoes.map((av) => (
                  <div
                    key={av.id}
                    className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-[#FBFBFC] dark:bg-[#111113] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-copper-100 dark:bg-copper-950/60 text-copper-700 dark:text-copper-300 flex items-center justify-center font-bold text-xs">
                          {av.cliente_nome[0]}
                        </div>
                        <div>
                          <span className="text-sm font-bold block">{av.cliente_nome}</span>
                          <span className="text-[11px] opacity-50">
                            {new Date(av.created_at).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= av.nota
                                ? "text-amber-400 fill-amber-400"
                                : "text-neutral-300 dark:text-neutral-700"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {av.comentario && (
                      <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                        {av.comentario}
                      </p>
                    )}

                    {av.resposta_barbearia && (
                      <div className="p-3 rounded-lg bg-copper-500/10 border border-copper-500/20 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-copper-700 dark:text-copper-300">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Resposta da Barbearia:</span>
                        </div>
                        <p className="text-xs text-neutral-700 dark:text-neutral-300 pl-5">
                          {av.resposta_barbearia}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Grade de Horários e Localização (Coluna Lateral) */}
        <div className="flex flex-col gap-6">
          <Card camada="primaria">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#B45A2B]" /> Horários de Atendimento
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-neutral-200/60 dark:divide-neutral-800/60 text-xs">
              {[1, 2, 3, 4, 5, 6, 0].map((dia) => {
                const h = horarios.find((item) => item.dia_semana === dia);
                const nomeDia = NOMES_DIAS_SEMANA[dia as DiaSemana];
                const ehHoje = dia === hojeIndex;

                return (
                  <div
                    key={dia}
                    className={`py-2 flex items-center justify-between ${
                      ehHoje ? "font-bold text-[#B45A2B]" : "opacity-80"
                    }`}
                  >
                    <span>{nomeDia} {ehHoje && "(Hoje)"}</span>
                    {h && h.ativo ? (
                      <span>{h.hora_abertura.slice(0, 5)} - {h.hora_fechamento.slice(0, 5)}</span>
                    ) : (
                      <span className="opacity-50">Fechado</span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Card de Localização e Endereço com Destaque para Bairro */}
          <Card camada="primaria">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#B45A2B]" /> Localização e Endereço
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5 text-xs">
              {barbearia.bairro && (
                <div className="flex items-center justify-between py-1 border-b border-neutral-200/60 dark:border-neutral-800/60">
                  <span className="opacity-70">Bairro</span>
                  <span className="font-semibold text-black dark:text-white px-2 py-0.5 rounded bg-[#B45A2B]/10 text-[#B45A2B] border border-[#B45A2B]/20">
                    {barbearia.bairro}
                  </span>
                </div>
              )}
              {barbearia.cidade && (
                <div className="flex items-center justify-between py-1 border-b border-neutral-200/60 dark:border-neutral-800/60">
                  <span className="opacity-70">Cidade / UF</span>
                  <span className="font-medium">
                    {barbearia.cidade} {barbearia.estado ? `- ${barbearia.estado}` : ""}
                  </span>
                </div>
              )}
              {barbearia.endereco && (
                <div className="flex flex-col gap-0.5 py-1">
                  <span className="opacity-70">Logradouro</span>
                  <span className="font-medium">{barbearia.endereco}</span>
                </div>
              )}
              {barbearia.cep && (
                <div className="flex items-center justify-between py-1 border-t border-neutral-200/60 dark:border-neutral-800/60">
                  <span className="opacity-70">CEP</span>
                  <span className="font-mono">{barbearia.cep}</span>
                </div>
              )}

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  [barbearia.nome, barbearia.endereco, barbearia.bairro, barbearia.cidade].filter(Boolean).join(", ")
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2"
              >
                <Button variante="secundario" tamanho="sm" className="w-full text-xs min-h-[44px]">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir no Google Maps
                </Button>
              </a>
            </CardContent>
          </Card>

          {/* Card de Agendamento Rápido */}
          <Card camada="primaria" className="border-l-4 border-l-[#B45A2B]">
            <CardContent className="p-5 flex flex-col gap-3">
              <h4 className="font-bold text-sm">Reserva sem Fricção</h4>
              <p className="text-xs opacity-75">
                Você pode selecionar os serviços e horários livremente. A autenticação é solicitada apenas antes da confirmação final.
              </p>
              <Link href={`/reservar/${barbearia.slug}`}>
                <Button variante="principal" tamanho="sm" className="w-full mt-1">
                  Agendar Online <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Foto Ampliada */}
      {fotoAmpliada && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setFotoAmpliada(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setFotoAmpliada(null)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-neutral-300 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center bg-black/50"
              aria-label="Fechar foto ampliada"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={fotoAmpliada.foto_url}
              alt={fotoAmpliada.titulo || "Foto ampliada"}
              className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
            />
            {fotoAmpliada.titulo && (
              <p className="text-white text-sm font-semibold mt-3 bg-black/60 px-4 py-1.5 rounded-full">
                {fotoAmpliada.titulo}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaginaPerfilPublicoBarbearia() {
  return (
    <React.Suspense
      fallback={
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <LoadingSpinner tamanho="lg" />
          <p className="text-sm opacity-70">Carregando perfil da barbearia...</p>
        </div>
      }
    >
      <ConteudoPerfilPublicoBarbearia />
    </React.Suspense>
  );
}
