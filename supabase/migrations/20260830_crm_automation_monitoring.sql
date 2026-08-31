CREATE TABLE IF NOT EXISTS public.automation_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  sequence_step_id uuid REFERENCES public.lead_followup_sequence(id) ON DELETE SET NULL,
  issue_type text NOT NULL,
  source text NOT NULL,
  source_ref text NOT NULL,
  severity text NOT NULL DEFAULT 'error' CHECK (severity IN ('warning', 'error', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'retrying', 'resolved', 'dismissed')),
  summary text NOT NULL,
  technical_detail text,
  recommended_action text,
  retry_count integer NOT NULL DEFAULT 0,
  first_occurred_at timestamptz NOT NULL DEFAULT now(),
  last_occurred_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_ref, issue_type)
);

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  processed integer NOT NULL DEFAULT 0,
  error_detail text
);

CREATE TABLE IF NOT EXISTS public.crm_recovery_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  issue_id uuid REFERENCES public.automation_issues(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  requested_by text NOT NULL,
  status text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_call_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  retell_call_id text UNIQUE,
  requested_by text NOT NULL,
  source text NOT NULL DEFAULT 'crm',
  status text NOT NULL,
  failure_detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_issues_open
  ON public.automation_issues (status, severity, last_occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_worker
  ON public.automation_runs (worker, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_call_attempts_cooldown
  ON public.lead_call_attempts (lead_id, created_at DESC);

ALTER TABLE public.automation_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_recovery_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_call_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_issues FROM anon, authenticated;
REVOKE ALL ON public.automation_runs FROM anon, authenticated;
REVOKE ALL ON public.crm_recovery_actions FROM anon, authenticated;
REVOKE ALL ON public.lead_call_attempts FROM anon, authenticated;
