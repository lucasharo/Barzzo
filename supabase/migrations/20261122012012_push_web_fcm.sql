-- Enfileira o envio do push após a criação da notificação in-app.
-- A URL e o segredo ficam no Supabase Vault; não incluir credenciais nesta migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'BARZZO_PUSH_WEBHOOK_SECRET'
  ) THEN
    PERFORM vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'BARZZO_PUSH_WEBHOOK_SECRET',
      'Segredo interno para autenticar o disparo de push web.'
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.obter_configuracao_push_web()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, vault
AS $$
  SELECT COALESCE(
    jsonb_object_agg(name, decrypted_secret),
    '{}'::jsonb
  )
  FROM vault.decrypted_secrets
  WHERE name = 'BARZZO_PUSH_WEBHOOK_SECRET';
$$;

REVOKE ALL ON FUNCTION public.obter_configuracao_push_web() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obter_configuracao_push_web() TO service_role;

CREATE OR REPLACE FUNCTION public.enfileirar_push_web_notificacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, net, vault
AS $$
DECLARE
  v_url text;
  v_segredo text;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'BARZZO_PUSH_EDGE_FUNCTION_URL'
  LIMIT 1;

  SELECT decrypted_secret INTO v_segredo
  FROM vault.decrypted_secrets
  WHERE name = 'BARZZO_PUSH_WEBHOOK_SECRET'
  LIMIT 1;

  IF v_url IS NULL OR v_segredo IS NULL THEN
    RAISE WARNING 'Push web não enfileirado: configuração do Vault ausente.';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-barzzo-webhook-secret', v_segredo
    ),
    body := jsonb_build_object('notificacao_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enfileirar_push_web_notificacao ON public.notificacoes;
CREATE TRIGGER trg_enfileirar_push_web_notificacao
AFTER INSERT ON public.notificacoes
FOR EACH ROW
EXECUTE FUNCTION public.enfileirar_push_web_notificacao();
