# Apps Android (Capacitor)

Os apps **Cliente** e **Parceiro** viram dois aplicativos Android independentes empacotando o build Vite (`dist/`) em um WebView nativo (Capacitor 7). O Admin continua só web.

| App | Pasta | Ambiente DEV | Produção | Nome |
|---|---|---|---|---|
| Barzzo (Cliente) | `apps/cliente` | `com.barzzo.cliente.dev` | `com.barzzo.cliente` | Barzzo DEV / Barzzo |
| Barzzo Parceiro | `apps/parceiro` | `com.barzzo.parceiro.dev` | `com.barzzo.parceiro` | Barzzo Parceiro DEV / Barzzo Parceiro |

As variantes `devDebug` e `devRelease` usam `.dev` e podem coexistir com os apps de produção. A variante `devRelease` é assinada para distribuição de teste e usa o mesmo applicationId dos APKs de debug.

## Estrutura

- `apps/<app>/capacitor.config.ts`: id, nome, `webDir: dist`, esquema `https://localhost`, barra de status, tela de abertura e teclado.
- `apps/<app>/android/`: projeto Gradle nativo (versionado; saídas de build e `keystore.properties` ficam no `.gitignore`).
- `apps/<app>/assets/`: ícone oficial e splash usados por `scripts/gerar-icones-android.mjs` para gerar todos os tamanhos Android com `@capacitor/assets`.
- `apps/<app>/public/marca/`: logotipos claro e escuro usados nos cabeçalhos web.
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
npm run android:cliente:dev:release    # AAB e APK DEV assinados do Cliente
npm run android:parceiro:dev:release   # idem para o Parceiro
npm run android:cliente:release        # AAB e APK de produção
npm run android:parceiro:release       # idem para produção
```

APK DEV de debug: `apps/<app>/android/app/build/outputs/apk/dev/debug/app-dev-debug.apk`.
APK DEV assinado: `apps/<app>/android/app/build/outputs/apk/dev/release/app-dev-release.apk`.
AAB DEV assinado: `apps/<app>/android/app/build/outputs/bundle/devRelease/app-dev-release.aab`.
Instalar no emulador ou aparelho: `adb install -r <apk>`.

Versão: `-PbarzzoVersionCode=12 -PbarzzoVersionName=1.2.0` (padrão 1 / 0.1.0).

## Assinatura de release

1. Gere o keystore **fora do repositório** e faça backup. Preserve a mesma chave para todas as futuras atualizações DEV assinadas.
2. Copie `apps/<app>/android/keystore.properties.example` para `keystore.properties` e preencha os caminhos e senhas locais.
3. `npm run android:<app>:dev:release` gera AAB e APK DEV assinados; `npm run android:<app>:release` gera as variantes de produção.

Sem `keystore.properties` o build de release sai sem assinatura. Nunca versione `keystore.properties`, o keystore ou as senhas.

## Push (Firebase Cloud Messaging)

### Web

O Cliente e o Parceiro usam ativação explícita do push web, registro do token FCM em `dispositivos`, recebimento em primeiro e segundo plano e abertura de links internos. No Supabase DEV, a Edge Function `push-notificacao` está implantada, as credenciais de servidor estão em secrets, a URL está no Vault e a migration `20261122012012_push_web_fcm.sql` foi aplicada. O gatilho envia cada nova linha de `public.notificacoes` e a função respeita as preferências do destinatário.

**Estado DEV:** as variáveis públicas Firebase estão configuradas no Vercel e Cliente/Parceiro estão publicados nos aliases DEV. O navegador obtém um token FCM com `getToken`, salva-o em `dispositivos` e a Edge Function envia para o campo `token` da API FCM. A ativação e a obtenção do token foram verificadas em Chrome nos dois domínios. Novo agendamento do marketplace cria notificação para dono/gerente e profissional vinculado. Cancelamento e reagendamento notificam cliente e equipe. Lembretes de agendamento e campanhas promocionais são processados pelo Supabase Cron a cada 15 minutos; o lembrete respeita a preferência do cliente e é idempotente, e a campanha só alcança clientes cadastrados que mantêm a preferência promocional ativa. Campanhas existentes antes da ativação do fluxo não disparam avisos retroativos. Todas as novas linhas passam pelo trigger de push existente.

### Android

O projeto Firebase `barzzo-barbearia` contém os apps Android DEV `com.barzzo.cliente.dev` e `com.barzzo.parceiro.dev`. Cada `google-services.json` fica local e ignorado pelo Git em `apps/<app>/android/app/`; o plugin do Google Services valida o package name da variante durante a compilação. Os apps de produção usam registros Firebase separados com os applicationIds sem `.dev`. O `registrarPush` existente cadastra o token nativo em `dispositivos` quando o arquivo DEV correto está instalado.

Em 2026-11-26, a consulta ao projeto DEV encontrou dois dispositivos Android ativos. A Edge Function `push-notificacao` filtrava apenas `plataforma = web`, então nenhum push chegava aos tokens nativos. A função foi atualizada e implantada para enviar a dispositivos web, Android e iOS; para Android/iOS inclui `notification.title` e `notification.body`, além dos dados usados ao abrir o link. Falhas ao registrar no FCM ou salvar o token agora são registradas sem expor o token. A entrega no aparelho ainda precisa ser confirmada após reconectar o SM-S926B.

O screenshot do SM-S926B também mostrou que a página do Parceiro tentava ativar FCM Web dentro do WebView. Cliente e Parceiro agora detectam a plataforma atual, consultam a permissão nativa do Capacitor e o token ativo correspondente, e mostram o estado do app sem apresentar o erro ou o switch de navegador no Android.

### Downloads DEV (2026-11-26)

Os quatro artefatos `devRelease` da versão `0.1.4-dev`, versionCode `5`, foram assinados e publicados no bucket público `downloads-dev` do Supabase DEV. Os builds DEV desativam o R8; os builds de produção continuam minificados.

| App | APK | AAB |
|---|---|---|
| Cliente | [Baixar APK](https://gdgeokfwkbusemayqucb.supabase.co/storage/v1/object/public/downloads-dev/cliente/barzzo-cliente-dev-0.1.4.apk) | [Baixar AAB](https://gdgeokfwkbusemayqucb.supabase.co/storage/v1/object/public/downloads-dev/cliente/barzzo-cliente-dev-0.1.4.aab) |
| Parceiro | [Baixar APK](https://gdgeokfwkbusemayqucb.supabase.co/storage/v1/object/public/downloads-dev/parceiro/barzzo-parceiro-dev-0.1.4.apk) | [Baixar AAB](https://gdgeokfwkbusemayqucb.supabase.co/storage/v1/object/public/downloads-dev/parceiro/barzzo-parceiro-dev-0.1.4.aab) |

| App / formato | Tamanho | SHA-256 |
|---|---:|---|
| Cliente APK | 4.453.044 bytes | `26343A574BF3D3A104C87E03EC912EF2489DADF475402DA28B5F2E55BA80C614` |
| Cliente AAB | 4.112.428 bytes | `BCDDDA95F8E1BA257CF069560910D9F62E0ACE22BAE43A783BDD2DAC1D915980` |
| Parceiro APK | 4.328.733 bytes | `767D73B11D6E372B1020E0DE78F3FF9D5F9AADE1558ADFD024D35B78739BF269` |
| Parceiro AAB | 3.987.561 bytes | `5EB95375CBD573C4C3ED1E442198E95ECB2B247487107153CC419180A95F4DC0` |

Os links foram baixados novamente e conferidos por tamanho e SHA-256 contra os arquivos locais. A versão `0.1.2-dev` foi instalada no SM-S926B e o usuário confirmou que o login passou a funcionar. A `0.1.4-dev` foi compilada com versionCode 5 após o screenshot, mas não foi reinstalada porque o aparelho não está conectado ao ADB nesta sessão.

## Links profundos

Esquema `barzzo://cliente/<rota>` e `barzzo://parceiro/<rota>`. Links de e-mail (recuperação de senha, convite) abrem o site; para abrir direto no app é preciso publicar `assetlinks.json` nos domínios e adicionar App Links no manifesto (pendente, depende dos domínios finais).

## Pendências e riscos

- Instalar `0.1.4-dev` nos dois apps no SM-S926B e confirmar o recebimento de push com o app em primeiro e segundo plano.
- Registrar os apps Firebase de produção e configurar seus arquivos locais antes de gerar builds Android para distribuição comercial.
- Mercado Pago no WebView: o fluxo de cartão do Parceiro funciona por API; o Checkout Pro por redirecionamento (`criar-preferencia`) volta para a URL web e precisa de App Link para retornar ao app.
- iOS fica para uma fase futura (mesma base Capacitor).
- A marca web usa `public/marca/barzzo-logo-claro.webp` em tema claro e `public/marca/barzzo-logo-escuro.webp` em tema escuro. Os favicons e ícones PWA ficam em `public/`.
- Cliente e Parceiro usam o mesmo monograma Barzzo branco e bronze sobre fundo escuro. O splash Android usa o logotipo branco completo com transparência real, centralizado dentro da área segura sobre fundo preto definido pelo tema nativo. A origem oficial atualizada dos arquivos é `D:/Barbearia/barzzo-assets-web-mobile-v2/barzzo-assets`; ao atualizar, sincronizar as variantes web, PWA, Android e splash nos dois apps.
