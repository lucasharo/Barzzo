import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { barbearia_id, card_token, email, last_four, brand, plano_id, ciclo, valor } = req.body || {};

    if (!barbearia_id || !card_token) {
      return res.status(400).json({ error: 'barbearia_id e card_token são obrigatórios' });
    }

    const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_CHAVE_SECRETA;

    if (!mpAccessToken || !supabaseUrl || !supabaseSecretKey) {
      return res.status(500).json({ error: 'Configuração de ambiente incompleta' });
    }

    const supabase = createClient(supabaseUrl, supabaseSecretKey);

    // 1. Obter dados da barbearia
    const { data: barbearia, error: errBarb } = await supabase
      .from('barbearias')
      .select('id, email, mercado_pago_customer_id')
      .eq('id', barbearia_id)
      .single();

    if (errBarb || !barbearia) {
      return res.status(404).json({ error: 'Barbearia não encontrada' });
    }

    let customerId = barbearia.mercado_pago_customer_id;
    const emailPagador = email || barbearia.email || 'contato@barzzo.com.br';

    // 2. Se não possuir Customer ID no Mercado Pago, criar um novo
    if (!customerId) {
      const respCustomer = await fetch('https://api.mercadopago.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: emailPagador,
        }),
      });

      const customerData = await respCustomer.json();
      if (!respCustomer.ok) {
        if (customerData.message?.includes('access denied') || customerData.cause?.[0]?.code === '300') {
          return res.status(400).json({
            error: 'Para salvar cartões com credenciais de produção, acesse o Painel do Desenvolvedor Mercado Pago e preencha a Validação de Produção da aplicação. Utilize a opção Checkout Pro (Pix/Cartão).'
          });
        }
        throw new Error(customerData.message || 'Falha ao cadastrar cliente no Mercado Pago');
      }
      customerId = customerData.id;
    }

    // 3. Salvar o cartão no cofre do Customer no Mercado Pago
    const respCard = await fetch(`https://api.mercadopago.com/v1/customers/${customerId}/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: card_token,
      }),
    });

    const cardData = await respCard.json();
    if (!respCard.ok) {
      throw new Error(cardData.message || 'Falha ao vincular o cartão no cofre do Mercado Pago');
    }

    const cardId = cardData.id;
    const finalLastFour = last_four || cardData.last_four || '****';
    const finalBrand = brand || cardData.payment_method?.id || 'cartão';

    // 4. Atualizar registro da barbearia no Supabase
    await supabase
      .from('barbearias')
      .update({
        mercado_pago_customer_id: customerId,
        mercado_pago_card_id: cardId,
        mercado_pago_card_last_four: finalLastFour,
        mercado_pago_card_brand: finalBrand,
        recorrencia_ativa: true,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', barbearia_id);

    // 5. Se foi informado plano_id e valor para contratação/renovação imediata:
    if (plano_id && valor) {
      const respPayment = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `BARZZO_CARD_${barbearia_id}_${Date.now()}`,
        },
        body: JSON.stringify({
          transaction_amount: Number(valor),
          token: card_token,
          description: `Barzzo - Assinatura (${ciclo === 'semestral' ? 'Semestral' : 'Mensal'})`,
          payment_method_id: cardData.payment_method?.id,
          installments: 1,
          payer: {
            id: customerId,
            email: emailPagador,
          },
          external_reference: JSON.stringify({
            barbearia_id,
            plano_id,
            ciclo: ciclo || 'mensal',
            valor,
          }),
        }),
      });

      const paymentData = await respPayment.json();
      if (respPayment.ok && (paymentData.status === 'approved' || paymentData.status === 'in_process')) {
        await supabase.rpc('processar_confirmacao_pagamento_assinatura', {
          p_barbearia_id,
          p_plano_id,
          p_ciclo: ciclo || 'mensal',
          p_valor: Number(valor),
          p_mp_payment_id: String(paymentData.id),
        });
      }
    }

    return res.status(200).json({
      sucesso: true,
      customer_id: customerId,
      card_id: cardId,
      last_four: finalLastFour,
      brand: finalBrand,
      recorrencia_ativa: true,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro ao salvar cartão para renovação automática' });
  }
}
