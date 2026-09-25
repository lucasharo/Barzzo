"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import { traduzirErro } from "@barzzo/utilitarios";
import type { FavoritoBarbearia } from "@barzzo/tipos";
import {
  Heart,
  MapPin,
  Calendar,
  Trash2,
  AlertCircle,
  ExternalLink,
  Scissors,
} from "lucide-react";

export default function PaginaFavoritosCliente() {
  const router = useRouter();
  const [carregando, setCarregando] = React.useState(true);
  const [autenticado, setAutenticado] = React.useState<boolean | null>(null);
  const [favoritos, setFavoritos] = React.useState<FavoritoBarbearia[]>([]);
  const [erro, setErro] = React.useState<string | null>(null);
  const [removendoId, setRemovendoId] = React.useState<string | null>(null);

  React.useEffect(() => {
    carregarFavoritos();
  }, []);

  async function carregarFavoritos() {
    try {
      setCarregando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setAutenticado(false);
        setCarregando(false);
        return;
      }

      setAutenticado(true);

      const { data, error } = await (supabase.from("favoritos") as any)
        .select(`
          id,
          cliente_id,
          barbearia_id,
          created_at,
          barbearias (
            id,
            nome,
            slug,
            logo_url,
            bairro,
            cidade,
            telefone
          )
        `)
        .eq("cliente_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) {
        setErro(traduzirErro(error, "Não foi possível carregar seus estabelecimentos favoritos."));
        return;
      }

      const lista = (data || []).map((item: any) => ({
        id: item.id,
        cliente_id: item.cliente_id,
        barbearia_id: item.barbearia_id,
        created_at: item.created_at,
        barbearia: item.barbearias,
      }));

      setFavoritos(lista);
    } catch {
      setErro("Falha ao comunicar com os servidores.");
    } finally {
      setCarregando(false);
    }
  }

  async function desfavoritar(favoritoId: string) {
    try {
      setRemovendoId(favoritoId);
      const supabase = criarClienteSupabaseBrowser();
      const { error } = await (supabase.from("favoritos") as any)
        .delete()
        .eq("id", favoritoId);

      if (error) {
        setErro("Erro ao remover dos favoritos.");
        return;
      }

      setFavoritos((anteriores) => anteriores.filter((f) => f.id !== favoritoId));
    } catch {
      setErro("Falha ao remover favorito.");
    } finally {
      setRemovendoId(null);
    }
  }

  if (carregando) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-4xl flex flex-col items-center justify-center gap-4">
        <LoadingSpinner tamanho="lg" />
        <p className="text-neutral-500 text-sm">Carregando seus favoritos...</p>
      </div>
    );
  }

  if (autenticado === false) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md">
        <Card className="text-center p-8 border-neutral-200 dark:border-neutral-800">
          <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8 fill-current" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Suas Barbearias Favoritas</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6">
            Faça login para salvar suas barbearias preferidas e agendar com rapidez a qualquer momento.
          </p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => router.push("/entrar?retorno=/favoritos")}
              className="w-full bg-copper-600 hover:bg-copper-700 text-white min-h-[44px]"
            >
              Fazer login no Barzzo
            </Button>
            <Button
              variante="secundario"
              onClick={() => router.push("/barbearias")}
              className="w-full min-h-[44px]"
            >
              Explorar barbearias
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <Heart className="w-7 h-7 text-red-500 fill-red-500" />
            Barbearias Favoritas
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Seus estabelecimentos de preferência para agendamentos rápidos
          </p>
        </div>
        <Link href="/barbearias">
          <Button variante="secundario" className="gap-2 min-h-[44px]">
            <Scissors className="w-4 h-4" />
            Explorar Mais
          </Button>
        </Link>
      </div>

      {erro && (
        <Alert variante="erro" className="mb-6">
          <AlertCircle className="w-4 h-4 mr-2" />
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {/* Lista de Favoritos */}
      {favoritos.length === 0 ? (
        <Card className="text-center py-16 px-4 border-dashed border-2 border-neutral-200 dark:border-neutral-800">
          <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-3">
            <Heart className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Nenhuma barbearia favoritada ainda</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mb-6">
            Ao visitar o perfil de uma barbearia que você gosta, clique no ícone de coração para salvá-la aqui.
          </p>
          <Link href="/barbearias">
            <Button className="bg-copper-600 hover:bg-copper-700 text-white min-h-[44px]">
              Encontrar Barbearias
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {favoritos.map((fav) => {
            const b = fav.barbearia;
            if (!b) return null;

            return (
              <Card
                key={fav.id}
                className="overflow-hidden hover:border-copper-500/40 transition-colors shadow-sm flex flex-col justify-between"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-copper-100 dark:bg-copper-950/60 text-copper-700 dark:text-copper-300 flex items-center justify-center font-bold text-lg flex-shrink-0">
                        {b.nome[0]}
                      </div>
                      <div>
                        <Link
                          href={`/barbearias/${b.slug}`}
                          className="font-bold text-base hover:text-copper-600 dark:hover:text-copper-400 transition-colors"
                        >
                          {b.nome}
                        </Link>
                        <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          <span>
                            {[b.bairro, b.cidade].filter(Boolean).join(", ") || "Localização não informada"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => desfavoritar(fav.id)}
                      disabled={removendoId === fav.id}
                      aria-label={`Remover ${b.nome} dos favoritos`}
                      className="p-2 text-neutral-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="px-5 pb-5 pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                  <Link href={`/barbearias/${b.slug}`}>
                    <Button
                      variante="fantasma"
                      tamanho="sm"
                      className="text-xs min-h-[36px]"
                    >
                      Ver Perfil
                    </Button>
                  </Link>

                  <Link href={`/reservar/${b.slug}`}>
                    <Button
                      tamanho="sm"
                      className="bg-copper-600 hover:bg-copper-700 text-white text-xs gap-1.5 min-h-[36px]"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Agendar Horário
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
