import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const dotenv = fs.readFileSync(".env.local", "utf-8");
const env = {};
dotenv.split("\n").forEach((l) => {
  const s = l.indexOf("=");
  if (s > -1) {
    const k = l.slice(0, s).trim();
    let v = l.slice(s + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
});

const url = env["NEXT_PUBLIC_SUPABASE_URL"];
const chaveSecreta = env["SUPABASE_CHAVE_SECRETA"];
const chavePublica = env["NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA"];

console.log("URL Supabase:", url);
console.log("Testando com service_role...");

const adminClient = createClient(url, chaveSecreta, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  try {
    const { data: bData, error: bErr } = await adminClient.from("barbearias").select("id, nome").limit(5);
    if (bErr) {
      console.error("Erro ao consultar barbearias com chave secreta:", bErr);
    } else {
      console.log("Sucesso! Barbearias existentes:", bData);
    }

    const { data: uData, error: uErr } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 5 });
    if (uErr) {
      console.error("Erro ao listar auth.users com admin API:", uErr);
    } else {
      console.log("Sucesso no auth.admin! Usuários encontrados:", uData.users.length);
    }
  } catch (err) {
    console.error("Exceção:", err);
  }
}

main();
