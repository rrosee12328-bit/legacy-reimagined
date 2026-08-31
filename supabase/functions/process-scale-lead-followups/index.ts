import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FROM_NUMBER = "+16153074302";
const BOOKING_URL = "https://calendly.com/scaletolegacy/30min";
const qualifyingScores = new Set(["680_699", "700_749", "750_plus"]);
const qualifyingUtilization = new Set(["under_10", "10_29", "30_50"]);

function trackedBookingUrl(leadId: string) {
  const url = new URL(BOOKING_URL);
  url.searchParams.set("utm_source", "sms");
  url.searchParams.set("utm_medium", "followup");
  url.searchParams.set("utm_campaign", "booking_sequence");
  url.searchParams.set("utm_content", leadId);
  return url.toString();
}

function messageFor(step: number, firstName: string, leadId: string) {
  const link = trackedBookingUrl(leadId);
  if (step === 1)
    return `Hi ${firstName}, this is Scale to Legacy. Your qualification for business funding is incomplete until you book your required call.\n\nBook here:\n${link}\n\nYour appointment is confirmed only after you see the confirmation screen and receive the calendar invitation. Reply STOP to opt out.`;
  if (step === 2)
    return `Hi ${firstName}, quick reminder from Scale to Legacy: your business funding qualification is still incomplete because we do not see a confirmed call.\n\nChoose your time here:\n${link}\n\nReply STOP to opt out.`;
  if (step === 3)
    return `Hi ${firstName}, we still do not see your Scale to Legacy qualification call on the calendar. Booking the call is required to complete qualification.\n\nBook here:\n${link}\n\nReply STOP to opt out.`;
  return `Hi ${firstName}, this is your final reminder from Scale to Legacy. Your business funding qualification will remain incomplete until you book your required call.\n\nBook here:\n${link}\n\nReply STOP to opt out.`;
}

function normalizedPhone(value: unknown) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(-10);
}

function toE164(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return value.trim();
}

function localHour(date: Date, timezone: string) {
  try {
    return Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(date),
    );
  } catch {
    return -1;
  }
}

