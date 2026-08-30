import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();
const qualifyingScores = new Set(["680_699", "700_749", "750_plus"]);
const qualifyingUtilization = new Set(["under_10", "10_29", "30_50"]);
const FOLLOW_UP_MESSAGE =
  "Scale to Legacy: Your qualification for business funding is incomplete until you book your call. Book now: https://calendly.com/scaletolegacy/30min. Your appointment is booked only after you see the confirmation and receive the calendar invitation. Reply STOP to opt out.";

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifySignature(rawBody: string, signature: string, apiKey: string) {
  const match = signature.match(/^v=(\d+),d=(.+)$/);
  if (!match) return false;
  const [, timestamp, digest] = match;
  if (Math.abs(Date.now() - Number(timestamp)) > 5 * 60 * 1000) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(apiKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody + timestamp));
  return hex(signatureBytes) === digest;
}

function toE164Phone(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return trimmed;
}

async function sendTwilioSms(to: string, body: string) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!accountSid || !authToken) throw new Error("SMS delivery is not configured");

  const form = new URLSearchParams({
    To: to,
    From: "+16153074302",
    Body: body,
    StatusCallback: `${Deno.env.get("SUPABASE_URL")}/functions/v1/scale-twilio-message-status`,
  });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(JSON.stringify(payload));
  return { sid: String(payload.sid ?? ""), status: String(payload.status ?? "queued") };
}

