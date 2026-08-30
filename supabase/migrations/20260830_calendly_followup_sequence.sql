-- Calendly-aware SMS follow-up queue for qualified, unbooked leads.
CREATE TABLE IF NOT EXISTS public.lead_followup_sequence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  sequence_key text NOT NULL DEFAULT 'calendly_booking',
  step_number integer NOT NULL CHECK (step_number BETWEEN 1 AND 4),
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paused', 'processing', 'sent', 'delivered', 'failed', 'cancelled_booked', 'cancelled_opt_out', 'cancelled_disqualified', 'cancelled_manual')),
  attempts integer NOT NULL DEFAULT 0,
  twilio_message_sid text,
  message_body text,
  attempted_at timestamptz,
  sent_at timestamptz,
  cancellation_reason text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, sequence_key, step_number)
);

CREATE INDEX IF NOT EXISTS idx_lead_followup_sequence_due
  ON public.lead_followup_sequence (scheduled_at, status)
  WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_followup_sequence_twilio_sid
  ON public.lead_followup_sequence (twilio_message_sid)
  WHERE twilio_message_sid IS NOT NULL;

ALTER TABLE public.lead_followup_sequence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lead_followup_sequence FROM anon, authenticated;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS booking_sequence_status text,
  ADD COLUMN IF NOT EXISTS booking_sequence_next_at timestamptz,
  ADD COLUMN IF NOT EXISTS booking_sequence_step integer,
  ADD COLUMN IF NOT EXISTS manual_follow_up_needed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.claim_due_lead_followups(batch_size integer DEFAULT 25)
RETURNS SETOF public.lead_followup_sequence
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT id
    FROM public.lead_followup_sequence
    WHERE status = 'pending' AND scheduled_at <= now()
    ORDER BY scheduled_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(batch_size, 1), 100)
  )
  UPDATE public.lead_followup_sequence q
  SET status = 'processing', attempts = attempts + 1, attempted_at = now(), updated_at = now()
  FROM due
  WHERE q.id = due.id
  RETURNING q.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_lead_followups(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_lead_followups(integer) TO service_role;

-- The processor authenticates with a dedicated secret held in Supabase Vault.
-- Create the Vault secret before applying this migration:
--   select vault.create_secret('<random value>', 'scale_followup_cron_secret');
DO $$
DECLARE
  cron_secret text;
BEGIN
  SELECT decrypted_secret INTO cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'scale_followup_cron_secret'
  ORDER BY created_at DESC
  LIMIT 1;

  IF cron_secret IS NULL THEN
    RAISE WARNING 'scale_followup_cron_secret is missing; follow-up cron was not scheduled';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'process-scale-lead-followups';

  PERFORM cron.schedule(
    'process-scale-lead-followups',
    '*/5 * * * *',
    format($job$
      SELECT net.http_post(
        url := 'https://qlvsbsfddwuocfihsleq.supabase.co/functions/v1/process-scale-lead-followups',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-scale-followup-secret', %L),
        body := '{}'::jsonb
      );
    $job$, cron_secret)
  );
END $$;
