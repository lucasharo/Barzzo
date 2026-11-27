import { ehAppNativo, plataformaAtual } from "@barzzo/utilitarios";

const CHAVE_PUSH_NATIVO_ATIVO = "barzzo:push-nativo-ativo";
const CHAVE_TOKEN_PUSH_NATIVO = "barzzo:push-nativo-token";
const EVENTO_PUSH_NATIVO_ALTERADO = "barzzo:push-nativo-alterado";

export function pushNativoAtivo(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(CHAVE_PUSH_NATIVO_ATIVO) !== "false";
}

export function definirPushNativoAtivo(ativo: boolean): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(CHAVE_PUSH_NATIVO_ATIVO, String(ativo));
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENTO_PUSH_NATIVO_ALTERADO, { detail: { ativo } }));
  }
}

export function tokenPushNativoAtual(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(CHAVE_TOKEN_PUSH_NATIVO);
}

export function salvarTokenPushNativo(token: string): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(CHAVE_TOKEN_PUSH_NATIVO, token);
  }
}

export const eventoPushNativoAlterado = EVENTO_PUSH_NATIVO_ALTERADO;

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
      opcoes.salvarToken(token.value, plataforma).catch((erro: unknown) => {
        const codigo = erro && typeof erro === "object" && "code" in erro ? String(erro.code) : "sem código";
        console.error("Falha ao salvar o token push no Supabase", codigo);
      });
    }),
    PushNotifications.addListener("registrationError", (erro) => {
      const codigo = erro && typeof erro === "object" && "code" in erro ? String(erro.code) : "sem código";
      console.error("Falha ao registrar o aparelho no FCM", codigo);
    }),
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
  } catch (erro) {
    const codigo = erro && typeof erro === "object" && "code" in erro ? String(erro.code) : "sem código";
    console.error("Falha ao iniciar o registro push", codigo);
  }

  return () => {
    ouvintes.forEach((ouvinte) => ouvinte.remove().catch(() => undefined));
  };
}
