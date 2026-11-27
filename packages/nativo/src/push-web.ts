type PayloadPush = {
  notification?: { title?: string; body?: string };
  data?: Record<string, string>;
};

export interface ConfiguracaoFirebaseWeb {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  messagingSenderId?: string;
  appId?: string;
  vapidKey?: string;
}

function erroFirebaseComCodigo(erro: unknown): Error | null {
  const codigo =
    erro && typeof erro === "object" && "code" in erro && typeof erro.code === "string"
      ? erro.code
      : null;
  if (!codigo || (!codigo.startsWith("messaging/") && !codigo.startsWith("installations/"))) return null;

  console.error("Falha ao ativar notificações no Firebase", codigo);
  const mensagens: Record<string, string> = {
    "messaging/permission-blocked": "A permissão de notificações está bloqueada no navegador. Libere a permissão nas configurações do site.",
    "messaging/unsupported-browser": "Este navegador não oferece suporte a notificações web.",
    "messaging/failed-service-worker-registration": "O navegador não conseguiu ativar o serviço de notificações. Recarregue a página e tente novamente.",
    "messaging/token-subscribe-no-vapid-key": "A configuração de notificações do Barzzo está sem a chave pública do Firebase.",
    "messaging/invalid-public-vapid-key": "A chave pública do Firebase está inválida. A configuração do ambiente precisa ser corrigida.",
    "messaging/token-subscribe-failed": "O Firebase recusou o cadastro deste navegador. Confira a configuração Web Push do projeto Firebase.",
    "installations/registration-api-key-not-valid": "A chave de configuração do Firebase é inválida neste ambiente.",
    "installations/missing-app-config-values": "A configuração do Firebase está incompleta neste ambiente.",
  };
  return new Error(mensagens[codigo] ?? `O Firebase não concluiu o cadastro deste navegador (código ${codigo}).`);
}

function aguardarComTempoLimite<T>(promessa: Promise<T>, limiteMs: number, mensagem: string): Promise<T> {
  let temporizador: number | undefined;
  const limite = new Promise<T>((_, rejeitar) => {
    temporizador = window.setTimeout(() => rejeitar(new Error(mensagem)), limiteMs);
  });

  return Promise.race([promessa, limite]).finally(() => {
    if (temporizador !== undefined) window.clearTimeout(temporizador);
  });
}

function aguardarServiceWorkerAtivo(
  registro: ServiceWorkerRegistration,
  urlEsperada: string,
  appIdEsperado: string,
  projectIdEsperado: string,
  limiteMs: number
): Promise<ServiceWorkerRegistration> {
  return new Promise((resolve, reject) => {
    const prazo = Date.now() + limiteMs;
    let temporizador: number | undefined;
    const correspondeAoFirebase = (worker: ServiceWorker) => {
      try {
        const urlAtiva = new URL(worker.scriptURL);
        const urlConfigurada = new URL(urlEsperada);
        const configAtiva = JSON.parse(urlAtiva.searchParams.get("config") ?? "{}");
        return urlAtiva.origin === urlConfigurada.origin &&
          urlAtiva.pathname === "/firebase-messaging-sw.js" &&
          configAtiva.appId === appIdEsperado &&
          configAtiva.projectId === projectIdEsperado;
      } catch {
        return false;
      }
    };

    const conferir = () => {
      const ativo = registro.active;
      if (ativo?.state === "activated" && correspondeAoFirebase(ativo)) {
        if (temporizador !== undefined) window.clearTimeout(temporizador);
        resolve(registro);
        return;
      }

      if (Date.now() >= prazo) {
        reject(new Error("O serviço de notificações não foi ativado para este endereço."));
        return;
      }
      // O evento statechange pode ocorrer antes de Registration.active ser atualizado.
      temporizador = window.setTimeout(conferir, 50);
    };

    conferir();
  });
}

export interface OpcoesPushWeb {
  config: ConfiguracaoFirebaseWeb;
  plataforma: "cliente" | "parceiro";
  salvarToken: (token: string, modelo: string) => Promise<void>;
  desativarToken: (token: string) => Promise<void>;
}

export interface RegistroPushWeb {
  token: string;
  desativar: () => Promise<void>;
}

