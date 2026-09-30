-- TASK-11: Revisão de cupons, atribuição comercial e comissões.
-- Migration incremental: a migration histórica da Task 08 não é alterada.

-- ============================================================================
-- 1. Modelo de cupom e regras/faixas
-- ============================================================================

ALTER TABLE public.cupons
    ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'BARBEARIA',
    ADD COLUMN IF NOT EXISTS influenciador_id UUID REFERENCES public.influenciadores(id) ON DELETE SET NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cupons_origem_check'
    ) THEN
        ALTER TABLE public.cupons
            ADD CONSTRAINT cupons_origem_check
            CHECK (origem IN ('BARBEARIA', 'INFLUENCIADOR', 'BARZZO_GLOBAL'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cupons_influenciador ON public.cupons (influenciador_id);
CREATE INDEX IF NOT EXISTS idx_cupons_origem_ativo ON public.cupons (origem, ativo);

-- Migra a associação conhecida da Task 08 sem remover cupom_padrao_id.
UPDATE public.cupons c
SET origem = 'INFLUENCIADOR', influenciador_id = i.id
FROM public.influenciadores i
WHERE i.cupom_padrao_id = c.id
  AND i.barbearia_id = c.barbearia_id
  AND c.influenciador_id IS NULL;

CREATE TABLE IF NOT EXISTS public.cupons_regras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cupom_id UUID NOT NULL REFERENCES public.cupons(id) ON DELETE CASCADE,
    prioridade INTEGER NOT NULL DEFAULT 100,
    escopo_historico TEXT NOT NULL DEFAULT 'BARBEARIA'
        CHECK (escopo_historico IN ('BARBEARIA', 'GLOBAL_BARZZO')),
    atendimentos_minimos INTEGER CHECK (atendimentos_minimos IS NULL OR atendimentos_minimos >= 0),
    atendimentos_maximos INTEGER CHECK (atendimentos_maximos IS NULL OR atendimentos_maximos >= 0),
    tipo_desconto TEXT NOT NULL CHECK (tipo_desconto IN ('percentual', 'valor_fixo')),
    valor_desconto NUMERIC(10,2) NOT NULL CHECK (valor_desconto > 0),
    valor_minimo_reserva NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (valor_minimo_reserva >= 0),
    limite_usos_total INTEGER CHECK (limite_usos_total IS NULL OR limite_usos_total > 0),
    limite_usos_por_cliente INTEGER CHECK (limite_usos_por_cliente IS NULL OR limite_usos_por_cliente > 0),
    servicos_elegiveis UUID[] NOT NULL DEFAULT '{}'::UUID[],
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT cupons_regras_faixa_check CHECK (
        atendimentos_minimos IS NULL OR atendimentos_maximos IS NULL OR atendimentos_minimos <= atendimentos_maximos
    ),
    CONSTRAINT cupons_regras_percentual_check CHECK (
        tipo_desconto <> 'percentual' OR valor_desconto <= 100
    )
);

CREATE INDEX IF NOT EXISTS idx_cupons_regras_cupom_prioridade
    ON public.cupons_regras (cupom_id, prioridade, ativo);

-- Backfill de uma regra equivalente às colunas legadas para cada cupom.
INSERT INTO public.cupons_regras (
    cupom_id, prioridade, escopo_historico, atendimentos_minimos,
    atendimentos_maximos, tipo_desconto, valor_desconto, valor_minimo_reserva,
    limite_usos_total, limite_usos_por_cliente, servicos_elegiveis, ativo
)
SELECT
    c.id,
    100,
    'BARBEARIA',
    CASE WHEN c.apenas_primeira_reserva THEN 0 ELSE NULL END,
    CASE WHEN c.apenas_primeira_reserva THEN 0 ELSE NULL END,
    c.tipo_desconto,
    c.valor_desconto,
    COALESCE(c.valor_minimo_reserva, 0),
    c.limite_usos_total,
    c.limite_usos_por_cliente,
    COALESCE(c.servicos_elegiveis, '{}'::UUID[]),
    c.ativo
FROM public.cupons c
WHERE NOT EXISTS (SELECT 1 FROM public.cupons_regras r WHERE r.cupom_id = c.id);

-- ============================================================================
-- 2. Histórico individual de utilização
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cupons_utilizacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cupom_id UUID NOT NULL REFERENCES public.cupons(id) ON DELETE RESTRICT,
    regra_id UUID REFERENCES public.cupons_regras(id) ON DELETE SET NULL,
    cliente_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'reservado'
        CHECK (status IN ('reservado', 'consumido', 'liberado', 'cancelado')),
    valor_bruto NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (valor_bruto >= 0),
    subtotal_elegivel NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (subtotal_elegivel >= 0),
    valor_desconto NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (valor_desconto >= 0),
    regra_aplicada JSONB NOT NULL DEFAULT '{}'::JSONB,
    reservado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    consumido_em TIMESTAMPTZ,
    liberado_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT cupons_utilizacoes_agendamento_unico UNIQUE (agendamento_id)
);

