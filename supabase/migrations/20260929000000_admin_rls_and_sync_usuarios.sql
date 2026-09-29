-- Migration: 20260929000000_admin_rls_and_sync_usuarios.sql
-- Descrição: Função eh_admin, políticas RLS para painel administrativo, sincronização de usuários auth -> public.usuarios

-- 1. Função auxiliar eh_admin
CREATE OR REPLACE FUNCTION public.eh_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        auth.jwt() ->> 'email' = 'admin@barzzo.com.br' OR
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR
        (auth.jwt() -> 'user_metadata' ->> 'papel') = 'admin' OR
        COALESCE((auth.jwt() -> 'app_metadata' ->> 'claims_admin')::boolean, false) = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.eh_admin() TO authenticated, anon;

-- 2. Sincronizar todos os usuários existentes em auth.users para public.usuarios
INSERT INTO public.usuarios (id, nome, email, telefone, criado_em, atualizado_em)
SELECT
    au.id,
    COALESCE(au.raw_user_meta_data->>'nome', split_part(au.email, '@', 1)),
    au.email,
    au.raw_user_meta_data->>'telefone',
    au.created_at,
    COALESCE(au.updated_at, au.created_at)
FROM auth.users au
ON CONFLICT (id) DO UPDATE SET
    nome = COALESCE(EXCLUDED.nome, public.usuarios.nome),
    email = COALESCE(EXCLUDED.email, public.usuarios.email),
    telefone = COALESCE(EXCLUDED.telefone, public.usuarios.telefone),
    atualizado_em = timezone('utc'::text, now());

-- 3. Atualizar/Garantir Trigger de inserção automática de novos auth.users em public.usuarios
CREATE OR REPLACE FUNCTION public.lidar_com_novo_usuario()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.usuarios (
        id,
        nome,
        email,
        telefone,
        criado_em,
        atualizado_em
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
        NEW.email,
        NEW.raw_user_meta_data->>'telefone',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        nome = COALESCE(EXCLUDED.nome, public.usuarios.nome),
        email = COALESCE(EXCLUDED.email, public.usuarios.email),
        telefone = COALESCE(EXCLUDED.telefone, public.usuarios.telefone),
        atualizado_em = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_ao_criar_usuario ON auth.users;
CREATE TRIGGER trigger_ao_criar_usuario
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.lidar_com_novo_usuario();

-- 4. Políticas RLS: public.usuarios
DROP POLICY IF EXISTS "Usuarios podem ler seu proprio registro" ON public.usuarios;
CREATE POLICY "Usuarios podem ler seu proprio registro"
    ON public.usuarios
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id OR public.eh_admin());

-- 5. Políticas RLS: public.assinaturas
DROP POLICY IF EXISTS "Membros leem assinatura da barbearia" ON public.assinaturas;
CREATE POLICY "Membros leem assinatura da barbearia"
    ON public.assinaturas
    FOR SELECT
    TO authenticated
    USING (public.usuario_eh_membro(barbearia_id) OR public.eh_admin());

-- 6. Políticas RLS: public.beneficios_assinatura
DROP POLICY IF EXISTS "Membros leem beneficios da barbearia" ON public.beneficios_assinatura;
CREATE POLICY "Membros leem beneficios da barbearia"
    ON public.beneficios_assinatura
    FOR SELECT
    TO authenticated
    USING (public.usuario_eh_membro(barbearia_id) OR public.eh_admin());

-- 7. Políticas RLS: public.logs_auditoria
DROP POLICY IF EXISTS "Logs auditaveis por usuarios autorizados" ON public.logs_auditoria;
CREATE POLICY "Logs auditaveis por usuarios autorizados"
    ON public.logs_auditoria
    FOR SELECT
    TO authenticated
    USING (public.eh_admin() OR auth.uid() = usuario_id OR (auth.jwt()->>'role')::text = 'service_role');

DROP POLICY IF EXISTS "Insercao de logs de auditoria" ON public.logs_auditoria;
CREATE POLICY "Insercao de logs de auditoria"
    ON public.logs_auditoria
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 8. Políticas RLS: public.barbearias (Permitir update por Admin)
DROP POLICY IF EXISTS "Donos e gerentes podem atualizar dados da barbearia" ON public.barbearias;
CREATE POLICY "Donos e gerentes podem atualizar dados da barbearia"
    ON public.barbearias
    FOR UPDATE
    TO authenticated
    USING (public.usuario_eh_dono_ou_gerente(id) OR public.eh_admin())
    WITH CHECK (public.usuario_eh_dono_ou_gerente(id) OR public.eh_admin());

-- 9. Políticas RLS: public.agendamentos (Permitir select por Admin)
DROP POLICY IF EXISTS "Membros da barbearia podem ver agendamentos" ON public.agendamentos;
CREATE POLICY "Membros da barbearia podem ver agendamentos"
    ON public.agendamentos
    FOR SELECT
    TO authenticated
    USING (
        public.eh_admin()
        OR cliente_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.membros_barbearia mb
            WHERE mb.barbearia_id = agendamentos.barbearia_id
              AND mb.usuario_id = auth.uid()
              AND mb.ativo = true
        )
    );

-- 10. Políticas RLS: public.membros_barbearia (Permitir select por Admin)
DROP POLICY IF EXISTS "Membros podem ver outros membros de suas barbearias" ON public.membros_barbearia;
CREATE POLICY "Membros podem ver outros membros de suas barbearias"
    ON public.membros_barbearia
    FOR SELECT
    TO authenticated
    USING (public.usuario_eh_membro(barbearia_id) OR public.eh_admin());

-- 11. Políticas RLS: public.influenciadores (Permitir select por Admin)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'influenciadores') THEN
        DROP POLICY IF EXISTS "Admin e barbearias veem influenciadores" ON public.influenciadores;
        CREATE POLICY "Admin e barbearias veem influenciadores"
            ON public.influenciadores
            FOR SELECT
            TO authenticated
            USING (public.eh_admin() OR public.usuario_eh_membro(barbearia_id));
    END IF;
END $$;