function extrairMensagem(payload: PayloadPush) {
  const dados = payload.data ?? {};
  return {
    titulo: payload.notification?.title ?? dados.titulo ?? "Barzzo",
    corpo: payload.notification?.body ?? dados.corpo ?? "Você tem uma nova notificação.",
    link: dados.link ?? null,
  };
}

/** Ativa notificações web somente após ação explícita do usuário. */
export async function ativarPushWeb(opcoes: OpcoesPushWeb): Promise<RegistroPushWeb> {
  if (
    typeof window === "undefined" ||
    !window.isSecureContext ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    throw new Error("As notificações não estão disponíveis neste navegador.");
  }

  const camposObrigatorios = [
    opcoes.config.apiKey,
    opcoes.config.appId,
    opcoes.config.projectId,
    opcoes.config.messagingSenderId,
    opcoes.config.vapidKey,
  ];
  if (camposObrigatorios.some((valor) => !valor)) {
    throw new Error("A configuração de notificações do Barzzo está incompleta.");
  }

  const permissao =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permissao !== "granted") {
    throw new Error("A permissão para notificações não foi concedida.");
  }

  const configFirebase = {
    apiKey: opcoes.config.apiKey,
    authDomain: opcoes.config.authDomain,
    projectId: opcoes.config.projectId,
    messagingSenderId: opcoes.config.messagingSenderId,
    appId: opcoes.config.appId,
  };
  const versaoSdk = "12.9.0";
  const importarFirebase = (url: string) => import(/* @vite-ignore */ url);
  let sdkApp: any;
  let sdkMessaging: any;
  try {
    [sdkApp, sdkMessaging] = await Promise.all([
      importarFirebase(`https://www.gstatic.com/firebasejs/${versaoSdk}/firebase-app.js`),
      importarFirebase(`https://www.gstatic.com/firebasejs/${versaoSdk}/firebase-messaging.js`),
    ]);
  } catch (erro) {
    throw erroFirebaseComCodigo(erro) ?? new Error("Não foi possível carregar o serviço de notificações.");
  }

  let navegadorSuportado = false;
  try {
    navegadorSuportado = await sdkMessaging.isSupported();
  } catch (erro) {
    throw erroFirebaseComCodigo(erro) ?? new Error("Não foi possível verificar o suporte a notificações neste navegador.");
  }
  if (!navegadorSuportado) {
    throw new Error("Este navegador não oferece suporte a notificações web.");
  }
  const appExistente = sdkApp.getApps().find((item: any) => item.options.appId === configFirebase.appId);
  const app = appExistente ? sdkApp.getApp(appExistente.name) : sdkApp.initializeApp(configFirebase);
  // getMessaging() pode lançar antes de isSupported() em alguns navegadores móveis.
  let messaging: any;
  try {
    messaging = sdkMessaging.getMessaging(app);
  } catch (erro) {
    throw erroFirebaseComCodigo(erro) ??
      (erro instanceof Error
        ? erro
        : new Error("Não foi possível iniciar o serviço de notificações neste navegador."));
  }
  const configWorker = encodeURIComponent(JSON.stringify(configFirebase));
  const urlWorkerEsperada = new URL(
    `/firebase-messaging-sw.js?config=${configWorker}`,
    window.location.origin
  ).href;
  let worker: ServiceWorkerRegistration;
  try {
    const registroWorker = await navigator.serviceWorker.register(urlWorkerEsperada, { scope: "/" });
    // navigator.serviceWorker.ready pode entregar um worker antigo do mesmo escopo.
    // Aguarda especificamente o worker do Firebase com a configuração deste projeto.
    const workerPronto = await aguardarServiceWorkerAtivo(
      registroWorker,
      urlWorkerEsperada,
      configFirebase.appId!,
      configFirebase.projectId!,
      20000
    );
    worker = workerPronto;
  } catch (erro) {
    throw erroFirebaseComCodigo(erro) ?? new Error("Não foi possível iniciar o serviço de notificações neste navegador.");
  }

  try {
    const token = await aguardarComTempoLimite(
      sdkMessaging.getToken(messaging, {
        vapidKey: opcoes.config.vapidKey,
        serviceWorkerRegistration: worker,
      }),
      60000,
      "O Firebase demorou para concluir o registro das notificações. Verifique a conexão e tente novamente."
    );
    if (typeof token !== "string" || !token.trim()) {
      throw new Error("O Firebase não retornou um token para este navegador.");
    }
    const modelo = `web:${opcoes.plataforma}:${navigator.userAgent.slice(0, 180)}`;
    try {
      await aguardarComTempoLimite(
        opcoes.salvarToken(token, modelo),
        30000,
        "Não foi possível salvar este navegador para receber notificações."
      );
    } catch (erro) {
      const codigo =
        erro && typeof erro === "object" && "code" in erro && typeof erro.code === "string"
          ? erro.code
          : null;
      console.error("Falha ao salvar o token de notificações no Supabase", codigo ?? "sem código");
      if (erro instanceof Error && erro.message.includes("não foi possível salvar")) throw erro;
      throw new Error(
        codigo
          ? `O Firebase gerou o token, mas o Barzzo não conseguiu salvar o cadastro no Supabase (código ${codigo}).`
          : "O Firebase gerou o token, mas o Barzzo não conseguiu salvar o cadastro no Supabase. Confira sua conexão e tente novamente."
      );
    }

    return {
      token,
      desativar: async () => {
        await sdkMessaging.deleteToken(messaging);
        await opcoes.desativarToken(token);
      },
    };
  } catch (erro) {
    const erroComCodigo = erroFirebaseComCodigo(erro);
    if (erroComCodigo) throw erroComCodigo;
    throw erro instanceof Error ? erro : new Error("Não foi possível ativar as notificações.");
  }
}

