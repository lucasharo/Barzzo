-- Migration: 20260925000000_criar_usuarios_e_auth.sql
-- Descrição: Criação da tabela de usuários, trigger para sincronizar com auth.users,
-- funções de atualização de timestamp, políticas de segurança RLS e configuração de storage.

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Função utilitária para atualizar timestamp
CREATE OR REPLACE FUNCTION public.funcao_atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Tabela public.usuarios
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    telefone TEXT,
    foto_url TEXT,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    atualizado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_telefone ON public.usuarios(telefone);

-- 4. Trigger para atualizar atualizado_em
DROP TRIGGER IF EXISTS trigger_atualizar_usuarios_timestamp ON public.usuarios;
CREATE TRIGGER trigger_atualizar_usuarios_timestamp
    BEFORE UPDATE ON public.usuarios
    FOR EACH ROW
    EXECUTE FUNCTION public.funcao_atualizar_timestamp();

-- 5. Função e trigger para sincronização automática a partir de auth.users
CREATE OR REPLACE FUNCTION public.funcao_ao_criar_usuario_auth()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.usuarios (id, nome, email, telefone, foto_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
        NEW.email,
        NEW.raw_user_meta_data->>'telefone',
        NEW.raw_user_meta_data->>'foto_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        nome = CASE WHEN public.usuarios.nome = '' THEN EXCLUDED.nome ELSE public.usuarios.nome END,
        atualizado_em = timezone('utc'::text, now());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.funcao_ao_criar_usuario_auth();

-- 6. Habilitação de RLS (Row Level Security)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para public.usuarios
-- Usuário autenticado pode ler seus próprios dados
DROP POLICY IF EXISTS "Usuarios podem ler seu proprio registro" ON public.usuarios;
CREATE POLICY "Usuarios podem ler seu proprio registro"
    ON public.usuarios
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Usuário autenticado pode atualizar seu próprio perfil
DROP POLICY IF EXISTS "Usuarios podem atualizar seu proprio perfil" ON public.usuarios;
CREATE POLICY "Usuarios podem atualizar seu proprio perfil"
    ON public.usuarios
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Inserção de novos usuários vinculados ao próprio id
DROP POLICY IF EXISTS "Usuarios podem inserir seu proprio registro" ON public.usuarios;
CREATE POLICY "Usuarios podem inserir seu proprio registro"
    ON public.usuarios
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- 7. Configuração do Storage para fotos de perfil (avatares)
-- Criação do bucket se a tabela de buckets do storage existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatares',
    'avatares',
    true,
    5242880, -- Limite de 5MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

-- Políticas de RLS no Storage (storage.objects)
-- Leitura pública de fotos de avatares
DROP POLICY IF EXISTS "Avatares sao publicamente visiveis" ON storage.objects;
CREATE POLICY "Avatares sao publicamente visiveis"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'avatares');

-- Usuário só pode fazer upload para sua própria pasta: avatares/{usuario_id}/*
DROP POLICY IF EXISTS "Usuarios autenticados podem enviar seu proprio avatar" ON storage.objects;
CREATE POLICY "Usuarios autenticados podem enviar seu proprio avatar"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'avatares' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Usuário só pode atualizar seu próprio avatar
DROP POLICY IF EXISTS "Usuarios podem atualizar seu proprio avatar" ON storage.objects;
CREATE POLICY "Usuarios podem atualizar seu proprio avatar"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'avatares' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Usuário só pode excluir seu próprio avatar
DROP POLICY IF EXISTS "Usuarios podem remover seu proprio avatar" ON storage.objects;
CREATE POLICY "Usuarios podem remover seu proprio avatar"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'avatares' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );
