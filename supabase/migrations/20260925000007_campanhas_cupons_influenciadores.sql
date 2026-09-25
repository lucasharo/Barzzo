-- ==============================================================================
-- MIGRATION: Campanhas, Cupons e Influenciadores (TASK-08)
-- Barzzo MVP - Multi-tenant com RLS, Atribuição e Comissões Idempotentes
-- ==============================================================================

-- 1. TABELA: campanhas
CREATE TABLE IF NOT EXISTS public.campanhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id UUID NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    data_inicio TIMESTAMPTZ NOT NULL,
    data_fim TIMESTAMPTZ NOT NULL,
    ativa BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT campanhas_datas_check CHECK (data_inicio <= data_fim)
);

CREATE INDEX IF NOT EXISTS idx_campanhas_barbearia ON public.campanhas (barbearia_id);
CREATE INDEX IF NOT EXISTS idx_campanhas_vigencia ON public.campanhas (data_inicio, data_fim, ativa);

-- 2. TABELA: cupons
CREATE TABLE IF NOT EXISTS public.cupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id UUID NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
    campanha_id UUID REFERENCES public.campanhas(id) ON DELETE SET NULL,
    codigo TEXT NOT NULL,
    descricao TEXT,
    tipo_desconto TEXT NOT NULL CHECK (tipo_desconto IN ('percentual', 'valor_fixo')),
    valor_desconto NUMERIC(10,2) NOT NULL CHECK (valor_desconto > 0),
    valor_minimo_reserva NUMERIC(10,2) DEFAULT 0 CHECK (valor_minimo_reserva >= 0),
    limite_usos_total INT,
    usos_atuais INT NOT NULL DEFAULT 0,
    limite_usos_por_cliente INT NOT NULL DEFAULT 1,
    apenas_primeira_reserva BOOLEAN NOT NULL DEFAULT false,
    servicos_elegiveis UUID[] DEFAULT '{}'::uuid[],
    data_inicio TIMESTAMPTZ NOT NULL,
    data_fim TIMESTAMPTZ NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT cupons_codigo_barbearia_unique UNIQUE (barbearia_id, codigo),
    CONSTRAINT cupons_datas_check CHECK (data_inicio <= data_fim)
);

CREATE INDEX IF NOT EXISTS idx_cupons_barbearia_codigo ON public.cupons (barbearia_id, codigo);
CREATE INDEX IF NOT EXISTS idx_cupons_campanha ON public.cupons (campanha_id);

-- 3. TABELA: influenciadores
CREATE TABLE IF NOT EXISTS public.influenciadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id UUID NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    nome TEXT NOT NULL,
    codigo_ref TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    chave_pix TEXT,
    tipo_comissao TEXT NOT NULL DEFAULT 'percentual' CHECK (tipo_comissao IN ('percentual', 'valor_fixo')),
    valor_comissao NUMERIC(10,2) NOT NULL DEFAULT 10.00 CHECK (valor_comissao >= 0),
    cupom_padrao_id UUID REFERENCES public.cupons(id) ON DELETE SET NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    cliques_rastreados INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT influenciadores_codigo_barbearia_unique UNIQUE (barbearia_id, codigo_ref)
);

CREATE INDEX IF NOT EXISTS idx_influenciadores_barbearia ON public.influenciadores (barbearia_id);
CREATE INDEX IF NOT EXISTS idx_influenciadores_codigo ON public.influenciadores (codigo_ref);
CREATE INDEX IF NOT EXISTS idx_influenciadores_usuario ON public.influenciadores (usuario_id);

-- 4. TABELA: indicacoes (atribuição de clique e reserva ao influenciador)
CREATE TABLE IF NOT EXISTS public.indicacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id UUID NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
    influenciador_id UUID NOT NULL REFERENCES public.influenciadores(id) ON DELETE CASCADE,
    cupom_id UUID REFERENCES public.cupons(id) ON DELETE SET NULL,
    agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
    cliente_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    codigo_ref_usado TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido', 'cancelado')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_indicacoes_influenciador ON public.indicacoes (influenciador_id);
