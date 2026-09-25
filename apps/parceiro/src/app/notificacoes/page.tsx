"use client";

import * as React from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Alert,
  AlertDescription,
  LoadingSpinner,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import type { Notificacao, TipoNotificacao } from "@barzzo/tipos";
import {
  Bell,
  CheckCheck,
  Calendar,
  AlertTriangle,
  Clock,
  RefreshCw,
  Tag,
  Info,
  CheckCircle2,
  Trash2,
} from "lucide-react";

export default function PaginaNotificacoesParceiro() {
  const [carregando, setCarregando] = React.useState(true);
  const [notificacoes, setNotificacoes] = React.useState<Notificacao[]>([]);
  const [filtroLida, setFiltroLida] = React.useState<"todas" | "nao_lidas">("todas");
  const [marcandoTodas, setMarcandoTodas] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  const carregarNotificacoes = React.useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      let query = supabase
        .from("notificacoes")
        .select("*")
        .eq("usuario_id", session.user.id)
        .order("criado_em", { ascending: false });

      if (filtroLida === "nao_lidas") {
        query = query.eq("lida", false);
      }

      const { data: notifsDb, error: erroDb } = await query;
      if (erroDb) throw erroDb;

      setNotificacoes((notifsDb as Notificacao[]) || []);
    } catch {
      setErro("Falha ao carregar suas notificações.");
    } finally {
      setCarregando(false);
    }
  }, [filtroLida]);

  React.useEffect(() => {
    carregarNotificacoes();
  }, [carregarNotificacoes]);

  async function handleMarcarLida(id: string) {
    try {
      const supabase = criarClienteSupabaseBrowser();
      await (supabase.rpc as any)("marcar_notificacao_lida", { p_notificacao_id: id });

      // Atualizar estado local
      setNotificacoes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lida: true, lida_em: new Date().toISOString() } : n))
      );
    } catch {
      // Falha silenciosa
    }
  }

  async function handleMarcarTodasLidas() {
    try {
      setMarcandoTodas(true);
      const supabase = criarClienteSupabaseBrowser();
      await (supabase.rpc as any)("marcar_todas_notificacoes_lidas");

      setNotificacoes((prev) =>
        prev.map((n) => ({ ...n, lida: true, lida_em: new Date().toISOString() }))
      );
    } catch {
      setErro("Erro ao marcar notificações como lidas.");
    } finally {
      setMarcandoTodas(false);
    }
  }

  const obterIconeTipo = (tipo: TipoNotificacao) => {
    switch (tipo) {
      case "confirmacao":
        return <Calendar className="h-5 w-5 text-[#16A34A]" />;
      case "cancelamento":
        return <AlertTriangle className="h-5 w-5 text-[#DC2626]" />;
      case "lembrete":
        return <Clock className="h-5 w-5 text-[#D97706]" />;
      case "reagendamento":
        return <RefreshCw className="h-5 w-5 text-blue-500" />;
      case "promocao":
        return <Tag className="h-5 w-5 text-[#B45A2B]" />;
      case "sistema":
      default:
        return <Info className="h-5 w-5 text-purple-500" />;
    }
  };

  const totalNaoLidas = notificacoes.filter((n) => !n.lida).length;

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto pb-12">
      {erro && (
        <Alert variante="erro">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Notificações</h1>
            {totalNaoLidas > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#B45A2B] text-white font-bold">
                {totalNaoLidas} nova(s)
              </span>
            )}
          </div>
          <p className="text-sm opacity-70 mt-1">
            Histórico de avisos operacionais, agendamentos e comunicados da sua barbearia.
          </p>
        </div>

        {totalNaoLidas > 0 && (
          <Button
            variante="secundario"
            tamanho="sm"
            disabled={marcandoTodas}
            carregando={marcandoTodas}
            onClick={handleMarcarTodasLidas}
            className="min-h-[44px] text-xs font-semibold"
          >
            <CheckCheck className="mr-1.5 h-4 w-4" /> Marcar todas como lidas
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-2">
        <button
          type="button"
          onClick={() => setFiltroLida("todas")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors min-h-[44px] ${
            filtroLida === "todas"
              ? "border-[#B45A2B] text-[#B45A2B]"
              : "border-transparent opacity-60 hover:opacity-100"
          }`}
        >
          Todas ({notificacoes.length})
        </button>

        <button
          type="button"
          onClick={() => setFiltroLida("nao_lidas")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors min-h-[44px] ${
            filtroLida === "nao_lidas"
              ? "border-[#B45A2B] text-[#B45A2B]"
              : "border-transparent opacity-60 hover:opacity-100"
          }`}
        >
          Não Lidas ({totalNaoLidas})
        </button>
      </div>

      {/* Lista de Notificações */}
      {carregando ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <LoadingSpinner tamanho="lg" className="text-[#B45A2B]" />
          <p className="text-sm opacity-70">Carregando avisos...</p>
        </div>
      ) : notificacoes.length === 0 ? (
        <Card className="border border-neutral-200/80 dark:border-neutral-800 text-center py-16">
          <CardContent className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center opacity-50">
              <Bell className="h-6 w-6" />
            </div>
            <p className="font-semibold text-base">Nenhuma notificação encontrada.</p>
            <p className="text-xs opacity-60 max-w-sm">
              Você está em dia com todas as novidades e avisos operacionais da barbearia.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {notificacoes.map((n) => (
            <Card
              key={n.id}
              onClick={() => !n.lida && handleMarcarLida(n.id)}
              className={`border transition-all cursor-pointer ${
                !n.lida
                  ? "border-[#B45A2B]/40 bg-[#B45A2B]/5 shadow-sm"
                  : "border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
              }`}
            >
              <CardContent className="p-4 sm:p-5 flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 shrink-0 mt-0.5">
                  {obterIconeTipo(n.tipo)}
                </div>

                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                      {n.titulo}
                      {!n.lida && (
                        <span className="h-2 w-2 rounded-full bg-[#B45A2B] shrink-0" />
                      )}
                    </h3>
                    <span className="text-[11px] opacity-50 shrink-0">
                      {new Date(n.criado_em).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm opacity-80 leading-relaxed">{n.corpo}</p>

                  {n.link && (
                    <div className="mt-2">
                      <Link
                        href={n.link}
                        className="text-xs font-bold text-[#B45A2B] hover:underline inline-flex items-center gap-1 min-h-[32px]"
                      >
                        Ver detalhes →
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
