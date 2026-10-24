# Apps Android (Capacitor)

Os apps **Cliente** e **Parceiro** viram dois aplicativos Android independentes empacotando o build Vite (`dist/`) em um WebView nativo (Capacitor 7). O Admin continua só web.

| App | Pasta | Application id (release) | Debug | Nome |
|---|---|---|---|---|
| Barzzo (Cliente) | `apps/cliente` | `com.barzzo.cliente` | `com.barzzo.cliente.dev` | Barzzo / Barzzo Dev |
| Barzzo Parceiro | `apps/parceiro` | `com.barzzo.parceiro` | `com.barzzo.parceiro.dev` | Barzzo Parceiro / Barzzo Parceiro Dev |

O build de debug usa o sufixo `.dev` para conviver, no mesmo aparelho, com a versão da loja.

## Estrutura

- `apps/<app>/capacitor.config.ts`: id, nome, `webDir: dist`, esquema `https://localhost`, barra de status, tela de abertura e teclado.
- `apps/<app>/android/`: projeto Gradle nativo (versionado; saídas de build e `keystore.properties` ficam no `.gitignore`).
- `apps/<app>/assets/`: marca-base (ícone e splash) e `scripts/gerar-icones-android.mjs`, que gera todos os tamanhos com `@capacitor/assets`.
- `packages/nativo` (`@barzzo/nativo`): código nativo compartilhado pelos dois apps.
  - `RuntimeNativo`: barra de status (segue o tema claro/escuro), fim da tela de abertura, botão voltar (fecha o app só nas rotas raiz), links profundos `barzzo://cliente/...` e `barzzo://parceiro/...`.
  - `registrarPush`: pede a permissão, registra o aparelho no FCM e grava o token em `dispositivos` (RLS: o usuário só grava o próprio).
  - `obterPosicaoAtual`: localização pelo plugin nativo ou pelo navegador.
- `packages/utilitarios/src/plataforma.ts`: `ehAppNativo()` e `plataformaAtual()` (o app web e o PWA seguem iguais).

## API do Parceiro no app

O app não tem servidor local. As rotas `/api/*` (assinatura, cartão, Mercado Pago) vivem no deploy web do Parceiro. No nativo, `apps/parceiro/src/lib/api.ts` chama o endereço absoluto de `VITE_API_BASE_URL` (padrão: `https://barzzo-parceiro-dev.vercel.app`) e envia a sessão (`Authorization: Bearer`).

As rotas exigem usuário logado que seja dono ou gerente da barbearia (`api/_seguranca.js`) e liberam CORS apenas para as origens do Barzzo e do WebView (`https://localhost`, `capacitor://localhost`). Origens extras: variável `CORS_ORIGENS` (separadas por vírgula). Os crons exigem `CRON_SECRET`.

## Ambiente de build (Windows)

- JDK 21, Android SDK (`ANDROID_HOME=D:\Android\android-sdk`, plataforma 35) e `GRADLE_USER_HOME=D:\gradle-user-home`. Nada vai para o `C:`.
- Primeira execução baixa o Gradle 8.11.1 e as dependências (alguns minutos).

## Comandos

Na raiz do monorepo:

```bash
npm run android:cliente      # build web + cap sync + APK de debug do Cliente
npm run android:parceiro     # idem para o Parceiro
npm run android:cliente:release    # AAB e APK de release (precisa do keystore)
npm run android:parceiro:release
```

APK de debug: `apps/<app>/android/app/build/outputs/apk/debug/app-debug.apk`.
Instalar no emulador ou aparelho: `adb install -r <apk>`.

Versão: `-PbarzzoVersionCode=12 -PbarzzoVersionName=1.2.0` (padrão 1 / 0.1.0).

## Assinatura de release

1. Gere o keystore **fora do repositório** e faça backup (perdê-lo impede atualizar o app na Play Store; considere o Play App Signing).
2. Copie `apps/<app>/android/keystore.properties.example` para `keystore.properties` e preencha.
3. `npm run android:<app>:release` gera o AAB em `android/app/build/outputs/bundle/release/`.

Sem `keystore.properties` o build de release sai sem assinatura.

## Push (Firebase Cloud Messaging)

O app já registra o token. Para o push funcionar:

1. Criar o projeto Firebase do Barzzo (só push, nunca imagens nem Auth) e registrar os apps Android `com.barzzo.cliente`, `com.barzzo.cliente.dev`, `com.barzzo.parceiro`, `com.barzzo.parceiro.dev`.
2. Colocar o `google-services.json` em `apps/<app>/android/app/` (já está no `.gitignore`).
3. Implementar o envio no backend (Edge Function com a conta de serviço do FCM) lendo `dispositivos` e respeitando `preferencias_notificacao`. **Pendente:** hoje só a central in-app existe.

Sem o arquivo, o plugin do Google não é aplicado e o app segue sem push.

## Links profundos

Esquema `barzzo://cliente/<rota>` e `barzzo://parceiro/<rota>`. Links de e-mail (recuperação de senha, convite) abrem o site; para abrir direto no app é preciso publicar `assetlinks.json` nos domínios e adicionar App Links no manifesto (pendente, depende dos domínios finais).

## Pendências e riscos

- Projeto Firebase e envio de push (acima).
- Mercado Pago no WebView: o fluxo de cartão do Parceiro funciona por API; o Checkout Pro por redirecionamento (`criar-preferencia`) volta para a URL web e precisa de App Link para retornar ao app.
- iOS fica para uma fase futura (mesma base Capacitor).
- Ícone e splash usam a marca atual (letra B); trocar os arquivos em `apps/<app>/assets/` e rodar `npm run android:icones --workspace=apps/<app>`.
