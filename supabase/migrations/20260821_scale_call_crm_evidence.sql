-- Keep sensitive call evidence private, separate from publicly submitted lead rows.

CREATE TABLE IF NOT EXISTS public.lead_call_evidence (
  lead_id uuid PRIMARY KEY REFERENCES public.leads(id) ON DELETE CASCADE,
  retell_call_id text UNIQUE NOT NULL,
  transcript text,
  recording_url text,
  recording_multi_channel_url text,
  duration_ms integer,
  disconnection_reason text,
  call_summary text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_call_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lead_call_evidence FROM anon, authenticated;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS sms_contact_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_opted_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS calendar_confirmation_token uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS calendar_booked_at timestamptz,
  ADD COLUMN IF NOT EXISTS calendly_event_id text,
  ADD COLUMN IF NOT EXISTS midcall_experian_sms_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS midcall_experian_sms_sid text,
  ADD COLUMN IF NOT EXISTS booking_followup_sms_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS booking_followup_sms_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS booking_followup_sms_status text,
  ADD COLUMN IF NOT EXISTS booking_followup_sms_sid text;

CREATE INDEX IF NOT EXISTS idx_bookings_lead_id ON public.bookings (lead_id);

-- The public qualification form may insert a lead, but CRM reads and changes
-- now flow through password-protected service-role Edge Functions.
DROP POLICY IF EXISTS "Allow anon select" ON public.leads;
DROP POLICY IF EXISTS "Allow anon update" ON public.leads;
