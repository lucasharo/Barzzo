ALTER TABLE public.preferencias_notificacao
    ADD COLUMN IF NOT EXISTS notificacoes_confirmacao boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS notificacoes_cancelamento boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS notificacoes_reagendamento boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS notificacoes_sistema boolean NOT NULL DEFAULT true;

UPDATE public.preferencias_notificacao
SET notificacoes_confirmacao = notificacoes_transacionais,
    notificacoes_cancelamento = notificacoes_transacionais,
    notificacoes_reagendamento = notificacoes_transacionais;

COMMENT ON COLUMN public.preferencias_notificacao.notificacoes_transacionais IS
    'Campo legado. Versões antigas dos apps ainda podem gravá-lo; o gatilho sincroniza os três tipos transacionais.';

CREATE OR REPLACE FUNCTION public.compatibilizar_preferencias_notificacao_legadas()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.notificacoes_transacionais IS DISTINCT FROM true THEN
            NEW.notificacoes_confirmacao := NEW.notificacoes_transacionais;
            NEW.notificacoes_cancelamento := NEW.notificacoes_transacionais;
            NEW.notificacoes_reagendamento := NEW.notificacoes_transacionais;
        END IF;
    ELSIF NEW.notificacoes_transacionais IS DISTINCT FROM OLD.notificacoes_transacionais THEN
        NEW.notificacoes_confirmacao := NEW.notificacoes_transacionais;
        NEW.notificacoes_cancelamento := NEW.notificacoes_transacionais;
        NEW.notificacoes_reagendamento := NEW.notificacoes_transacionais;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compatibilizar_preferencias_notificacao_legadas
    ON public.preferencias_notificacao;
CREATE TRIGGER trg_compatibilizar_preferencias_notificacao_legadas
BEFORE INSERT OR UPDATE OF notificacoes_transacionais
ON public.preferencias_notificacao
FOR EACH ROW
EXECUTE FUNCTION public.compatibilizar_preferencias_notificacao_legadas();

REVOKE ALL ON FUNCTION public.compatibilizar_preferencias_notificacao_legadas()
    FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
