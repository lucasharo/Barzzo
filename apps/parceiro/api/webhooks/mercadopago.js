import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const body = req.body || {};
    const query = req.query || {};

    const tipo = body.type || body.topic || query.type || query.topic;
    const dataId = body.data?.id || body.id || query['data.id'] || query.id;
    const eventoId = `${tipo}_${dataId}_${body.action || 'notify'}`;

    if (!dataId) {
      return res.status(200).json({ status: 'ignored', message: 'ID ausente no payload do webhook' });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_CHAVE_SECRETA;

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

    const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    let statusOficial = null;
    let externalRefRaw = null;
    let preapprovalId = null;
    let paymentId = null;
    let valorCobrado = null;

    // 2. Consulta autorizada no Mercado Pago para confirmar autenticidade e estado real
    if (tipo === 'subscription_preapproval' || tipo === 'preapproval') {
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
    } else if (tipo === 'payment') {
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

    // 3. Registrar o recebimento em eventos_webhook_mercadopago
    await supabase.from('eventos_webhook_mercadopago').insert({
      evento_id: eventoId,
      tipo: tipo || 'desconhecido',
      payload: body,
    }).catch(() => {});

    if (!externalRefRaw) {
      return res.status(200).json({ status: 'processed', message: 'Evento recebido sem external_reference relevante' });
    }

    let extData = {};
    try {
      extData = JSON.parse(externalRefRaw);
    } catch {
      extData = {};
    }

    const { barbearia_id, plano_id, ciclo, valor } = extData;

    if (!barbearia_id) {
      return res.status(200).json({ status: 'processed', message: 'barbearia_id não encontrado no evento' });
    }

    // 4. Processamento seguro do evento
    if (statusOficial === 'authorized' || statusOficial === 'approved') {
      // Ativar assinatura via RPC ou tabelas
      const { error: rpcErr } = await supabase.rpc('processar_confirmacao_pagamento_assinatura', {
        p_barbearia_id: barbearia_id,
        p_plano_id: plano_id,
        p_ciclo: ciclo || 'mensal',
        p_valor: Number(valor || valorCobrado || 0),
        p_mp_payment_id: paymentId || `MP_PREAPPROVAL_${dataId}`,
        p_mp_subscription_id: preapprovalId || dataId,
      });

      if (rpcErr) {
        // Fallback manual se RPC falhar
        await supabase.from('barbearias').update({
          status_assinatura: 'ativo',
          atualizado_em: new Date().toISOString(),
        }).eq('id', barbearia_id);
      }
    } else if (statusOficial === 'cancelled' || statusOficial === 'paused') {
      // Suspender/Cancelar assinatura
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