async function sendUnbookedFollowUp(supabase: ReturnType<typeof createClient>, leadId: string) {
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select(
      "phone, source, credit_score, utilization, sms_contact_consent, sms_opted_out, calendar_booked_at, booking_followup_sms_attempted_at",
    )
    .eq("id", leadId)
    .maybeSingle();
  if (leadError) throw leadError;
  if (
    lead?.source !== "qualify_form" ||
    !qualifyingScores.has(String(lead?.credit_score ?? "")) ||
    !qualifyingUtilization.has(String(lead?.utilization ?? "")) ||
    !lead?.sms_contact_consent ||
    lead.sms_opted_out ||
    lead.calendar_booked_at ||
    lead.booking_followup_sms_attempted_at
  ) {
    return;
  }

  const { count, error: bookingError } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .eq("status", "confirmed");
  if (bookingError) throw bookingError;
  if (count && count > 0) return;

  const attemptAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("leads")
    .update({
      booking_followup_sms_attempted_at: attemptAt,
      booking_followup_sms_status: "sending",
    })
    .eq("id", leadId)
    .is("booking_followup_sms_attempted_at", null)
    .select("phone")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed?.phone) return;

  try {
    const toPhone = toE164Phone(claimed.phone);
    const message = await sendTwilioSms(toPhone, FOLLOW_UP_MESSAGE);
    const { error: communicationError } = await supabase.from("lead_communications").upsert(
      {
        lead_id: leadId,
        twilio_message_sid: message.sid,
        direction: "outbound",
        channel: "sms",
        from_phone: "+16153074302",
        to_phone: toPhone,
        body: FOLLOW_UP_MESSAGE,
        status: message.status,
        matching_status: "matched",
        occurred_at: new Date().toISOString(),
      },
      { onConflict: "twilio_message_sid" },
    );
    if (communicationError) throw communicationError;
    const { error: sentError } = await supabase
      .from("leads")
      .update({
        booking_followup_sms_sent_at: new Date().toISOString(),
        booking_followup_sms_status: "sent",
        booking_followup_sms_sid: message.sid,
      })
      .eq("id", leadId);
    if (sentError) throw sentError;
  } catch (error) {
    const { error: failureError } = await supabase
      .from("leads")
      .update({ booking_followup_sms_status: "failed" })
      .eq("id", leadId);
    if (failureError) throw failureError;
    throw error;
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await request.text();
  const retellKey = Deno.env.get("RETELL_API_KEY");
  const signature = request.headers.get("x-retell-signature") ?? "";
  if (!retellKey || !(await verifySignature(rawBody, signature, retellKey))) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    if (!["call_ended", "call_analyzed"].includes(payload.event)) {
      return new Response(null, { status: 204 });
    }

    const call = payload.call ?? {};
    const leadId = call.metadata?.lead_id;
    if (!leadId) return new Response(null, { status: 204 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (call.call_id) {
      const baseAnalysis = call.call_analysis ?? {};
      const baseOutcome =
        baseAnalysis.custom_analysis_data?.scale_qualification ??
        baseAnalysis.custom_analysis_data ??
        {};
      const { error: historyError } = await supabase.from("lead_call_evidence").upsert(
        {
          lead_id: leadId,
          retell_call_id: call.call_id,
          transcript: call.transcript ?? null,
          recording_url: call.recording_url ?? null,
          recording_multi_channel_url: call.recording_multi_channel_url ?? null,
          duration_ms: call.duration_ms ?? null,
          disconnection_reason: call.disconnection_reason ?? null,
          call_summary: baseAnalysis.call_summary ?? null,
          analysis_data: baseOutcome,
          captured_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "retell_call_id" },
      );
      if (historyError) throw historyError;
    }

    if (call.disconnection_reason === "dial_no_answer") {
      const { error: unansweredError } = await supabase
        .from("leads")
        .update({
          outbound_call_status: "unanswered",
          qualification_status: "unanswered",
          retell_call_id: call.call_id ?? null,
          outbound_call_completed_at: new Date().toISOString(),
        })
        .eq("id", leadId);
      if (unansweredError) throw unansweredError;
      if (payload.event === "call_ended") return new Response(null, { status: 204 });
    }

    if (call.disconnection_reason === "voicemail_reached") {
      const { error: voicemailError } = await supabase
        .from("leads")
        .update({
          outbound_call_status: "voicemail",
          qualification_status: "unconfirmed",
          retell_call_id: call.call_id ?? null,
          outbound_call_completed_at: new Date().toISOString(),
        })
        .eq("id", leadId);
      if (voicemailError) throw voicemailError;

      // The agent leaves a short voicemail, then this webhook sends the
      // consented booking follow-up without waiting for post-call analysis.
      if (payload.event === "call_ended") {
        await sendUnbookedFollowUp(supabase, leadId);
      }
      return new Response(null, { status: 204 });
    }

    if (payload.event !== "call_analyzed") return new Response(null, { status: 204 });

    // Retell places agent-level custom analysis fields alongside the built-in
    // call-analysis fields. Keep the nested fallback for backward compatibility.
    const analysis = call.call_analysis ?? {};
    const outcome =
      analysis.custom_analysis_data?.scale_qualification ??
      analysis.custom_analysis_data ??
      analysis;
    const qualificationStatus =
      call.disconnection_reason === "dial_no_answer"
        ? "unanswered"
        : (outcome.qualification_status ?? "unconfirmed");

    const update = {
      outbound_call_status: qualificationStatus,
      qualification_status: qualificationStatus,
      retell_call_id: call.call_id ?? null,
      confirmed_credit_score_680_plus: outcome.confirmed_credit_score_680_plus ?? null,
      confirmed_utilization_under_30: outcome.confirmed_utilization_under_30 ?? null,
      funding_amount: outcome.requested_funding_amount || null,
      qualification_notes: outcome.lead_notes || null,
      callback_window: outcome.callback_window || null,
      outbound_call_completed_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("leads").update(update).eq("id", leadId);
    if (error) throw error;

    // The applicant already met the form benchmarks before the call was
    // created. Send the required booking link whenever that call is analyzed
    // and no confirmed booking exists, even if Retell returns an incomplete or
    // unexpected qualification label. sendUnbookedFollowUp rechecks consent,
    // opt-out, original eligibility, booking state, and idempotency.
    if (!["unanswered", "not_qualified"].includes(qualificationStatus)) {
      await sendUnbookedFollowUp(supabase, leadId);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return new Response("Internal server error", { status: 500 });
  }
});
