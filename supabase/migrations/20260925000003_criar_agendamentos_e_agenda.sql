-- Migration: 20260925000003_criar_agendamentos_e_agenda.sql
-- Descrição: Tabelas de agendamentos e snapshot de serviços, prevenção de concorrência com GiST,
-- máquina de estados de agendamentos, RPCs para criação, reagendamento e transições operacionais.

-- 1. Habilitar extensão btree_gist para suporte a restrições de exclusão de intervalo temporal
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Tabela de Agendamentos
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id UUID REFERENCES public.barbearias(id) ON DELETE CASCADE NOT NULL,
    cliente_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    cliente_nome TEXT NOT NULL,
    cliente_telefone TEXT,
    cliente_email TEXT,
    profissional_id UUID REFERENCES public.profissionais(id) ON DELETE CASCADE NOT NULL,
    inicio_previsto TIMESTAMPTZ NOT NULL,
    fim_previsto TIMESTAMPTZ NOT NULL,
    inicio_real TIMESTAMPTZ,
    fim_real TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'confirmado' CHECK (status IN ('pendente', 'confirmado', 'em_atendimento', 'concluido', 'cancelado', 'nao_compareceu')),
    observacoes TEXT,
    origem TEXT NOT NULL DEFAULT 'parceiro' CHECK (origem IN ('parceiro', 'cliente', 'marketplace')),
    preco_total NUMERIC(10, 2) NOT NULL CHECK (preco_total >= 0),
    duracao_total_minutos INTEGER NOT NULL CHECK (duracao_total_minutos > 0),
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT check_agendamento_datas CHECK (inicio_previsto < fim_previsto),
    CONSTRAINT uq_agendamento_sem_sobreposicao EXCLUDE USING gist (
        profissional_id WITH =,
        tstzrange(inicio_previsto, fim_previsto, '[)') WITH &&
    ) WHERE (status NOT IN ('cancelado', 'nao_compareceu'))
);

CREATE INDEX IF NOT EXISTS idx_agendamentos_barbearia_inicio ON public.agendamentos(barbearia_id, inicio_previsto);
CREATE INDEX IF NOT EXISTS idx_agendamentos_prof_inicio ON public.agendamentos(profissional_id, inicio_previsto);
CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente ON public.agendamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON public.agendamentos(status);

DROP TRIGGER IF EXISTS trigger_atualizar_agendamentos_timestamp ON public.agendamentos;
CREATE TRIGGER trigger_atualizar_agendamentos_timestamp
    BEFORE UPDATE ON public.agendamentos
    FOR EACH ROW
    EXECUTE FUNCTION public.funcao_atualizar_timestamp();

-- 3. Tabela de Snapshot de Serviços do Agendamento
CREATE TABLE IF NOT EXISTS public.agendamentos_servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE CASCADE NOT NULL,
    servico_id UUID REFERENCES public.servicos(id) ON DELETE SET NULL,
    nome_servico TEXT NOT NULL,
    preco NUMERIC(10, 2) NOT NULL CHECK (preco >= 0),
    duracao_minutos INTEGER NOT NULL CHECK (duracao_minutos > 0),
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agendamentos_servicos_agendamento ON public.agendamentos_servicos(agendamento_id);

-- ==============================================================================
-- 4. Row Level Security (RLS) Multi-Tenant
-- ==============================================================================

ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos_servicos ENABLE ROW LEVEL SECURITY;

-- 4.1 Políticas de Leitura para agendamentos
-- Gestores e profissionais da barbearia podem ver agendamentos de sua barbearia
CREATE POLICY "Membros da barbearia podem ver agendamentos"
    ON public.agendamentos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.membros_barbearia mb
            WHERE mb.barbearia_id = agendamentos.barbearia_id
              AND mb.usuario_id = auth.uid()
              AND mb.ativo = true
        )
    );

-- Clientes podem ver seus próprios agendamentos
CREATE POLICY "Clientes podem ver seus proprios agendamentos"
    ON public.agendamentos FOR SELECT
    USING (cliente_id = auth.uid());

-- 4.2 Políticas de Inserção para agendamentos
-- Gestores podem criar agendamentos para sua barbearia
CREATE POLICY "Gestores podem criar agendamentos"
    ON public.agendamentos FOR INSERT
    WITH CHECK (public.usuario_eh_dono_ou_gerente(barbearia_id));

-- Clientes podem agendar para si mesmos
CREATE POLICY "Clientes autenticados podem agendar"
    ON public.agendamentos FOR INSERT
    WITH CHECK (cliente_id = auth.uid());

