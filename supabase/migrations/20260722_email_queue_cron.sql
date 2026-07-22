-- ============================================================
-- Scale to Legacy — Email Queue Cron Job
-- Created: 2026-07-22
-- Purpose: Calls the process-email-queue edge function every hour
--          to send any scheduled emails that are due.
-- ============================================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create hourly cron job to process email queue
SELECT cron.schedule(
  'process-email-queue',
  '0 * * * *',  -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url := 'https://qlvsbsfddwuocfihsleq.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsdnNic2ZkZHd1b2NmaWhzbGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMzMyNTMsImV4cCI6MjA5OTkwOTI1M30.0OYygnsDw16SpkeTOuWkmbvig7mTvHnn9F4AP6Si7-Y'
    ),
    body := '{}'::jsonb
  );
  $$
);
