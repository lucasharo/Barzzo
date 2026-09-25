-- Migration: 20260925000004_marketplace_e_busca.sql
-- Descrição: Funções de geolocalização (Haversine), busca e listagem pública para o marketplace do cliente.

-- 1. Função Haversine para cálculo de distância em quilômetros
CREATE OR REPLACE FUNCTION public.calcular_distancia_km(
    lat1 NUMERIC,
    lon1 NUMERIC,
    lat2 NUMERIC,
    lon2 NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
    r NUMERIC := 6371; -- Raio da Terra em KM
    dlat NUMERIC;
    dlon NUMERIC;
    a NUMERIC;
    c NUMERIC;
BEGIN
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN NULL;
    END IF;

    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    a := sin(dlat / 2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2)^2;
    c := 2 * atan2(sqrt(a), sqrt(1 - a));

    RETURN round((r * c)::numeric, 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. RPC: Busca de barbearias para o marketplace
CREATE OR REPLACE FUNCTION public.buscar_barbearias_marketplace(
    p_termo TEXT DEFAULT NULL,
    p_cidade TEXT DEFAULT NULL,
    p_estado TEXT DEFAULT NULL,
    p_latitude NUMERIC DEFAULT NULL,
    p_longitude NUMERIC DEFAULT NULL,
    p_raio_km NUMERIC DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    nome TEXT,
    slug TEXT,
    logo_url TEXT,
    endereco TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    distancia_km NUMERIC,
    total_servicos_ativos BIGINT,
    total_profissionais_ativos BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.nome,
        b.slug,
        b.logo_url,
        b.endereco,
        b.bairro,
        b.cidade,
        b.estado,
        b.latitude,
        b.longitude,
        public.calcular_distancia_km(p_latitude, p_longitude, b.latitude, b.longitude) AS distancia_km,
        COUNT(DISTINCT s.id) AS total_servicos_ativos,
        COUNT(DISTINCT p.id) AS total_profissionais_ativos
    FROM public.barbearias b
    LEFT JOIN public.servicos s ON s.barbearia_id = b.id AND s.ativo = true
    LEFT JOIN public.profissionais p ON p.barbearia_id = b.id AND p.ativo = true
    WHERE b.ativa = true
      AND (
          p_termo IS NULL
          OR b.nome ILIKE '%' || p_termo || '%'
          OR b.bairro ILIKE '%' || p_termo || '%'
          OR b.cidade ILIKE '%' || p_termo || '%'
          OR EXISTS (
              SELECT 1 FROM public.servicos serv
              WHERE serv.barbearia_id = b.id
                AND serv.ativo = true
                AND serv.nome ILIKE '%' || p_termo || '%'
          )
      )
      AND (p_cidade IS NULL OR b.cidade ILIKE p_cidade)
      AND (p_estado IS NULL OR b.estado ILIKE p_estado)
      AND (
          p_latitude IS NULL
          OR p_longitude IS NULL
          OR b.latitude IS NULL
          OR b.longitude IS NULL
          OR public.calcular_distancia_km(p_latitude, p_longitude, b.latitude, b.longitude) <= p_raio_km
      )
    GROUP BY b.id
    ORDER BY
        CASE WHEN p_latitude IS NOT NULL AND b.latitude IS NOT NULL THEN
            public.calcular_distancia_km(p_latitude, p_longitude, b.latitude, b.longitude)
        ELSE NULL END ASC NULLS LAST,
        b.nome ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. Permissões de Execução Pública
GRANT EXECUTE ON FUNCTION public.calcular_distancia_km TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_barbearias_marketplace TO anon, authenticated;
