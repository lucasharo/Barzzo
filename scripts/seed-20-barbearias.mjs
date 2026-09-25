import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_CHAVE_SECRETA;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_CHAVE_SECRETA devem estar configurados.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const NOMES_BARBEARIAS = [
  "Barbearia Dom Barzzo",
  "Barbearia Navalha de Ouro",
  "Barbearia Vintage Club",
  "Barbearia Cavalheiro Imperial",
  "Barbearia Barbudos da Vila",
  "Barbearia Alfa & Ômega",
  "Barbearia Bigode de Respeito",
  "Barbearia Fina Estampa",
  "Barbearia Lord Barbers",
  "Barbearia Rota 66 Cortes",
  "Barbearia Old School Classic",
  "Barbearia Estilo Nobre",
  "Barbearia Black Sheep",
  "Barbearia King's Beard",
  "Barbearia Mustache Lounge",
  "Barbearia O Corte Perfeito",
  "Barbearia Garagem dos Cortes",
  "Barbearia Brooklyn Barber",
  "Barbearia Vila Real",
  "Barbearia Dom Pedro Club",
];

const BAIRROS_SP = [
  "Pinheiros", "Vila Madalena", "Moema", "Itaim Bibi", "Jardins",
  "Bela Vista", "Perdizes", "Santana", "Tatuapé", "Mooca",
  "Brooklin", "Campo Belo", "Vila Mariana", "Consolação", "Paraíso",
  "Vila Leopoldina", "Higienópolis", "Lapa", "Saúde", "Aclimação"
];

const NOMES_PROFISSIONAIS = [
  "Carlos Silva", "Marcos Santos", "Rafael Oliveira", "Lucas Pereira",
  "Felipe Costa", "Rodrigo Lima", "Thiago Souza", "Bruno Alves",
  "Gabriel Rocha", "Matheus Ribeiro", "Diego Martins", "Gustavo Fernandes",
  "Danilo Barbosa", "Vinicius Castro", "Alexandre Duarte", "Leonardo Gomes"
];

const SERVICOS_PADRAO = [
  { nome: "Corte Tradicional / Degradê", descricao: "Corte completo com lavagem, finalização e alinhamento dos fios.", preco: 45.0, duracao_minutos: 30 },
  { nome: "Barba Terapia com Toalha Quente", descricao: "Barba desenhada com aplicação de óleos essenciais, massagem e toalha quente.", preco: 35.0, duracao_minutos: 30 },
  { nome: "Combo Cabelo + Barba", descricao: "Corte completo + Barba terapia com desconto especial.", preco: 75.0, duracao_minutos: 50 },
  { nome: "Acabamento & Pezinho", descricao: "Alinhamento de contorno, costeletas e nuca com navalhete descartável.", preco: 20.0, duracao_minutos: 15 },
];

