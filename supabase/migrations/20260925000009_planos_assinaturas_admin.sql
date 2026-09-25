-- Migration: 20260925000009_planos_assinaturas_admin.sql
-- Descrição: Tabelas de planos SaaS, assinaturas recorrentes, benefícios de retenção,
-- trilha de auditoria administrativa, funções de extensão de trial e RPCs do admin.

-- 1. Tabela public.planos (Configurável no banco, não hardcoded)
CREATE TABLE IF NOT EXISTS public.planos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identificador TEXT NOT NULL UNIQUE CHECK (identificador IN ('solo', 'pro', 'growth', 'rede')),
    nome TEXT NOT NULL,
    descricao TEXT,
    limite_profissionais INTEGER, -- NULL = ilimitado
    preco_mensal NUMERIC(10,2) NOT NULL,
    preco_semestral NUMERIC(10,2) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    ordem INTEGER NOT NULL DEFAULT 0,
    recursos JSONB DEFAULT '[]'::jsonb,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed idempotente dos planos oficiais do Barzzo MVP
INSERT INTO public.planos (identificador, nome, descricao, limite_profissionais, preco_mensal, preco_semestral, ativo, ordem, recursos)
VALUES
    ('solo', 'Plano Solo', 'Para barbeiros autônomos ou profissionais individuais.', 1, 49.90, 249.00, true, 1, '["1 profissional", "Agendamentos ilimitados", "Marketplace Barzzo", "Lembretes in-app"]'::jsonb),
    ('pro', 'Plano Pro', 'Para barbearias de bairro e estúdios em crescimento.', 5, 99.90, 499.00, true, 2, '["Até 5 profissionais", "Agendamentos ilimitados", "Galeria e Catálogo", "Relatórios e Dashboard", "Campanhas e Cupons"]'::jsonb),
    ('growth', 'Plano Growth', 'Para barbearias consolidadas com alto volume e equipe robusta.', 15, 189.90, 949.00, true, 3, '["Até 15 profissionais", "Tudo do Pro", "Gestão de Influenciadores", "Comissões e Atribuição", "Suporte prioritário"]'::jsonb),
    ('rede', 'Plano Rede', 'Para redes, franquias ou grandes operações multi-cadeiras.', NULL, 349.90, 1749.00, true, 4, '["Profissionais ilimitados", "Todas as funcionalidades", "Métricas avançadas", "Gestão de unidades", "Gerente de contas dedicado"]'::jsonb)
ON CONFLICT (identificador) DO UPDATE SET
    nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    limite_profissionais = EXCLUDED.limite_profissionais,
    preco_mensal = EXCLUDED.preco_mensal,
    preco_semestral = EXCLUDED.preco_semestral,
    recursos = EXCLUDED.recursos;

