-- Migration: 20260925000010_busca_geografica_distancia.sql
-- Descrição: Função RPC para buscar barbearias calculando distância por latitude/longitude no PostgreSQL.

CREATE OR REPLACE FUNCTION public.buscar_barbearias_com_distancia(
    p_latitude NUMERIC DEFAULT NULL,
    p_longitude NUMERIC DEFAULT NULL,
    p_busca_nome TEXT DEFAULT NULL,
    p_raio_km NUMERIC DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    nome TEXT,
    slug TEXT,
    logo_url TEXT,
    telefone TEXT,
    endereco TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    cep TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    distancia_km NUMERIC,
    preco_corte NUMERIC,
    menor_preco NUMERIC,
    maior_preco NUMERIC,
    media_nota NUMERIC,
    total_avaliacoes BIGINT,
    total_servicos BIGINT,
    servicos JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.nome,
        b.slug,
        b.logo_url,
        b.telefone,
        b.endereco,
        b.bairro,
        b.cidade,
        b.estado,
        b.cep,
        b.latitude,
        b.longitude,
        public.calcular_distancia_km(p_latitude, p_longitude, b.latitude, b.longitude) AS distancia_km,
        COALESCE((
            SELECT s.preco FROM public.servicos s
            WHERE s.barbearia_id = b.id AND s.ativo = true AND (s.nome ILIKE '%corte%' OR s.nome ILIKE '%cabelo%')
            ORDER BY s.preco ASC LIMIT 1
        ), NULL) AS preco_corte,
        (
            SELECT MIN(s.preco) FROM public.servicos s
            WHERE s.barbearia_id = b.id AND s.ativo = true AND s.preco > 0
        ) AS menor_preco,
        (
            SELECT MAX(s.preco) FROM public.servicos s
            WHERE s.barbearia_id = b.id AND s.ativo = true AND s.preco > 0
        ) AS maior_preco,
        COALESCE((
            SELECT ROUND(AVG(a.nota)::numeric, 1) FROM public.avaliacoes a
            WHERE a.barbearia_id = b.id
        ), 0.0) AS media_nota,
        COALESCE((
            SELECT COUNT(a.id) FROM public.avaliacoes a
            WHERE a.barbearia_id = b.id
        ), 0::bigint) AS total_avaliacoes,
        COALESCE((
            SELECT COUNT(s.id) FROM public.servicos s
            WHERE s.barbearia_id = b.id AND s.ativo = true
        ), 0::bigint) AS total_servicos,
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'preco', s.preco, 'ativo', s.ativo))
            FROM public.servicos s
            WHERE s.barbearia_id = b.id AND s.ativo = true
        ), '[]'::jsonb) AS servicos
    FROM public.barbearias b
    WHERE b.ativa = true
      AND (
          p_busca_nome IS NULL
          OR b.nome ILIKE '%' || p_busca_nome || '%'
      )
      AND (
          p_raio_km IS NULL
          OR p_latitude IS NULL
          OR p_longitude IS NULL
          OR b.latitude IS NULL
          OR b.longitude IS NULL
          OR public.calcular_distancia_km(p_latitude, p_longitude, b.latitude, b.longitude) <= p_raio_km
      )
    ORDER BY
        CASE WHEN p_latitude IS NOT NULL AND b.latitude IS NOT NULL THEN
            public.calcular_distancia_km(p_latitude, p_longitude, b.latitude, b.longitude)
        ELSE NULL END ASC NULLS LAST,
        b.nome ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.buscar_barbearias_com_distancia TO anon, authenticated;