-- Migration: 20260925000001_criar_barbearias_e_equipe.sql
-- Descrição: Tabelas de barbearias, membros da barbearia (dono, gerente, profissional),
-- profissionais (suportando profissional sem conta), convites de equipe,
-- funções RPC de criação de barbearia com dono e aceite de convites,
-- além de políticas de Row Level Security (RLS) multi-tenant restritivas.

-- 1. Tabela de Barbearias
CREATE TABLE IF NOT EXISTS public.barbearias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    telefone TEXT,
    email TEXT,
    documento TEXT,
    endereco TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    cep TEXT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    logo_url TEXT,
    status_assinatura TEXT DEFAULT 'trial' NOT NULL CHECK (status_assinatura IN ('trial', 'ativo', 'inadimplente', 'cancelado')),
    trial_inicio TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    trial_fim TIMESTAMPTZ DEFAULT (timezone('utc'::text, now()) + interval '30 days') NOT NULL,
    onboarding_concluido BOOLEAN DEFAULT false NOT NULL,
    ativa BOOLEAN DEFAULT true NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_barbearias_slug ON public.barbearias(slug);
CREATE INDEX IF NOT EXISTS idx_barbearias_cidade_estado ON public.barbearias(cidade, estado);

DROP TRIGGER IF EXISTS trigger_atualizar_barbearias_timestamp ON public.barbearias;
CREATE TRIGGER trigger_atualizar_barbearias_timestamp
    BEFORE UPDATE ON public.barbearias
    FOR EACH ROW
    EXECUTE FUNCTION public.funcao_atualizar_timestamp();