CREATE INDEX IF NOT EXISTS idx_cupons_utilizacoes_cupom_status
    ON public.cupons_utilizacoes (cupom_id, status);
CREATE INDEX IF NOT EXISTS idx_cupons_utilizacoes_cliente_status
    ON public.cupons_utilizacoes (cliente_id, status);

-- ============================================================================
-- 3. Snapshot comercial do agendamento e comissão
-- ============================================================================

ALTER TABLE public.agendamentos
    ADD COLUMN IF NOT EXISTS cupom_id UUID REFERENCES public.cupons(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS codigo_cupom_snapshot TEXT,
    ADD COLUMN IF NOT EXISTS origem_cupom_snapshot TEXT,
    ADD COLUMN IF NOT EXISTS influenciador_id_snapshot UUID REFERENCES public.influenciadores(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS influenciador_nome_snapshot TEXT,
    ADD COLUMN IF NOT EXISTS valor_bruto_servicos_snapshot NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS subtotal_elegivel_snapshot NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS desconto_snapshot NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS valor_liquido_snapshot NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS cupom_regra_id UUID REFERENCES public.cupons_regras(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cupom_regra_snapshot JSONB,
    ADD COLUMN IF NOT EXISTS tipo_comissao_snapshot TEXT,
    ADD COLUMN IF NOT EXISTS taxa_comissao_snapshot NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS valor_comissao_snapshot NUMERIC(10,2);

ALTER TABLE public.comissoes_influenciadores
    ADD COLUMN IF NOT EXISTS cupom_id UUID REFERENCES public.cupons(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS codigo_cupom TEXT,
    ADD COLUMN IF NOT EXISTS origem_cupom TEXT,
    ADD COLUMN IF NOT EXISTS subtotal_elegivel NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_indicacoes_agendamento_unico
    ON public.indicacoes (agendamento_id) WHERE agendamento_id IS NOT NULL;

-- Backfill mínimo de reservas já atribuídas pela Task 08. Novas reservas nunca
-- consultam ref ou a configuração atual na conclusão.
UPDATE public.agendamentos a
SET cupom_id = i.cupom_id,
    codigo_cupom_snapshot = c.codigo,
    origem_cupom_snapshot = c.origem,
    influenciador_id_snapshot = c.influenciador_id,
    influenciador_nome_snapshot = inf.nome,
    valor_bruto_servicos_snapshot = COALESCE(a.preco_total, 0),
    subtotal_elegivel_snapshot = COALESCE(a.preco_total, 0),
    desconto_snapshot = 0,
    valor_liquido_snapshot = COALESCE(a.preco_total, 0),
    tipo_comissao_snapshot = inf.tipo_comissao,
    taxa_comissao_snapshot = inf.valor_comissao,
    valor_comissao_snapshot = CASE
        WHEN inf.tipo_comissao = 'percentual' THEN ROUND((a.preco_total * inf.valor_comissao) / 100, 2)
        ELSE inf.valor_comissao
    END
FROM public.indicacoes i
LEFT JOIN public.cupons c ON c.id = i.cupom_id
LEFT JOIN public.influenciadores inf ON inf.id = i.influenciador_id
WHERE i.agendamento_id = a.id
  AND i.cupom_id IS NOT NULL
  AND c.influenciador_id IS NOT NULL
  AND a.cupom_id IS NULL;

-- ============================================================================
-- 4. RLS e helpers
-- ============================================================================

ALTER TABLE public.cupons_regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupons_utilizacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública das regras de cupons ativos"
    ON public.cupons_regras FOR SELECT TO anon, authenticated
    USING (EXISTS (
        SELECT 1 FROM public.cupons c
        WHERE c.id = cupom_id AND c.ativo = true
    ));

CREATE POLICY "Membros gerenciam regras de cupons da barbearia"
    ON public.cupons_regras FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.cupons c
        WHERE c.id = cupom_id AND public.usuario_eh_membro_equipe(c.barbearia_id, auth.uid())
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.cupons c
        WHERE c.id = cupom_id AND public.usuario_eh_membro_equipe(c.barbearia_id, auth.uid())
    ));

CREATE POLICY "Membros visualizam utilizações da barbearia"
    ON public.cupons_utilizacoes FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.cupons c
        WHERE c.id = cupom_id AND public.usuario_eh_membro_equipe(c.barbearia_id, auth.uid())
    ));

