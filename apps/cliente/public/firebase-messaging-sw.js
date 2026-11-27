/* global importScripts, firebase, self, URL */

importScripts("https://www.gstatic.com/firebasejs/12.9.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.9.0/firebase-messaging-compat.js");

const configJson = new URL(self.location.href).searchParams.get("config");
if (configJson) {
  firebase.initializeApp(JSON.parse(configJson));
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const dados = payload.data || {};
    const titulo = dados.titulo || payload.notification?.title || "Barzzo";
    const corpo = dados.corpo || payload.notification?.body || "Você tem uma nova notificação.";
    self.registration.showNotification(titulo, {
      body: corpo,
      icon: "/icon-192.svg",
      data: { link: dados.link || null },
    });
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const caminho = event.notification.data?.link;
  const destino = typeof caminho === "string" && caminho.startsWith("/") && !caminho.startsWith("//")
    ? new URL(caminho, self.location.origin).href
    : self.location.origin;
  event.waitUntil((async () => {
    const abas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const aba of abas) {
      if (aba.url.startsWith(self.location.origin) && "focus" in aba) {
        await aba.focus();
        if ("navigate" in aba && aba.url !== destino) await aba.navigate(destino);
        return;
      }
    }
    await self.clients.openWindow(destino);
  })());
});
