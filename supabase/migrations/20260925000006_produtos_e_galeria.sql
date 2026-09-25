-- Migration: 20260925000006_produtos_e_galeria.sql
-- Descrição: Catálogo de produtos presenciais e galeria de fotos com pipeline de mídia.

-- 1. Tabela: produtos (Catálogo de conveniência presencial da barbearia)
CREATE TABLE IF NOT EXISTS public.produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id UUID NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT,
    preco NUMERIC(10,2) NOT NULL CHECK (preco >= 0),
    foto_url TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    destaque BOOLEAN NOT NULL DEFAULT false,
    ordem INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produtos_barbearia ON public.produtos(barbearia_id);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON public.produtos(ativo);

-- 2. Tabela: galeria_fotos (Fotos do estabelecimento, cortes e ambiente)
CREATE TABLE IF NOT EXISTS public.galeria_fotos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barbearia_id UUID NOT NULL REFERENCES public.barbearias(id) ON DELETE CASCADE,
    titulo TEXT,
    foto_url TEXT NOT NULL,
    destaque_capa BOOLEAN NOT NULL DEFAULT false,
    ordem INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_galeria_barbearia ON public.galeria_fotos(barbearia_id);
CREATE INDEX IF NOT EXISTS idx_galeria_capa ON public.galeria_fotos(destaque_capa);

-- 3. Row Level Security (RLS)

-- RLS: produtos
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer pessoa pode visualizar produtos ativos"
ON public.produtos FOR SELECT
USING (
    ativo = true
    OR EXISTS (
        SELECT 1 FROM public.membros_equipe m
        WHERE m.barbearia_id = produtos.barbearia_id
          AND m.usuario_id = auth.uid()
          AND m.ativo = true
    )
);

CREATE POLICY "Membros da equipe gerenciam produtos da barbearia"
ON public.produtos FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.membros_equipe m
        WHERE m.barbearia_id = produtos.barbearia_id
          AND m.usuario_id = auth.uid()
          AND m.ativo = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.membros_equipe m
        WHERE m.barbearia_id = produtos.barbearia_id
          AND m.usuario_id = auth.uid()
          AND m.ativo = true
    )
);

-- RLS: galeria_fotos
ALTER TABLE public.galeria_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer pessoa pode visualizar fotos da galeria"
ON public.galeria_fotos FOR SELECT
USING (true);

CREATE POLICY "Membros da equipe gerenciam fotos da barbearia"
ON public.galeria_fotos FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.membros_equipe m
        WHERE m.barbearia_id = galeria_fotos.barbearia_id
          AND m.usuario_id = auth.uid()
          AND m.ativo = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.membros_equipe m
        WHERE m.barbearia_id = galeria_fotos.barbearia_id
          AND m.usuario_id = auth.uid()
          AND m.ativo = true
    )
);

-- 4. Buckets de Storage Públicos para Mídia
INSERT INTO storage.buckets (id, name, public)
VALUES ('produtos', 'produtos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('galeria', 'galeria', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "Leitura pública de fotos de produtos"
ON storage.objects FOR SELECT
USING (bucket_id = 'produtos');

CREATE POLICY "Membros autenticados enviam fotos de produtos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'produtos' AND auth.role() = 'authenticated');

CREATE POLICY "Leitura pública de fotos da galeria"
ON storage.objects FOR SELECT
USING (bucket_id = 'galeria');

CREATE POLICY "Membros autenticados enviam fotos da galeria"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'galeria' AND auth.role() = 'authenticated');
