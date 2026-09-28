import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_CHAVE_SECRETA;

    if (!supabaseUrl || !supabaseSecretKey) {
      return res.status(500).json({ error: 'Configuração de ambiente incompleta' });
    }

    const supabase = createClient(supabaseUrl, supabaseSecretKey);
    const agora = new Date();
    const alertas = [];

    // 1. Buscar barbearias ativas e em trial
    const { data: barbearias, error: errBarb } = await supabase
      .from('barbearias')
      .select('id, nome, email, status_assinatura, trial_fim, recorrencia_ativa');

    if (errBarb) {
      throw new Error(`Erro ao buscar barbearias: ${errBarb.message}`);
    }

    for (const b of barbearias || []) {
      // 2. Buscar membros admin da barbearia para notificar
      const { data: membros } = await supabase
        .from('membros_barbearia')
        .select('usuario_id, papel')
        .eq('barbearia_id', b.id)
        .in('papel', ['dono', 'gerente']);

      let dataVencimento = null;
      let tipoVigencia = '';

      if (b.status_assinatura === 'trial' && b.trial_fim) {
        dataVencimento = new Date(b.trial_fim);
        tipoVigencia = 'Período de Testes';
      } else if (b.status_assinatura === 'ativa' || b.status_assinatura === 'ativo') {
        const { data: ass } = await supabase
          .from('assinaturas')
          .select('data_fim')
          .eq('barbearia_id', b.id)
          .eq('status', 'ativa')
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (ass?.data_fim) {
          dataVencimento = new Date(ass.data_fim);
          tipoVigencia = 'Assinatura';
        }
      }

      if (!dataVencimento) continue;

      const diffMs = dataVencimento.getTime() - agora.getTime();
      const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Alertas com 7 dias, 3 dias ou no dia (0 dias)
      let titulo = null;
      let corpo = null;

      if (diasRestantes === 7) {
        titulo = `Faltam 7 dias para o término do seu ${tipoVigencia}`;
        corpo = `Sua assinatura vencerá em ${dataVencimento.toLocaleDateString('pt-BR')}. Cadastre seu cartão para manter o acesso e os agendamentos online ativos sem interrupção.`;
      } else if (diasRestantes === 3) {
        titulo = `Atenção: Apenas 3 dias restantes do seu ${tipoVigencia}`;
        corpo = `Faltam apenas 3 dias para o vencimento (${dataVencimento.toLocaleDateString('pt-BR')}). Garanta a continuidade dos seus agendamentos agora.`;
      } else if (diasRestantes <= 0 && diasRestantes >= -1) {
        titulo = `Seu ${tipoVigencia} vence hoje!`;
        corpo = `Hoje é o último dia de vigência. Após hoje, seus clientes não conseguirão visualizar seu perfil nem agendar horários.`;
      }

      if (titulo && corpo && membros && membros.length > 0) {
        for (const m of membros) {
          await supabase.from('notificacoes').insert({
            usuario_id: m.usuario_id,
            titulo,
            corpo,
            tipo: 'sistema',
            lida: false,
            link: '/assinatura',
            metadata: {
              barbearia_id: b.id,
              dias_restantes: diasRestantes,
              data_vencimento: dataVencimento.toISOString(),
            },
          });
        }

        alertas.push({
          barbearia_id: b.id,
          nome: b.nome,
          dias_restantes: diasRestantes,
          data_vencimento: dataVencimento.toISOString(),
        });
      }
    }

    return res.status(200).json({
      sucesso: true,
      total_alertas_enviados: alertas.length,
      alertas,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro ao processar alertas de assinatura' });
  }
}
