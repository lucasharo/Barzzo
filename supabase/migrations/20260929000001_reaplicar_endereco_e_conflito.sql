-- Migration: 20260929000001_reaplicar_endereco_e_conflito.sql
-- Descrição: Reaplica colunas de endereço em usuarios e constraint de conflito de cliente
-- (as migrações 20260928060000 e 20260928070000 foram registradas como aplicadas
--  mas nunca foram executadas no banco remoto)

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

-- 2. Trigger de sincronização auth.users -> public.usuarios com endereço
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
        CASE WHEN (NEW.raw_user_meta_data->>'latitude') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (NEW.raw_user_meta_data->>'latitude')::NUMERIC ELSE NULL END,
        CASE WHEN (NEW.raw_user_meta_data->>'longitude') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (NEW.raw_user_meta_data->>'longitude')::NUMERIC ELSE NULL END,
        NEW.raw_user_meta_data->>'endereco_completo'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        nome = CASE WHEN public.usuarios.nome IS NULL OR public.usuarios.nome = '' THEN EXCLUDED.nome ELSE public.usuarios.nome END,
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

-- Recriar trigger no auth.users
DROP TRIGGER IF EXISTS trigger_ao_criar_usuario_auth ON auth.users;
CREATE TRIGGER trigger_ao_criar_usuario_auth
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.funcao_ao_criar_usuario_auth();

-- 3. Backfill de endereço dos usuários existentes a partir do auth.users
UPDATE public.usuarios u
SET
    cep = COALESCE(u.cep, au.raw_user_meta_data->>'cep'),
    logradouro = COALESCE(u.logradouro, au.raw_user_meta_data->>'logradouro', au.raw_user_meta_data->>'endereco'),
    numero = COALESCE(u.numero, au.raw_user_meta_data->>'numero'),
    complemento = COALESCE(u.complemento, au.raw_user_meta_data->>'complemento'),
    bairro = COALESCE(u.bairro, au.raw_user_meta_data->>'bairro'),
    cidade = COALESCE(u.cidade, au.raw_user_meta_data->>'cidade'),
    estado = COALESCE(u.estado, au.raw_user_meta_data->>'estado'),
    endereco_completo = COALESCE(u.endereco_completo, au.raw_user_meta_data->>'endereco_completo'),
    atualizado_em = timezone('utc'::text, now())
FROM auth.users au
WHERE u.id = au.id;

-- 4. Cancelar agendamentos conflitantes de mesmo cliente (limpeza)
UPDATE public.agendamentos
SET status = 'cancelado',
    observacoes = COALESCE(observacoes, '') || ' [Cancelado por conflito de horário do cliente]'
WHERE id IN (
  SELECT a2.id
  FROM public.agendamentos a1
  JOIN public.agendamentos a2 ON a1.cliente_id = a2.cliente_id AND a1.id < a2.id
  WHERE a1.cliente_id IS NOT NULL
    AND a1.status NOT IN ('cancelado', 'nao_compareceu')
    AND a2.status NOT IN ('cancelado', 'nao_compareceu')
    AND tstzrange(a1.inicio_previsto, a1.fim_previsto, '[)') && tstzrange(a2.inicio_previsto, a2.fim_previsto, '[)')
);

-- 5. Constraint de exclusão para evitar agendamentos sobrepostos por cliente
ALTER TABLE public.agendamentos
    DROP CONSTRAINT IF EXISTS uq_agendamento_cliente_sem_sobreposicao;

ALTER TABLE public.agendamentos
    ADD CONSTRAINT uq_agendamento_cliente_sem_sobreposicao EXCLUDE USING gist (
        cliente_id WITH =,
        tstzrange(inicio_previsto, fim_previsto, '[)') WITH &&
    ) WHERE (cliente_id IS NOT NULL AND status NOT IN ('cancelado', 'nao_compareceu'));
