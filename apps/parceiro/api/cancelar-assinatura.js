import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { barbearia_id } = req.body || {};

    if (!barbearia_id) {
      return res.status(400).json({ error: 'barbearia_id é obrigatório' });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_CHAVE_SECRETA;

    if (!supabaseUrl || !supabaseSecretKey) {
      return res.status(500).json({ error: 'Configuração de ambiente incompleta' });
    }

    const supabase = createClient(supabaseUrl, supabaseSecretKey);

    // 1. Obter assinatura ativa para informar a data limite
    const { data: assAtiva } = await supabase
      .from('assinaturas')
      .select('*')
      .eq('barbearia_id', barbearia_id)
      .eq('status', 'ativa')
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Desativar renovação automática na barbearia
    const { error: errUpdate } = await supabase
      .from('barbearias')
      .update({
        recorrencia_ativa: false,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', barbearia_id);

    if (errUpdate) {
      throw new Error('Falha ao desativar renovação automática no banco.');
    }

    const dataLimite = assAtiva?.data_fim || null;

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Renovação automática cancelada com sucesso.',
      data_limite: dataLimite,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro ao cancelar assinatura' });
  }
}
