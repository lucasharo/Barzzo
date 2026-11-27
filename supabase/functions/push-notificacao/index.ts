import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

function base64Url(valor: Uint8Array | string): string {
  const bytes = typeof valor === "string" ? encoder.encode(valor) : valor;
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function mesmoSegredo(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i += 1) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

async function obterAccessToken(projectId: string, clientEmail: string, privateKey: string) {
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: agora,
    exp: agora + 3600,
  }));
  const jwtSemAssinatura = `${cabecalho}.${claims}`;
  const pem = privateKey.replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const chave = Uint8Array.from(atob(pem), (caractere) => caractere.charCodeAt(0));
  const chavePrivada = await crypto.subtle.importKey(
    "pkcs8",
    chave,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", chavePrivada, encoder.encode(jwtSemAssinatura)),
  );
  const jwt = `${jwtSemAssinatura}.${base64Url(assinatura)}`;
  const resposta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!resposta.ok) throw new Error(`Google OAuth respondeu ${resposta.status}`);
  const dados = await resposta.json();
  if (typeof dados.access_token !== "string") throw new Error("Google OAuth não retornou token de acesso.");
  return { token: dados.access_token as string, projectId };
}

function preferenciaPermitida(tipo: string, preferencias: Record<string, boolean> | null) {
  if (tipo === "promocao") return preferencias?.notificacoes_promocionais !== false;
  if (tipo === "lembrete") return preferencias?.notificacoes_lembretes !== false;
  return preferencias?.notificacoes_transacionais !== false;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Método não permitido", { status: 405 });

  try {
    const body = await req.json();
    const notificacaoId = typeof body?.notificacao_id === "string" ? body.notificacao_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(notificacaoId)) {
      return Response.json({ erro: "Identificador de notificação inválido." }, { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Configuração de envio push ausente.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: config, error: erroConfig } = await supabase.rpc("obter_configuracao_push_web");
    if (erroConfig) throw erroConfig;
    const segredoEsperado = typeof config === "object" && config !== null &&
      typeof config.BARZZO_PUSH_WEBHOOK_SECRET === "string"
      ? config.BARZZO_PUSH_WEBHOOK_SECRET
      : "";
    const segredoRecebido = req.headers.get("x-barzzo-webhook-secret") ?? "";
    if (!segredoEsperado || !mesmoSegredo(segredoEsperado, segredoRecebido)) {
      return new Response("Não autorizado", { status: 401 });
    }

    const projectId = Deno.env.get("FIREBASE_PROJECT_ID") ?? "";
    const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL") ?? "";
    const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY") ?? "";
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("Configuração de envio push ausente.");
    }
    const { data: notificacao, error: erroNotificacao } = await supabase
      .from("notificacoes")
      .select("id, usuario_id, titulo, corpo, tipo, link")
      .eq("id", notificacaoId)
      .maybeSingle();
    if (erroNotificacao) throw erroNotificacao;
    if (!notificacao) return Response.json({ enviado: 0, motivo: "notificacao_inexistente" });

    const [{ data: preferencias }, { data: dispositivos, error: erroDispositivos }] = await Promise.all([
      supabase.from("preferencias_notificacao")
        .select("notificacoes_transacionais, notificacoes_promocionais, notificacoes_lembretes")
        .eq("usuario_id", notificacao.usuario_id)
        .maybeSingle(),
      supabase.from("dispositivos")
        .select("id, fcm_token, plataforma")
        .eq("usuario_id", notificacao.usuario_id)
        .in("plataforma", ["web", "android", "ios"])
        .eq("ativo", true),
    ]);
    if (erroDispositivos) throw erroDispositivos;
    if (!preferenciaPermitida(notificacao.tipo, preferencias)) {
      return Response.json({ enviado: 0, motivo: "preferencia_desativada" });
    }
    if (!dispositivos?.length) return Response.json({ enviado: 0, motivo: "sem_dispositivos" });

    const { token } = await obterAccessToken(projectId, clientEmail, privateKey);
    const link = typeof notificacao.link === "string" && notificacao.link.startsWith("/") && !notificacao.link.startsWith("//")
      ? notificacao.link
      : "/";
    let enviados = 0;
    let inativos = 0;

    for (const dispositivo of dispositivos) {
      const resposta = await fetch(
        `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: dispositivo.fcm_token,
              data: {
                titulo: notificacao.titulo,
                corpo: notificacao.corpo,
                link,
              },
              ...(dispositivo.plataforma === "web"
                ? { webpush: { headers: { TTL: "86400" } } }
                : {
                    notification: { title: notificacao.titulo, body: notificacao.corpo },
                    android: { priority: "HIGH" },
                  }),
            },
          }),
        },
      );
      if (resposta.ok) {
        enviados += 1;
        continue;
      }

      const detalhes = await resposta.text();
      if (resposta.status === 404 || detalhes.includes("UNREGISTERED") || detalhes.includes("INVALID_ARGUMENT")) {
        await supabase.from("dispositivos").update({ ativo: false }).eq("id", dispositivo.id);
        inativos += 1;
      }
      console.error("FCM falhou para um dispositivo web", resposta.status);
    }

    return Response.json({ enviado: enviados, dispositivos_inativos: inativos });
  } catch (erro) {
    console.error("Falha no envio de push web", erro instanceof Error ? erro.message : "erro desconhecido");
    return Response.json({ erro: "Não foi possível enviar a notificação." }, { status: 500 });
  }
});