/** Mantém o recebimento em primeiro plano ativo fora da página de notificações. */
export async function ouvirPushWebEmPrimeiroPlano(
  config: ConfiguracaoFirebaseWeb
): Promise<() => void> {
  if (
    typeof window === "undefined" ||
    !window.isSecureContext ||
    !("Notification" in window) ||
    Notification.permission !== "granted" ||
    !("serviceWorker" in navigator)
  ) {
    return () => undefined;
  }

  const camposObrigatorios = [config.apiKey, config.appId, config.projectId, config.messagingSenderId];
  if (camposObrigatorios.some((valor) => !valor)) return () => undefined;

  const versaoSdk = "12.9.0";
  const importarFirebase = (url: string) => import(/* @vite-ignore */ url);
  const [sdkApp, sdkMessaging] = await Promise.all([
    importarFirebase(`https://www.gstatic.com/firebasejs/${versaoSdk}/firebase-app.js`),
    importarFirebase(`https://www.gstatic.com/firebasejs/${versaoSdk}/firebase-messaging.js`),
  ]);
  if (!(await sdkMessaging.isSupported())) return () => undefined;

  const configFirebase = {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  };
  const appExistente = sdkApp.getApps().find((item: any) => item.options.appId === configFirebase.appId);
  const app = appExistente ? sdkApp.getApp(appExistente.name) : sdkApp.initializeApp(configFirebase);
  const messaging = sdkMessaging.getMessaging(app);
  const worker = await navigator.serviceWorker.getRegistration("/");
  if (!worker?.active) return () => undefined;

  try {
    const configWorker = JSON.parse(new URL(worker.active.scriptURL).searchParams.get("config") ?? "{}");
    if (configWorker.appId !== configFirebase.appId || configWorker.projectId !== configFirebase.projectId) {
      return () => undefined;
    }
  } catch {
    return () => undefined;
  }

  return sdkMessaging.onMessage(messaging, (payload: PayloadPush) => {
    const mensagem = extrairMensagem(payload);
    void worker.showNotification(mensagem.titulo, {
      body: mensagem.corpo,
      icon: "/icon-192.svg",
      data: { link: mensagem.link },
    }).catch((erro: unknown) => {
      const codigo = erro && typeof erro === "object" && "name" in erro ? String(erro.name) : "erro desconhecido";
      console.error("Falha ao exibir notificação em primeiro plano", codigo);
    });
  });
}

export function notificarPushWebAtivado() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("barzzo:push-web-ativado"));
}

export function extrairDadosPushWeb(payload: PayloadPush) {
  return extrairMensagem(payload);
}