-- 2. Tabela public.assinaturas
CREATE TABLE IF NOT EXISTS public.assinaturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id UUID NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
    plano_id UUID NOT NULL REFERENCES public.planos(id),
    ciclo TEXT NOT NULL CHECK (ciclo IN ('mensal', 'semestral')),
    status TEXT NOT NULL CHECK (status IN ('trial', 'ativa', 'vencida', 'suspensa', 'cancelada')),
    data_inicio TIMESTAMPTZ NOT NULL,
    data_fim TIMESTAMPTZ NOT NULL,
    data_cancelamento TIMESTAMPTZ,
    mercado_pago_subscription_id TEXT,
    mercado_pago_payment_id TEXT UNIQUE,
    valor NUMERIC(10,2) NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assinaturas_barbearia ON public.assinaturas(barbearia_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_status ON public.assinaturas(status);

-- 3. Tabela public.beneficios_assinatura (Retenção sem apagar histórico)
CREATE TABLE IF NOT EXISTS public.beneficios_assinatura (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id UUID NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('extensao_trial', 'desconto', 'dias_bonus')),
    dias_concedidos INTEGER NOT NULL,
    motivo TEXT NOT NULL,
    concedido_por UUID NOT NULL REFERENCES public.usuarios(id),
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_beneficios_barbearia ON public.beneficios_assinatura(barbearia_id);

-- 4. Tabela public.logs_auditoria (Ações administrativas sensíveis)
CREATE TABLE IF NOT EXISTS public.logs_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    barbearia_id UUID REFERENCES public.barbearias(id) ON DELETE SET NULL,
    acao TEXT NOT NULL,
    entidade TEXT NOT NULL,
    entidade_id UUID,
    dados_anteriores JSONB,
    dados_novos JSONB,
    ip TEXT,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_criado_em ON public.logs_auditoria(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_entidade ON public.logs_auditoria(entidade, entidade_id);

-- 5. Row Level Security (RLS)
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficios_assinatura ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;

-- 5.1 Políticas para public.planos
-- Leitura pública de planos ativos para vitrine comercial
DROP POLICY IF EXISTS "Planos ativos sao publicos" ON public.planos;
CREATE POLICY "Planos ativos sao publicos"
    ON public.planos
    FOR SELECT
    USING (ativo = true);

-- 5.2 Políticas para public.assinaturas
-- Membros da barbearia podem ler a assinatura da sua própria barbearia
DROP POLICY IF EXISTS "Membros leem assinatura da barbearia" ON public.assinaturas;
CREATE POLICY "Membros leem assinatura da barbearia"
    ON public.assinaturas
    FOR SELECT
    TO authenticated
    USING (public.usuario_eh_membro(barbearia_id));

-- 5.3 Políticas para public.beneficios_assinatura
DROP POLICY IF EXISTS "Membros leem beneficios da barbearia" ON public.beneficios_assinatura;
CREATE POLICY "Membros leem beneficios da barbearia"
    ON public.beneficios_assinatura
    FOR SELECT
    TO authenticated
    USING (public.usuario_eh_membro(barbearia_id));

-- 5.4 Políticas para public.logs_auditoria
-- Apenas usuários autenticados com perfil de admin no auth.users metadata ou usuários podem ler
DROP POLICY IF EXISTS "Logs auditaveis por usuarios autorizados" ON public.logs_auditoria;
CREATE POLICY "Logs auditaveis por usuarios autorizados"
    ON public.logs_auditoria
    FOR SELECT
    TO authenticated
    USING (auth.uid() = usuario_id OR (auth.jwt()->>'role')::text = 'service_role');

-- 6. RPC: Conceder Extensão de Trial (Retenção Comercial)
CREATE OR REPLACE FUNCTION public.conceder_extensao_trial(
    p_barbearia_id UUID,
    p_dias INTEGER,
    p_motivo TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_trial_fim_atual TIMESTAMPTZ;
    v_novo_trial_fim TIMESTAMPTZ;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    IF p_dias <= 0 THEN
        RAISE EXCEPTION 'Quantidade de dias deve ser maior que zero.';
    END IF;

    -- Obter fim do trial atual
    SELECT trial_fim INTO v_trial_fim_atual
    FROM public.barbearias
    WHERE id = p_barbearia_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Barbearia não encontrada.';
    END IF;

    -- Se o trial já expirou, estender a partir de agora; se ainda está ativo, somar ao fim atual
    IF v_trial_fim_atual > timezone('utc'::text, now()) THEN
        v_novo_trial_fim := v_trial_fim_atual + (p_dias || ' days')::INTERVAL;
    ELSE
        v_novo_trial_fim := timezone('utc'::text, now()) + (p_dias || ' days')::INTERVAL;
    END IF;

    -- Atualizar barbearia mantendo histórico
    UPDATE public.barbearias
    SET trial_fim = v_novo_trial_fim,
        status_assinatura = 'trial',
        atualizado_em = timezone('utc'::text, now())
    WHERE id = p_barbearia_id;

    -- Registrar o benefício
    INSERT INTO public.beneficios_assinatura (
        barbearia_id, tipo, dias_concedidos, motivo, concedido_por
    )
    VALUES (
        p_barbearia_id, 'extensao_trial', p_dias, p_motivo, auth.uid()
    );

    -- Registrar na trilha de auditoria
    INSERT INTO public.logs_auditoria (
        usuario_id, barbearia_id, acao, entidade, entidade_id, dados_anteriores, dados_novos
    )
    VALUES (
        auth.uid(),
        p_barbearia_id,
        'conceder_extensao_trial',
        'barbearias',
        p_barbearia_id,
        jsonb_build_object('trial_fim_anterior', v_trial_fim_atual),
        jsonb_build_object('novo_trial_fim', v_novo_trial_fim, 'dias', p_dias, 'motivo', p_motivo)
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Processar Confirmação de Pagamento de Assinatura (Mercado Pago Idempotente)
CREATE OR REPLACE FUNCTION public.processar_confirmacao_pagamento_assinatura(
    p_barbearia_id UUID,
    p_plano_id UUID,
    p_ciclo TEXT,
    p_valor NUMERIC(10,2),
    p_mp_payment_id TEXT
)
RETURNS UUID AS $$
DECLARE
    v_assinatura_id UUID;
    v_meses_adicionar INTEGER;
    v_data_inicio TIMESTAMPTZ := timezone('utc'::text, now());
    v_data_fim TIMESTAMPTZ;
BEGIN
    -- Idempotência: verificar se o pagamento já foi registrado
    IF p_mp_payment_id IS NOT NULL THEN
        SELECT id INTO v_assinatura_id
        FROM public.assinaturas
        WHERE mercado_pago_payment_id = p_mp_payment_id;

        IF FOUND THEN
            RETURN v_assinatura_id; -- Retorna registro existente sem duplicar
        END IF;
    END IF;

    -- Determinar vigência
    IF p_ciclo = 'semestral' THEN
        v_meses_adicionar := 6;
    ELSE
        v_meses_adicionar := 1;
    END IF;

    v_data_fim := v_data_inicio + (v_meses_adicionar || ' months')::INTERVAL;

    -- Inserir assinatura ativa
    INSERT INTO public.assinaturas (
        barbearia_id, plano_id, ciclo, status, data_inicio, data_fim,
        mercado_pago_payment_id, valor
    )
    VALUES (
        p_barbearia_id, p_plano_id, p_ciclo, 'ativa', v_data_inicio, v_data_fim,
        p_mp_payment_id, p_valor
    )
    RETURNING id INTO v_assinatura_id;

    -- Atualizar status da barbearia
    UPDATE public.barbearias
    SET status_assinatura = 'ativa',
        atualizado_em = timezone('utc'::text, now())
    WHERE id = p_barbearia_id;

    -- Auditoria
    INSERT INTO public.logs_auditoria (
        usuario_id, barbearia_id, acao, entidade, entidade_id, dados_novos
    )
    VALUES (
        auth.uid(),
        p_barbearia_id,
        'ativar_assinatura',
        'assinaturas',
        v_assinatura_id,
        jsonb_build_object(
            'plano_id', p_plano_id,
            'ciclo', p_ciclo,
            'valor', p_valor,
            'mp_payment_id', p_mp_payment_id,
            'data_fim', v_data_fim
        )
    );

    RETURN v_assinatura_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: Obter Métricas Globais para o Admin
CREATE OR REPLACE FUNCTION public.obter_metricas_admin_global()
RETURNS JSONB AS $$
DECLARE
    v_total_barbearias INTEGER := 0;
    v_barbearias_ativas INTEGER := 0;
    v_barbearias_trial INTEGER := 0;
    v_total_assinantes INTEGER := 0;
    v_mrr_estimado NUMERIC(10,2) := 0.00;
    v_total_agendamentos INTEGER := 0;
    v_total_usuarios INTEGER := 0;
BEGIN
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status_assinatura = 'ativa'),
        COUNT(*) FILTER (WHERE status_assinatura = 'trial')
    INTO
        v_total_barbearias,
        v_barbearias_ativas,
        v_barbearias_trial
    FROM public.barbearias;

    -- Assinaturas ativas e MRR
    SELECT
        COUNT(*),
        COALESCE(
            SUM(
                CASE
                    WHEN ciclo = 'semestral' THEN ROUND(valor / 6.0, 2)
                    ELSE valor
                END
            ),
            0.00
        )
    INTO
        v_total_assinantes,
        v_mrr_estimado
    FROM public.assinaturas
    WHERE status = 'ativa';

    -- Agendamentos globais
    SELECT COUNT(*) INTO v_total_agendamentos FROM public.agendamentos;

    -- Usuários cadastrados
    SELECT COUNT(*) INTO v_total_usuarios FROM public.usuarios;

    RETURN jsonb_build_object(
        'total_barbearias', v_total_barbearias,
        'barbearias_ativas', v_barbearias_ativas,
        'barbearias_trial', v_barbearias_trial,
        'total_assinantes', v_total_assinantes,
        'mrr_estimado', v_mrr_estimado,
        'total_agendamentos', v_total_agendamentos,
        'total_usuarios', v_total_usuarios
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
