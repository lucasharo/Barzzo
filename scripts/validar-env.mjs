import fs from "fs";
import path from "path";
import crypto from "crypto";

const arquivo = path.resolve(".env.local");

function lerEnv(nomeArquivo) {
  const caminho = path.resolve(nomeArquivo);
  if (!fs.existsSync(caminho)) return null;
  const conteudo = fs.readFileSync(caminho, "utf-8");
  const linhas = conteudo.split("\n");
  const env = {};
  for (const linha of linhas) {
    const l = linha.trim();
    if (l && !l.startsWith("#")) {
      const sep = l.indexOf("=");
      if (sep > -1) {
        const k = l.slice(0, sep).trim();
        let v = l.slice(sep + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        env[k] = v;
      }
    }
  }
  return env;
}

const envLocal = lerEnv(".env.local");
const localEnv = lerEnv("local.env");
const env = envLocal || localEnv;

if (!env) {
  console.error("❌ Nenhum arquivo de ambiente (.env.local ou local.env) encontrado!");
  process.exit(1);
}

console.log("=== VALIDAÇÃO DAS CHAVES DO FIREBASE (.env.local) ===\n");

const camposObrigatoriosWeb = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_VAPID_KEY",
];

const camposObrigatoriosAdmin = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
];

let erros = 0;

console.log("▶ 1. Firebase Cloud Messaging (Web / Client):");
for (const campo of camposObrigatoriosWeb) {
  const valor = env[campo];
  if (!valor || valor.trim() === "") {
    console.error(`  ❌ ${campo}: FALTANDO ou VAZIO`);
    erros++;
  } else {
    const preview = valor.length > 20 ? `${valor.slice(0, 10)}...${valor.slice(-5)}` : valor;
    console.log(`  ✔ ${campo}: Presente (${preview})`);
  }
}

console.log("\n▶ 2. Firebase Admin SDK (Backend):");
for (const campo of camposObrigatoriosAdmin) {
  const valor = env[campo];
  if (!valor || valor.trim() === "") {
    console.error(`  ❌ ${campo}: FALTANDO ou VAZIO`);
    erros++;
  } else if (campo === "FIREBASE_PRIVATE_KEY") {
    // Validar se é uma chave RSA PEM válida
    const chaveFormatada = valor.replace(/\\n/g, "\n");
    const temCabecalho = chaveFormatada.includes("-----BEGIN PRIVATE KEY-----");
    const temRodape = chaveFormatada.includes("-----END PRIVATE KEY-----");

    if (!temCabecalho || !temRodape) {
      console.error(`  ❌ FIREBASE_PRIVATE_KEY: Formato PEM inválido (falta cabeçalho ou rodapé)`);
      erros++;
    } else {
      try {
        // Tentar criar objeto de chave privada com a crypto do Node
        crypto.createPrivateKey(chaveFormatada);
        console.log(`  ✔ FIREBASE_PRIVATE_KEY: Chave RSA privada válida e decodificável pelo Node.js!`);
      } catch (err) {
        console.error(`  ❌ FIREBASE_PRIVATE_KEY: Erro ao instanciar chave criptográfica: ${err.message}`);
        erros++;
      }
    }
  } else {
    console.log(`  ✔ ${campo}: Presente (${valor})`);
  }
}

// 3. Checar consistência dos IDs de projeto
console.log("\n▶ 3. Consistência entre Web e Admin:");
if (env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"] !== env["FIREBASE_PROJECT_ID"]) {
  console.warn(`  ⚠️ Aviso: NEXT_PUBLIC_FIREBASE_PROJECT_ID (${env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"]}) difere de FIREBASE_PROJECT_ID (${env["FIREBASE_PROJECT_ID"]})`);
} else {
  console.log(`  ✔ Project ID consistente: ${env["FIREBASE_PROJECT_ID"]}`);
}

// 4. Checar consistência com o Sender ID e App ID
if (env["NEXT_PUBLIC_FIREBASE_APP_ID"] && env["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"]) {
  const contemSenderNoAppId = env["NEXT_PUBLIC_FIREBASE_APP_ID"].includes(env["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"]);
  if (contemSenderNoAppId) {
    console.log(`  ✔ App ID contém o Sender ID correto (${env["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"]})`);
  } else {
    console.warn(`  ⚠️ Aviso: Sender ID não parece coincidir com o prefixo do App ID`);
  }
}

console.log("\n-------------------------------------------------------");
if (erros === 0) {
  console.log("✔ TODAS AS CONFIGURAÇÕES DO FIREBASE ESTÃO CORRETAS E VÁLIDAS!");
} else {
  console.error(`❌ Foram encontrados ${erros} erro(s) na configuração.`);
  process.exit(1);
}
