-- Migration: 20260928000000_tokenizacao_recorrencia_barbearias.sql
-- Descrição: Suporte a tokenização de cartão de crédito e renovação automática de assinatura via Mercado Pago.

ALTER TABLE public.barbearias
ADD COLUMN IF NOT EXISTS mercado_pago_customer_id TEXT,
ADD COLUMN IF NOT EXISTS mercado_pago_card_id TEXT,
ADD COLUMN IF NOT EXISTS mercado_pago_card_last_four TEXT,
ADD COLUMN IF NOT EXISTS mercado_pago_card_brand TEXT,
ADD COLUMN IF NOT EXISTS recorrencia_ativa BOOLEAN NOT NULL DEFAULT false;

-- Índice para busca rápida de barbearias com renovação automática ativa
CREATE INDEX IF NOT EXISTS idx_barbearias_recorrencia ON public.barbearias(recorrencia_ativa) WHERE recorrencia_ativa = true;
