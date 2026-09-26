import fs from "fs";
import { createClient } from "@supabase/supabase-js";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL && fs.existsSync(".env.local")) {
  const dotenv = fs.readFileSync(".env.local", "utf-8");
  dotenv.split("\n").forEach((l) => {
    const s = l.indexOf("=");
    if (s > -1) {
      const k = l.slice(0, s).trim();
      let v = l.slice(s + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[k] = v;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_CHAVE_SECRETA;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_CHAVE_SECRETA devem estar configurados.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BARBEARIAS_CONFIG = [
  // --- ZONA SUL DE SÃO PAULO (15 barbearias) ---
  {
    nome: "Barbearia Dom Barzzo Moema",
    bairro: "Moema",
    cidade: "São Paulo",
    endereco: "Av. Moema, 340",
    cep: "04077-020",
    lat: -23.6052,
    lng: -46.6621,
    precoCorte: 65.0,
  },
  {
    nome: "Barbearia Brooklin Barber Club",
    bairro: "Brooklin",
    cidade: "São Paulo",
    endereco: "Av. Padre Antônio José dos Santos, 1180",
    cep: "04563-003",
    lat: -23.6145,
    lng: -46.6850,
    precoCorte: 70.0,
  },
  {
    nome: "Barbearia Estilo Campo Belo",
    bairro: "Campo Belo",
    cidade: "São Paulo",
    endereco: "Rua Vieira de Morais, 950",
    cep: "04617-003",
    lat: -23.6230,
    lng: -46.6710,
    precoCorte: 60.0,
  },
  {
    nome: "Barbearia Vila Mariana Classic",
    bairro: "Vila Mariana",
    cidade: "São Paulo",
    endereco: "Rua Domingos de Morais, 1850",
    cep: "04010-200",
    lat: -23.5880,
    lng: -46.6380,
    precoCorte: 50.0,
  },
  {
    nome: "Barbearia Santo Amaro Imperial",
    bairro: "Santo Amaro",
    cidade: "São Paulo",
    endereco: "Rua Floriano Peixoto, 280",
    cep: "04751-030",
    lat: -23.6520,
    lng: -46.7050,
    precoCorte: 45.0,
  },
  {
    nome: "Barbearia Saúde Prime",
    bairro: "Saúde",
    cidade: "São Paulo",
    endereco: "Av. Jabaquara, 1420",
    cep: "04046-200",
    lat: -23.6120,
    lng: -46.6390,
    precoCorte: 40.0,
  },
  {
    nome: "Barbearia Rota Interlagos",
    bairro: "Interlagos",
    cidade: "São Paulo",
    endereco: "Av. Interlagos, 3200",
    cep: "04660-006",
    lat: -23.6820,
    lng: -46.6910,
    precoCorte: 45.0,
  },
  {
    nome: "Barbearia Vila Olímpia Lounge",
    bairro: "Vila Olímpia",
    cidade: "São Paulo",
    endereco: "Rua Funchal, 418",
    cep: "04551-060",
    lat: -23.5930,
    lng: -46.6870,
    precoCorte: 80.0,
  },
  {
    nome: "Barbearia Histórica do Ipiranga",
    bairro: "Ipiranga",
    cidade: "São Paulo",
    endereco: "Rua Silva Bueno, 1540",
    cep: "04208-001",
    lat: -23.5910,
    lng: -46.6030,
    precoCorte: 45.0,
  },
  {
    nome: "Barbearia Morumbi Concept",
    bairro: "Morumbi",
    cidade: "São Paulo",
    endereco: "Av. Giovanni Gronchi, 3200",
    cep: "05724-002",
    lat: -23.6190,
    lng: -46.7280,
    precoCorte: 75.0,
  },
  {
    nome: "Barbearia Jabaquara Tradicional",
    bairro: "Jabaquara",
    cidade: "São Paulo",
    endereco: "Av. Eng. Armando de Arruda Pereira, 890",
    cep: "04308-000",
    lat: -23.6450,
    lng: -46.6420,
    precoCorte: 35.0,
  },
  {
    nome: "Barbearia Socorro & Náutica",
    bairro: "Socorro",
    cidade: "São Paulo",
    endereco: "Av. Atlântica, 1100",
    cep: "04768-000",
    lat: -23.6790,
    lng: -46.7090,
    precoCorte: 40.0,
  },
  {
    nome: "Barbearia Garagem do Grajaú",
    bairro: "Grajaú",
    cidade: "São Paulo",
    endereco: "Av. Dona Belmira Marin, 1520",
    cep: "04846-010",
    lat: -23.7480,
    lng: -46.6980,
    precoCorte: 30.0,
  },
  {
    nome: "Barbearia Campo Limpo Club",
    bairro: "Campo Limpo",
    cidade: "São Paulo",
    endereco: "Estrada do Campo Limpo, 2600",
    cep: "05787-000",
    lat: -23.6410,
    lng: -46.7580,
    precoCorte: 35.0,
  },
  {
    nome: "Barbearia Raízes do Capão",
    bairro: "Capão Redondo",
    cidade: "São Paulo",
    endereco: "Estrada de Itapecerica, 3800",
    cep: "05858-000",
    lat: -23.6620,
    lng: -46.7720,
    precoCorte: 30.0,
  },

  // --- OUTRAS REGIÕES DE SÃO PAULO (5 barbearias) ---
  {
    nome: "Barbearia Pinheiros Vintage",
    bairro: "Pinheiros",
    cidade: "São Paulo",
    endereco: "Rua dos Pinheiros, 720",
    cep: "05422-001",
    lat: -23.5670,
    lng: -46.6840,
    precoCorte: 65.0,
  },
  {
    nome: "Barbearia Vila Madalena Cult",
    bairro: "Vila Madalena",
    cidade: "São Paulo",
    endereco: "Rua Aspicuelta, 450",
    cep: "05435-001",
    lat: -23.5540,
    lng: -46.6910,
    precoCorte: 60.0,
  },
  {
    nome: "Barbearia Tatuapé Nobre",
    bairro: "Tatuapé",
    cidade: "São Paulo",
    endereco: "Rua Tuiuti, 2100",
    cep: "03307-000",
    lat: -23.5380,
    lng: -46.5740,
    precoCorte: 50.0,
  },
  {
    nome: "Barbearia Santana Imperial",
    bairro: "Santana",
    cidade: "São Paulo",
    endereco: "Rua Voluntários da Pátria, 2200",
    cep: "02010-400",
    lat: -23.5040,
    lng: -46.6260,
    precoCorte: 45.0,
  },
  {
    nome: "Barbearia Bela Vista Clássica",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    endereco: "Rua Treze de Maio, 840",
    cep: "01327-000",
    lat: -23.5590,
    lng: -46.6470,
    precoCorte: 45.0,
  },

  // --- GUARULHOS (3 barbearias) ---
  {
    nome: "Barbearia Bosque Maia Guarulhos",
    bairro: "Bosque Maia",
    cidade: "Guarulhos",
    endereco: "Av. Paulo Faccini, 1520",
    cep: "07115-260",
    lat: -23.4560,
    lng: -46.5280,
    precoCorte: 50.0,
  },
  {
    nome: "Barbearia Centro Histórico Guarulhos",
    bairro: "Centro",
    cidade: "Guarulhos",
    endereco: "Rua Dom Pedro II, 410",
    cep: "07011-000",
    lat: -23.4680,
    lng: -46.5310,
    precoCorte: 40.0,
  },
  {
    nome: "Barbearia Vila Galvão Barbers",
    bairro: "Vila Galvão",
    cidade: "Guarulhos",
    endereco: "Rua Treze de Maio, 280",
    cep: "07071-050",
    lat: -23.4590,
    lng: -46.5590,
    precoCorte: 45.0,
  },

  // --- SUZANO (3 barbearias) ---
  {
    nome: "Barbearia Estilo Suzano Centro",
    bairro: "Centro",
    cidade: "Suzano",
    endereco: "Rua General Francisco Glicério, 1050",
    cep: "08674-001",
    lat: -23.5415,
    lng: -46.3090,
    precoCorte: 40.0,
  },
  {
    nome: "Barbearia Vila Amorim Suzano",
    bairro: "Vila Amorim",
    cidade: "Suzano",
    endereco: "Rua Benjamin Constant, 1680",
    cep: "08674-010",
    lat: -23.5370,
    lng: -46.3150,
    precoCorte: 35.0,
  },
  {
    nome: "Barbearia Parque Suzano Prime",
    bairro: "Parque Suzano",
    cidade: "Suzano",
    endereco: "Av. Armando Salles de Oliveira, 780",
    cep: "08673-000",
    lat: -23.5460,
    lng: -46.3040,
    precoCorte: 45.0,
  },

  // --- POÁ (2 barbearias) ---
  {
    nome: "Barbearia Imperial Poá Centro",
    bairro: "Centro",
    cidade: "Poá",
    endereco: "Av. Nove de Julho, 620",
    cep: "08557-100",
    lat: -23.5285,
    lng: -46.3450,
    precoCorte: 40.0,
  },
  {
    nome: "Barbearia Calmon Viana Poá",
    bairro: "Calmon Viana",
    cidade: "Poá",
    endereco: "Rua José de Oliveira Gomes, 190",
    cep: "08560-150",
    lat: -23.5240,
    lng: -46.3320,
    precoCorte: 35.0,
  },

  // --- FERRAZ DE VASCONCELOS (2 barbearias) ---
  {
    nome: "Barbearia Central Ferraz",
    bairro: "Centro",
    cidade: "Ferraz de Vasconcelos",
    endereco: "Av. Brasil, 750",
    cep: "08500-000",
    lat: -23.5410,
    lng: -46.3685,
    precoCorte: 35.0,
  },
  {
    nome: "Barbearia Romanopolis Ferraz",
    bairro: "Vila Romanopolis",
    cidade: "Ferraz de Vasconcelos",
    endereco: "Rua Godofredo Osório Novaes, 320",
    cep: "08529-100",
    lat: -23.5450,
    lng: -46.3650,
    precoCorte: 35.0,
  },
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
  console.log(`  INICIANDO SEED DE ${BARBEARIAS_CONFIG.length} BARBEARIAS ATIVAS NO BARZZO`);
  console.log("==========================================================\n");

  // 1. Obter planos do banco
  const { data: planos, error: erroPlanos } = await supabase.from("planos").select("*");
  if (erroPlanos || !planos || planos.length === 0) {
    console.error("Erro ao buscar planos:", erroPlanos);
    process.exit(1);
  }

  const planoPro = planos.find((p) => p.identificador === "pro") || planos[0];
  console.log(`✔ Plano selecionado para assinaturas: ${planoPro.nome} (ID: ${planoPro.id})`);

  // 2. Loop de 1 a 30
  for (let i = 1; i <= BARBEARIAS_CONFIG.length; i++) {
    const numPad = i.toString().padStart(2, "0");
    const bConfig = BARBEARIAS_CONFIG[i - 1];
    const email = `barbearia${numPad}@barzzo.com.br`;
    const senha = `teste123`;
    const slug = `barbearia-${numPad}`;
    const nomeBarbearia = bConfig.nome;
    const bairro = bConfig.bairro;
    const cidade = bConfig.cidade;
    const endereco = bConfig.endereco;
    const cep = bConfig.cep;
    const lat = bConfig.lat;
    const lng = bConfig.lng;
    const telefone = `(11) 98765-${numPad}00`;
    const doc = `12.345.678/0001-${numPad}`;

    console.log(`\n----------------------------------------------------------`);
    console.log(`[${i}/${BARBEARIAS_CONFIG.length}] Configurando: ${nomeBarbearia} (${bairro}, ${cidade})`);

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
    const dadosBarbearia = {
      nome: nomeBarbearia,
      slug: slug,
      email: email,
      telefone: telefone,
      documento: doc,
      endereco: endereco,
      bairro: bairro,
      cidade: cidade,
      estado: "SP",
      cep: cep,
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

    // E. Criar ou Atualizar Serviços Padrão com Preço Personalizado
    const servicosPersonalizados = [
      { nome: "Corte Tradicional / Degradê", descricao: "Corte completo com lavagem, finalização e alinhamento dos fios.", preco: bConfig.precoCorte, duracao_minutos: 30 },
      { nome: "Barba Terapia com Toalha Quente", descricao: "Barba desenhada com aplicação de óleos essenciais, massagem e toalha quente.", preco: Math.max(25, bConfig.precoCorte - 10), duracao_minutos: 30 },
      { nome: "Combo Cabelo + Barba", descricao: "Corte completo + Barba terapia com desconto especial.", preco: Math.round(bConfig.precoCorte * 1.5), duracao_minutos: 50 },
      { nome: "Acabamento & Pezinho", descricao: "Alinhamento de contorno, costeletas e nuca com navalhete descartável.", preco: 25.0, duracao_minutos: 15 },
    ];

    const servicosIds = [];
    for (const s of servicosPersonalizados) {
      const { data: servicoDb } = await supabase
        .from("servicos")
        .select("id")
        .eq("barbearia_id", barbeariaId)
        .eq("nome", s.nome)
        .maybeSingle();

      if (servicoDb) {
        await supabase
          .from("servicos")
          .update({ preco: s.preco, descricao: s.descricao, ativo: true })
          .eq("id", servicoDb.id);
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
  console.log(`  ✔ SUCESSO: ${BARBEARIAS_CONFIG.length} BARBEARIAS CADASTRADAS E ATIVAS!`);
  console.log(`  Credenciais geradas: barbearia01@barzzo.com.br até barbearia${BARBEARIAS_CONFIG.length}@barzzo.com.br`);
  console.log("  Senha: teste123");
  console.log("==========================================================");
}

seed().catch((err) => {
  console.error("Falha fatal na execução do seed:", err);
  process.exit(1);
});
