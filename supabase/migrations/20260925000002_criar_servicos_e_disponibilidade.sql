-- Migration: 20260925000002_criar_servicos_e_disponibilidade.sql
-- Descrição: Tabelas de serviços, vínculo profissional-serviço, horários de funcionamento da barbearia,
-- jornadas semanais dos profissionais e bloqueios de agenda pontuais.
-- Inclui RLS multi-tenant, índices de performance e a função RPC central buscar_horarios_disponiveis.

-- 1. Tabela de Serviços
CREATE TABLE IF NOT EXISTS public.servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id UUID REFERENCES public.barbearias(id) ON DELETE CASCADE NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT,
    preco NUMERIC(10, 2) NOT NULL CHECK (preco >= 0),
    duracao_minutos INTEGER NOT NULL CHECK (duracao_minutos > 0),
    ativo BOOLEAN DEFAULT true NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_servicos_barbearia_ativo ON public.servicos(barbearia_id, ativo);

DROP TRIGGER IF EXISTS trigger_atualizar_servicos_timestamp ON public.servicos;
CREATE TRIGGER trigger_atualizar_servicos_timestamp
    BEFORE UPDATE ON public.servicos
    FOR EACH ROW
    EXECUTE FUNCTION public.funcao_atualizar_timestamp();

-- 2. Tabela de Vínculo Profissional-Serviço (N:N)
CREATE TABLE IF NOT EXISTS public.profissionais_servicos (
    profissional_id UUID REFERENCES public.profissionais(id) ON DELETE CASCADE NOT NULL,
    servico_id UUID REFERENCES public.servicos(id) ON DELETE CASCADE NOT NULL,
    ativo BOOLEAN DEFAULT true NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (profissional_id, servico_id)
);

CREATE INDEX IF NOT EXISTS idx_prof_serv_servico ON public.profissionais_servicos(servico_id);
CREATE INDEX IF NOT EXISTS idx_prof_serv_profissional ON public.profissionais_servicos(profissional_id);

