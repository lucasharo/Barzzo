-- Pagina a busca do marketplace no banco para reduzir a carga enviada ao app Cliente.
DROP FUNCTION IF EXISTS public.buscar_barbearias_com_distancia(NUMERIC, NUMERIC, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.buscar_barbearias_com_distancia(
    p_latitude NUMERIC DEFAULT NULL,
    p_longitude NUMERIC DEFAULT NULL,
    p_busca_nome TEXT DEFAULT NULL,
    p_raio_km NUMERIC DEFAULT NULL,
    p_faixa_preco TEXT DEFAULT 'todos',
    p_nota_minima NUMERIC DEFAULT NULL,
    p_ordenacao TEXT DEFAULT 'relevancia',
    p_busca_localidade TEXT DEFAULT NULL,
    p_limite INTEGER DEFAULT 10,
    p_deslocamento INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    nome TEXT,
    slug TEXT,
    logo_url TEXT,
    foto_capa_url TEXT,
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
    WITH resultados AS (
        SELECT
            b.id,
            b.nome,
            b.slug,
            b.logo_url,
            COALESCE(
                (
                    SELECT gf.foto_url FROM public.galeria_fotos gf
                    WHERE gf.barbearia_id = b.id AND gf.destaque_capa = true
                    ORDER BY gf.created_at DESC LIMIT 1
                ),
                (
                    SELECT gf.foto_url FROM public.galeria_fotos gf
                    WHERE gf.barbearia_id = b.id
                    ORDER BY gf.ordem ASC, gf.created_at ASC LIMIT 1
                ),
                b.logo_url
            ) AS foto_capa_url,
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
                WHERE s.barbearia_id = b.id AND s.ativo = true
                  AND (s.nome ILIKE '%corte%' OR s.nome ILIKE '%cabelo%')
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
                SELECT jsonb_agg(jsonb_build_object(
                    'id', s.id, 'nome', s.nome, 'preco', s.preco, 'ativo', s.ativo
                ))
                FROM public.servicos s
                WHERE s.barbearia_id = b.id AND s.ativo = true
            ), '[]'::jsonb) AS servicos
        FROM public.barbearias b
        WHERE b.ativa = true
          AND public.barbearia_possui_horarios_ativos(b.id) = true
          AND (p_busca_nome IS NULL OR b.nome ILIKE '%' || p_busca_nome || '%')
          AND (
              p_raio_km IS NULL
              OR p_latitude IS NULL
              OR p_longitude IS NULL
              OR b.latitude IS NULL
              OR b.longitude IS NULL
              OR public.calcular_distancia_km(p_latitude, p_longitude, b.latitude, b.longitude) <= p_raio_km
          )
    ), filtrados AS (
        SELECT r.*
        FROM resultados r
        WHERE CASE p_faixa_preco
            WHEN 'ate-35' THEN COALESCE(r.preco_corte, r.menor_preco) <= 35
            WHEN 'ate-50' THEN COALESCE(r.preco_corte, r.menor_preco) <= 50
            WHEN 'ate-75' THEN COALESCE(r.preco_corte, r.menor_preco) <= 75
            WHEN 'acima-75' THEN COALESCE(r.preco_corte, r.menor_preco) > 75
            ELSE true
        END
          AND (
              p_nota_minima IS NULL
              OR (r.total_avaliacoes > 0 AND r.media_nota >= p_nota_minima)
          )
          AND (
              p_busca_localidade IS NULL
              OR EXISTS (
                  SELECT 1
                  FROM regexp_split_to_table(p_busca_localidade, '[,[:space:]-]+') AS termo(valor)
                  WHERE length(termo.valor) >= 2
                    AND translate(
                        lower(concat_ws(' ', r.bairro, r.cidade, r.estado, r.endereco)),
                        'áàâãäéèêëíìîïóòôõöúùûüç',
                        'aaaaaeeeeiiiiooooouuuuc'
                    ) ILIKE '%' || termo.valor || '%'
              )
              OR (
                  length(regexp_replace(p_busca_localidade, '[^0-9]', '', 'g')) >= 4
                  AND regexp_replace(COALESCE(r.cep, ''), '[^0-9]', '', 'g')
                      LIKE '%' || regexp_replace(p_busca_localidade, '[^0-9]', '', 'g') || '%'
              )
          )
    )
    SELECT
        f.id,
        f.nome,
        f.slug,
        f.logo_url,
        f.foto_capa_url,
        f.telefone,
        f.endereco,
        f.bairro,
        f.cidade,
        f.estado,
        f.cep,
        f.latitude,
        f.longitude,
        f.distancia_km,
        f.preco_corte,
        f.menor_preco,
        f.maior_preco,
        f.media_nota,
        f.total_avaliacoes,
        f.total_servicos,
        f.servicos
    FROM filtrados f
    ORDER BY
        CASE
            WHEN p_ordenacao = 'distancia'
              OR (p_ordenacao = 'relevancia' AND p_latitude IS NOT NULL)
            THEN f.distancia_km
        END ASC NULLS LAST,
        CASE WHEN p_ordenacao = 'menor-preco' THEN COALESCE(f.preco_corte, f.menor_preco) END ASC NULLS LAST,
        CASE WHEN p_ordenacao = 'maior-preco' THEN COALESCE(f.preco_corte, f.menor_preco) END DESC NULLS LAST,
        CASE WHEN p_ordenacao = 'melhor-nota' THEN f.media_nota END DESC NULLS LAST,
        CASE WHEN p_ordenacao = 'melhor-nota' THEN f.total_avaliacoes END DESC NULLS LAST,
        f.nome ASC,
        f.id ASC
    LIMIT LEAST(GREATEST(COALESCE(p_limite, 10), 1), 50)
    OFFSET GREATEST(COALESCE(p_deslocamento, 0), 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.buscar_barbearias_com_distancia(
    NUMERIC, NUMERIC, TEXT, NUMERIC, TEXT, NUMERIC, TEXT, TEXT, INTEGER, INTEGER
) TO anon, authenticated;