CREATE INDEX IF NOT EXISTS idx_indicacoes_agendamento ON public.indicacoes (agendamento_id);

-- 5. TABELA: comissoes_influenciadores
CREATE TABLE IF NOT EXISTS public.comissoes_influenciadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id UUID NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
    influenciador_id UUID NOT NULL REFERENCES public.influenciadores(id) ON DELETE CASCADE,
    indicacao_id UUID REFERENCES public.indicacoes(id) ON DELETE SET NULL,
    agendamento_id UUID NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
    valor_servicos NUMERIC(10,2) NOT NULL,
    tipo_comissao TEXT NOT NULL CHECK (tipo_comissao IN ('percentual', 'valor_fixo')),
    taxa_comissao NUMERIC(10,2) NOT NULL,
    valor_comissao NUMERIC(10,2) NOT NULL CHECK (valor_comissao >= 0),
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'paga', 'cancelada')),
    paga_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Restrição de Idempotência: Cada atendimento concluído gera no máximo 1 comissão
    CONSTRAINT comissoes_agendamento_unique UNIQUE (agendamento_id)
);

CREATE INDEX IF NOT EXISTS idx_comissoes_barbearia ON public.comissoes_influenciadores (barbearia_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_influenciador ON public.comissoes_influenciadores (influenciador_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_status ON public.comissoes_influenciadores (status);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influenciadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissoes_influenciadores ENABLE ROW LEVEL SECURITY;

-- 1. Campanhas
CREATE POLICY "Membros da equipe gerenciam campanhas da barbearia"
    ON public.campanhas
    FOR ALL
    TO authenticated
    USING (public.usuario_eh_membro_equipe(barbearia_id, auth.uid()))
    WITH CHECK (public.usuario_eh_membro_equipe(barbearia_id, auth.uid()));

-- 2. Cupons
CREATE POLICY "Leitura pública de cupons ativos para validação"
    ON public.cupons
    FOR SELECT
    TO anon, authenticated
    USING (ativo = true);

CREATE POLICY "Membros da equipe gerenciam cupons da barbearia"
    ON public.cupons
    FOR ALL
    TO authenticated
    USING (public.usuario_eh_membro_equipe(barbearia_id, auth.uid()))
    WITH CHECK (public.usuario_eh_membro_equipe(barbearia_id, auth.uid()));

-- 3. Influenciadores
CREATE POLICY "Membros da equipe gerenciam influenciadores da barbearia"
    ON public.influenciadores
    FOR ALL
    TO authenticated
    USING (public.usuario_eh_membro_equipe(barbearia_id, auth.uid()))
    WITH CHECK (public.usuario_eh_membro_equipe(barbearia_id, auth.uid()));

CREATE POLICY "Influenciadores visualizam seus próprios cadastros"
    ON public.influenciadores
    FOR SELECT
    TO authenticated
    USING (usuario_id = auth.uid());

-- 4. Indicações
CREATE POLICY "Membros da equipe visualizam indicacoes da barbearia"
    ON public.indicacoes
    FOR ALL
    TO authenticated
    USING (public.usuario_eh_membro_equipe(barbearia_id, auth.uid()))
    WITH CHECK (public.usuario_eh_membro_equipe(barbearia_id, auth.uid()));

CREATE POLICY "Influenciadores visualizam suas proprias indicacoes"
    ON public.indicacoes
    FOR SELECT
    TO authenticated
    USING (
        influenciador_id IN (
            SELECT id FROM public.influenciadores WHERE usuario_id = auth.uid()
        )
    );

CREATE POLICY "Clientes inserem indicacao ao agendar"
    ON public.indicacoes
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- 5. Comissões
CREATE POLICY "Membros da equipe gerenciam comissoes da barbearia"
    ON public.comissoes_influenciadores
    FOR ALL
    TO authenticated
    USING (public.usuario_eh_membro_equipe(barbearia_id, auth.uid()))
    WITH CHECK (public.usuario_eh_membro_equipe(barbearia_id, auth.uid()));

CREATE POLICY "Influenciadores visualizam suas proprias comissoes"
    ON public.comissoes_influenciadores
    FOR SELECT
    TO authenticated
    USING (
        influenciador_id IN (
            SELECT id FROM public.influenciadores WHERE usuario_id = auth.uid()
        )
    );

-- ==============================================================================
-- FUNÇÕES / RPCS ATÔMICAS
-- ==============================================================================

-- 1. Registrar clique no link do influenciador
CREATE OR REPLACE FUNCTION public.registrar_clique_influenciador(
    p_barbearia_id UUID,
    p_codigo_ref TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.influenciadores
    SET cliques_rastreados = cliques_rastreados + 1
    WHERE barbearia_id = p_barbearia_id
      AND UPPER(codigo_ref) = UPPER(p_codigo_ref);
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_clique_influenciador TO anon, authenticated;

-- 2. Processar comissão atômica e idempotente na conclusão do agendamento
CREATE OR REPLACE FUNCTION public.processar_comissao_conclusao_atendimento(
    p_agendamento_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agendamento RECORD;
    v_indicacao RECORD;
    v_influenciador RECORD;
    v_valor_comissao NUMERIC(10,2);
BEGIN
    -- Obter dados do agendamento
    SELECT id, barbearia_id, status, preco_total
    INTO v_agendamento
    FROM public.agendamentos
    WHERE id = p_agendamento_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Comissão só é devida se o atendimento foi concluído
    IF v_agendamento.status <> 'concluido' THEN
        -- Se o agendamento foi cancelado, cancelar indicação e comissão pendente se houver
        IF v_agendamento.status IN ('cancelado', 'nao_compareceu') THEN
            UPDATE public.indicacoes
            SET status = 'cancelado'
            WHERE agendamento_id = p_agendamento_id;

            UPDATE public.comissoes_influenciadores
            SET status = 'cancelada', updated_at = now()
            WHERE agendamento_id = p_agendamento_id
              AND status = 'pendente';
        END IF;
        RETURN;
    END IF;

    -- Verificar se há indicação para este agendamento
    SELECT id, influenciador_id
    INTO v_indicacao
    FROM public.indicacoes
    WHERE agendamento_id = p_agendamento_id
      AND status = 'pendente'
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Obter parâmetros do influenciador
    SELECT id, tipo_comissao, valor_comissao
    INTO v_influenciador
    FROM public.influenciadores
    WHERE id = v_indicacao.influenciador_id
      AND ativo = true;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Calcular valor da comissão
    IF v_influenciador.tipo_comissao = 'percentual' THEN
        v_valor_comissao := ROUND((v_agendamento.preco_total * v_influenciador.valor_comissao) / 100.0, 2);
    ELSE
        v_valor_comissao := v_influenciador.valor_comissao;
    END IF;

    -- Inserir comissão com idempotência estrita (ON CONFLICT DO NOTHING)
    INSERT INTO public.comissoes_influenciadores (
        barbearia_id,
        influenciador_id,
        indicacao_id,
        agendamento_id,
        valor_servicos,
        tipo_comissao,
        taxa_comissao,
        valor_comissao,
        status
    ) VALUES (
        v_agendamento.barbearia_id,
        v_influenciador.id,
        v_indicacao.id,
        p_agendamento_id,
        v_agendamento.preco_total,
        v_influenciador.tipo_comissao,
        v_influenciador.valor_comissao,
        v_valor_comissao,
        'pendente'
    )
    ON CONFLICT (agendamento_id) DO NOTHING;

    -- Atualizar indicação para concluído
    UPDATE public.indicacoes
    SET status = 'concluido'
    WHERE id = v_indicacao.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.processar_comissao_conclusao_atendimento TO authenticated;