-- 3. Tabela de Horários de Funcionamento da Barbearia (Semanal: 0=Domingo a 6=Sábado)
CREATE TABLE IF NOT EXISTS public.horarios_barbearia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id UUID REFERENCES public.barbearias(id) ON DELETE CASCADE NOT NULL,
    dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    hora_abertura TIME NOT NULL,
    hora_fechamento TIME NOT NULL,
    hora_inicio_almoco TIME,
    hora_fim_almoco TIME,
    ativo BOOLEAN DEFAULT true NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_horarios_barbearia_dia UNIQUE (barbearia_id, dia_semana),
    CONSTRAINT check_horario_funcionamento CHECK (hora_abertura < hora_fechamento),
    CONSTRAINT check_almoco CHECK (
        hora_inicio_almoco IS NULL OR (
            hora_fim_almoco IS NOT NULL AND
            hora_inicio_almoco < hora_fim_almoco AND
            hora_inicio_almoco >= hora_abertura AND
            hora_fim_almoco <= hora_fechamento
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_horarios_barbearia_busca ON public.horarios_barbearia(barbearia_id, dia_semana, ativo);

DROP TRIGGER IF EXISTS trigger_atualizar_horarios_barbearia_timestamp ON public.horarios_barbearia;
CREATE TRIGGER trigger_atualizar_horarios_barbearia_timestamp
    BEFORE UPDATE ON public.horarios_barbearia
    FOR EACH ROW
    EXECUTE FUNCTION public.funcao_atualizar_timestamp();

-- 4. Tabela de Jornadas Semanais dos Profissionais
CREATE TABLE IF NOT EXISTS public.jornadas_profissionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profissional_id UUID REFERENCES public.profissionais(id) ON DELETE CASCADE NOT NULL,
    dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    hora_inicio_pausa TIME,
    hora_fim_pausa TIME,
    ativo BOOLEAN DEFAULT true NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_jornada_profissional_dia UNIQUE (profissional_id, dia_semana),
    CONSTRAINT check_jornada CHECK (hora_inicio < hora_fim),
    CONSTRAINT check_pausa CHECK (
        hora_inicio_pausa IS NULL OR (
            hora_fim_pausa IS NOT NULL AND
            hora_inicio_pausa < hora_fim_pausa AND
            hora_inicio_pausa >= hora_inicio AND
            hora_fim_pausa <= hora_fim
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_jornadas_prof_dia ON public.jornadas_profissionais(profissional_id, dia_semana, ativo);

DROP TRIGGER IF EXISTS trigger_atualizar_jornadas_prof_timestamp ON public.jornadas_profissionais;
CREATE TRIGGER trigger_atualizar_jornadas_prof_timestamp
    BEFORE UPDATE ON public.jornadas_profissionais
    FOR EACH ROW
    EXECUTE FUNCTION public.funcao_atualizar_timestamp();

-- 5. Tabela de Bloqueios Pontuais de Agenda
CREATE TABLE IF NOT EXISTS public.bloqueios_agenda (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id UUID REFERENCES public.barbearias(id) ON DELETE CASCADE NOT NULL,
    profissional_id UUID REFERENCES public.profissionais(id) ON DELETE CASCADE,
    inicio TIMESTAMPTZ NOT NULL,
    fim TIMESTAMPTZ NOT NULL,
    motivo TEXT NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT check_datas_bloqueio CHECK (inicio < fim)
);

CREATE INDEX IF NOT EXISTS idx_bloqueios_barbearia_datas ON public.bloqueios_agenda(barbearia_id, inicio, fim);
CREATE INDEX IF NOT EXISTS idx_bloqueios_prof_datas ON public.bloqueios_agenda(profissional_id, inicio, fim);

-- ==============================================================================
-- 6. Políticas de Row Level Security (RLS) Multi-Tenant
-- ==============================================================================

ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profissionais_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_barbearia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jornadas_profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloqueios_agenda ENABLE ROW LEVEL SECURITY;

-- 6.1 Políticas para servicos
-- Leitura pública para serviços ativos (Marketplace e Agendamentos sem login)
CREATE POLICY "Servicos ativos sao visiveis publicamente"
    ON public.servicos FOR SELECT
    USING (ativo = true);

-- Dono/Gerente da barbearia pode ver todos os serviços (incluindo inativos)
CREATE POLICY "Membros gestores podem visualizar todos os servicos da barbearia"
    ON public.servicos FOR SELECT
    USING (public.usuario_eh_dono_ou_gerente(barbearia_id));

-- Inserção, Atualização e Deleção: Apenas Donos e Gerentes
CREATE POLICY "Dono ou gerente pode criar servicos"
    ON public.servicos FOR INSERT
    WITH CHECK (public.usuario_eh_dono_ou_gerente(barbearia_id));

CREATE POLICY "Dono ou gerente pode atualizar servicos"
    ON public.servicos FOR UPDATE
    USING (public.usuario_eh_dono_ou_gerente(barbearia_id));

CREATE POLICY "Dono ou gerente pode remover servicos"
    ON public.servicos FOR DELETE
    USING (public.usuario_eh_dono_ou_gerente(barbearia_id));

-- 6.2 Políticas para profissionais_servicos
CREATE POLICY "Profissionais e servicos ativos sao visiveis publicamente"
    ON public.profissionais_servicos FOR SELECT
    USING (ativo = true);

CREATE POLICY "Gestores podem gerenciar vinculos profissional servico"
    ON public.profissionais_servicos FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profissionais p
            WHERE p.id = profissionais_servicos.profissional_id
              AND public.usuario_eh_dono_ou_gerente(p.barbearia_id)
        )
    );

-- 6.3 Políticas para horarios_barbearia
CREATE POLICY "Horarios da barbearia sao publicos"
    ON public.horarios_barbearia FOR SELECT
    USING (ativo = true);

CREATE POLICY "Gestores podem ver todos os horarios da barbearia"
    ON public.horarios_barbearia FOR SELECT
    USING (public.usuario_eh_dono_ou_gerente(barbearia_id));

CREATE POLICY "Gestores podem gerenciar horarios da barbearia"
    ON public.horarios_barbearia FOR ALL
    USING (public.usuario_eh_dono_ou_gerente(barbearia_id));

-- 6.4 Políticas para jornadas_profissionais
CREATE POLICY "Jornadas ativas sao visiveis publicamente para consulta de agenda"
    ON public.jornadas_profissionais FOR SELECT
    USING (ativo = true);

CREATE POLICY "Profissional ou gestor pode gerenciar jornada"
    ON public.jornadas_profissionais FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profissionais p
            WHERE p.id = jornadas_profissionais.profissional_id
              AND (
                  public.usuario_eh_dono_ou_gerente(p.barbearia_id)
                  OR p.usuario_id = auth.uid()
              )
        )
    );

-- 6.5 Políticas para bloqueios_agenda
CREATE POLICY "Gestores e profissionais veem bloqueios da sua barbearia"
    ON public.bloqueios_agenda FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.membros_barbearia mb
            WHERE mb.barbearia_id = bloqueios_agenda.barbearia_id
              AND mb.usuario_id = auth.uid()
              AND mb.ativo = true
        )
    );

CREATE POLICY "Gestores podem gerenciar bloqueios de agenda"
    ON public.bloqueios_agenda FOR ALL
    USING (public.usuario_eh_dono_ou_gerente(barbearia_id));