-- 4.3 Políticas de Atualização para agendamentos
-- Gestores podem atualizar qualquer agendamento da barbearia
CREATE POLICY "Gestores podem atualizar agendamentos da barbearia"
    ON public.agendamentos FOR UPDATE
    USING (public.usuario_eh_dono_ou_gerente(barbearia_id));

-- Profissional pode atualizar o status dos agendamentos em que foi designado
CREATE POLICY "Profissional pode atualizar status do seu agendamento"
    ON public.agendamentos FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profissionais p
            WHERE p.id = agendamentos.profissional_id
              AND p.usuario_id = auth.uid()
        )
    );

-- Clientes podem cancelar seus próprios agendamentos futuros
CREATE POLICY "Clientes podem cancelar seus agendamentos futuros"
    ON public.agendamentos FOR UPDATE
    USING (cliente_id = auth.uid() AND inicio_previsto > now());

-- 4.4 Políticas para agendamentos_servicos
CREATE POLICY "Leitura de servicos do agendamento sincronizada com agendamento"
    ON public.agendamentos_servicos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.agendamentos a
            WHERE a.id = agendamentos_servicos.agendamento_id
              AND (
                  a.cliente_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.membros_barbearia mb
                      WHERE mb.barbearia_id = a.barbearia_id
                        AND mb.usuario_id = auth.uid()
                        AND mb.ativo = true
                  )
              )
        )
    );

CREATE POLICY "Gestores e clientes podem inserir itens de servico do agendamento"
    ON public.agendamentos_servicos FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.agendamentos a
            WHERE a.id = agendamentos_servicos.agendamento_id
              AND (
                  a.cliente_id = auth.uid()
                  OR public.usuario_eh_dono_ou_gerente(a.barbearia_id)
              )
        )
    );

-- ==============================================================================
-- 5. Funções RPC Operacionais
-- ==============================================================================

-- 5.1 RPC: Transição de Status Segura com gravação de início/fim real
CREATE OR REPLACE FUNCTION public.atualizar_status_agendamento(
    p_agendamento_id UUID,
    p_novo_status TEXT
)
RETURNS public.agendamentos AS $$
DECLARE
    v_agendamento public.agendamentos;
    v_status_atual TEXT;
BEGIN
    SELECT * INTO v_agendamento
    FROM public.agendamentos
    WHERE id = p_agendamento_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agendamento % não encontrado.', p_agendamento_id;
    END IF;

    v_status_atual := v_agendamento.status;

    -- Validar máquina de estados finita
    IF v_status_atual = 'concluido' OR v_status_atual = 'cancelado' OR v_status_atual = 'nao_compareceu' THEN
        RAISE EXCEPTION 'Não é permitido alterar o status de um agendamento finalizado (%).', v_status_atual;
    END IF;

    IF v_status_atual = 'pendente' AND p_novo_status NOT IN ('confirmado', 'cancelado') THEN
        RAISE EXCEPTION 'Transição inválida de pendente para %.', p_novo_status;
    END IF;

    IF v_status_atual = 'confirmado' AND p_novo_status NOT IN ('em_atendimento', 'cancelado', 'nao_compareceu', 'confirmado') THEN
        RAISE EXCEPTION 'Transição inválida de confirmado para %.', p_novo_status;
    END IF;

    IF v_status_atual = 'em_atendimento' AND p_novo_status NOT IN ('concluido', 'cancelado') THEN
        RAISE EXCEPTION 'Transição inválida de em_atendimento para %.', p_novo_status;
    END IF;

    -- Aplicar marcas de tempo reais
    IF p_novo_status = 'em_atendimento' AND v_agendamento.inicio_real IS NULL THEN
        UPDATE public.agendamentos
        SET status = p_novo_status,
            inicio_real = timezone('utc'::text, now()),
            atualizado_em = timezone('utc'::text, now())
        WHERE id = p_agendamento_id
        RETURNING * INTO v_agendamento;
    ELSIF p_novo_status = 'concluido' THEN
        UPDATE public.agendamentos
        SET status = p_novo_status,
            fim_real = timezone('utc'::text, now()),
            atualizado_em = timezone('utc'::text, now())
        WHERE id = p_agendamento_id
        RETURNING * INTO v_agendamento;
    ELSE
        UPDATE public.agendamentos
        SET status = p_novo_status,
            atualizado_em = timezone('utc'::text, now())
        WHERE id = p_agendamento_id
        RETURNING * INTO v_agendamento;
    END IF;

    RETURN v_agendamento;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.2 RPC: Reagendamento com Verificação de Concorrência