function nextAllowedTime(timezone: string | null) {
  const now = new Date();
  if (!timezone) {
    // A fixed 1 p.m. Central fallback stays in daytime across the continental US.
    const candidate = new Date(now);
    for (let i = 0; i < 48; i += 1) {
      if (localHour(candidate, "America/Chicago") === 13 && candidate > now) return candidate;
      candidate.setUTCMinutes(candidate.getUTCMinutes() + 30);
    }
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
  const hour = localHour(now, timezone);
  if (hour >= 9 && hour < 20) return null;
  const candidate = new Date(now);
  for (let i = 0; i < 96; i += 1) {
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 15);
    if (localHour(candidate, timezone) === 9) return candidate;
  }
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

async function calendlyHasBooking(lead: Record<string, unknown>) {
  const token = Deno.env.get("CALENDLY_API_TOKEN");
  const eventType = Deno.env.get("CALENDLY_EVENT_TYPE_URI");
  if (!token || !eventType) throw new Error("Calendly reconciliation is not configured");
  const headers = { Authorization: `Bearer ${token}` };
  const meResponse = await fetch("https://api.calendly.com/users/me", { headers });
  if (!meResponse.ok) throw new Error(`Calendly user lookup failed: ${meResponse.status}`);
  const me = await meResponse.json();
  const organization = me.resource?.current_organization;
  if (!organization) throw new Error("Calendly organization was not returned");

  const params = new URLSearchParams({
    organization,
    event_type: eventType,
    status: "active",
    count: "100",
    min_start_time: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (lead.email) params.set("invitee_email", String(lead.email).trim().toLowerCase());
  const response = await fetch(`https://api.calendly.com/scheduled_events?${params}`, { headers });
  if (!response.ok) throw new Error(`Calendly event lookup failed: ${response.status}`);
  const events = (await response.json()).collection ?? [];
  if (lead.email && events.length > 0) return true;

  // Phone-only fallback: inspect invitees from recent matching events and require an exact match.
  const phone = normalizedPhone(lead.phone);
  if (!phone) return false;
  for (const event of events.slice(0, 25)) {
    const eventId = String(event.uri ?? "")
      .split("/")
      .pop();
    if (!eventId) continue;
    const inviteesResponse = await fetch(
      `https://api.calendly.com/scheduled_events/${eventId}/invitees?count=100`,
      { headers },
    );
    if (!inviteesResponse.ok) continue;
    const invitees = (await inviteesResponse.json()).collection ?? [];
    if (
      invitees.some(
        (invitee: Record<string, unknown>) =>
          normalizedPhone(invitee.text_reminder_number) === phone,
      )
    )
      return true;
  }
  return false;
}

async function sendSms(to: string, body: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!sid || !token) throw new Error("Twilio is not configured");
  const form = new URLSearchParams({
    To: to,
    From: FROM_NUMBER,
    Body: body,
    StatusCallback: `${Deno.env.get("SUPABASE_URL")}/functions/v1/scale-twilio-message-status`,
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Twilio ${response.status}: ${JSON.stringify(payload)}`);
  return { sid: String(payload.sid), status: String(payload.status ?? "queued") };
}

async function upsertIssue(
  supabase: ReturnType<typeof createClient>,
  input: Record<string, unknown>,
) {
  await supabase.from("automation_issues").upsert(
    {
      ...input,
      status: "open",
      last_occurred_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "source,source_ref,issue_type" },
  );
}

async function resolveIssues(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  sourceRef: string,
) {
  await supabase
    .from("automation_issues")
    .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: "system" })
    .eq("lead_id", leadId)
    .eq("source_ref", sourceRef)
    .in("status", ["open", "retrying"]);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("SCALE_FOLLOWUP_CRON_SECRET");
  if (!secret || request.headers.get("x-scale-followup-secret") !== secret)
    return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: run } = await supabase
    .from("automation_runs")
    .insert({ worker: "process-scale-lead-followups", status: "running" })
    .select("id")
    .single();
  const { data: jobs, error } = await supabase.rpc("claim_due_lead_followups", { batch_size: 25 });
  if (error) {
    if (run?.id)
      await supabase
        .from("automation_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_detail: error.message,
        })
        .eq("id", run.id);
    return new Response(error.message, { status: 500 });
  }
  const results: Array<Record<string, unknown>> = [];

  for (const job of jobs ?? []) {
    try {
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select(
          "id, full_name, email, phone, source, credit_score, utilization, qualification_status, sms_contact_consent, sms_opted_out, calendar_booked_at, contact_consent_timezone",
        )
        .eq("id", job.lead_id)
        .single();
      if (leadError) throw leadError;

      let cancelStatus: string | null = null;
      if (!lead.sms_contact_consent || lead.sms_opted_out) cancelStatus = "cancelled_opt_out";
      else if (
        !qualifyingScores.has(String(lead.credit_score)) ||
        !qualifyingUtilization.has(String(lead.utilization)) ||
        lead.qualification_status === "not_qualified"
      )
        cancelStatus = "cancelled_disqualified";

      const { count } = await supabase
        .from("bookings")
        .select("id", { head: true, count: "exact" })
        .eq("lead_id", lead.id)
        .eq("status", "confirmed");
      if (lead.calendar_booked_at || (count ?? 0) > 0) cancelStatus = "cancelled_booked";
      if (!cancelStatus && (await calendlyHasBooking(lead))) {
        cancelStatus = "cancelled_booked";
        await supabase
          .from("leads")
          .update({ calendar_booked_at: new Date().toISOString() })
          .eq("id", lead.id);
      }

      if (cancelStatus) {
        await supabase
          .from("lead_followup_sequence")
          .update({
            status: cancelStatus,
            cancellation_reason: cancelStatus.replace("cancelled_", ""),
            updated_at: new Date().toISOString(),
          })
          .eq("lead_id", lead.id)
          .in("status", ["pending", "processing"]);
        await supabase
          .from("leads")
          .update({
            booking_sequence_status: cancelStatus,
            booking_sequence_next_at: null,
          })
          .eq("id", lead.id);
        results.push({ id: job.id, status: cancelStatus });
        continue;
      }

      const deferredUntil = nextAllowedTime(lead.contact_consent_timezone);
      if (deferredUntil) {
        await supabase
          .from("lead_followup_sequence")
          .update({
            status: "pending",
            scheduled_at: deferredUntil.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        results.push({ id: job.id, status: "deferred" });
        continue;
      }

      // Final race check after the job is claimed and immediately before Twilio.
      const { data: freshLead } = await supabase
        .from("leads")
        .select("calendar_booked_at, sms_opted_out")
        .eq("id", lead.id)
        .single();
      if (freshLead?.calendar_booked_at || freshLead?.sms_opted_out) {
        const status = freshLead.calendar_booked_at ? "cancelled_booked" : "cancelled_opt_out";
        await supabase
          .from("lead_followup_sequence")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("lead_id", lead.id)
          .in("status", ["pending", "processing"]);
        continue;
      }

      const firstName =
        String(lead.full_name ?? "there")
          .trim()
          .split(/\s+/)[0] || "there";
      const body = messageFor(Number(job.step_number), firstName, lead.id);
      const sms = await sendSms(toE164(String(lead.phone)), body);
      const now = new Date().toISOString();
      await supabase.from("lead_communications").upsert(
        {
          lead_id: lead.id,
          twilio_message_sid: sms.sid,
          direction: "outbound",
          channel: "sms",
          from_phone: FROM_NUMBER,
          to_phone: toE164(String(lead.phone)),
          body,
          status: sms.status,
          matching_status: "matched",
          occurred_at: now,
        },
        { onConflict: "twilio_message_sid" },
      );
      await supabase
        .from("lead_followup_sequence")
        .update({
          status: "sent",
          twilio_message_sid: sms.sid,
          message_body: body,
          sent_at: now,
          updated_at: now,
        })
        .eq("id", job.id);
      await resolveIssues(supabase, lead.id, String(job.id));

      const { data: nextJob } = await supabase
        .from("lead_followup_sequence")
        .select("step_number, scheduled_at")
        .eq("lead_id", lead.id)
        .eq("status", "pending")
        .order("step_number")
        .limit(1)
        .maybeSingle();
      await supabase
        .from("leads")
        .update({
          booking_sequence_status: nextJob ? "active" : "manual_follow_up_needed",
          booking_sequence_step: Number(job.step_number),
          booking_sequence_next_at: nextJob?.scheduled_at ?? null,
          manual_follow_up_needed: !nextJob && Number(job.step_number) === 4,
        })
        .eq("id", lead.id);
      results.push({ id: job.id, status: "sent", sid: sms.sid });
    } catch (jobError) {
      const retry = Number(job.attempts) < 3;
      await supabase
        .from("lead_followup_sequence")
        .update({
          status: retry ? "pending" : "failed",
          scheduled_at: retry
            ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
            : job.scheduled_at,
          last_error: String(jobError).slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      if (!retry) {
        await upsertIssue(supabase, {
          lead_id: job.lead_id,
          sequence_step_id: job.id,
          issue_type: "followup_step_failed",
          source: "followup_processor",
          source_ref: String(job.id),
          severity: "error",
          summary: `Booking reminder ${job.step_number} could not be sent after three attempts.`,
          technical_detail: String(jobError).slice(0, 2000),
          recommended_action: "Retry the text after checking Calendly and lead eligibility.",
          retry_count: Number(job.attempts),
        });
      }
      results.push({ id: job.id, status: retry ? "retrying" : "failed" });
    }
  }

  if (run?.id)
    await supabase
      .from("automation_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        processed: results.length,
      })
      .eq("id", run.id);

  return Response.json({ processed: results.length, results });
});
