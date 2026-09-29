-- Migration: 20260928060000_endereco_usuarios.sql
-- Descrição: Adiciona colunas de endereço do cliente na tabela public.usuarios e sincronização com auth.users

-- 1. Adicionar colunas de endereço em public.usuarios
ALTER TABLE public.usuarios
    ADD COLUMN IF NOT EXISTS cep TEXT,
    ADD COLUMN IF NOT EXISTS logradouro TEXT,
    ADD COLUMN IF NOT EXISTS numero TEXT,
    ADD COLUMN IF NOT EXISTS complemento TEXT,
    ADD COLUMN IF NOT EXISTS bairro TEXT,
    ADD COLUMN IF NOT EXISTS cidade TEXT,
    ADD COLUMN IF NOT EXISTS estado TEXT,
    ADD COLUMN IF NOT EXISTS latitude NUMERIC,
    ADD COLUMN IF NOT EXISTS longitude NUMERIC,
    ADD COLUMN IF NOT EXISTS endereco_completo TEXT;

-- 2. Atualizar a trigger de sincronização de auth.users -> public.usuarios
CREATE OR REPLACE FUNCTION public.funcao_ao_criar_usuario_auth()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.usuarios (
        id,
        nome,
        email,
        telefone,
        foto_url,
        cep,
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
        latitude,
        longitude,
        endereco_completo
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
        NEW.email,
        NEW.raw_user_meta_data->>'telefone',
        NEW.raw_user_meta_data->>'foto_url',
        NEW.raw_user_meta_data->>'cep',
        COALESCE(NEW.raw_user_meta_data->>'logradouro', NEW.raw_user_meta_data->>'endereco'),
        NEW.raw_user_meta_data->>'numero',
        NEW.raw_user_meta_data->>'complemento',
        NEW.raw_user_meta_data->>'bairro',
        NEW.raw_user_meta_data->>'cidade',
        NEW.raw_user_meta_data->>'estado',
        CASE WHEN (NEW.raw_user_meta_data->>'latitude') ~ '^-?[0-9]+(.[0-9]+)?$' THEN (NEW.raw_user_meta_data->>'latitude')::NUMERIC ELSE NULL END,
        CASE WHEN (NEW.raw_user_meta_data->>'longitude') ~ '^-?[0-9]+(.[0-9]+)?$' THEN (NEW.raw_user_meta_data->>'longitude')::NUMERIC ELSE NULL END,
        NEW.raw_user_meta_data->>'endereco_completo'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        nome = CASE WHEN public.usuarios.nome = '' THEN EXCLUDED.nome ELSE public.usuarios.nome END,
        telefone = COALESCE(EXCLUDED.telefone, public.usuarios.telefone),
        foto_url = COALESCE(EXCLUDED.foto_url, public.usuarios.foto_url),
        cep = COALESCE(EXCLUDED.cep, public.usuarios.cep),
        logradouro = COALESCE(EXCLUDED.logradouro, public.usuarios.logradouro),
        numero = COALESCE(EXCLUDED.numero, public.usuarios.numero),
        complemento = COALESCE(EXCLUDED.complemento, public.usuarios.complemento),
        bairro = COALESCE(EXCLUDED.bairro, public.usuarios.bairro),
        cidade = COALESCE(EXCLUDED.cidade, public.usuarios.cidade),
        estado = COALESCE(EXCLUDED.estado, public.usuarios.estado),
        latitude = COALESCE(EXCLUDED.latitude, public.usuarios.latitude),
        longitude = COALESCE(EXCLUDED.longitude, public.usuarios.longitude),
        endereco_completo = COALESCE(EXCLUDED.endereco_completo, public.usuarios.endereco_completo),
        atualizado_em = timezone('utc'::text, now());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
