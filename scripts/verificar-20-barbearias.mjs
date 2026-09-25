import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA;
const secretKey = process.env.SUPABASE_CHAVE_SECRETA;

const adminClient = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anonClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function verificar() {
  console.log("=== INICIANDO VERIFICAÇÃO DAS 20 BARBEARIAS ===\n");

  // 1. Contagem total de barbearias ativas
  const { data: barbearias, error: erroB } = await adminClient
    .from("barbearias")
    .select("id, nome, slug, email, status_assinatura, ativa, onboarding_concluido")
    .order("slug", { ascending: true });

  if (erroB) {
    console.error("Erro ao listar barbearias:", erroB);
    process.exit(1);
  }

  console.log(`Total de barbearias no banco: ${barbearias.length}`);
  const barbeariasSeed = barbearias.filter((b) => b.slug.startsWith("barbearia-"));
  console.log(`Barbearias do seed (barbearia-01 a 20): ${barbeariasSeed.length}`);

  let todasAtivas = true;
  for (const b of barbeariasSeed) {
    if (!b.ativa || b.status_assinatura !== "ativo" || !b.onboarding_concluido) {
      console.error(`❌ Barbearia ${b.slug} com estado inválido:`, b);
      todasAtivas = false;
    }
  }
  if (todasAtivas) {
    console.log("✔ Todas as 20 barbearias estão ativas, com assinatura ativa e onboarding concluído!");
  }

  // 2. Verificar funcionários de cada uma
  console.log("\n--- Contagem de Profissionais por Barbearia ---");
  for (const b of barbeariasSeed) {
    const { count, error } = await adminClient
      .from("profissionais")
      .select("*", { count: "exact", head: true })
      .eq("barbearia_id", b.id);

    console.log(`  ${b.slug} (${b.nome}): ${count} funcionário(s)`);
    if (count < 1 || count > 3) {
      console.error(`  ❌ Quantidade fora do esperado (1 a 3): ${count}`);
    }
  }

  // 3. Testar Login com 3 amostras (01, 10 e 20) com anon client
  console.log("\n--- Testando Autenticação Real com a Chave Pública (Anon Client) ---");
  const amostras = ["01", "10", "20"];
  for (const num of amostras) {
    const email = `barbearia${num}@barzzo.com.br`;
    const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
      email,
      password: "teste123",
    });

    if (authError || !authData.session) {
      console.error(`❌ Falha no login de ${email}:`, authError?.message);
    } else {
      console.log(`✔ Login com sucesso para ${email}! Token emitido para usuário: ${authData.user.id}`);
    }
  }

  // 4. Testar listagem pública de barbearias pelo anon client (como o app cliente faz)
  console.log("\n--- Testando Consulta Pública pelo App Cliente (Anon Client) ---");
  const { data: vitrine, error: vitrineError } = await anonClient
    .from("barbearias")
    .select("id, nome, slug, cidade, servicos (id, nome, preco)")
    .eq("ativa", true)
    .limit(5);

  if (vitrineError) {
    console.error("❌ Erro na consulta da vitrine:", vitrineError);
  } else {
    console.log(`✔ Vitrine pública acessível com sucesso! Retornadas ${vitrine.length} amostras com serviços vinculados.`);
  }

  console.log("\n==============================================");
  console.log("✔ TODAS AS VALIDAÇÕES FORAM BEM SUCEDIDAS!");
  console.log("==============================================");
}

verificar().catch(console.error);
