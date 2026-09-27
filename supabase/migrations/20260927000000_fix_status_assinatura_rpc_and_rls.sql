-- Migration: 20260927000000_fix_status_assinatura_rpc_and_rls.sql
-- Correção da RPC processar_confirmacao_pagamento_assinatura para usar 'ativo' (masculino) e permissões RLS em assinaturas.

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
        mercado_pago_payment_id, valor
    )
    VALUES (
        p_barbearia_id, p_plano_id, p_ciclo, 'ativa', v_data_inicio, v_data_fim,
        p_mp_payment_id, p_valor
    )
    RETURNING id INTO v_assinatura_id;

    -- Atualizar status da barbearia para 'ativo' (conforme barbearias_status_assinatura_check)
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
        'contratar_assinatura',
        'assinaturas',
        v_assinatura_id,
        jsonb_build_object('plano_id', p_plano_id, 'ciclo', p_ciclo, 'valor', p_valor)
    );

    RETURN v_assinatura_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas adicionais RLS para public.assinaturas
DROP POLICY IF EXISTS "Membros gestores podem inserir assinaturas" ON public.assinaturas;
CREATE POLICY "Membros gestores podem inserir assinaturas"
    ON public.assinaturas
    FOR INSERT
    TO authenticated
    WITH CHECK (public.usuario_eh_membro(barbearia_id));

DROP POLICY IF EXISTS "Membros gestores podem atualizar assinaturas" ON public.assinaturas;
CREATE POLICY "Membros gestores podem atualizar assinaturas"
    ON public.assinaturas
    FOR UPDATE
    TO authenticated
    USING (public.usuario_eh_membro(barbearia_id));