-- ============================================================================
-- 5. Confirmação atômica de cupom
-- ============================================================================

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
SET search_path = ''
AS $$
DECLARE
    v_agendamento public.agendamentos%ROWTYPE;
    v_cupom public.cupons%ROWTYPE;
    v_regra public.cupons_regras%ROWTYPE;
    v_influenciador public.influenciadores%ROWTYPE;
    v_total_anterior_barbearia INTEGER;
    v_total_anterior_global INTEGER;
    v_total_usos INTEGER;
    v_usos_cliente INTEGER;
    v_bruto NUMERIC(10,2);
    v_elegivel NUMERIC(10,2);
    v_desconto NUMERIC(10,2);
    v_liquido NUMERIC(10,2);
    v_comissao NUMERIC(10,2);
    v_codigo TEXT := UPPER(TRIM(p_codigo));
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_cliente_id THEN
        IF NOT public.usuario_eh_membro_equipe(p_barbearia_id, auth.uid()) THEN
            RAISE EXCEPTION 'Usuário não autorizado a confirmar este cupom.';
        END IF;
    END IF;

    SELECT * INTO v_agendamento
    FROM public.agendamentos
    WHERE id = p_agendamento_id
      AND barbearia_id = p_barbearia_id
      AND cliente_id = p_cliente_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agendamento não encontrado para confirmar o cupom.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.cupons_utilizacoes u
        WHERE u.agendamento_id = p_agendamento_id
          AND u.status IN ('reservado', 'consumido')
    ) OR v_agendamento.cupom_id IS NOT NULL THEN
        RETURN;
    END IF;

    IF p_cupom_id IS NOT NULL THEN
        SELECT * INTO v_cupom FROM public.cupons
        WHERE id = p_cupom_id AND barbearia_id = p_barbearia_id FOR UPDATE;
    ELSE
        SELECT * INTO v_cupom FROM public.cupons
        WHERE barbearia_id = p_barbearia_id AND UPPER(codigo) = v_codigo FOR UPDATE;
    END IF;

    IF NOT FOUND OR v_cupom.ativo = false THEN
        RAISE EXCEPTION 'Cupom não encontrado ou inativo.';
    END IF;
    IF UPPER(v_cupom.codigo) <> v_codigo THEN
        RAISE EXCEPTION 'O código informado não corresponde ao cupom selecionado.';
    END IF;
    IF timezone('utc'::text, now()) < v_cupom.data_inicio OR timezone('utc'::text, now()) > v_cupom.data_fim THEN
        RAISE EXCEPTION 'Este cupom está fora do período de validade.';
    END IF;

    SELECT COALESCE(SUM(s.preco), 0)::NUMERIC(10,2) INTO v_bruto
    FROM public.agendamentos_servicos s WHERE s.agendamento_id = p_agendamento_id;
    SELECT COUNT(*) INTO v_total_anterior_barbearia
    FROM public.agendamentos a
    WHERE a.cliente_id = p_cliente_id AND a.barbearia_id = p_barbearia_id AND a.status = 'concluido';
    SELECT COUNT(*) INTO v_total_anterior_global
    FROM public.agendamentos a
    WHERE a.cliente_id = p_cliente_id AND a.status = 'concluido';

    SELECT * INTO v_regra
    FROM public.cupons_regras r
    WHERE r.cupom_id = v_cupom.id AND r.ativo = true
      AND (r.atendimentos_minimos IS NULL OR
           (CASE WHEN r.escopo_historico = 'GLOBAL_BARZZO' THEN v_total_anterior_global ELSE v_total_anterior_barbearia END) >= r.atendimentos_minimos)
      AND (r.atendimentos_maximos IS NULL OR
           (CASE WHEN r.escopo_historico = 'GLOBAL_BARZZO' THEN v_total_anterior_global ELSE v_total_anterior_barbearia END) <= r.atendimentos_maximos)
      AND v_bruto >= r.valor_minimo_reserva
    ORDER BY r.prioridade ASC, r.id ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Nenhuma regra deste cupom é válida para o histórico e os serviços selecionados.';
    END IF;

    SELECT COALESCE(SUM(s.preco) FILTER (
        WHERE COALESCE(cardinality(v_regra.servicos_elegiveis), 0) = 0
           OR s.servico_id = ANY(v_regra.servicos_elegiveis)
    ), 0)::NUMERIC(10,2) INTO v_elegivel
    FROM public.agendamentos_servicos s WHERE s.agendamento_id = p_agendamento_id;

    SELECT COUNT(*) INTO v_total_usos FROM public.cupons_utilizacoes u
    WHERE u.cupom_id = v_cupom.id AND u.status IN ('reservado', 'consumido');
    IF v_regra.limite_usos_total IS NOT NULL AND v_total_usos >= v_regra.limite_usos_total THEN
        RAISE EXCEPTION 'O limite total deste cupom foi atingido.';
    END IF;

    SELECT COUNT(*) INTO v_usos_cliente FROM public.cupons_utilizacoes u
    WHERE u.cupom_id = v_cupom.id AND u.cliente_id = p_cliente_id AND u.status IN ('reservado', 'consumido');
    IF v_regra.limite_usos_por_cliente IS NOT NULL AND v_usos_cliente >= v_regra.limite_usos_por_cliente THEN
        RAISE EXCEPTION 'Você já atingiu o limite de uso deste cupom.';
    END IF;

    IF v_regra.tipo_desconto = 'percentual' THEN
        v_desconto := ROUND((v_elegivel * v_regra.valor_desconto) / 100, 2);
    ELSE
        v_desconto := v_regra.valor_desconto;
    END IF;
    v_desconto := LEAST(v_elegivel, GREATEST(0, v_desconto));
    v_liquido := GREATEST(0, v_bruto - v_desconto);

    IF v_cupom.influenciador_id IS NOT NULL THEN
        SELECT * INTO v_influenciador FROM public.influenciadores i
        WHERE i.id = v_cupom.influenciador_id AND i.barbearia_id = p_barbearia_id AND i.ativo = true;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Este cupom não está disponível para novas atribuições.';
        END IF;
        IF v_influenciador.tipo_comissao = 'percentual' THEN
            v_comissao := ROUND((v_liquido * v_influenciador.valor_comissao) / 100, 2);
        ELSE
            v_comissao := v_influenciador.valor_comissao;
        END IF;
    END IF;

    PERFORM set_config('barzzo.comercial_rpc', 'true', true);
    UPDATE public.agendamentos SET
        preco_total = v_liquido,
        cupom_id = v_cupom.id,
        codigo_cupom_snapshot = v_cupom.codigo,
        origem_cupom_snapshot = v_cupom.origem,
        influenciador_id_snapshot = v_cupom.influenciador_id,
        influenciador_nome_snapshot = v_influenciador.nome,
        valor_bruto_servicos_snapshot = v_bruto,
        subtotal_elegivel_snapshot = v_elegivel,
        desconto_snapshot = v_desconto,
        valor_liquido_snapshot = v_liquido,
        cupom_regra_id = v_regra.id,
        cupom_regra_snapshot = to_jsonb(v_regra),
        tipo_comissao_snapshot = v_influenciador.tipo_comissao,
        taxa_comissao_snapshot = v_influenciador.valor_comissao,
        valor_comissao_snapshot = v_comissao
    WHERE id = p_agendamento_id;

    INSERT INTO public.cupons_utilizacoes (
        cupom_id, regra_id, cliente_id, agendamento_id, status,
        valor_bruto, subtotal_elegivel, valor_desconto, regra_aplicada, consumido_em
    ) VALUES (
        v_cupom.id, v_regra.id, p_cliente_id, p_agendamento_id, 'consumido',
        v_bruto, v_elegivel, v_desconto, to_jsonb(v_regra), timezone('utc'::text, now())
    );

    INSERT INTO public.indicacoes (
        barbearia_id, influenciador_id, cupom_id, agendamento_id, cliente_id,
        codigo_ref_usado, status
    ) VALUES (
        p_barbearia_id, v_cupom.influenciador_id, v_cupom.id, p_agendamento_id,
        p_cliente_id, v_cupom.codigo, 'pendente'
    ) ON CONFLICT (agendamento_id) DO NOTHING;

    UPDATE public.cupons SET usos_atuais = (
        SELECT COUNT(*) FROM public.cupons_utilizacoes u
        WHERE u.cupom_id = public.cupons.id AND u.status IN ('reservado', 'consumido')
    ), updated_at = timezone('utc'::text, now()) WHERE id = v_cupom.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_uso_cupom(UUID, UUID, UUID, UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_uso_cupom(UUID, UUID, UUID, UUID, TEXT, UUID) TO authenticated;

-- ============================================================================
-- 6. Comissão por snapshot e liberação de uso
-- ============================================================================

CREATE OR REPLACE FUNCTION public.processar_comissao_conclusao_atendimento(p_agendamento_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_agendamento public.agendamentos%ROWTYPE;
    v_indicacao_id UUID;
BEGIN
    SELECT * INTO v_agendamento FROM public.agendamentos
    WHERE id = p_agendamento_id FOR UPDATE;
    IF NOT FOUND OR v_agendamento.status <> 'concluido' THEN
        RETURN;
    END IF;
    IF auth.uid() IS NOT NULL
       AND NOT public.usuario_eh_membro_equipe(v_agendamento.barbearia_id, auth.uid()) THEN
        RAISE EXCEPTION 'Usuário não autorizado a processar a comissão.';
    END IF;
    IF v_agendamento.influenciador_id_snapshot IS NULL
       OR v_agendamento.tipo_comissao_snapshot IS NULL
       OR v_agendamento.valor_comissao_snapshot IS NULL THEN
        RETURN;
    END IF;

    SELECT i.id INTO v_indicacao_id FROM public.indicacoes i
    WHERE i.agendamento_id = p_agendamento_id
      AND i.influenciador_id = v_agendamento.influenciador_id_snapshot
    LIMIT 1;

    INSERT INTO public.comissoes_influenciadores (
        barbearia_id, influenciador_id, indicacao_id, agendamento_id,
        cupom_id, codigo_cupom, origem_cupom, valor_servicos,
        subtotal_elegivel, valor_liquido, tipo_comissao, taxa_comissao,
        valor_comissao, status
    ) VALUES (
        v_agendamento.barbearia_id, v_agendamento.influenciador_id_snapshot,
        v_indicacao_id, p_agendamento_id, v_agendamento.cupom_id,
        v_agendamento.codigo_cupom_snapshot, v_agendamento.origem_cupom_snapshot,
        COALESCE(v_agendamento.valor_bruto_servicos_snapshot, v_agendamento.preco_total),
        COALESCE(v_agendamento.subtotal_elegivel_snapshot, v_agendamento.preco_total),
        COALESCE(v_agendamento.valor_liquido_snapshot, v_agendamento.preco_total),
        v_agendamento.tipo_comissao_snapshot, v_agendamento.taxa_comissao_snapshot,
        v_agendamento.valor_comissao_snapshot, 'pendente'
    ) ON CONFLICT (agendamento_id) DO NOTHING;

    UPDATE public.indicacoes SET status = 'concluido'
    WHERE agendamento_id = p_agendamento_id AND influenciador_id = v_agendamento.influenciador_id_snapshot;
END;
$$;

GRANT EXECUTE ON FUNCTION public.processar_comissao_conclusao_atendimento(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.processar_comissao_conclusao_atendimento(UUID) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.liberar_uso_cupom_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.status IN ('cancelado', 'nao_compareceu')
       AND OLD.status NOT IN ('cancelado', 'nao_compareceu') THEN
        UPDATE public.cupons_utilizacoes
        SET status = 'liberado', liberado_em = timezone('utc'::text, now()), atualizado_em = timezone('utc'::text, now())
        WHERE agendamento_id = NEW.id AND status IN ('reservado', 'consumido');
        UPDATE public.comissoes_influenciadores
        SET status = 'cancelada', updated_at = timezone('utc'::text, now())
        WHERE agendamento_id = NEW.id AND status = 'pendente';
        UPDATE public.indicacoes SET status = 'cancelado' WHERE agendamento_id = NEW.id;
        UPDATE public.cupons c SET usos_atuais = (
            SELECT COUNT(*) FROM public.cupons_utilizacoes u
            WHERE u.cupom_id = c.id AND u.status IN ('reservado', 'consumido')
        ) WHERE c.id = NEW.cupom_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.disparar_comissao_agendamento_concluido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.status = 'concluido' AND OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM public.processar_comissao_conclusao_atendimento(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_liberar_uso_cupom ON public.agendamentos;
CREATE TRIGGER trigger_liberar_uso_cupom
    AFTER UPDATE OF status ON public.agendamentos
    FOR EACH ROW EXECUTE FUNCTION public.liberar_uso_cupom_agendamento();

DROP TRIGGER IF EXISTS trigger_comissao_agendamento_concluido ON public.agendamentos;
CREATE TRIGGER trigger_comissao_agendamento_concluido
    AFTER UPDATE OF status ON public.agendamentos
    FOR EACH ROW EXECUTE FUNCTION public.disparar_comissao_agendamento_concluido();

-- ============================================================================
-- 7. Proteção do snapshot e preenchimento sem cupom
-- ============================================================================

CREATE OR REPLACE FUNCTION public.proteger_snapshot_comercial_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.cupom_id := NULL;
        NEW.codigo_cupom_snapshot := NULL;
        NEW.origem_cupom_snapshot := NULL;
        NEW.influenciador_id_snapshot := NULL;
        NEW.influenciador_nome_snapshot := NULL;
        NEW.valor_bruto_servicos_snapshot := NULL;
        NEW.subtotal_elegivel_snapshot := NULL;
        NEW.desconto_snapshot := NULL;
        NEW.valor_liquido_snapshot := NULL;
        NEW.cupom_regra_id := NULL;
        NEW.cupom_regra_snapshot := NULL;
        NEW.tipo_comissao_snapshot := NULL;
        NEW.taxa_comissao_snapshot := NULL;
        NEW.valor_comissao_snapshot := NULL;
    ELSIF current_setting('barzzo.comercial_rpc', true) IS DISTINCT FROM 'true'
       AND (OLD.cupom_id IS NOT NULL OR NEW.cupom_id IS NOT NULL OR OLD.valor_liquido_snapshot IS NOT NULL) THEN
        NEW.cupom_id := OLD.cupom_id;
        NEW.codigo_cupom_snapshot := OLD.codigo_cupom_snapshot;
        NEW.origem_cupom_snapshot := OLD.origem_cupom_snapshot;
        NEW.influenciador_id_snapshot := OLD.influenciador_id_snapshot;
        NEW.influenciador_nome_snapshot := OLD.influenciador_nome_snapshot;
        NEW.valor_bruto_servicos_snapshot := OLD.valor_bruto_servicos_snapshot;
        NEW.subtotal_elegivel_snapshot := OLD.subtotal_elegivel_snapshot;
        NEW.desconto_snapshot := OLD.desconto_snapshot;
        NEW.valor_liquido_snapshot := OLD.valor_liquido_snapshot;
        NEW.cupom_regra_id := OLD.cupom_regra_id;
        NEW.cupom_regra_snapshot := OLD.cupom_regra_snapshot;
        NEW.tipo_comissao_snapshot := OLD.tipo_comissao_snapshot;
        NEW.taxa_comissao_snapshot := OLD.taxa_comissao_snapshot;
        NEW.valor_comissao_snapshot := OLD.valor_comissao_snapshot;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_snapshot_sem_cupom()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_total NUMERIC(10,2);
BEGIN
    SELECT COALESCE(SUM(preco), 0)::NUMERIC(10,2) INTO v_total
    FROM public.agendamentos_servicos WHERE agendamento_id = NEW.agendamento_id;
    PERFORM set_config('barzzo.comercial_rpc', 'true', true);
    UPDATE public.agendamentos SET
        valor_bruto_servicos_snapshot = v_total,
        subtotal_elegivel_snapshot = v_total,
        desconto_snapshot = 0,
        valor_liquido_snapshot = v_total,
        preco_total = CASE WHEN cupom_id IS NULL THEN v_total ELSE preco_total END
    WHERE id = NEW.agendamento_id AND cupom_id IS NULL;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_proteger_snapshot_comercial ON public.agendamentos;
CREATE TRIGGER trigger_proteger_snapshot_comercial
    BEFORE INSERT OR UPDATE ON public.agendamentos
    FOR EACH ROW EXECUTE FUNCTION public.proteger_snapshot_comercial_agendamento();

DROP TRIGGER IF EXISTS trigger_snapshot_sem_cupom ON public.agendamentos_servicos;
CREATE TRIGGER trigger_snapshot_sem_cupom
    AFTER INSERT OR UPDATE OF preco ON public.agendamentos_servicos
    FOR EACH ROW EXECUTE FUNCTION public.atualizar_snapshot_sem_cupom();

REVOKE EXECUTE ON FUNCTION public.liberar_uso_cupom_agendamento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.disparar_comissao_agendamento_concluido() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.proteger_snapshot_comercial_agendamento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.atualizar_snapshot_sem_cupom() FROM PUBLIC, anon, authenticated;

-- Compatibilidade: ref não é API de atribuição comercial.
REVOKE EXECUTE ON FUNCTION public.registrar_clique_influenciador(UUID, TEXT) FROM PUBLIC, anon, authenticated;
