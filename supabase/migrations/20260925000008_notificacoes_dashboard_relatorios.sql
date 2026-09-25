-- Migration: 20260925000008_notificacoes_dashboard_relatorios.sql
-- Descrição: Tabelas de dispositivos, preferências de notificação, notificações push/in-app,
-- flag de idempotência de lembretes e RPCs analíticas para dashboard e relatórios.

-- 1. Tabela public.dispositivos (FCM Tokens Multi-Device)
CREATE TABLE IF NOT EXISTS public.dispositivos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL,
    plataforma TEXT NOT NULL CHECK (plataforma IN ('web', 'android', 'ios')),
    ativo BOOLEAN NOT NULL DEFAULT true,
    modelo TEXT,
    ultimo_acesso_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT dispositivos_usuario_token_key UNIQUE (usuario_id, fcm_token)
);

CREATE INDEX IF NOT EXISTS idx_dispositivos_usuario ON public.dispositivos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_dispositivos_ativo ON public.dispositivos(ativo);

-- 2. Tabela public.preferencias_notificacao
CREATE TABLE IF NOT EXISTS public.preferencias_notificacao (
    usuario_id UUID PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
    notificacoes_transacionais BOOLEAN NOT NULL DEFAULT true,
    notificacoes_promocionais BOOLEAN NOT NULL DEFAULT true,
    notificacoes_lembretes BOOLEAN NOT NULL DEFAULT true,
    atualizado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela public.notificacoes (Central In-App)
CREATE TABLE IF NOT EXISTS public.notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    corpo TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('confirmacao', 'cancelamento', 'lembrete', 'reagendamento', 'promocao', 'sistema')),
    lida BOOLEAN NOT NULL DEFAULT false,
    lida_em TIMESTAMPTZ,
    link TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON public.notificacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_lida ON public.notificacoes(usuario_id, lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_criado_em ON public.notificacoes(criado_em DESC);

-- 4. Campo de Idempotência em Agendamentos (Lembrete Único)
ALTER TABLE public.agendamentos 
ADD COLUMN IF NOT EXISTS lembrete_enviado BOOLEAN NOT NULL DEFAULT false;

-- 5. Row Level Security (RLS)
ALTER TABLE public.dispositivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferencias_notificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- 5.1 Políticas para public.dispositivos
DROP POLICY IF EXISTS "Usuarios gerenciam seus proprios dispositivos" ON public.dispositivos;
CREATE POLICY "Usuarios gerenciam seus proprios dispositivos"
    ON public.dispositivos
    FOR ALL
    TO authenticated
    USING (auth.uid() = usuario_id)
    WITH CHECK (auth.uid() = usuario_id);

-- 5.2 Políticas para public.preferencias_notificacao
DROP POLICY IF EXISTS "Usuarios gerenciam suas proprias preferencias" ON public.preferencias_notificacao;
CREATE POLICY "Usuarios gerenciam suas proprias preferencias"
    ON public.preferencias_notificacao
    FOR ALL
    TO authenticated
    USING (auth.uid() = usuario_id)
    WITH CHECK (auth.uid() = usuario_id);

-- 5.3 Políticas para public.notificacoes
DROP POLICY IF EXISTS "Usuarios leem suas proprias notificacoes" ON public.notificacoes;
CREATE POLICY "Usuarios leem suas proprias notificacoes"
    ON public.notificacoes
    FOR SELECT
    TO authenticated
    USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Usuarios atualizam status de suas notificacoes" ON public.notificacoes;
CREATE POLICY "Usuarios atualizam status de suas notificacoes"
    ON public.notificacoes
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = usuario_id)
    WITH CHECK (auth.uid() = usuario_id);

-- 6. RPC: Registrar ou Atualizar Dispositivo
CREATE OR REPLACE FUNCTION public.registrar_dispositivo(
    p_fcm_token TEXT,
    p_plataforma TEXT,
    p_modelo TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário deve estar autenticado para registrar dispositivo.';
    END IF;

    INSERT INTO public.dispositivos (usuario_id, fcm_token, plataforma, modelo, ativo, ultimo_acesso_em)
    VALUES (auth.uid(), p_fcm_token, p_plataforma, p_modelo, true, timezone('utc'::text, now()))
    ON CONFLICT (usuario_id, fcm_token) DO UPDATE SET
        ativo = true,
        modelo = COALESCE(p_modelo, public.dispositivos.modelo),
        ultimo_acesso_em = timezone('utc'::text, now())
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Marcar Notificação como Lida
CREATE OR REPLACE FUNCTION public.marcar_notificacao_lida(p_notificacao_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.notificacoes
    SET lida = true,
        lida_em = timezone('utc'::text, now())
    WHERE id = p_notificacao_id
      AND usuario_id = auth.uid();

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: Marcar Todas as Notificações como Lidas
CREATE OR REPLACE FUNCTION public.marcar_todas_notificacoes_lidas()
RETURNS INTEGER AS $$
DECLARE
    v_contagem INTEGER;
BEGIN
    UPDATE public.notificacoes
    SET lida = true,
        lida_em = timezone('utc'::text, now())
    WHERE usuario_id = auth.uid()
      AND lida = false;

    GET DIAGNOSTICS v_contagem = ROW_COUNT;
    RETURN v_contagem;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RPC: Obter Métricas do Dashboard de Hoje
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
      AND (data_hora_inicio AT TIME ZONE 'UTC')::DATE = v_data_hoje
      AND (p_profissional_id IS NULL OR profissional_id = p_profissional_id);

    -- Novos clientes com primeiro atendimento hoje
    SELECT COUNT(DISTINCT cliente_id)
    INTO v_novos_clientes_hoje
    FROM public.agendamentos a1
    WHERE a1.barbearia_id = p_barbearia_id
      AND (a1.data_hora_inicio AT TIME ZONE 'UTC')::DATE = v_data_hoje
      AND a1.status = 'concluido'
      AND (p_profissional_id IS NULL OR a1.profissional_id = p_profissional_id)
      AND NOT EXISTS (
          SELECT 1 FROM public.agendamentos a2
          WHERE a2.barbearia_id = p_barbearia_id
            AND a2.cliente_id = a1.cliente_id
            AND a2.status = 'concluido'
            AND (a2.data_hora_inicio AT TIME ZONE 'UTC')::DATE < v_data_hoje
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

-- 10. RPC: Obter Relatório Geral Consolidado
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
      AND (data_hora_inicio AT TIME ZONE 'UTC')::DATE >= p_data_inicio
      AND (data_hora_inicio AT TIME ZONE 'UTC')::DATE <= p_data_fim
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
