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
import type { Notificacao, PreferenciasNotificacao, TipoNotificacao } from "@barzzo/tipos";
import {
  Bell,
  Calendar,
  AlertTriangle,
  Clock,
  RefreshCw,
  Tag,
  Info,
  CheckCheck,
  Settings2,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";

export default function PaginaNotificacoesCliente() {
  const [carregando, setCarregando] = React.useState(true);
  const [usuarioAutenticado, setUsuarioAutenticado] = React.useState(false);
  const [notificacoes, setNotificacoes] = React.useState<Notificacao[]>([]);
  const [preferencias, setPreferencias] = React.useState<PreferenciasNotificacao>({
    usuario_id: "",
    notificacoes_transacionais: true,
    notificacoes_promocionais: true,
    notificacoes_lembretes: true,
    atualizado_em: "",
  });
  const [salvandoPref, setSalvandoPref] = React.useState(false);
  const [aba, setAba] = React.useState<"notificacoes" | "preferencias">("notificacoes");
  const [marcandoTodas, setMarcandoTodas] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [sucessoPref, setSucessoPref] = React.useState(false);

  const carregarDados = React.useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setUsuarioAutenticado(false);
        return;
      }

      setUsuarioAutenticado(true);

      // 1. Carregar notificações
      const { data: notifsDb, error: erroNotifs } = await supabase
        .from("notificacoes")
        .select("*")
        .eq("usuario_id", session.user.id)
        .order("criado_em", { ascending: false });

      if (erroNotifs) throw erroNotifs;
      setNotificacoes((notifsDb as Notificacao[]) || []);

      // 2. Carregar preferências
      const { data: prefDb } = await supabase
        .from("preferencias_notificacao")
        .select("*")
        .eq("usuario_id", session.user.id)
        .maybeSingle();

      if (prefDb) {
        setPreferencias(prefDb as PreferenciasNotificacao);
      } else {
        setPreferencias((p) => ({ ...p, usuario_id: session.user.id }));
      }
    } catch {
      setErro("Falha ao carregar suas notificações.");
    } finally {
      setCarregando(false);
    }
  }, []);

  React.useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  async function handleMarcarLida(id: string) {
    try {
      const supabase = criarClienteSupabaseBrowser();
      await (supabase.rpc as any)("marcar_notificacao_lida", { p_notificacao_id: id });
      setNotificacoes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lida: true, lida_em: new Date().toISOString() } : n))
      );
    } catch {
      // Silencioso
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
      setErro("Não foi possível marcar notificações como lidas.");
    } finally {
      setMarcandoTodas(false);
    }
  }

  async function handleSalvarPreferencia(chave: "notificacoes_promocionais" | "notificacoes_lembretes", valor: boolean) {
    try {
      setSalvandoPref(true);
      setSucessoPref(false);
      const supabase = criarClienteSupabaseBrowser();

      const novaPref = {
        ...preferencias,
        [chave]: valor,
        atualizado_em: new Date().toISOString(),
      };
      setPreferencias(novaPref);

      await (supabase.from("preferencias_notificacao") as any).upsert({
        usuario_id: novaPref.usuario_id,
        notificacoes_transacionais: novaPref.notificacoes_transacionais,
        notificacoes_promocionais: novaPref.notificacoes_promocionais,
        notificacoes_lembretes: novaPref.notificacoes_lembretes,
        atualizado_em: novaPref.atualizado_em,
      });

      setSucessoPref(true);
      setTimeout(() => setSucessoPref(false), 3000);
    } catch {
      setErro("Erro ao salvar preferências de notificação.");
    } finally {
      setSalvandoPref(false);
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

  if (carregando) {
    return (
      <div className="flex-1 max-w-xl mx-auto py-20 flex flex-col items-center justify-center gap-3">
        <LoadingSpinner tamanho="lg" className="text-[#B45A2B]" />
        <p className="text-sm opacity-70">Carregando central de avisos...</p>
      </div>
    );
  }

  if (!usuarioAutenticado) {
    return (
      <div className="flex-1 max-w-md mx-auto py-16 flex flex-col items-center text-center gap-6">
        <div className="h-16 w-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center opacity-60">
          <Bell className="h-8 w-8" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Central de Notificações</h1>
          <p className="text-sm opacity-70">
            Conecte-se para visualizar confirmações de agendamento, lembretes de corte e novidades da sua barbearia.
          </p>
        </div>
        <Link href="/auth/login">
          <Button variante="principal" tamanho="lg">
            Entrar na Minha Conta
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-12">
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
            Seus lembretes de horário, confirmações de reserva e avisos importantes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variante={aba === "notificacoes" ? "principal" : "secundario"}
            tamanho="sm"
            onClick={() => setAba("notificacoes")}
            className="min-h-[44px] text-xs font-semibold"
          >
            <Bell className="mr-1.5 h-4 w-4" /> Mensagens
          </Button>
          <Button
            type="button"
            variante={aba === "preferencias" ? "principal" : "secundario"}
            tamanho="sm"
            onClick={() => setAba("preferencias")}
            className="min-h-[44px] text-xs font-semibold"
          >
            <Settings2 className="mr-1.5 h-4 w-4" /> Preferências
          </Button>
        </div>
      </div>

      {/* ABA 1: LISTA DE NOTIFICAÇÕES */}
      {aba === "notificacoes" && (
        <div className="flex flex-col gap-4">
          {totalNaoLidas > 0 && (
            <div className="flex justify-end">
              <Button
                variante="fantasma"
                tamanho="sm"
                disabled={marcandoTodas}
                onClick={handleMarcarTodasLidas}
                className="text-xs font-semibold opacity-70 hover:opacity-100 min-h-[44px]"
              >
                <CheckCheck className="mr-1.5 h-4 w-4" /> Marcar todas como lidas
              </Button>
            </div>
          )}

          {notificacoes.length === 0 ? (
            <Card className="border border-neutral-200/80 dark:border-neutral-800 text-center py-16">
              <CardContent className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center opacity-50">
                  <Bell className="h-6 w-6" />
                </div>
                <p className="font-semibold text-base">Tudo limpo por aqui!</p>
                <p className="text-xs opacity-60 max-w-sm">
                  Você não possui notificações pendentes no momento.
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
      )}

      {/* ABA 2: PREFERÊNCIAS DE NOTIFICAÇÃO */}
      {aba === "preferencias" && (
        <Card className="border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-[#B45A2B]" /> Preferências de Mensagens
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {sucessoPref && (
              <span className="text-xs font-semibold text-[#16A34A]">
                Preferências salvas com sucesso!
              </span>
            )}

            {/* Transacionais (Obrigatórias) */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-sm">Notificações Transacionais</span>
                <span className="text-xs opacity-60">
                  Confirmações de agendamento e avisos de cancelamento/reagendamento da barbearia.
                </span>
              </div>
              <span className="text-xs font-bold text-[#16A34A] px-2.5 py-1 rounded-full bg-[#16A34A]/10 border border-[#16A34A]/20">
                Sempre Ativo
              </span>
            </div>

            {/* Lembretes de Horário */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-sm">Lembretes de Horário</span>
                <span className="text-xs opacity-60">
                  Aviso antes do início do seu corte para evitar esquecimentos e atrasos.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferencias.notificacoes_lembretes}
                onClick={() =>
                  handleSalvarPreferencia(
                    "notificacoes_lembretes",
                    !preferencias.notificacoes_lembretes
                  )
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none min-h-[44px] items-center ${
                  preferencias.notificacoes_lembretes ? "bg-[#B45A2B]" : "bg-neutral-300 dark:bg-neutral-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    preferencias.notificacoes_lembretes ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Notificações Promocionais */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-sm">Promoções e Cupons Exclusivos</span>
                <span className="text-xs opacity-60">
                  Ofertas especiais, novidades e cupons de desconto das suas barbearias favoritas.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferencias.notificacoes_promocionais}
                onClick={() =>
                  handleSalvarPreferencia(
                    "notificacoes_promocionais",
                    !preferencias.notificacoes_promocionais
                  )
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none min-h-[44px] items-center ${
                  preferencias.notificacoes_promocionais ? "bg-[#B45A2B]" : "bg-neutral-300 dark:bg-neutral-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    preferencias.notificacoes_promocionais ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
