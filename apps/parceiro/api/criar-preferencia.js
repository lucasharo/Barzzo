export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { plano_nome, valor, barbearia_id, plano_id, ciclo, email } = req.body || {};

    if (!barbearia_id || !plano_id || !valor) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes' });
    }

    const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!mpAccessToken) {
      return res.status(500).json({ error: 'MERCADO_PAGO_ACCESS_TOKEN não configurado nas variáveis de ambiente' });
    }

    const reqOrigin = req.headers.origin || '';
    const origin = (reqOrigin.includes('localhost') || reqOrigin.includes('192.168.') || !reqOrigin)
      ? 'https://barzzo-parceiro-dev.vercel.app'
      : reqOrigin;

    // Checkout Pro Oficial: pagamento sem exigência de conta no Mercado Pago (Convidado / Cartão / Pix)
    const respPref = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            title: `Barzzo - ${plano_nome || 'Assinatura'} (${ciclo === 'semestral' ? 'Semestral' : 'Mensal'})`,
            description: `Assinatura de software Barzzo - Acesso ${ciclo === 'semestral' ? 'Semestral (6 meses)' : 'Mensal (1 mês)'}`,
            quantity: 1,
            unit_price: Number(valor),
            currency_id: 'BRL',
          },
        ],
        payer: {
          email: email || 'contato@barzzo.com.br',
        },
        external_reference: JSON.stringify({
          barbearia_id,
          plano_id,
          ciclo,
          valor,
        }),
        back_urls: {
          success: `${origin}/assinatura?status=sucesso&plano=${plano_id}&ciclo=${ciclo}`,
          failure: `${origin}/assinatura?status=falha`,
          pending: `${origin}/assinatura?status=pendente`,
        },
        auto_return: 'approved',
        statement_descriptor: 'BARZZO',
      }),
    });

    const dataPref = await respPref.json();
    const checkoutUrl = dataPref.init_point || dataPref.sandbox_init_point;

    if (checkoutUrl) {
      return res.status(200).json({
        init_url: checkoutUrl,
        preference_id: dataPref.id,
      });
    }

    return res.status(400).json({
      error: dataPref.message || 'Falha ao gerar checkout no Mercado Pago'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro interno no servidor' });
  }
}
