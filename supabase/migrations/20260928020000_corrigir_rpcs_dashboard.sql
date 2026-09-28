-- Migration: 20260928020000_corrigir_rpcs_dashboard.sql
-- Descrição: Corrige referência ao campo 'inicio_previsto' (em vez de data_hora_inicio) nas RPCs obter_metricas_dashboard_hoje e obter_relatorio_geral

CREATE OR REPLACE FUNCTION public.obter_metricas_dashboard_hoje(
    p_barbearia_id UUID,
    p_profissional_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_total_hoje INTEGER := 0;
    v_proximos INTEGER := 0;
    v_em_atendimento INTEGER := 0;
    v_concluidos INTEGER := 0;
    v_cancelados_no_show INTEGER := 0;
    v_faturamento_realizado NUMERIC(10,2) := 0.00;
    v_faturamento_estimado NUMERIC(10,2) := 0.00;
    v_novos_clientes_hoje INTEGER := 0;
    v_data_hoje DATE := CURRENT_DATE;
BEGIN
    -- Validação de acesso à barbearia
    IF NOT (public.usuario_eh_membro(p_barbearia_id)) THEN
        RAISE EXCEPTION 'Acesso não autorizado aos dados operacionais desta barbearia.';
    END IF;

    -- Métricas de agendamento de hoje
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'confirmado'),
        COUNT(*) FILTER (WHERE status = 'em_atendimento'),
        COUNT(*) FILTER (WHERE status = 'concluido'),
        COUNT(*) FILTER (WHERE status IN ('cancelado', 'nao_compareceu')),
        COALESCE(SUM(preco_total) FILTER (WHERE status = 'concluido'), 0.00),
        COALESCE(SUM(preco_total) FILTER (WHERE status IN ('confirmado', 'em_atendimento')), 0.00)
    INTO
        v_total_hoje,
        v_proximos,
        v_em_atendimento,
        v_concluidos,
        v_cancelados_no_show,
        v_faturamento_realizado,
        v_faturamento_estimado
    FROM public.agendamentos
    WHERE barbearia_id = p_barbearia_id
      AND (inicio_previsto AT TIME ZONE 'UTC')::DATE = v_data_hoje
      AND (p_profissional_id IS NULL OR profissional_id = p_profissional_id);

    -- Novos clientes com primeiro atendimento hoje
    SELECT COUNT(DISTINCT cliente_id)
    INTO v_novos_clientes_hoje
    FROM public.agendamentos a1
    WHERE a1.barbearia_id = p_barbearia_id
      AND (a1.inicio_previsto AT TIME ZONE 'UTC')::DATE = v_data_hoje
      AND a1.status = 'concluido'
      AND (p_profissional_id IS NULL OR a1.profissional_id = p_profissional_id)
      AND NOT EXISTS (
          SELECT 1 FROM public.agendamentos a2
          WHERE a2.barbearia_id = p_barbearia_id
            AND a2.cliente_id = a1.cliente_id
            AND a2.status = 'concluido'
            AND (a2.inicio_previsto AT TIME ZONE 'UTC')::DATE < v_data_hoje
      );

    RETURN jsonb_build_object(
        'total_hoje', v_total_hoje,
        'proximos', v_proximos,
        'em_atendimento', v_em_atendimento,
        'concluidos', v_concluidos,
        'cancelados_no_show', v_cancelados_no_show,
        'faturamento_realizado', v_faturamento_realizado,
        'faturamento_estimado', v_faturamento_estimado,
        'novos_clientes_hoje', v_novos_clientes_hoje
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.obter_relatorio_geral(
    p_barbearia_id UUID,
    p_data_inicio DATE,
    p_data_fim DATE,
    p_profissional_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_total_agendamentos INTEGER := 0;
    v_concluidos INTEGER := 0;
    v_cancelados INTEGER := 0;
    v_no_show INTEGER := 0;
    v_faturamento_total NUMERIC(10,2) := 0.00;
    v_ticket_medio NUMERIC(10,2) := 0.00;
    v_duracao_prevista_media NUMERIC(10,1) := 0.0;
    v_duracao_real_media NUMERIC(10,1) := 0.0;
BEGIN
    IF NOT (public.usuario_eh_membro(p_barbearia_id)) THEN
        RAISE EXCEPTION 'Acesso não autorizado aos relatórios desta barbearia.';
    END IF;

    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'concluido'),
        COUNT(*) FILTER (WHERE status = 'cancelado'),
        COUNT(*) FILTER (WHERE status = 'nao_compareceu'),
        COALESCE(SUM(preco_total) FILTER (WHERE status = 'concluido'), 0.00),
        COALESCE(AVG(duracao_total_minutos) FILTER (WHERE status = 'concluido'), 0.0),
        COALESCE(
            AVG(EXTRACT(EPOCH FROM (fim_real - inicio_real)) / 60)
            FILTER (WHERE status = 'concluido' AND inicio_real IS NOT NULL AND fim_real IS NOT NULL),
            0.0
        )
    INTO
        v_total_agendamentos,
        v_concluidos,
        v_cancelados,
        v_no_show,
        v_faturamento_total,
        v_duracao_prevista_media,
        v_duracao_real_media
    FROM public.agendamentos
    WHERE barbearia_id = p_barbearia_id
      AND (inicio_previsto AT TIME ZONE 'UTC')::DATE >= p_data_inicio
      AND (inicio_previsto AT TIME ZONE 'UTC')::DATE <= p_data_fim
      AND (p_profissional_id IS NULL OR profissional_id = p_profissional_id);

    IF v_concluidos > 0 THEN
        v_ticket_medio := ROUND(v_faturamento_total / v_concluidos, 2);
    END IF;

    RETURN jsonb_build_object(
        'periodo_inicio', p_data_inicio,
        'periodo_fim', p_data_fim,
        'total_agendamentos', v_total_agendamentos,
        'concluidos', v_concluidos,
        'cancelados', v_cancelados,
        'no_show', v_no_show,
        'faturamento_total', v_faturamento_total,
        'ticket_medio', v_ticket_medio,
        'duracao_prevista_media_min', ROUND(v_duracao_prevista_media, 1),
        'duracao_real_media_min', ROUND(v_duracao_real_media, 1)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