-- 2. Tabela de Membros da Barbearia (Vínculo e Papéis)
CREATE TABLE IF NOT EXISTS public.membros_barbearia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id UUID REFERENCES public.barbearias(id) ON DELETE CASCADE NOT NULL,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE NOT NULL,
    papel TEXT NOT NULL CHECK (papel IN ('dono', 'gerente', 'profissional')),
    ativo BOOLEAN DEFAULT true NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_membros_barbearia_usuario UNIQUE (barbearia_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_membros_usuario ON public.membros_barbearia(usuario_id);
CREATE INDEX IF NOT EXISTS idx_membros_barbearia ON public.membros_barbearia(barbearia_id);

DROP TRIGGER IF EXISTS trigger_atualizar_membros_timestamp ON public.membros_barbearia;
CREATE TRIGGER trigger_atualizar_membros_timestamp
    BEFORE UPDATE ON public.membros_barbearia
    FOR EACH ROW
    EXECUTE FUNCTION public.funcao_atualizar_timestamp();

-- 3. Tabela de Profissionais (pode existir sem conta associada inicialmente)
CREATE TABLE IF NOT EXISTS public.profissionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id UUID REFERENCES public.barbearias(id) ON DELETE CASCADE NOT NULL,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    foto_url TEXT,
    bio TEXT,
    ativo BOOLEAN DEFAULT true NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profissionais_barbearia ON public.profissionais(barbearia_id);
CREATE INDEX IF NOT EXISTS idx_profissionais_usuario ON public.profissionais(usuario_id);

DROP TRIGGER IF EXISTS trigger_atualizar_profissionais_timestamp ON public.profissionais;
CREATE TRIGGER trigger_atualizar_profissionais_timestamp
    BEFORE UPDATE ON public.profissionais
    FOR EACH ROW
    EXECUTE FUNCTION public.funcao_atualizar_timestamp();

-- 4. Tabela de Convites de Profissionais
CREATE TABLE IF NOT EXISTS public.convites_profissionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id UUID REFERENCES public.barbearias(id) ON DELETE CASCADE NOT NULL,
    profissional_id UUID REFERENCES public.profissionais(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    papel TEXT DEFAULT 'profissional' NOT NULL CHECK (papel IN ('gerente', 'profissional')),
    token TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pendente' NOT NULL CHECK (status IN ('pendente', 'aceito', 'recusado', 'expirado')),
    expira_em TIMESTAMPTZ NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    respondido_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_convites_token ON public.convites_profissionais(token);
CREATE INDEX IF NOT EXISTS idx_convites_barbearia ON public.convites_profissionais(barbearia_id);

-- 5. Funções Auxiliares de Verificação de Permissão (Security Definer)
CREATE OR REPLACE FUNCTION public.usuario_eh_membro(p_barbearia_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.membros_barbearia
        WHERE barbearia_id = p_barbearia_id
          AND usuario_id = auth.uid()
          AND ativo = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.usuario_eh_dono_ou_gerente(p_barbearia_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.membros_barbearia
        WHERE barbearia_id = p_barbearia_id
          AND usuario_id = auth.uid()
          AND papel IN ('dono', 'gerente')
          AND ativo = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 6. RPC: Criar barbearia atômica vinculando o criador como dono
CREATE OR REPLACE FUNCTION public.criar_barbearia_com_dono(
    p_nome TEXT,
    p_slug TEXT,
    p_telefone TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_endereco TEXT DEFAULT NULL,
    p_bairro TEXT DEFAULT NULL,
    p_cidade TEXT DEFAULT NULL,
    p_estado TEXT DEFAULT NULL,
    p_cep TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_barbearia_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Inserir barbearia com trial de 30 dias
    INSERT INTO public.barbearias (
        nome, slug, telefone, email, endereco, bairro, cidade, estado, cep,
        status_assinatura, trial_inicio, trial_fim, onboarding_concluido
    )
    VALUES (
        p_nome, p_slug, p_telefone, p_email, p_endereco, p_bairro, p_cidade, p_estado, p_cep,
        'trial', timezone('utc'::text, now()), timezone('utc'::text, now()) + interval '30 days', false
    )
    RETURNING id INTO v_barbearia_id;

    -- Vincular o usuário como Dono
    INSERT INTO public.membros_barbearia (barbearia_id, usuario_id, papel, ativo)
    VALUES (v_barbearia_id, auth.uid(), 'dono', true);

    RETURN v_barbearia_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Aceitar convite de equipe
CREATE OR REPLACE FUNCTION public.aceitar_convite_equipe(p_token TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_convite RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário deve estar autenticado para aceitar o convite.';
    END IF;

    SELECT * INTO v_convite
    FROM public.convites_profissionais
    WHERE token = p_token
      AND status = 'pendente'
      AND expira_em > timezone('utc'::text, now());

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Convite inválido ou expirado.';
    END IF;

    -- Vincular profissional à conta do usuário
    UPDATE public.profissionais
    SET usuario_id = auth.uid(),
        atualizado_em = timezone('utc'::text, now())
    WHERE id = v_convite.profissional_id;

    -- Inserir ou atualizar na tabela de membros
    INSERT INTO public.membros_barbearia (barbearia_id, usuario_id, papel, ativo)
    VALUES (v_convite.barbearia_id, auth.uid(), v_convite.papel, true)
    ON CONFLICT (barbearia_id, usuario_id) DO UPDATE SET
        papel = EXCLUDED.papel,
        ativo = true,
        atualizado_em = timezone('utc'::text, now());

    -- Atualizar status do convite
    UPDATE public.convites_profissionais
    SET status = 'aceito',
        respondido_em = timezone('utc'::text, now())
    WHERE id = v_convite.id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Row Level Security (RLS) Multi-Tenant

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.barbearias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros_barbearia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convites_profissionais ENABLE ROW LEVEL SECURITY;

-- 8.1 Políticas para public.barbearias
-- Qualquer um pode visualizar barbearias ativas (marketplace público do Barzzo)
DROP POLICY IF EXISTS "Barbearias ativas sao publicas" ON public.barbearias;
CREATE POLICY "Barbearias ativas sao publicas"
    ON public.barbearias
    FOR SELECT
    USING (ativa = true);

-- Apenas donos e gerentes podem atualizar os dados da barbearia
DROP POLICY IF EXISTS "Donos e gerentes podem atualizar dados da barbearia" ON public.barbearias;
CREATE POLICY "Donos e gerentes podem atualizar dados da barbearia"
    ON public.barbearias
    FOR UPDATE
    TO authenticated
    USING (public.usuario_eh_dono_ou_gerente(id))
    WITH CHECK (public.usuario_eh_dono_ou_gerente(id));

-- Inserção de barbearia via authenticated
DROP POLICY IF EXISTS "Usuarios autenticados podem criar barbearias" ON public.barbearias;
CREATE POLICY "Usuarios autenticados podem criar barbearias"
    ON public.barbearias
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 8.2 Políticas para public.membros_barbearia (Isolamento Multi-Tenant)
-- Usuário pode ver membros das barbearias das quais ele é membro
DROP POLICY IF EXISTS "Membros podem ver outros membros de suas barbearias" ON public.membros_barbearia;
CREATE POLICY "Membros podem ver outros membros de suas barbearias"
    ON public.membros_barbearia
    FOR SELECT
    TO authenticated
    USING (public.usuario_eh_membro(barbearia_id));

-- Apenas donos e gerentes podem inserir/modificar membros na sua barbearia
DROP POLICY IF EXISTS "Donos e gerentes podem gerenciar membros" ON public.membros_barbearia;
CREATE POLICY "Donos e gerentes podem gerenciar membros"
    ON public.membros_barbearia
    FOR ALL
    TO authenticated
    USING (public.usuario_eh_dono_ou_gerente(barbearia_id))
    WITH CHECK (public.usuario_eh_dono_ou_gerente(barbearia_id));

-- 8.3 Políticas para public.profissionais
-- Leitura pública para visualização de profissionais da barbearia no marketplace e parceiro
DROP POLICY IF EXISTS "Profissionais ativos sao publicos" ON public.profissionais;
CREATE POLICY "Profissionais ativos sao publicos"
    ON public.profissionais
    FOR SELECT
    USING (ativo = true);

-- Donos e gerentes podem gerenciar profissionais da sua barbearia
DROP POLICY IF EXISTS "Donos e gerentes podem gerenciar profissionais" ON public.profissionais;
CREATE POLICY "Donos e gerentes podem gerenciar profissionais"
    ON public.profissionais
    FOR ALL
    TO authenticated
    USING (public.usuario_eh_dono_ou_gerente(barbearia_id))
    WITH CHECK (public.usuario_eh_dono_ou_gerente(barbearia_id));

-- Profissional pode atualizar seu próprio perfil/bio
DROP POLICY IF EXISTS "Profissional pode atualizar seu proprio perfil" ON public.profissionais;
CREATE POLICY "Profissional pode atualizar seu proprio perfil"
    ON public.profissionais
    FOR UPDATE
    TO authenticated
    USING (usuario_id = auth.uid())
    WITH CHECK (usuario_id = auth.uid());

-- 8.4 Políticas para public.convites_profissionais
-- Donos e gerentes podem ver e gerenciar convites da sua barbearia
DROP POLICY IF EXISTS "Donos e gerentes gerenciam convites" ON public.convites_profissionais;
CREATE POLICY "Donos e gerentes gerenciam convites"
    ON public.convites_profissionais
    FOR ALL
    TO authenticated
    USING (public.usuario_eh_dono_ou_gerente(barbearia_id))
    WITH CHECK (public.usuario_eh_dono_ou_gerente(barbearia_id));

-- Leitura de convite pelo token (pública ou autenticada para aceitar convite)
DROP POLICY IF EXISTS "Leitura de convite por token" ON public.convites_profissionais;
CREATE POLICY "Leitura de convite por token"
    ON public.convites_profissionais
    FOR SELECT
    USING (status = 'pendente' AND expira_em > timezone('utc'::text, now()));