async function seed() {
  console.log("==========================================================");
  console.log("  INICIANDO SEED DE 20 BARBEARIAS ATIVAS NO BARZZO");
  console.log("==========================================================\n");

  // 1. Obter planos do banco
  const { data: planos, error: erroPlanos } = await supabase.from("planos").select("*");
  if (erroPlanos || !planos || planos.length === 0) {
    console.error("Erro ao buscar planos:", erroPlanos);
    process.exit(1);
  }

  const planoPro = planos.find((p) => p.identificador === "pro") || planos[0];
  console.log(`✔ Plano selecionado para assinaturas: ${planoPro.nome} (ID: ${planoPro.id})`);

  // 2. Loop de 1 a 20
  for (let i = 1; i <= 20; i++) {
    const numPad = i.toString().padStart(2, "0");
    const email = `barbearia${numPad}@barzzo.com.br`;
    const senha = `teste123`;
    const slug = `barbearia-${numPad}`;
    const nomeBarbearia = `${NOMES_BARBEARIAS[i - 1]} ${numPad}`;
    const bairro = BAIRROS_SP[(i - 1) % BAIRROS_SP.length];
    const telefone = `(11) 98765-${numPad}00`;
    const doc = `12.345.678/0001-${numPad}`;

    console.log(`\n----------------------------------------------------------`);
    console.log(`[${i}/20] Configurando: ${nomeBarbearia} (${email})`);

    // A. Criar ou Obter Usuário Dono no Auth
    let usuarioId;
    const { data: listagem } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const usuarioExistente = listagem?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (usuarioExistente) {
      console.log(`  ℹ Usuário auth já existe (ID: ${usuarioExistente.id}). Atualizando senha...`);
      await supabase.auth.admin.updateUserById(usuarioExistente.id, {
        password: senha,
        email_confirm: true,
        user_metadata: { nome: `Dono ${nomeBarbearia}` },
      });
      usuarioId = usuarioExistente.id;
    } else {
      console.log(`  ➕ Criando usuário auth ${email}...`);
      const { data: novoUser, error: erroUser } = await supabase.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome: `Dono ${nomeBarbearia}`, telefone },
      });

      if (erroUser) {
        console.error(`  ❌ Erro ao criar usuário ${email}:`, erroUser);
        continue;
      }
      usuarioId = novoUser.user.id;
    }

    // Garantir registro em public.usuarios
    await supabase.from("usuarios").upsert({
      id: usuarioId,
      nome: `Dono ${nomeBarbearia}`,
      email: email,
      telefone: telefone,
    });

    // B. Criar ou Atualizar Barbearia
    const lat = Number((-23.550520 + ((i % 5) - 2) * 0.015).toFixed(6));
    const lng = Number((-46.633308 + (((i * 3) % 5) - 2) * 0.015).toFixed(6));

    const dadosBarbearia = {
      nome: nomeBarbearia,
      slug: slug,
      email: email,
      telefone: telefone,
      documento: doc,
      endereco: `Av. Paulista, ${100 * i}`,
      bairro: bairro,
      cidade: "São Paulo",
      estado: "SP",
      cep: "01310-100",
      latitude: lat,
      longitude: lng,
      status_assinatura: "ativo",
      ativa: true,
      onboarding_concluido: true,
      trial_inicio: new Date().toISOString(),
      trial_fim: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const { data: barbeariaExistente } = await supabase
      .from("barbearias")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    let barbeariaId;
    if (barbeariaExistente) {
      console.log(`  ℹ Barbearia já existe. Atualizando status e dados...`);
      const { data: bAtualizada, error: erroUpdate } = await supabase
        .from("barbearias")
        .update(dadosBarbearia)
        .eq("id", barbeariaExistente.id)
        .select()
        .single();
      if (erroUpdate) console.error("  ❌ Erro no update da barbearia:", erroUpdate);
      barbeariaId = barbeariaExistente.id;
    } else {
      console.log(`  ➕ Inserindo barbearia...`);
      const { data: bCriada, error: erroInsert } = await supabase
        .from("barbearias")
        .insert(dadosBarbearia)
        .select()
        .single();
      if (erroInsert) {
        console.error("  ❌ Erro ao inserir barbearia:", erroInsert);
        continue;
      }
      barbeariaId = bCriada.id;
    }

    // C. Vincular Membro Dono
    await supabase.from("membros_barbearia").upsert(
      {
        barbearia_id: barbeariaId,
        usuario_id: usuarioId,
        papel: "dono",
        ativo: true,
      },
      { onConflict: "barbearia_id,usuario_id" }
    );

    // D. Criar Assinatura Ativa
    const { data: assExistente } = await supabase
      .from("assinaturas")
      .select("id")
      .eq("barbearia_id", barbeariaId)
      .maybeSingle();

    const dadosAssinatura = {
      barbearia_id: barbeariaId,
      plano_id: planoPro.id,
      ciclo: "mensal",
      status: "ativa",
      data_inicio: new Date().toISOString(),
      data_fim: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      valor: planoPro.preco_mensal,
    };

    if (assExistente) {
      await supabase.from("assinaturas").update(dadosAssinatura).eq("id", assExistente.id);
    } else {
      await supabase.from("assinaturas").insert(dadosAssinatura);
    }

    // E. Criar Serviços Padrão
    const servicosIds = [];
    for (const s of SERVICOS_PADRAO) {
      const { data: servicoDb } = await supabase
        .from("servicos")
        .select("id")
        .eq("barbearia_id", barbeariaId)
        .eq("nome", s.nome)
        .maybeSingle();

      if (servicoDb) {
        servicosIds.push(servicoDb.id);
      } else {
        const { data: novoServ } = await supabase
          .from("servicos")
          .insert({
            barbearia_id: barbeariaId,
            ...s,
            ativo: true,
          })
          .select("id")
          .single();
        if (novoServ) servicosIds.push(novoServ.id);
      }
    }

    // F. Criar Horários de Funcionamento (Segunda a Sábado, dias 1..6)
    for (let dia = 1; dia <= 6; dia++) {
      await supabase.from("horarios_barbearia").upsert(
        {
          barbearia_id: barbeariaId,
          dia_semana: dia,
          hora_abertura: "09:00:00",
          hora_fechamento: "19:00:00",
          hora_inicio_almoco: "12:00:00",
          hora_fim_almoco: "13:00:00",
          ativo: true,
        },
        { onConflict: "barbearia_id,dia_semana" }
      );
    }

    // G. Criar 1, 2 ou 3 Funcionários Aleatoriamente
    const qtdFuncionarios = Math.floor(Math.random() * 3) + 1; // 1, 2 ou 3
    console.log(`  👥 Cadastrando ${qtdFuncionarios} funcionário(s) aleatório(s)...`);

    // Limpar profissionais antigos se houver recadastro para garantir quantidade exata
    const { data: profsAntigos } = await supabase
      .from("profissionais")
      .select("id")
      .eq("barbearia_id", barbeariaId);

    const profsParaManter = [];

    for (let f = 0; f < qtdFuncionarios; f++) {
      const nomeProf = NOMES_PROFISSIONAIS[(i * 3 + f) % NOMES_PROFISSIONAIS.length];
      const telefoneProf = `(11) 99887-${numPad}${f + 1}0`;

      let profId;
      if (profsAntigos && profsAntigos[f]) {
        profId = profsAntigos[f].id;
        await supabase.from("profissionais").update({
          nome: `${nomeProf}`,
          telefone: telefoneProf,
          bio: `Especialista em barbearia clássica e corte moderno com ${f + 3} anos de experiência.`,
          ativo: true,
        }).eq("id", profId);
      } else {
        const { data: novoProf } = await supabase
          .from("profissionais")
          .insert({
            barbearia_id: barbeariaId,
            nome: `${nomeProf}`,
            telefone: telefoneProf,
            bio: `Especialista em barbearia clássica e corte moderno com ${f + 3} anos de experiência.`,
            ativo: true,
          })
          .select("id")
          .single();
        if (novoProf) profId = novoProf.id;
      }

      if (profId) {
        profsParaManter.push(profId);

        // Vincular o profissional a todos os serviços
        for (const sId of servicosIds) {
          await supabase.from("profissionais_servicos").upsert(
            {
              profissional_id: profId,
              servico_id: sId,
              ativo: true,
            },
            { onConflict: "profissional_id,servico_id" }
          );
        }

        // Criar jornada semanal do profissional (Segunda a Sábado)
        for (let dia = 1; dia <= 6; dia++) {
          await supabase.from("jornadas_profissionais").upsert(
            {
              profissional_id: profId,
              dia_semana: dia,
              hora_inicio: "09:00:00",
              hora_fim: "19:00:00",
              hora_inicio_pausa: "12:00:00",
              hora_fim_pausa: "13:00:00",
              ativo: true,
            },
            { onConflict: "profissional_id,dia_semana" }
          );
        }
      }
    }

    // Se havia mais profissionais anteriormente do que o sorteado agora, remover os excedentes
    if (profsAntigos && profsAntigos.length > qtdFuncionarios) {
      const idsParaRemover = profsAntigos
        .slice(qtdFuncionarios)
        .map((p) => p.id);
      await supabase.from("profissionais").delete().in("id", idsParaRemover);
    }

    console.log(`  ✔ Barbearia ${nomeBarbearia} finalizada com sucesso!`);
  }

  console.log("\n==========================================================");
  console.log("  ✔ SUCESSO: 20 BARBEARIAS CADASTRADAS E ATIVAS!");
  console.log("  Credenciais geradas: barbearia01@barzzo.com.br até barbearia20@barzzo.com.br");
  console.log("  Senha: teste123");
  console.log("==========================================================");
}

seed().catch((err) => {
  console.error("Falha fatal na execução do seed:", err);
  process.exit(1);
});
