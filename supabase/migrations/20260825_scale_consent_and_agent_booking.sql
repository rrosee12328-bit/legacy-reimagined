-- Persist affirmative call/SMS consent and gate immediate AI calls on that evidence.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS contact_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS contact_consent_timezone text,
  ADD COLUMN IF NOT EXISTS contact_consent_text text;

CREATE OR REPLACE FUNCTION public.enqueue_scale_qualified_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  trigger_secret text;
  request_id bigint;
BEGIN
  IF NEW.source <> 'qualify_form'
    OR NEW.credit_score NOT IN ('680_699', '700_749', '750_plus')
    OR NEW.utilization NOT IN ('under_10', '10_29')
    OR NEW.sms_contact_consent IS NOT TRUE
    OR NEW.contact_consent_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO trigger_secret
  FROM vault.decrypted_secrets
  WHERE name = 'scale_qualified_call_trigger_secret'
  LIMIT 1;

  IF trigger_secret IS NULL THEN
    RAISE WARNING 'Scale qualified call trigger secret is unavailable; lead % was not queued', NEW.id;
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url := 'https://qlvsbsfddwuocfihsleq.supabase.co/functions/v1/trigger-scale-qualified-call',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-scale-trigger-secret', trigger_secret
    ),
    body := jsonb_build_object('record', row_to_json(NEW)::jsonb)
  ) INTO request_id;

  RETURN NEW;
END;
$$;
