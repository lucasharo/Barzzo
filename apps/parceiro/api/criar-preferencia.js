export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { plano_nome, valor, barbearia_id, plano_id, ciclo, email, sandbox } = req.body || {};

    const mpAccessToken =
      process.env.MERCADO_PAGO_ACCESS_TOKEN ||
      'APP_USR-2185754805018181-092512-a124c075e38233b413379bb547d146fa-3647911506';

    const reqOrigin = req.headers.origin || '';
    const origin = (reqOrigin.includes('localhost') || reqOrigin.includes('192.168.') || !reqOrigin)
      ? 'https://barzzo-parceiro.vercel.app'
      : reqOrigin;

    const respMp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            title: `Barzzo - ${plano_nome || 'Assinatura'} (${ciclo === 'semestral' ? 'Semestral' : 'Mensal'})`,
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
      }),
    });

    const dataMp = await respMp.json();
    const initUrl = (sandbox || mpAccessToken.startsWith('TEST-'))
      ? (dataMp.sandbox_init_point || dataMp.init_point)
      : (dataMp.init_point || dataMp.sandbox_init_point);

    if (initUrl) {
      return res.status(200).json({ init_url: initUrl });
    }

    return res.status(400).json({ error: dataMp.message || 'Falha ao gerar checkout no Mercado Pago' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro interno no servidor' });
  }
}
