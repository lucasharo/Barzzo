import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Aceita GET e POST para permitir acionamento via Vercel Cron
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_CHAVE_SECRETA;

    if (!mpAccessToken || !supabaseUrl || !supabaseSecretKey) {
      return res.status(500).json({ error: 'Configuração de ambiente incompleta' });
    }

    const supabase = createClient(supabaseUrl, supabaseSecretKey);

    // 1. Buscar barbearias com renovação automática ativa
    const { data: barbearias, error: errBarb } = await supabase
      .from('barbearias')
      .select('id, nome, email, mercado_pago_customer_id, mercado_pago_card_id, mercado_pago_card_brand')
      .eq('recorrencia_ativa', true)
      .not('mercado_pago_customer_id', 'is', null)
      .not('mercado_pago_card_id', 'is', null);

    if (errBarb) {
      throw errBarb;
    }

    const resultados = [];
    const agora = new Date();

    for (const b of barbearias || []) {
      // 2. Buscar a assinatura mais recente da barbearia
      const { data: ass } = await supabase
        .from('assinaturas')
        .select('id, plano_id, ciclo, status, data_fim, valor, planos(preco_mensal, preco_semestral, nome)')
        .eq('barbearia_id', b.id)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!ass) continue;

      const dataFim = new Date(ass.data_fim);
      // Processa se faltar menos de 24h para vencer ou se já venceu
      const diffHoras = (dataFim.getTime() - agora.getTime()) / (1000 * 60 * 60);

      if (diffHoras <= 24 && ass.status === 'ativa') {
        const ciclo = ass.ciclo || 'mensal';
        const valorCobrar = ass.valor > 0 ? ass.valor : (ciclo === 'semestral' ? ass.planos?.preco_semestral : ass.planos?.preco_mensal);

        if (!valorCobrar) continue;

        // 3. Efetuar cobrança automática no Mercado Pago
        const respPayment = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mpAccessToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': `CRON_RENOVA_${b.id}_${agora.toISOString().slice(0, 10)}`,
          },
          body: JSON.stringify({
            transaction_amount: Number(valorCobrar),
            description: `Renovação Automática Barzzo - ${ass.planos?.nome || 'Plano'} (${ciclo})`,
            payment_method_id: b.mercado_pago_card_brand || 'master',
            installments: 1,
            payer: {
              type: 'customer',
              id: b.mercado_pago_customer_id,
              email: b.email,
            },
            card_id: b.mercado_pago_card_id,
            external_reference: JSON.stringify({
              barbearia_id: b.id,
              plano_id: ass.plano_id,
              ciclo: ciclo,
              valor: valorCobrar,
            }),
          }),
        });

        const paymentData = await respPayment.json();

        if (respPayment.ok && (paymentData.status === 'approved' || paymentData.status === 'in_process')) {
          await supabase.rpc('processar_confirmacao_pagamento_assinatura', {
            p_barbearia_id: b.id,
            p_plano_id: ass.plano_id,
            p_ciclo: ciclo,
            p_valor: Number(valorCobrar),
            p_mp_payment_id: String(paymentData.id),
          });

          resultados.push({ barbearia_id: b.id, status: 'renovada', payment_id: paymentData.id });
        } else {
          // Em caso de falha de cartão na renovação
          resultados.push({ barbearia_id: b.id, status: 'falha_cobranca', erro: paymentData.message });
        }
      }
    }

    return res.status(200).json({ sucesso: true, total_processado: resultados.length, resultados });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro ao processar renovações automáticas' });
  }
}
