-- Evita resolução de objetos por schemas controláveis em uma função SECURITY DEFINER.
ALTER FUNCTION public.buscar_barbearias_com_distancia(
    NUMERIC,
    NUMERIC,
    TEXT,
    NUMERIC,
    TEXT,
    NUMERIC,
    TEXT,
    TEXT,
    INTEGER,
    INTEGER
) SET search_path = '';
