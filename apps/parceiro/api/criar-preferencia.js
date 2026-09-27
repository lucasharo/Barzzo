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

    // Regra do Sandbox do Mercado Pago para Assinaturas (/preapproval):
    // Se o collector for usuário de teste (Sandbox), o payer_email também DEVE ser um test_user registrado (@testuser.com)
    // Caso contrário, o Mercado Pago retorna: "Both payer and collector must be real or test users"
    let payerEmail = email;
    const isTestToken = mpAccessToken.includes('3647911506') || mpAccessToken.startsWith('TEST-');
    if (isTestToken && (!payerEmail || !payerEmail.endsWith('@testuser.com'))) {
      payerEmail = 'test_user_1902596193823187970@testuser.com';
    }

    // 1. Tentar criar assinatura recorrente via Preapproval API
    try {
      const respMp = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: `Barzzo - ${plano_nome || 'Assinatura'} (${ciclo === 'semestral' ? 'Semestral' : 'Mensal'})`,
          auto_recurring: {
            frequency: ciclo === 'semestral' ? 6 : 1,
            frequency_type: 'months',
            transaction_amount: Number(valor),
            currency_id: 'BRL',
          },
          payer_email: payerEmail,
          back_url: `${origin}/assinatura?status=sucesso&plano=${plano_id}&ciclo=${ciclo}`,
          external_reference: JSON.stringify({
            barbearia_id,
            plano_id,
            ciclo,
            valor,
          }),
        }),
      });

      const dataMp = await respMp.json();
      const initUrl = dataMp.init_point || dataMp.sandbox_init_point;

      if (initUrl) {
        return res.status(200).json({
          init_url: initUrl,
          preapproval_id: dataMp.id,
        });
      }
    } catch (errPreapproval) {
      console.warn('Erro ao chamar Preapproval API, tentando Checkout Preferences:', errPreapproval);
    }

    // 2. Fallback de alta disponibilidade: Checkout Pro Preferences API
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
            quantity: 1,
            unit_price: Number(valor),
            currency_id: 'BRL',
          },
        ],
        payer: {
          email: payerEmail,
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

    const dataPref = await respPref.json();
    const fallbackUrl = dataPref.sandbox_init_point || dataPref.init_point;

    if (fallbackUrl) {
      return res.status(200).json({
        init_url: fallbackUrl,
        preference_id: dataPref.id,
      });
    }

    return res.status(400).json({
      error: dataPref.message || 'Falha ao gerar link de pagamento no Mercado Pago'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro interno no servidor' });
  }
}
