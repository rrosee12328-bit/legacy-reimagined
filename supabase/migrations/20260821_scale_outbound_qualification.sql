-- Scale to Legacy qualified form-to-call workflow.
-- Calls are triggered only for self-reported 680+ score and under-30% utilization submissions.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS outbound_call_status text,
  ADD COLUMN IF NOT EXISTS retell_call_id text,
  ADD COLUMN IF NOT EXISTS outbound_call_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS outbound_call_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS qualification_status text,
  ADD COLUMN IF NOT EXISTS confirmed_credit_score_680_plus boolean,
  ADD COLUMN IF NOT EXISTS confirmed_utilization_under_30 boolean,
  ADD COLUMN IF NOT EXISTS qualification_notes text,
  ADD COLUMN IF NOT EXISTS callback_window text;

CREATE INDEX IF NOT EXISTS leads_outbound_call_status_idx ON public.leads(outbound_call_status);
CREATE INDEX IF NOT EXISTS leads_retell_call_id_idx ON public.leads(retell_call_id);

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
    OR NEW.utilization NOT IN ('under_10', '10_29') THEN
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

DROP TRIGGER IF EXISTS on_scale_qualified_lead_insert ON public.leads;
CREATE TRIGGER on_scale_qualified_lead_insert
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_scale_qualified_call();
