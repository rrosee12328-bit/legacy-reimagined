import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();
const FOLLOW_UP_MESSAGE =
  "Scale to Legacy: Thanks for speaking with us. Book your funding strategy session here: https://calendly.com/scaletolegacy/30min. To verify the score you reported, please get a current credit report from Experian: https://www.experian.com. Reply STOP to opt out.";

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

  const form = new URLSearchParams({ To: to, From: "+16153074302", Body: body });
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
  return String(payload.sid ?? "");
}

async function sendUnbookedFollowUp(supabase: ReturnType<typeof createClient>, leadId: string) {
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select(
      "phone, sms_contact_consent, sms_opted_out, calendar_booked_at, booking_followup_sms_attempted_at",
    )
    .eq("id", leadId)
    .maybeSingle();
  if (leadError) throw leadError;
  if (
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
    const sid = await sendTwilioSms(toE164Phone(claimed.phone), FOLLOW_UP_MESSAGE);
    const { error: sentError } = await supabase
      .from("leads")
      .update({
        booking_followup_sms_sent_at: new Date().toISOString(),
        booking_followup_sms_status: "sent",
        booking_followup_sms_sid: sid,
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
    if (payload.event !== "call_analyzed") {
      return new Response(null, { status: 204 });
    }

    const call = payload.call ?? {};
    const leadId = call.metadata?.lead_id;
    if (!leadId) return new Response(null, { status: 204 });

    // Retell places agent-level custom analysis fields alongside the built-in
    // call-analysis fields. Keep the nested fallback for backward compatibility.
    const analysis = call.call_analysis ?? {};
    const outcome =
      analysis.custom_analysis_data?.scale_qualification ??
      analysis.custom_analysis_data ??
      analysis;
    const qualificationStatus = outcome.qualification_status ?? "unconfirmed";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

    if (call.call_id) {
      const { error: evidenceError } = await supabase.from("lead_call_evidence").upsert(
        {
          lead_id: leadId,
          retell_call_id: call.call_id,
          transcript: call.transcript ?? null,
          recording_url: call.recording_url ?? null,
          recording_multi_channel_url: call.recording_multi_channel_url ?? null,
          duration_ms: call.duration_ms ?? null,
          disconnection_reason: call.disconnection_reason ?? null,
          call_summary: analysis.call_summary ?? null,
          captured_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "lead_id" },
      );
      if (evidenceError) throw evidenceError;
    }
    if (qualificationStatus === "qualified") {
      await sendUnbookedFollowUp(supabase, leadId);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return new Response("Internal server error", { status: 500 });
  }
});