-- ==============================================================================
-- 7. Função RPC: buscar_horarios_disponiveis
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.buscar_horarios_disponiveis(
    p_barbearia_id UUID,
    p_servico_id UUID,
    p_data DATE,
    p_profissional_id UUID DEFAULT NULL
)
RETURNS TABLE (
    horario TEXT,
    duracao_minutos INTEGER,
    profissional_id UUID,
    profissional_nome TEXT
) AS $$
DECLARE
    v_dia_semana SMALLINT;
    v_horario_barbearia RECORD;
    v_servico RECORD;
    v_prof RECORD;
    v_jornada RECORD;
    v_slot_atual TIME;
    v_slot_fim TIME;
    v_duracao_interval INTERVAL;
    v_limite_inicio TIME;
    v_limite_fim TIME;
    v_valido BOOLEAN;
    v_passo_minutos INTEGER := 30; -- Intervalo de passo de slot padrão
BEGIN
    v_dia_semana := EXTRACT(DOW FROM p_data)::SMALLINT;

    -- 1. Obter serviço ativo
    SELECT * INTO v_servico
    FROM public.servicos s
    WHERE s.id = p_servico_id
      AND s.barbearia_id = p_barbearia_id
      AND s.ativo = true;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_duracao_interval := (v_servico.duracao_minutos || ' minutes')::INTERVAL;

    -- 2. Verificar horário de funcionamento da barbearia no dia
    SELECT * INTO v_horario_barbearia
    FROM public.horarios_barbearia hb
    WHERE hb.barbearia_id = p_barbearia_id
      AND hb.dia_semana = v_dia_semana
      AND hb.ativo = true;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- 3. Para cada profissional apto
    FOR v_prof IN
        SELECT p.id, p.nome
        FROM public.profissionais p
        JOIN public.profissionais_servicos ps ON ps.profissional_id = p.id
        WHERE p.barbearia_id = p_barbearia_id
          AND p.ativo = true
          AND ps.servico_id = p_servico_id
          AND ps.ativo = true
          AND (p_profissional_id IS NULL OR p.id = p_profissional_id)
        ORDER BY p.nome ASC
    LOOP
        -- Obter jornada do profissional
        SELECT * INTO v_jornada
        FROM public.jornadas_profissionais jp
        WHERE jp.profissional_id = v_prof.id
          AND jp.dia_semana = v_dia_semana
          AND jp.ativo = true;

        IF FOUND THEN
            -- O limite operacional é a interseção entre o funcionamento e a jornada
            v_limite_inicio := GREATEST(v_horario_barbearia.hora_abertura, v_jornada.hora_inicio);
            v_limite_fim := LEAST(v_horario_barbearia.hora_fechamento, v_jornada.hora_fim);

            v_slot_atual := v_limite_inicio;

            WHILE (v_slot_atual + v_duracao_interval) <= v_limite_fim LOOP
                v_slot_fim := (v_slot_atual + v_duracao_interval)::TIME;
                v_valido := true;

                -- Checagem 1: Almoço da barbearia
                IF v_horario_barbearia.hora_inicio_almoco IS NOT NULL AND v_horario_barbearia.hora_fim_almoco IS NOT NULL THEN
                    IF v_slot_atual < v_horario_barbearia.hora_fim_almoco AND v_slot_fim > v_horario_barbearia.hora_inicio_almoco THEN
                        v_valido := false;
                    END IF;
                END IF;

                -- Checagem 2: Pausa do profissional
                IF v_valido AND v_jornada.hora_inicio_pausa IS NOT NULL AND v_jornada.hora_fim_pausa IS NOT NULL THEN
                    IF v_slot_atual < v_jornada.hora_fim_pausa AND v_slot_fim > v_jornada.hora_inicio_pausa THEN
                        v_valido := false;
                    END IF;
                END IF;

                -- Checagem 3: Bloqueios pontuais de agenda (geral da barbearia ou do profissional)
                IF v_valido THEN
                    IF EXISTS (
                        SELECT 1 FROM public.bloqueios_agenda ba
                        WHERE ba.barbearia_id = p_barbearia_id
                          AND (ba.profissional_id IS NULL OR ba.profissional_id = v_prof.id)
                          AND ba.inicio < (p_data + v_slot_fim)
                          AND ba.fim > (p_data + v_slot_atual)
                    ) THEN
                        v_valido := false;
                    END IF;
                END IF;

                -- Checagem 4: Horário no passado (se for a data de hoje)
                IF v_valido AND p_data = CURRENT_DATE THEN
                    IF v_slot_atual <= CURRENT_TIME THEN
                        v_valido := false;
                    END IF;
                END IF;

                -- Se válido, emitir linha
                IF v_valido THEN
                    horario := to_char(v_slot_atual, 'HH24:MI');
                    duracao_minutos := v_servico.duracao_minutos;
                    profissional_id := v_prof.id;
                    profissional_nome := v_prof.nome;
                    RETURN NEXT;
                END IF;

                v_slot_atual := (v_slot_atual + (v_passo_minutos || ' minutes')::INTERVAL)::TIME;
            END LOOP;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