CREATE OR REPLACE FUNCTION public.reagendar_agendamento(
    p_agendamento_id UUID,
    p_novo_inicio TIMESTAMPTZ,
    p_novo_fim TIMESTAMPTZ,
    p_novo_profissional_id UUID DEFAULT NULL
)
RETURNS public.agendamentos AS $$
DECLARE
    v_agendamento public.agendamentos;
    v_prof_id UUID;
BEGIN
    SELECT * INTO v_agendamento
    FROM public.agendamentos
    WHERE id = p_agendamento_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agendamento não encontrado.';
    END IF;

    IF v_agendamento.status IN ('concluido', 'cancelado', 'nao_compareceu') THEN
        RAISE EXCEPTION 'Não é possível reagendar um atendimento com status %.', v_agendamento.status;
    END IF;

    IF p_novo_inicio >= p_novo_fim THEN
        RAISE EXCEPTION 'Horário de início deve ser anterior ao término.';
    END IF;

    v_prof_id := COALESCE(p_novo_profissional_id, v_agendamento.profissional_id);

    -- Atualiza os horários (a restrição de exclusão GiST garantirá atomicamente a não-sobreposição)
    UPDATE public.agendamentos
    SET profissional_id = v_prof_id,
        inicio_previsto = p_novo_inicio,
        fim_previsto = p_novo_fim,
        status = 'confirmado',
        atualizado_em = timezone('utc'::text, now())
    WHERE id = p_agendamento_id
    RETURNING * INTO v_agendamento;

    RETURN v_agendamento;
EXCEPTION
    WHEN exclusion_violation THEN
        RAISE EXCEPTION 'O profissional selecionado já possui um agendamento conflitante neste horário.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.3 RPC: Selecionar Profissional com Menor Carga do Dia (Opção "Qualquer Profissional")
CREATE OR REPLACE FUNCTION public.selecionar_profissional_menor_carga(
    p_barbearia_id UUID,
    p_servico_id UUID,
    p_inicio TIMESTAMPTZ,
    p_fim TIMESTAMPTZ
)
RETURNS UUID AS $$
DECLARE
    v_data DATE;
    v_prof_selecionado UUID;
BEGIN
    v_data := (p_inicio AT TIME ZONE 'UTC')::DATE;

    -- Seleciona profissionais que:
    -- 1. Pertencem à barbearia e estão ativos
    -- 2. Oferecem o serviço solicitado
    -- 3. Não possuem agendamentos ativos sobrepondo o intervalo [p_inicio, p_fim]
    -- 4. Não possuem bloqueio de agenda no intervalo
    -- E ordena pelo menor número de atendimentos ativos marcados para aquela data, desempatando por nome ASC
    SELECT p.id INTO v_prof_selecionado
    FROM public.profissionais p
    JOIN public.profissionais_servicos ps ON ps.profissional_id = p.id AND ps.ativo = true
    LEFT JOIN public.agendamentos ag ON ag.profissional_id = p.id
        AND (ag.inicio_previsto AT TIME ZONE 'UTC')::DATE = v_data
        AND ag.status NOT IN ('cancelado', 'nao_compareceu')
    WHERE p.barbearia_id = p_barbearia_id
      AND p.ativo = true
      AND ps.servico_id = p_servico_id
      -- Sem sobreposição de agendamento no intervalo
      AND NOT EXISTS (
          SELECT 1 FROM public.agendamentos a_conf
          WHERE a_conf.profissional_id = p.id
            AND a_conf.status NOT IN ('cancelado', 'nao_compareceu')
            AND tstzrange(a_conf.inicio_previsto, a_conf.fim_previsto, '[)') && tstzrange(p_inicio, p_fim, '[)')
      )
      -- Sem bloqueios de agenda
      AND NOT EXISTS (
          SELECT 1 FROM public.bloqueios_agenda ba
          WHERE ba.barbearia_id = p_barbearia_id
            AND (ba.profissional_id IS NULL OR ba.profissional_id = p.id)
            AND ba.inicio < p_fim
            AND ba.fim > p_inicio
      )
    GROUP BY p.id, p.nome
    ORDER BY COUNT(ag.id) ASC, p.nome ASC, p.id ASC
    LIMIT 1;

    RETURN v_prof_selecionado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
