-- Store inbound credit-score screenshots privately and associate them to CRM leads.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lead-credit-screenshots',
  'lead-credit-screenshots',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.lead_credit_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  twilio_message_sid text NOT NULL,
  media_index integer NOT NULL DEFAULT 0,
  sender_phone text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  content_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (twilio_message_sid, media_index)
);

CREATE INDEX IF NOT EXISTS lead_credit_evidence_lead_id_idx
  ON public.lead_credit_evidence (lead_id, received_at DESC);

ALTER TABLE public.lead_credit_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lead_credit_evidence FROM anon, authenticated;
