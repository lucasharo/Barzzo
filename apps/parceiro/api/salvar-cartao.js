import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { barbearia_id, card_token, email, last_four, brand } = req.body || {};

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
    let cardId = 'CARD_' + Date.now();
    let finalLastFour = last_four || '****';
    let finalBrand = brand || 'cartão';
    const emailPagador = email || barbearia.email || 'contato@barzzo.com.br';

    // 2. Tentar vincular no cofre do Mercado Pago
    try {
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
        if (respCustomer.ok && customerData.id) {
          customerId = customerData.id;
        }
      }

      if (customerId) {
        const respCard = await fetch(`https://api.mercadopago.com/v1/customers/${customerId}/cards`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mpAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: card_token }),
        });

        const cardData = await respCard.json();
        if (respCard.ok && cardData.id) {
          cardId = cardData.id;
          finalLastFour = cardData.last_four_digits || finalLastFour;
          finalBrand = cardData.payment_method?.id || finalBrand;
        }
      }
    } catch (e) {
      console.warn('[Mercado Pago Vault Warning]:', e.message);
    }

    // 3. Atualizar registro da barbearia no Supabase
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
