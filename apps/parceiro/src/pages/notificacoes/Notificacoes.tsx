
import * as React from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Alert,
  AlertDescription,
  LoadingSpinner,
  Switch,
} from "@barzzo/ui";
import { criarClienteSupabaseBrowser } from "@barzzo/supabase";
import {
  ativarPushWeb,
  definirPushNativoAtivo,
  notificarPushWebAtivado,
  tokenPushNativoAtual,
  type RegistroPushWeb,
} from "@barzzo/nativo";
import { ehAppNativo, formatarDataHora, plataformaAtual, traduzirErro } from "@barzzo/utilitarios";
import type { Notificacao, PreferenciasNotificacao, TipoNotificacao } from "@barzzo/tipos";
import {
  Bell,
  CheckCheck,
  Calendar,
  AlertTriangle,
  Clock,
  RefreshCw,
  Tag,
  Info,
  Trash2,
  BellRing,
} from "lucide-react";

export default function PaginaNotificacoesParceiro() {
  const appNativo = ehAppNativo();
  const plataformaPush = plataformaAtual();
  const [carregando, setCarregando] = React.useState(true);
  const [notificacoes, setNotificacoes] = React.useState<Notificacao[]>([]);
  const [filtroLida, setFiltroLida] = React.useState<"todas" | "nao_lidas">("todas");
  const [marcandoTodas, setMarcandoTodas] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [usuarioId, setUsuarioId] = React.useState<string | null>(null);
  const [preferencias, setPreferencias] = React.useState<PreferenciasNotificacao>({
    usuario_id: "",
    notificacoes_transacionais: true,
    notificacoes_promocionais: true,
    notificacoes_lembretes: true,
    atualizado_em: "",
  });
  const [salvandoPref, setSalvandoPref] = React.useState(false);
  const [sucessoPref, setSucessoPref] = React.useState(false);
  const [pushAtivo, setPushAtivo] = React.useState(false);
  const [ativandoPush, setAtivandoPush] = React.useState(false);
  const [erroPush, setErroPush] = React.useState<string | null>(null);
  const pushRef = React.useRef<RegistroPushWeb | null>(null);

  const carregarNotificacoes = React.useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      const supabase = criarClienteSupabaseBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;
      setUsuarioId(session.user.id);

      const { data: preferenciasDb, error: erroPreferencias } = await supabase
        .from("preferencias_notificacao")
        .select("*")
        .eq("usuario_id", session.user.id)
        .maybeSingle();
      if (erroPreferencias) throw erroPreferencias;
      if (preferenciasDb) {
        setPreferencias(preferenciasDb as PreferenciasNotificacao);
      } else {
        setPreferencias((atuais) => ({ ...atuais, usuario_id: session.user.id }));
      }

      let permissaoPushAtiva = true;
      if (appNativo) {
        try {
          const { PushNotifications } = await import("@capacitor/push-notifications");
          const permissao = await PushNotifications.checkPermissions();
          permissaoPushAtiva = permissao.receive === "granted";
        } catch {
          permissaoPushAtiva = false;
        }
      } else {
        permissaoPushAtiva = typeof Notification !== "undefined" && Notification.permission === "granted";
      }
      let consultaDispositivo = supabase
        .from("dispositivos")
        .select("id")
        .eq("usuario_id", session.user.id)
        .eq("plataforma", plataformaPush)
        .eq("ativo", true);
      const tokenNativo = appNativo ? tokenPushNativoAtual() : null;
      if (tokenNativo) consultaDispositivo = consultaDispositivo.eq("fcm_token", tokenNativo);
      const { data: dispositivoPush } = await consultaDispositivo.limit(1).maybeSingle();
      setPushAtivo(
        Boolean(dispositivoPush) && permissaoPushAtiva
      );

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
  }, [appNativo, filtroLida, plataformaPush]);

  async function handleSalvarPreferenciaTransacional(valor: boolean) {
    if (!usuarioId || !preferencias.usuario_id) return;

    const preferenciasAnteriores = preferencias;
    const novasPreferencias = {
      ...preferencias,
      notificacoes_transacionais: valor,
      atualizado_em: new Date().toISOString(),
    };

    try {
      setSalvandoPref(true);
      setSucessoPref(false);
      setErro(null);
      setPreferencias(novasPreferencias);

      const supabase = criarClienteSupabaseBrowser();
      const { error: erroSalvar } = await (supabase.from("preferencias_notificacao") as any).upsert({
        usuario_id: novasPreferencias.usuario_id,
        notificacoes_transacionais: novasPreferencias.notificacoes_transacionais,
        notificacoes_promocionais: novasPreferencias.notificacoes_promocionais,
        notificacoes_lembretes: novasPreferencias.notificacoes_lembretes,
        atualizado_em: novasPreferencias.atualizado_em,
      });
      if (erroSalvar) throw erroSalvar;

      setSucessoPref(true);
      setTimeout(() => setSucessoPref(false), 3000);
    } catch (erroSalvar) {
      setPreferencias(preferenciasAnteriores);
      setErro(traduzirErro(erroSalvar, "Erro ao salvar preferências de notificação."));
    } finally {
      setSalvandoPref(false);
    }
  }

  async function handleAlternarPush() {
    if (!usuarioId) return;
    try {
      setAtivandoPush(true);
      setErroPush(null);
      const supabase = criarClienteSupabaseBrowser();
      if (appNativo) {
        if (pushAtivo) {
          const tokenNativo = tokenPushNativoAtual();
          definirPushNativoAtivo(false);
          const { error: erroUpdate } = await (supabase.from("dispositivos") as any)
            .update({ ativo: false })
            .eq("usuario_id", usuarioId)
            .eq("plataforma", plataformaPush)
            .match(tokenNativo ? { fcm_token: tokenNativo } : {});
          if (erroUpdate) {
            definirPushNativoAtivo(true);
            throw erroUpdate;
          }
          setPushAtivo(false);
          return;
        }

        const { PushNotifications } = await import("@capacitor/push-notifications");
        let permissao = await PushNotifications.checkPermissions();
        if (permissao.receive === "prompt" || permissao.receive === "prompt-with-rationale") {
          permissao = await PushNotifications.requestPermissions();
        }
        if (permissao.receive !== "granted") {
          throw new Error("Permita notificações nas configurações do aparelho para ativá-las.");
        }
        definirPushNativoAtivo(true);
        setPushAtivo(true);
        return;
      }
      if (pushAtivo && pushRef.current) {
        await pushRef.current.desativar();
        pushRef.current = null;
        setPushAtivo(false);
        return;
      }
      if (pushAtivo) {
        const { error: erroUpdate } = await (supabase.from("dispositivos") as any)
          .update({ ativo: false })
          .eq("usuario_id", usuarioId)
          .eq("plataforma", "web");
        if (erroUpdate) throw erroUpdate;
        setPushAtivo(false);
        return;
      }

      const env = (import.meta as any).env ?? {};
      const registro = await ativarPushWeb({
        plataforma: "parceiro",
        config: {
          apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
          vapidKey: env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        },
        salvarToken: async (token, modelo) => {
          const { error: erroRpc } = await (supabase.rpc as any)("registrar_dispositivo", {
            p_fcm_token: token,
            p_plataforma: "web",
            p_modelo: modelo,
          });
          if (erroRpc) throw erroRpc;
        },
        desativarToken: async (token) => {
          const { error: erroUpdate } = await (supabase.from("dispositivos") as any)
            .update({ ativo: false })
            .eq("usuario_id", usuarioId)
            .eq("fcm_token", token)
            .eq("plataforma", "web");
          if (erroUpdate) throw erroUpdate;
        },
      });
      pushRef.current = registro;
      setPushAtivo(true);
      notificarPushWebAtivado();
    } catch (erro) {
      setErroPush(
        traduzirErro(erro, "Não foi possível atualizar as notificações. Verifique sua conexão e tente novamente.")
      );
    } finally {
      setAtivandoPush(false);
    }
  }

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
      {erroPush && (
        <Alert variante="erro">
          <AlertDescription>{erroPush}</AlertDescription>
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

      <Card className="border border-neutral-200/80 shadow-sm dark:border-neutral-800">
        <CardContent className="flex flex-row items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-[#B45A2B]" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <span id="push-status-label-parceiro" className="font-bold text-sm">
                {appNativo ? "Notificações neste app" : "Notificações neste navegador"}
              </span>
              <span id="push-status-parceiro" role="status" aria-live="polite" className="text-xs opacity-70">
                {appNativo
                  ? pushAtivo
                    ? "Este app está registrado para receber avisos do Barzzo."
                    : "As notificações deste app estão desativadas."
                  : pushAtivo
                    ? "Este navegador está ativado para receber avisos do Barzzo."
                    : "Ative para receber avisos mesmo quando o Barzzo não estiver aberto."}
              </span>
            </div>
          </div>
          <Switch
            id={`push-switch-parceiro-${appNativo ? "app" : "web"}`}
            aria-label={appNativo ? "Notificações neste app" : "Notificações neste navegador"}
            aria-labelledby="push-status-label-parceiro"
            aria-describedby="push-status-parceiro"
            marcado={pushAtivo}
            aoMudar={() => void handleAlternarPush()}
            disabled={ativandoPush || !usuarioId}
            className="min-h-[44px] min-w-[44px] shrink-0"
          />
        </CardContent>
      </Card>

      <Card className="border border-neutral-200/80 shadow-sm dark:border-neutral-800">
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span id="notificacoes-transacionais-label-parceiro" className="font-bold text-sm">
              Notificações Transacionais
            </span>
            <span id="notificacoes-transacionais-descricao-parceiro" className="text-xs opacity-70">
              Confirmações de agendamento e avisos de cancelamento/reagendamento da barbearia.
            </span>
          </div>
          <Switch
            id="notificacoes-transacionais-switch-parceiro"
            aria-labelledby="notificacoes-transacionais-label-parceiro"
            aria-describedby="notificacoes-transacionais-descricao-parceiro"
            marcado={preferencias.notificacoes_transacionais}
            aoMudar={(valor) => void handleSalvarPreferenciaTransacional(valor)}
            disabled={salvandoPref || carregando || !preferencias.usuario_id}
            className="min-h-[44px] min-w-[44px]"
          />
        </CardContent>
      </Card>
      {sucessoPref && (
        <span role="status" aria-live="polite" className="text-xs font-semibold text-[#16A34A]">
          Preferências salvas com sucesso!
        </span>
      )}

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
                      {formatarDataHora(n.criado_em)}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm opacity-80 leading-relaxed">{n.corpo}</p>

                  {n.link && (
                    <div className="mt-2">
                      <Link
                        to={n.link}
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
