import { ehAppNativo, plataformaAtual } from "@barzzo/utilitarios";

export interface OpcoesPush {
  /** Grava o token FCM do aparelho para o usuário logado. */
  salvarToken: (token: string, plataforma: "android" | "ios") => Promise<void>;
  /** Chamado ao tocar numa notificação; `link` vem do campo `link` dos dados da mensagem. */
  aoAbrirNotificacao?: (link: string | null) => void;
  /** Chamado quando a notificação chega com o app aberto. */
  aoReceber?: (titulo: string | null, corpo: string | null) => void;
}

/**
 * Pede permissão, registra o aparelho no FCM e entrega o token. Só roda no app nativo e exige o
 * google-services.json do projeto Firebase no build Android; sem ele o registro falha e é ignorado.
 * Retorna a função que remove os ouvintes.
 */
export async function registrarPush(opcoes: OpcoesPush): Promise<() => void> {
  if (!ehAppNativo()) return () => undefined;
  const plataforma = plataformaAtual();
  if (plataforma === "web") return () => undefined;

  const { PushNotifications } = await import("@capacitor/push-notifications");

  let permissao = await PushNotifications.checkPermissions();
  if (permissao.receive === "prompt" || permissao.receive === "prompt-with-rationale") {
    permissao = await PushNotifications.requestPermissions();
  }
  if (permissao.receive !== "granted") return () => undefined;

  const ouvintes = await Promise.all([
    PushNotifications.addListener("registration", (token) => {
      opcoes.salvarToken(token.value, plataforma).catch(() => undefined);
    }),
    PushNotifications.addListener("registrationError", () => undefined),
    PushNotifications.addListener("pushNotificationReceived", (notificacao) => {
      opcoes.aoReceber?.(notificacao.title ?? null, notificacao.body ?? null);
    }),
    PushNotifications.addListener("pushNotificationActionPerformed", (acao) => {
      const link = acao.notification.data?.link;
      opcoes.aoAbrirNotificacao?.(typeof link === "string" ? link : null);
    }),
  ]);

  try {
    await PushNotifications.register();
  } catch {
    // Sem google-services.json (Firebase) o registro não é possível: o app segue sem push.
  }

  return () => {
    ouvintes.forEach((ouvinte) => ouvinte.remove().catch(() => undefined));
  };
}
