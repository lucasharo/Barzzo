import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const barbearia_id = req.query.barbearia_id || req.body?.barbearia_id;
    const plano_id = req.query.plano_id || req.body?.plano_id;
    const ciclo = req.query.ciclo || req.body?.ciclo || 'mensal';

    if (!barbearia_id) {
      return res.status(400).json({ error: 'barbearia_id é obrigatório' });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_CHAVE_SECRETA;

    if (!supabaseUrl || !supabaseSecretKey) {
      return res.status(500).json({ error: 'Configuração do Supabase ausente nas variáveis de ambiente' });
    }

    const supabase = createClient(supabaseUrl, supabaseSecretKey);

    // 1. Inspecionar estado atual no Supabase
    const { data: barbearia } = await supabase
      .from('barbearias')
      .select('id, status_assinatura')
      .eq('id', barbearia_id)
      .single();

    if (barbearia?.status_assinatura === 'ativo') {
      return res.status(200).json({ ativada: true, status: 'ativo' });
    }

    // 2. Se o webhook ainda não tiver atualizado, ativa de forma segura via backend
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
        p_mp_payment_id: `MP_SYNC_RETURN_${Date.now()}`,
      });

      return res.status(200).json({ ativada: true, status: 'ativo', sincronizado: true });
    }

    return res.status(200).json({ ativada: false, status: barbearia?.status_assinatura || 'pendente' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro ao verificar assinatura' });
  }
}
