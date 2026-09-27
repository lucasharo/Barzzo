-- Migration: 20260927000001_fix_mercadopago_preapproval_rpc.sql
-- Descrição: Tabela idempotente de webhooks do Mercado Pago e RPC aprimorado de processamento de preapproval/assinatura

-- 1. Tabela de auditoria e idempotência de eventos de Webhook do Mercado Pago
CREATE TABLE IF NOT EXISTS public.eventos_webhook_mercadopago (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id VARCHAR(255) UNIQUE NOT NULL,
    tipo VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.eventos_webhook_mercadopago ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Webhook log acessivel apenas por service role" ON public.eventos_webhook_mercadopago;
CREATE POLICY "Webhook log acessivel apenas por service role"
    ON public.eventos_webhook_mercadopago
    FOR ALL
    TO authenticated
    USING ((auth.jwt()->>'role')::text = 'service_role');

-- 2. Atualizar RPC de confirmação de assinatura para suportar preapproval_id e payment_id
CREATE OR REPLACE FUNCTION public.processar_confirmacao_pagamento_assinatura(
    p_barbearia_id UUID,
    p_plano_id UUID,
    p_ciclo TEXT,
    p_valor NUMERIC(10,2),
    p_mp_payment_id TEXT,
    p_mp_subscription_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_assinatura_id UUID;
    v_meses_adicionar INTEGER;
    v_data_inicio TIMESTAMPTZ := timezone('utc'::text, now());
    v_data_fim TIMESTAMPTZ;
BEGIN
    -- Idempotência: verificar se o pagamento ou assinatura já foi registrado
    IF p_mp_payment_id IS NOT NULL THEN
        SELECT id INTO v_assinatura_id
        FROM public.assinaturas
        WHERE mercado_pago_payment_id = p_mp_payment_id;

        IF FOUND THEN
            RETURN v_assinatura_id;
        END IF;
    END IF;

    IF p_mp_subscription_id IS NOT NULL THEN
        SELECT id INTO v_assinatura_id
        FROM public.assinaturas
        WHERE mercado_pago_subscription_id = p_mp_subscription_id AND status = 'ativa';

        IF FOUND THEN
            RETURN v_assinatura_id;
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
        mercado_pago_payment_id, mercado_pago_subscription_id, valor
    )
    VALUES (
        p_barbearia_id, p_plano_id, p_ciclo, 'ativa', v_data_inicio, v_data_fim,
        p_mp_payment_id, p_mp_subscription_id, p_valor
    )
    RETURNING id INTO v_assinatura_id;

    -- Atualizar status da barbearia para ativo
    UPDATE public.barbearias
    SET status_assinatura = 'ativo',
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
            'mp_subscription_id', p_mp_subscription_id,
            'data_fim', v_data_fim
        )
    );

    RETURN v_assinatura_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
