import { createClient } from '@supabase/supabase-js';
import { aplicarCors, exigirGestorDaBarbearia } from './_seguranca.js';

export default async function handler(req, res) {
  if (aplicarCors(req, res)) return;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const barbearia_id = req.query.barbearia_id || req.body?.barbearia_id;
    const plano_id = req.query.plano_id || req.body?.plano_id;
    const ciclo = req.query.ciclo || req.body?.ciclo || 'mensal';
    const payment_id = req.query.payment_id || req.body?.payment_id;

    if (!barbearia_id) {
      return res.status(400).json({ error: 'barbearia_id é obrigatório' });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_CHAVE_SECRETA;

    if (!supabaseUrl || !supabaseSecretKey) {
      return res.status(500).json({ error: 'Configuração do Supabase ausente nas variáveis de ambiente' });
    }

    const supabase = createClient(supabaseUrl, supabaseSecretKey);

    const usuario = await exigirGestorDaBarbearia(req, res, supabase, barbearia_id);
    if (!usuario) return;

    // 1. Inspecionar última assinatura ativa no Supabase
    const { data: ultimaAssinatura } = await supabase
      .from('assinaturas')
      .select('id, plano_id, status')
      .eq('barbearia_id', barbearia_id)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Se já estiver com o mesmo plano ativo, retorna OK sem duplicar
    if (plano_id && ultimaAssinatura?.plano_id === plano_id && ultimaAssinatura?.status === 'ativa') {
      return res.status(200).json({ ativada: true, status: 'ativo', plano_id });
    }

    // 2. Contratação/upgrade: só ativa depois de confirmar o pagamento aprovado no Mercado Pago.
    //    Sem payment_id aprovado, quem ativa é o webhook; esta rota apenas informa a situação.
    if (plano_id) {
      const mpAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
      if (!payment_id || !mpAccessToken) {
        return res.status(200).json({ ativada: false, status: ultimaAssinatura?.status || 'pendente', aguardando_confirmacao: true });
      }

      const respPagamento = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(payment_id)}`, {
        headers: { Authorization: `Bearer ${mpAccessToken}` },
      });
      if (!respPagamento.ok) {
        return res.status(200).json({ ativada: false, status: 'pendente', aguardando_confirmacao: true });
      }

      const pagamento = await respPagamento.json();
      let referencia = {};
      try {
        referencia = JSON.parse(pagamento.external_reference || '{}');
      } catch {
        referencia = {};
      }

      const confere =
        pagamento.status === 'approved' &&
        referencia.barbearia_id === barbearia_id &&
        referencia.plano_id === plano_id;
      if (!confere) {
        return res.status(200).json({ ativada: false, status: pagamento.status || 'pendente' });
      }

      await supabase.rpc('processar_confirmacao_pagamento_assinatura', {
        p_barbearia_id: barbearia_id,
        p_plano_id: plano_id,
        p_ciclo: referencia.ciclo || ciclo,
        p_valor: Number(pagamento.transaction_amount),
        p_mp_payment_id: String(pagamento.id),
      });

      return res.status(200).json({ ativada: true, status: 'ativo', sincronizado: true, plano_id });
    }

    return res.status(200).json({ ativada: false, status: ultimaAssinatura?.status || 'pendente' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro ao verificar assinatura' });
  }
}
