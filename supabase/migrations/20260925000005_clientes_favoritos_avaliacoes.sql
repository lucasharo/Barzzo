-- Migration: 20260925000005_clientes_favoritos_avaliacoes.sql
-- Descrição: CRM da barbearia (clientes e observações internas), favoritos e avaliações com reputação pública.

-- 1. Tabela: clientes_barbearia (CRM de Clientes)
CREATE TABLE IF NOT EXISTS public.clientes_barbearia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id UUID NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    nome TEXT NOT NULL,
    telefone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_cliente_barbearia_usuario UNIQUE (barbearia_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_clientes_barbearia_barbearia ON public.clientes_barbearia(barbearia_id);
CREATE INDEX IF NOT EXISTS idx_clientes_barbearia_usuario ON public.clientes_barbearia(usuario_id);
CREATE INDEX IF NOT EXISTS idx_clientes_barbearia_telefone ON public.clientes_barbearia(telefone);

-- 2. Tabela: observacoes_clientes (Notas Internas Estritamente Privadas da Equipe)
CREATE TABLE IF NOT EXISTS public.observacoes_clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id UUID NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
    cliente_barbearia_id UUID NOT NULL REFERENCES public.clientes_barbearia(id) ON DELETE CASCADE,
    autor_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    autor_nome TEXT NOT NULL,
    texto TEXT NOT NULL CHECK (char_length(trim(texto)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_observacoes_cliente ON public.observacoes_clientes(cliente_barbearia_id);
CREATE INDEX IF NOT EXISTS idx_observacoes_barbearia ON public.observacoes_clientes(barbearia_id);

-- 3. Tabela: favoritos (Barbearias Favoritas do Cliente)
CREATE TABLE IF NOT EXISTS public.favoritos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    barbearia_id UUID NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_favorito_cliente_barbearia UNIQUE (cliente_id, barbearia_id)
);

CREATE INDEX IF NOT EXISTS idx_favoritos_cliente ON public.favoritos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_favoritos_barbearia ON public.favoritos(barbearia_id);

-- 4. Tabela: avaliacoes (Reputação Pública por Atendimento Concluído)
CREATE TABLE IF NOT EXISTS public.avaliacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id UUID NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
    agendamento_id UUID NOT NULL UNIQUE REFERENCES public.agendamentos(id) ON DELETE CASCADE,
    cliente_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    cliente_nome TEXT NOT NULL,
    profissional_id UUID REFERENCES public.profissionais(id) ON DELETE SET NULL,
    nota INT NOT NULL CHECK (nota >= 1 AND nota <= 5),
    comentario TEXT CHECK (char_length(comentario) <= 1000),
    resposta_barbearia TEXT CHECK (char_length(resposta_barbearia) <= 1000),
    respondido_em TIMESTAMPTZ,
    respondido_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_barbearia ON public.avaliacoes(barbearia_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_profissional ON public.avaliacoes(profissional_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_cliente ON public.avaliacoes(cliente_id);

-- 5. Row Level Security (RLS)

-- RLS: clientes_barbearia
ALTER TABLE public.clientes_barbearia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da equipe visualizam clientes da sua barbearia"
ON public.clientes_barbearia FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.membros_barbearia m
        WHERE m.barbearia_id = clientes_barbearia.barbearia_id
          AND m.usuario_id = auth.uid()
          AND m.ativo = true
    )
);

CREATE POLICY "Membros da equipe gerenciam clientes da sua barbearia"
ON public.clientes_barbearia FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.membros_barbearia m
        WHERE m.barbearia_id = clientes_barbearia.barbearia_id
          AND m.usuario_id = auth.uid()
          AND m.ativo = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.membros_barbearia m
        WHERE m.barbearia_id = clientes_barbearia.barbearia_id
          AND m.usuario_id = auth.uid()
          AND m.ativo = true
    )
);

-- RLS: observacoes_clientes (SIGILOSA: Nunca visível para o cliente final)
ALTER TABLE public.observacoes_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros da equipe visualizam observacoes internas de clientes"
ON public.observacoes_clientes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.membros_barbearia m
        WHERE m.barbearia_id = observacoes_clientes.barbearia_id
          AND m.usuario_id = auth.uid()
          AND m.ativo = true
    )
);

CREATE POLICY "Membros da equipe inserem observacoes internas de clientes"
ON public.observacoes_clientes FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.membros_barbearia m
        WHERE m.barbearia_id = observacoes_clientes.barbearia_id
          AND m.usuario_id = auth.uid()
          AND m.ativo = true
    )
    AND autor_id = auth.uid()
);

-- RLS: favoritos
ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clientes gerenciam seus proprios favoritos"
ON public.favoritos FOR ALL
USING (cliente_id = auth.uid())
WITH CHECK (cliente_id = auth.uid());

