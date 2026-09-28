-- Migration: 20260928030000_rastreamento_uso_cupons.sql
-- Descrição: Permitir influenciador_id nulo em indicacoes e criar RPC registrar_uso_cupom

-- 1. Permitir influenciador_id nulo em indicacoes para cupons diretos
ALTER TABLE public.indicacoes ALTER COLUMN influenciador_id DROP NOT NULL;

-- 2. RPC Atômica para registro de uso de cupom e indicação
CREATE OR REPLACE FUNCTION public.registrar_uso_cupom(
    p_barbearia_id UUID,
    p_cupom_id UUID,
    p_agendamento_id UUID,
    p_cliente_id UUID,
    p_codigo TEXT,
    p_influenciador_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Incrementar contador de usos no cupom
    IF p_cupom_id IS NOT NULL THEN
        UPDATE public.cupons
        SET usos_atuais = usos_atuais + 1,
            updated_at = now()
        WHERE id = p_cupom_id;
    END IF;

    -- 2. Inserir registro de atribuição / indicação
    INSERT INTO public.indicacoes (
        barbearia_id,
        influenciador_id,
        cupom_id,
        agendamento_id,
        cliente_id,
        codigo_ref_usado,
        status
    )
    VALUES (
        p_barbearia_id,
        p_influenciador_id,
        p_cupom_id,
        p_agendamento_id,
        p_cliente_id,
        UPPER(p_codigo),
        'pendente'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_uso_cupom TO anon, authenticated;
