-- Enable the pg_net extension for HTTP calls from database webhooks
-- This migration sets up the webhook to call our edge function when a lead is inserted

-- Create a database webhook trigger that fires on new lead inserts
-- This will be configured via Supabase Dashboard > Database > Webhooks
-- pointing to: https://qlvsbsfddwuocfihsleq.supabase.co/functions/v1/send-lead-email

-- The webhook configuration in Supabase Dashboard should be:
-- Name: send-lead-email
-- Table: leads
-- Events: INSERT
-- Type: Supabase Edge Functions
-- Edge Function: send-lead-email
-- HTTP Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
