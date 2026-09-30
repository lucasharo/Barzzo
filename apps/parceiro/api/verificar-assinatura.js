import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
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

    // 2. Se for uma nova contratação/upgrade de plano, processa e ativa o novo plano
    if (plano_id) {
      const { data: plano } = await supabase
        .from('planos')
        .select('preco_mensal, preco_semestral')
        .eq('id', plano_id)
        .single();

      const valorFinal = ciclo === 'semestral' ? (plano?.preco_semestral || 0) : (plano?.preco_mensal || 0);

      await supabase.rpc('processar_confirmacao_pagamento_assinatura', {
        p_barbearia_id: barbearia_id,
        p_plano_id: plano_id,
        p_ciclo: ciclo,
        p_valor: valorFinal,
        p_mp_payment_id: payment_id || `MP_SYNC_RETURN_${Date.now()}`,
      });

      return res.status(200).json({ ativada: true, status: 'ativo', sincronizado: true, plano_id });
    }

    return res.status(200).json({ ativada: false, status: ultimaAssinatura?.status || 'pendente' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro ao verificar assinatura' });
  }
}
