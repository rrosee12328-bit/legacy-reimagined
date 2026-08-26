-- Private, append-only communication history and human answer verification.

ALTER TABLE public.lead_call_evidence
  DROP CONSTRAINT IF EXISTS lead_call_evidence_pkey;

ALTER TABLE public.lead_call_evidence
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS analysis_data jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.lead_call_evidence SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.lead_call_evidence ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.lead_call_evidence ADD PRIMARY KEY (id);
CREATE INDEX IF NOT EXISTS lead_call_evidence_lead_captured_idx
  ON public.lead_call_evidence (lead_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS public.lead_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  twilio_message_sid text UNIQUE NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel text NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'mms')),
  from_phone text NOT NULL,
  to_phone text NOT NULL,
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'received',
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_code text,
  error_message text,
  matching_status text NOT NULL DEFAULT 'matched' CHECK (matching_status IN ('matched', 'unmatched')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_communications_lead_occurred_idx
  ON public.lead_communications (lead_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS lead_communications_unmatched_idx
  ON public.lead_communications (matching_status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.lead_answer_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  field_name text NOT NULL CHECK (field_name IN (
    'credit_score', 'utilization', 'llc_status', 'investment_ready',
    'funding_amount', 'calendar_booking_status'
  )),
  form_value jsonb,
  call_value jsonb,
  verified_value jsonb NOT NULL,
  reviewer text NOT NULL,
  note text,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, field_name)
);

ALTER TABLE public.lead_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_answer_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lead_communications FROM anon, authenticated;
REVOKE ALL ON TABLE public.lead_answer_verifications FROM anon, authenticated;
