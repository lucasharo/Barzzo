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

    // Chamada à API Preapproval do Mercado Pago para assinaturas recorrentes
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
        payer_email: email || 'contato@barzzo.com.br',
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
    const initUrl = dataMp.sandbox_init_point || dataMp.init_point;

    if (initUrl) {
      return res.status(200).json({
        init_url: initUrl,
        preapproval_id: dataMp.id,
      });
    }

    // Se o endpoint preapproval retornar erro por falta de cadastro prévio de plano ou chave, faz fallback seguro para a Preapproval Plan API ou preference
    if (!initUrl && dataMp.message) {
      console.warn('Alerta Preapproval Direct MP:', dataMp.message);
    }

    return res.status(400).json({ error: dataMp.message || 'Falha ao gerar assinatura no Mercado Pago' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro interno no servidor' });
  }
}