-- RLS: avaliacoes
ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer pessoa pode ler avaliacoes"
ON public.avaliacoes FOR SELECT
USING (true);

CREATE POLICY "Cliente cria avaliacao para seu agendamento concluido"
ON public.avaliacoes FOR INSERT
WITH CHECK (
    cliente_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.agendamentos a
        WHERE a.id = avaliacoes.agendamento_id
          AND a.cliente_id = auth.uid()
          AND a.status = 'concluido'
    )
);

CREATE POLICY "Membros gestores respondem avaliacoes da sua barbearia"
ON public.avaliacoes FOR UPDATE
USING (
    public.usuario_eh_dono_ou_gerente(barbearia_id)
)
WITH CHECK (
    public.usuario_eh_dono_ou_gerente(barbearia_id)
);

-- 6. RPC: Sincronizar Cliente em clientes_barbearia
CREATE OR REPLACE FUNCTION public.sincronizar_cliente_agendamento(
    p_barbearia_id UUID,
    p_usuario_id UUID,
    p_nome TEXT,
    p_telefone TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_cliente_id UUID;
BEGIN
    IF p_usuario_id IS NOT NULL THEN
        SELECT id INTO v_cliente_id
        FROM public.clientes_barbearia
        WHERE barbearia_id = p_barbearia_id AND usuario_id = p_usuario_id;
    END IF;

    IF v_cliente_id IS NULL AND p_telefone IS NOT NULL THEN
        SELECT id INTO v_cliente_id
        FROM public.clientes_barbearia
        WHERE barbearia_id = p_barbearia_id AND telefone = p_telefone;
    END IF;

    IF v_cliente_id IS NOT NULL THEN
        UPDATE public.clientes_barbearia
        SET nome = p_nome,
            telefone = COALESCE(p_telefone, telefone),
            email = COALESCE(p_email, email),
            updated_at = now()
        WHERE id = v_cliente_id;
    ELSE
        INSERT INTO public.clientes_barbearia (
            barbearia_id,
            usuario_id,
            nome,
            telefone,
            email
        ) VALUES (
            p_barbearia_id,
            p_usuario_id,
            p_nome,
            p_telefone,
            p_email
        )
        RETURNING id INTO v_cliente_id;
    END IF;

    RETURN v_cliente_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Obter Métricas do Cliente para o CRM
CREATE OR REPLACE FUNCTION public.obter_metricas_cliente_crm(
    p_barbearia_id UUID,
    p_cliente_id UUID,
    p_usuario_id UUID DEFAULT NULL
)
RETURNS TABLE (
    total_agendamentos BIGINT,
    concluidos BIGINT,
    cancelados BIGINT,
    no_shows BIGINT,
    total_gasto_centavos NUMERIC,
    ultimo_atendimento TIMESTAMPTZ,
    profissional_mais_frequente_nome TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH ags AS (
        SELECT
            a.id,
            a.status,
            a.inicio_previsto,
            a.preco_total,
            a.profissional_id,
            p.nome AS prof_nome
        FROM public.agendamentos a
        LEFT JOIN public.profissionais p ON p.id = a.profissional_id
        WHERE a.barbearia_id = p_barbearia_id
          AND (
              (p_usuario_id IS NOT NULL AND a.cliente_id = p_usuario_id)
              OR (
                  a.cliente_telefone IS NOT NULL
                  AND a.cliente_telefone = (
                      SELECT c.telefone FROM public.clientes_barbearia c WHERE c.id = p_cliente_id
                  )
              )
          )
    ),
    prof_freq AS (
        SELECT prof_nome, COUNT(*) as qtd
        FROM ags
        WHERE prof_nome IS NOT NULL AND status = 'concluido'
        GROUP BY prof_nome
        ORDER BY qtd DESC
        LIMIT 1
    )
    SELECT
        COUNT(*)::BIGINT AS total_agendamentos,
        COUNT(*) FILTER (WHERE status = 'concluido')::BIGINT AS concluidos,
        COUNT(*) FILTER (WHERE status = 'cancelado')::BIGINT AS cancelados,
        COUNT(*) FILTER (WHERE status = 'nao_compareceu')::BIGINT AS no_shows,
        COALESCE(SUM(preco_total) FILTER (WHERE status = 'concluido'), 0) * 100 AS total_gasto_centavos,
        MAX(inicio_previsto) FILTER (WHERE status = 'concluido') AS ultimo_atendimento,
        (SELECT prof_nome FROM prof_freq) AS profissional_mais_frequente_nome
    FROM ags;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 8. Grants de Execução
GRANT EXECUTE ON FUNCTION public.sincronizar_cliente_agendamento TO authenticated;
GRANT EXECUTE ON FUNCTION public.obter_metricas_cliente_crm TO authenticated;
