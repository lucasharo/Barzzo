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

    await supabase
      .from('barbearias')
      .update({
        mercado_pago_card_id: null,
        mercado_pago_card_last_four: null,
        mercado_pago_card_brand: null,
        recorrencia_ativa: false,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', barbearia_id);

    return res.status(200).json({ sucesso: true, recorrencia_ativa: false });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro ao remover cartão de renovação' });
  }
}
