-- ============================================================
-- Scale to Legacy — Booking Sequence Tables
-- Created: 2026-07-22
-- Purpose: Store Calendly bookings and schedule the 7-email
--          post-booking sequence for each confirmed booking.
-- ============================================================

-- Table: bookings
-- Stores confirmed Calendly bookings
CREATE TABLE IF NOT EXISTS public.bookings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  calendly_event_id text UNIQUE,
  invitee_name      text NOT NULL,
  invitee_email     text NOT NULL,
  invitee_phone     text,
  event_start_time  timestamptz NOT NULL,
  event_end_time    timestamptz,
  event_name        text,
  status            text NOT NULL DEFAULT 'confirmed',
  lead_id           uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  notes             text
);

-- Table: scheduled_emails
-- Queue of emails to be sent at specific times
CREATE TABLE IF NOT EXISTS public.scheduled_emails (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  booking_id    uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  to_email      text NOT NULL,
  to_name       text NOT NULL,
  subject       text NOT NULL,
  html_body     text NOT NULL,
  send_at       timestamptz NOT NULL,
  sent_at       timestamptz,
  status        text NOT NULL DEFAULT 'pending',
  email_number  integer NOT NULL,
  error         text
);

-- RLS policies for bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert on bookings"
  ON public.bookings FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon select on bookings"
  ON public.bookings FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon update on bookings"
  ON public.bookings FOR UPDATE TO anon USING (true);

-- RLS policies for scheduled_emails
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert on scheduled_emails"
  ON public.scheduled_emails FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon select on scheduled_emails"
  ON public.scheduled_emails FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon update on scheduled_emails"
  ON public.scheduled_emails FOR UPDATE TO anon USING (true);

-- Index for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_send_at
  ON public.scheduled_emails (send_at, status)
  WHERE status = 'pending';
