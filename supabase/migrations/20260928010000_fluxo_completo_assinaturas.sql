-- Migration: 20260928010000_fluxo_completo_assinaturas.sql
-- Descrição: Estrutura para controle de assinatura com tokenização, cálculo de upgrade pró-rata e cancelamento programado.

-- 1. Novos campos na tabela de barbearias
ALTER TABLE public.barbearias 
  ADD COLUMN IF NOT EXISTS mercado_pago_card_first_four VARCHAR(4),
  ADD COLUMN IF NOT EXISTS mercado_pago_card_expiration VARCHAR(7),
  ADD COLUMN IF NOT EXISTS cancelamento_agendado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ;

-- 2. Função RPC para cálculo de pró-rata de Upgrade
CREATE OR REPLACE FUNCTION public.calcular_prorata_upgrade(
  p_barbearia_id UUID,
  p_novo_plano_id UUID,
  p_novo_ciclo VARCHAR DEFAULT 'mensal'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ass RECORD;
  v_novo_plano RECORD;
  v_dias_totais NUMERIC := 30;
  v_dias_restantes NUMERIC := 0;
  v_valor_diario NUMERIC := 0;
  v_credito_restante NUMERIC := 0;
  v_preco_novo_plano NUMERIC := 0;
  v_valor_a_pagar NUMERIC := 0;
BEGIN
  -- Buscar novo plano
  SELECT * INTO v_novo_plano FROM public.planos WHERE id = p_novo_plano_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Novo plano não encontrado';
  END IF;

  IF p_novo_ciclo = 'semestral' THEN
    v_preco_novo_plano := v_novo_plano.preco_semestral;
  ELSE
    v_preco_novo_plano := v_novo_plano.preco_mensal;
  END IF;

  -- Buscar assinatura ativa atual
  SELECT * INTO v_ass 
  FROM public.assinaturas 
  WHERE barbearia_id = p_barbearia_id AND status = 'ativa'
  ORDER BY criado_em DESC
  LIMIT 1;

  IF FOUND AND v_ass.data_fim > NOW() THEN
    IF v_ass.ciclo = 'semestral' THEN
      v_dias_totais := 180;
    ELSE
      v_dias_totais := 30;
    END IF;

    -- Dias restantes inteiros
    v_dias_restantes := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_ass.data_fim - NOW())) / 86400));
    
    -- Valor diário proporcional ao valor pago
    v_valor_diario := (v_ass.valor / NULLIF(v_dias_totais, 0));
    v_credito_restante := ROUND((v_valor_diario * v_dias_restantes)::numeric, 2);
    v_credito_restante := LEAST(v_ass.valor, GREATEST(0, v_credito_restante));
  END IF;

  v_valor_a_pagar := GREATEST(0, ROUND((v_preco_novo_plano - v_credito_restante)::numeric, 2));

  RETURN json_build_object(
    'dias_restantes', v_dias_restantes,
    'credito_restante', v_credito_restante,
    'preco_novo_plano', v_preco_novo_plano,
    'valor_a_pagar', v_valor_a_pagar
  );
END;
$$;

-- 3. Função RPC para executar upgrade e iniciar novo ciclo completo
CREATE OR REPLACE FUNCTION public.executar_upgrade_assinatura(
  p_barbearia_id UUID,
  p_novo_plano_id UUID,
  p_novo_ciclo VARCHAR DEFAULT 'mensal',
  p_valor_cobrado NUMERIC DEFAULT 0,
  p_mp_payment_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duracao INTERVAL;
  v_nova_ass_id UUID;
BEGIN
  IF p_novo_ciclo = 'semestral' THEN
    v_duracao := INTERVAL '180 days';
  ELSE
    v_duracao := INTERVAL '30 days';
  END IF;

  -- 1. Encerrar assinatura anterior caso exista
  UPDATE public.assinaturas
  SET status = 'cancelada',
      data_cancelamento = NOW(),
      atualizado_em = NOW()
  WHERE barbearia_id = p_barbearia_id AND status = 'ativa';

  -- 2. Criar nova assinatura com novo ciclo cheio a partir de agora
  INSERT INTO public.assinaturas (
    barbearia_id,
    plano_id,
    ciclo,
    status,
    data_inicio,
    data_fim,
    valor,
    mercado_pago_payment_id,
    criado_em,
    atualizado_em
  ) VALUES (
    p_barbearia_id,
    p_novo_plano_id,
    p_novo_ciclo,
    'ativa',
    NOW(),
    NOW() + v_duracao,
    p_valor_cobrado,
    p_mp_payment_id,
    NOW(),
    NOW()
  ) RETURNING id INTO v_nova_ass_id;

  -- 3. Atualizar status e flags da barbearia
  UPDATE public.barbearias
  SET status_assinatura = 'ativa',
      cancelamento_agendado = false,
      cancelado_em = NULL,
      recorrencia_ativa = true,
      atualizado_em = NOW()
  WHERE id = p_barbearia_id;

  RETURN json_build_object(
    'sucesso', true,
    'assinatura_id', v_nova_ass_id
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.calcular_prorata_upgrade TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.executar_upgrade_assinatura TO anon, authenticated, service_role;
