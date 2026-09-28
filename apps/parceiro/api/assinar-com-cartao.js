import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const {
      barbearia_id,
      plano_id,
      ciclo = 'mensal',
      card_token,
      usar_cartao_salvo = false,
      email,
      last_four,
      brand,
    } = req.body || {};

    if (!barbearia_id || !plano_id) {
      return res.status(400).json({ error: 'barbearia_id e plano_id são obrigatórios' });
    }

    const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_CHAVE_SECRETA;

    if (!mpAccessToken || !supabaseUrl || !supabaseSecretKey) {
      return res.status(500).json({ error: 'Configuração de ambiente incompleta' });
    }

    const supabase = createClient(supabaseUrl, supabaseSecretKey);

    // 1. Obter barbearia e plano
    const { data: barbearia, error: errBarb } = await supabase
      .from('barbearias')
      .select('*')
      .eq('id', barbearia_id)
      .single();

    if (errBarb || !barbearia) {
      return res.status(404).json({ error: 'Barbearia não encontrada' });
    }

    const { data: novoPlano, error: errPlano } = await supabase
      .from('planos')
      .select('*')
      .eq('id', plano_id)
      .single();

    if (errPlano || !novoPlano) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }

    // 2. Buscar assinatura ativa atual (para cálculo de pró-rata em upgrade)
    const { data: assAtiva } = await supabase
      .from('assinaturas')
      .select('*, planos(*)')
      .eq('barbearia_id', barbearia_id)
      .eq('status', 'ativa')
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    const precoCheioNovoPlano = ciclo === 'semestral' ? Number(novoPlano.preco_semestral) : Number(novoPlano.preco_mensal);
    let creditoRestante = 0;
    let diasRestantes = 0;

    if (assAtiva && new Date(assAtiva.data_fim) > new Date()) {
      const diasTotais = assAtiva.ciclo === 'semestral' ? 180 : 30;
      const msRestantes = new Date(assAtiva.data_fim).getTime() - new Date().getTime();
      diasRestantes = Math.max(0, Math.ceil(msRestantes / (1000 * 60 * 60 * 24)));
      const valorDiario = Number(assAtiva.valor) / diasTotais;
      creditoRestante = Math.min(Number(assAtiva.valor), Math.max(0, Number((valorDiario * diasRestantes).toFixed(2))));
    }

    const valorACobrar = Math.max(0, Number((precoCheioNovoPlano - creditoRestante).toFixed(2)));

    let customerId = barbearia.mercado_pago_customer_id;
    let cardId = barbearia.mercado_pago_card_id;
    let finalLastFour = last_four || barbearia.mercado_pago_card_last_four || '****';
    let finalBrand = brand || barbearia.mercado_pago_card_brand || 'cartão';
    const emailPagador = email || barbearia.email || 'contato@barzzo.com.br';

    // 3. Tokenização / Vault do Mercado Pago
    if (card_token) {
      // Se não possui Customer ID no Mercado Pago, criar
      if (!customerId) {
        const respCustomer = await fetch('https://api.mercadopago.com/v1/customers', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mpAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: emailPagador }),
        });

        const customerData = await respCustomer.json();
        if (!respCustomer.ok) {
          if (customerData.message?.includes('access denied') || customerData.cause?.[0]?.code === '300') {
            return res.status(400).json({
              error: 'Para salvar cartões com credenciais de produção, acesse o Painel do Desenvolvedor Mercado Pago e preencha a Validação de Produção da aplicação.',
            });
          }
          throw new Error(customerData.message || 'Falha ao cadastrar cliente no Mercado Pago');
        }
        customerId = customerData.id;
      }

      // Salvar cartão no cofre do cliente
      const respCard = await fetch(`https://api.mercadopago.com/v1/customers/${customerId}/cards`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: card_token }),
      });

      const cardData = await respCard.json();
      if (!respCard.ok) {
        throw new Error(cardData.message || 'Falha ao vincular o cartão no cofre do Mercado Pago');
      }

      cardId = cardData.id;
      finalLastFour = cardData.last_four_digits || last_four || '****';
      finalBrand = cardData.payment_method?.id || brand || 'cartão';
    } else if (!usar_cartao_salvo || !customerId) {
      return res.status(400).json({ error: 'Dados do cartão de crédito não fornecidos' });
    }

    // 4. Executar cobrança no Mercado Pago
    let paymentId = null;
    if (valorACobrar > 0) {
      const payloadPagamento = {
        transaction_amount: valorACobrar,
        description: `Barzzo Assinatura - ${novoPlano.nome} (${ciclo === 'semestral' ? 'Semestral' : 'Mensal'})`,
        installments: 1,
        payer: {
          id: customerId,
          email: emailPagador,
        },
        external_reference: JSON.stringify({
          barbearia_id,
          plano_id,
          ciclo,
          valor: valorACobrar,
          credito_aplicado: creditoRestante,
        }),
      };

      if (card_token) {
        payloadPagamento.token = card_token;
      }

      const respPayment = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `BARZZO_ASSINATURA_${barbearia_id}_${plano_id}_${Date.now()}`,
        },
        body: JSON.stringify(payloadPagamento),
      });

      const paymentData = await respPayment.json();

      if (!respPayment.ok || (paymentData.status !== 'approved' && paymentData.status !== 'in_process')) {
        const msgErro = paymentData.status_detail === 'cc_rejected_insufficient_amount'
          ? 'Saldo/limite insuficiente no cartão de crédito.'
          : paymentData.status_detail === 'cc_rejected_bad_filled_security_code'
          ? 'Código de segurança (CVV) inválido.'
          : paymentData.message || 'Pagamento recusado pela operadora do cartão de crédito.';
        return res.status(400).json({ error: msgErro });
      }

      paymentId = String(paymentData.id);
    }

    // 5. Atualizar Banco de Dados Supabase (Novo Ciclo Completo de 30 ou 180 dias a partir de hoje)
    const duracaoDias = ciclo === 'semestral' ? 180 : 30;
    const dataInicio = new Date();
    const dataFim = new Date(dataInicio.getTime() + duracaoDias * 24 * 60 * 60 * 1000);

    // Encerrar assinatura anterior caso exista
    if (assAtiva) {
      await supabase
        .from('assinaturas')
        .update({
          status: 'cancelada',
          data_cancelamento: dataInicio.toISOString(),
          atualizado_em: dataInicio.toISOString(),
        })
        .eq('id', assAtiva.id);
    }

    // Inserir nova assinatura ativa
    const { data: novaAss, error: errNovaAss } = await supabase
      .from('assinaturas')
      .insert({
        barbearia_id,
        plano_id,
        ciclo,
        status: 'ativa',
        data_inicio: dataInicio.toISOString(),
        data_fim: dataFim.toISOString(),
        valor: valorACobrar,
        mercado_pago_payment_id: paymentId,
        criado_em: dataInicio.toISOString(),
        atualizado_em: dataInicio.toISOString(),
      })
      .select()
      .single();

    if (errNovaAss) {
      throw new Error('Falha ao registrar a nova assinatura no sistema.');
    }

    // Atualizar barbearia
    await supabase
      .from('barbearias')
      .update({
        status_assinatura: 'ativa',
        mercado_pago_customer_id: customerId,
        mercado_pago_card_id: cardId,
        mercado_pago_card_last_four: finalLastFour,
        mercado_pago_card_brand: finalBrand,
        recorrencia_ativa: true,
        atualizado_em: dataInicio.toISOString(),
      })
      .eq('id', barbearia_id);

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Assinatura contratada com sucesso!',
      assinatura: novaAss,
      valor_cobrado: valorACobrar,
      credito_aplicado: creditoRestante,
      proxima_renovacao: dataFim.toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro ao processar assinatura com cartão' });
  }
}
