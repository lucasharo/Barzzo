import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const body = req.body || {};
    const query = req.query || {};

    const rawTipo = body.type || body.topic || query.type || query.topic || 'desconhecido';
    const tipo = String(rawTipo).toLowerCase();
    const dataId = body.data?.id || body.id || query['data.id'] || query.id;

    if (!dataId) {
      return res.status(200).json({ status: 'ignored', message: 'ID ausente no payload do webhook' });
    }

    const eventoId = `${tipo}_${dataId}_${body.action || 'notify'}`;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_CHAVE_SECRETA || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      return res.status(500).json({ error: 'Configuração do Supabase ausente nas variáveis de ambiente' });
    }

    const supabase = createClient(supabaseUrl, supabaseSecretKey);

    // 1. Idempotência: verificar se o evento já foi processado anteriormente
    const { data: eventoExistente } = await supabase
      .from('eventos_webhook_mercadopago')
      .select('id')
      .eq('evento_id', eventoId)
      .maybeSingle();

    if (eventoExistente) {
      return res.status(200).json({ status: 'ok', message: 'Evento já processado de forma idempotente' });
    }

    // 2. Registrar o recebimento em eventos_webhook_mercadopago
    await supabase.from('eventos_webhook_mercadopago').insert({
      evento_id: eventoId,
      tipo: tipo,
      payload: body,
    }).catch(() => {});

    const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    // =========================================================================
    // TRATAMENTO DOS 7 EVENTOS CONFIGURADOS NO MERCADO PAGO
    // =========================================================================

    // A. Card Updater (Atualização de cartão pela bandeira/banco)
    if (tipo.includes('card') || tipo === 'card_updater') {
      if (mpAccessToken) {
        try {
          const { data: barb } = await supabase
            .from('barbearias')
            .select('id, mercado_pago_customer_id')
            .eq('mercado_pago_card_id', dataId)
            .maybeSingle();

          if (barb?.mercado_pago_customer_id) {
            const respCard = await fetch(
              `https://api.mercadopago.com/v1/customers/${barb.mercado_pago_customer_id}/cards/${dataId}`,
              { headers: { Authorization: `Bearer ${mpAccessToken}` } }
            );
            if (respCard.ok) {
              const cardData = await respCard.json();
              await supabase
                .from('barbearias')
                .update({
                  mercado_pago_card_last_four: cardData.last_four_digits,
                  mercado_pago_card_brand: cardData.payment_method?.id,
                  atualizado_em: new Date().toISOString(),
                })
                .eq('id', barb.id);
            }
          }
        } catch (e) {
          console.warn('[Card Updater Warning]:', e.message);
        }
      }
      return res.status(200).json({ status: 'success', message: 'Evento Card Updater processado com sucesso' });
    }

    // B. Contestações e Alertas de Fraude (Chargebacks / Disputes / Fraud)
    if (tipo.includes('chargeback') || tipo.includes('dispute') || tipo.includes('fraud')) {
      if (mpAccessToken) {
        try {
          const respPay = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
            headers: { Authorization: `Bearer ${mpAccessToken}` },
          });
          if (respPay.ok) {
            const payData = await respPay.json();
            const extRef = payData.external_reference;
            let bId = null;
            try {
              bId = JSON.parse(extRef).barbearia_id;
            } catch {
              if (extRef?.length === 36) bId = extRef;
            }
            if (bId) {
              await supabase
                .from('barbearias')
                .update({
                  status_assinatura: 'inadimplente',
                  atualizado_em: new Date().toISOString(),
                })
                .eq('id', bId);

              await supabase.from('logs_auditoria').insert({
                barbearia_id: bId,
                acao: 'contestacao_pagamento',
                entidade: 'assinaturas',
                dados_novos: { evento: tipo, id: dataId, payload: body },
              }).catch(() => {});
            }
          }
        } catch (e) {
          console.warn('[Dispute/Fraud Warning]:', e.message);
        }
      }
      return res.status(200).json({ status: 'success', message: 'Contestação/Alerta de fraude registrado com sucesso' });
    }

    // C. Reclamações (Claims)
    if (tipo.includes('claim')) {
      await supabase.from('logs_auditoria').insert({
        acao: 'reclamacao_recebida',
        entidade: 'mercadopago',
        dados_novos: { evento: tipo, id: dataId, payload: body },
      }).catch(() => {});

      return res.status(200).json({ status: 'success', message: 'Reclamação registrada na auditoria' });
    }

    // D. Split - Autorização
    if (tipo.includes('split')) {
      return res.status(200).json({ status: 'success', message: 'Split de autorização registrado com sucesso' });
    }

    // E. Pagamentos (legacy) e Planos e Assinaturas (Payments / Subscriptions / Preapproval)
    let statusOficial = null;
    let externalRefRaw = null;
    let preapprovalId = null;
    let paymentId = null;
    let valorCobrado = null;

    if (mpAccessToken) {
      if (tipo.includes('subscription') || tipo.includes('preapproval')) {
        const respMp = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
          headers: { Authorization: `Bearer ${mpAccessToken}` },
        });
        if (respMp.ok) {
          const mpData = await respMp.json();
          statusOficial = mpData.status; // 'authorized', 'paused', 'cancelled'
          externalRefRaw = mpData.external_reference;
          preapprovalId = mpData.id;
          valorCobrado = mpData.auto_recurring?.transaction_amount;
        }
      } else if (tipo.includes('payment')) {
        const respMp = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
          headers: { Authorization: `Bearer ${mpAccessToken}` },
        });
        if (respMp.ok) {
          const mpData = await respMp.json();
          statusOficial = mpData.status; // 'approved', 'rejected', 'pending'
          externalRefRaw = mpData.external_reference;
          paymentId = String(mpData.id);
          valorCobrado = mpData.transaction_amount;
        }
      }
    }

    if (!externalRefRaw) {
      return res.status(200).json({ status: 'processed', message: 'Evento recebido sem external_reference relevante' });
    }

    let extData = {};
    try {
      extData = JSON.parse(externalRefRaw);
    } catch {
      if (externalRefRaw.length === 36) {
        extData = { barbearia_id: externalRefRaw };
      }
    }

    const { barbearia_id, plano_id, ciclo, valor } = extData;

    if (!barbearia_id) {
      return res.status(200).json({ status: 'processed', message: 'barbearia_id não encontrado no evento' });
    }

    if (statusOficial === 'authorized' || statusOficial === 'approved') {
      const { error: rpcErr } = await supabase.rpc('processar_confirmacao_pagamento_assinatura', {
        p_barbearia_id: barbearia_id,
        p_plano_id: plano_id,
        p_ciclo: ciclo || 'mensal',
        p_valor: Number(valor || valorCobrado || 0),
        p_mp_payment_id: paymentId || `MP_PREAPPROVAL_${dataId}`,
        p_mp_subscription_id: preapprovalId || dataId,
      });

      if (rpcErr) {
        await supabase.from('barbearias').update({
          status_assinatura: 'ativo',
          atualizado_em: new Date().toISOString(),
        }).eq('id', barbearia_id);
      }
    } else if (statusOficial === 'cancelled' || statusOficial === 'paused') {
      await supabase.from('barbearias').update({
        status_assinatura: 'suspenso',
        atualizado_em: new Date().toISOString(),
      }).eq('id', barbearia_id);

      await supabase.from('assinaturas').update({
        status: 'cancelada',
        atualizado_em: new Date().toISOString(),
      }).eq('barbearia_id', barbearia_id);
    }

    return res.status(200).json({ status: 'success', message: 'Webhook processado com sucesso' });
  } catch (err) {
    console.error('Erro no webhook Mercado Pago:', err);
    return res.status(500).json({ error: err.message || 'Erro interno no webhook' });
  }
}
