-- Impede notificações retroativas para campanhas existentes ao habilitar o produtor.
ALTER TABLE public.campanhas
    ADD COLUMN IF NOT EXISTS notificacao_promocional_habilitada boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.habilitar_notificacao_promocional_campanha()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.notificacao_promocional_habilitada := NEW.ativa;
    ELSIF NEW.ativa IS DISTINCT FROM OLD.ativa THEN
        NEW.notificacao_promocional_habilitada := NEW.ativa;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_habilitar_notificacao_promocional_campanha ON public.campanhas;
CREATE TRIGGER trg_habilitar_notificacao_promocional_campanha
BEFORE INSERT OR UPDATE OF ativa ON public.campanhas
FOR EACH ROW
EXECUTE FUNCTION public.habilitar_notificacao_promocional_campanha();

CREATE OR REPLACE FUNCTION public.processar_notificacoes_campanhas_promocionais()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_total integer;
BEGIN
    INSERT INTO public.notificacoes (usuario_id, titulo, corpo, tipo, link, metadata)
    SELECT DISTINCT
        cb.usuario_id,
        'Nova promoção em ' || b.nome,
        COALESCE(NULLIF(btrim(c.descricao), ''), 'Confira a promoção e as ofertas disponíveis desta barbearia.'),
        'promocao',
        '/barbearias/' || b.slug,
        jsonb_build_object(
            'evento', 'campanha_promocional',
            'campanha_id', c.id,
            'barbearia_id', b.id
        )
    FROM public.campanhas c
    JOIN public.barbearias b ON b.id = c.barbearia_id
    JOIN public.clientes_barbearia cb ON cb.barbearia_id = c.barbearia_id
    LEFT JOIN public.preferencias_notificacao pn ON pn.usuario_id = cb.usuario_id
    WHERE c.ativa = true
      AND c.notificacao_promocional_habilitada = true
      AND c.data_inicio <= now()
      AND c.data_fim >= now()
      AND cb.usuario_id IS NOT NULL
      AND COALESCE(pn.notificacoes_promocionais, true) = true
      AND NOT EXISTS (
          SELECT 1
          FROM public.notificacoes n
          WHERE n.usuario_id = cb.usuario_id
            AND n.metadata ->> 'evento' = 'campanha_promocional'
            AND n.metadata ->> 'campanha_id' = c.id::text
      )
    ON CONFLICT (usuario_id, (metadata ->> 'campanha_id'))
    WHERE metadata ->> 'evento' = 'campanha_promocional'
      AND metadata ->> 'campanha_id' IS NOT NULL
    DO NOTHING;

    GET DIAGNOSTICS v_total = ROW_COUNT;
    RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.habilitar_notificacao_promocional_campanha() FROM PUBLIC, anon, authenticated;
