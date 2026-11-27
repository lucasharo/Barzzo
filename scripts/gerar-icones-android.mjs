// Gera os PNGs-base (ícone e splash) dos apps Android a partir da marca do Barzzo e roda o @capacitor/assets.
// Uso: node scripts/gerar-icones-android.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import sharp from "sharp";

async function splash(destino, logo) {
  const lado = 2732;
  const larguraLogo = 1600;
  mkdirSync(path.dirname(destino), { recursive: true });
  const logoRedimensionado = await sharp(logo)
    .resize({ width: larguraLogo, height: 500, fit: "inside" })
    .png()
    .toBuffer();
  const metadadosLogo = await sharp(logoRedimensionado).metadata();
  const largura = metadadosLogo.width ?? larguraLogo;
  const altura = metadadosLogo.height ?? 500;
  await sharp({
    create: {
      width: lado,
      height: lado,
      channels: 4,
      // O arquivo do splash contém só a marca; a cor de fundo fica na janela nativa.
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: logoRedimensionado,
        left: Math.floor((lado - largura) / 2),
        top: Math.floor((lado - altura) / 2),
      },
    ])
    .png()
    .toFile(destino);
}

for (const app of ["cliente", "parceiro"]) {
  const base = path.resolve("apps", app, "assets");
  const logoClaro = path.join(base, "logo-claro.webp");
  const logoEscuro = path.join(base, "logo-escuro.webp");
  if (!existsSync(logoClaro) || !existsSync(logoEscuro)) {
    throw new Error(`Logotipos oficiais ausentes em ${base}`);
  }
  await splash(path.join(base, "splash.png"), logoClaro);
  await splash(path.join(base, "splash-dark.png"), logoEscuro);
  console.log("assets base:", app);
  execSync("npx capacitor-assets generate --android --assetPath assets", { cwd: path.resolve("apps", app), stdio: "inherit" });

  const recursos = path.resolve("apps", app, "android", "app", "src", "main", "res");
  // Os dois apps usam o monograma branco e bronze sobre o fundo escuro da marca.
  const corFundo = "#0A0A0B";
  writeFileSync(
    path.join(recursos, "values", "ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${corFundo}</color>\n</resources>\n`,
    "utf8",
  );

  const logoSplash = await sharp(logoEscuro)
    // Mantém a wordmark dentro da área segura do splash Android, sem recortar as pontas.
    .resize({ width: 600, height: 260, fit: "inside" })
    .png()
    .toBuffer();
  const logoMetadados = await sharp(logoSplash).metadata();
  const logoLargura = logoMetadados.width ?? 600;
  const logoAltura = logoMetadados.height ?? 260;
  const drawableNodpi = path.join(recursos, "drawable-nodpi");
  mkdirSync(drawableNodpi, { recursive: true });
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: logoSplash,
        left: Math.floor((1024 - logoLargura) / 2),
        top: Math.floor((1024 - logoAltura) / 2),
      },
    ])
    .png()
    .toFile(path.join(drawableNodpi, "barzzo_splash_logo.png"));

  writeFileSync(
    path.join(recursos, "values", "barzzo_splash_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="barzzo_splash_background">#0A0A0B</color>\n</resources>\n`,
    "utf8",
  );
  writeFileSync(
    path.join(recursos, "drawable", "barzzo_splash_screen.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\n<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n    <item android:drawable="@color/barzzo_splash_background" />\n    <item android:drawable="@drawable/barzzo_splash_logo" android:width="300dp" android:height="300dp" android:gravity="center" />\n</layer-list>\n`,
    "utf8",
  );

  const caminhoEstilos = path.join(recursos, "values", "styles.xml");
  const estilos = readFileSync(caminhoEstilos, "utf8");
  const padraoEstiloSplash = /    <style name="AppTheme\.NoActionBarLaunch"[^>]*>[\s\S]*?<\/style>/;
  if (!padraoEstiloSplash.test(estilos)) {
    throw new Error(`Tema de splash não encontrado em ${caminhoEstilos}`);
  }
  const estiloSplash = `    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@color/barzzo_splash_background</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/barzzo_splash_logo</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
        <item name="android:background">@drawable/barzzo_splash_screen</item>
    </style>`;
  const estilosAtualizados = estilos.replace(padraoEstiloSplash, estiloSplash);
  writeFileSync(caminhoEstilos, estilosAtualizados, "utf8");

  for (const nome of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
    const caminho = path.join(recursos, "mipmap-anydpi-v26", nome);
    const xml = readFileSync(caminho, "utf8").replace(
      /<background>\s*<inset android:drawable="@mipmap\/ic_launcher_background" android:inset="16\.7%"\s*\/>\s*<\/background>/,
      '<background android:drawable="@color/ic_launcher_background" />',
    );
    writeFileSync(caminho, xml, "utf8");
  }
}
