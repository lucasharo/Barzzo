// Gera os PNGs-base (ícone e splash) dos apps Android a partir da marca do Barzzo e roda o @capacitor/assets.
// Uso: node scripts/gerar-icones-android.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import sharp from "sharp";

const TERRACOTA = "#B45A2B";
const LETRA =
  "M160 140 h120 c45 0 80 30 80 75 c0 28 -15 52 -38 65 c32 12 52 40 52 75 c0 50 -40 85 -95 85 h-119 z M225 195 v60 h50 c20 0 35 -12 35 -30 s-15 -30 -35 -30 z M225 305 v75 h55 c25 0 42 -15 42 -37 c0 -23 -17 -38 -42 -38 z";

// A letra ocupa ~55% do quadro de 512; no ícone adaptativo precisa caber nos 66% centrais.
const svg = (tamanho, corpo) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 ${tamanho} ${tamanho}">${corpo}</svg>`);
async function png(destino, buffer, tamanho) {
  mkdirSync(path.dirname(destino), { recursive: true });
  await sharp(buffer).resize(tamanho, tamanho).png().toFile(destino);
}

async function splash(destino, fundo) {
  const lado = 2732;
  const marca = 640;
  const corpo =
    `<rect width="${lado}" height="${lado}" fill="${fundo}"/>` +
    `<g transform="translate(${(lado - marca) / 2} ${(lado - marca) / 2}) scale(${marca / 512})">` +
    `<rect width="512" height="512" rx="100" fill="${TERRACOTA}"/><path d="${LETRA}" fill="#FFFFFF"/></g>`;
  mkdirSync(path.dirname(destino), { recursive: true });
  await sharp(svg(lado, corpo)).png().toFile(destino);
}

for (const app of ["cliente", "parceiro"]) {
  const base = path.resolve("apps", app, "assets");
  const quadrado = svg(1024, `<rect width="1024" height="1024" fill="${TERRACOTA}"/>` +
    `<g transform="scale(2)"><path d="${LETRA}" fill="#FFFFFF"/></g>`);
  await png(path.join(base, "icon-only.png"), quadrado, 1024);
  await png(path.join(base, "icon-background.png"), svg(1024, `<rect width="1024" height="1024" fill="${TERRACOTA}"/>`), 1024);
  // Primeiro plano: letra reduzida para ficar dentro da zona segura do ícone adaptativo.
  await png(path.join(base, "icon-foreground.png"), svg(1024, `<g transform="translate(180 180) scale(1.34)"><path d="${LETRA}" fill="#FFFFFF"/></g>`), 1024);
  await splash(path.join(base, "splash.png"), "#FFFFFF");
  await splash(path.join(base, "splash-dark.png"), "#0A0A0B");
  console.log("assets base:", app);
  execSync("npx capacitor-assets generate --android --assetPath assets", { cwd: path.resolve("apps", app), stdio: "inherit" });
}
