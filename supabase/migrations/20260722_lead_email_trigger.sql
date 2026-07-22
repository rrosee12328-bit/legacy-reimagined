-- ============================================================
-- Scale to Legacy — Lead Email Trigger
-- Created: 2026-07-22
-- Purpose: Fires the send-lead-email edge function via net.http_post
--          every time a new lead is inserted into the leads table.
--          Sends path-specific emails via Resend from info@scaletolegacynow.com
-- ============================================================

-- Step 1: Ensure pg_net extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Step 2: Create (or replace) the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://qlvsbsfddwuocfihsleq.supabase.co/functions/v1/send-lead-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsdnNic2ZkZHd1b2NmaWhzbGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMzMyNTMsImV4cCI6MjA5OTkwOTI1M30.0OYygnsDw16SpkeTOuWkmbvig7mTvHnn9F4AP6Si7-Y'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'leads',
      'record', row_to_json(NEW)::jsonb
    )
  ) INTO request_id;
  RETURN NEW;
END;
$$;

-- Step 3: Drop old trigger if it exists
DROP TRIGGER IF EXISTS on_lead_insert ON public.leads;

-- Step 4: Create the trigger on the leads table
CREATE TRIGGER on_lead_insert
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_lead();

-- ============================================================
-- Email routing logic (handled in the edge function):
--   score = 'hot'  → Lead gets "You May Qualify" email
--                  → rrose@vektiss.com gets hot lead notification
--   score = 'warm' → Lead gets "You're Closer Than You Think" email
--   score = 'cold' → Lead gets "Your Free Guide Is Ready" email
--
-- Sending domain: info@scaletolegacynow.com (verified in Resend)
-- Edge function secret: RESEND_API_KEY (set in Supabase Edge Functions > Secrets)
-- ============================================================
