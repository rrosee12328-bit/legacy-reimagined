import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();
const BOOKING_MESSAGE =
  "Scale to Legacy: Your qualification for business funding is incomplete until you book your call.\n\nBook now:\nhttps://calendly.com/scaletolegacy/30min\n\nYour appointment is booked only after you see the confirmation and receive the calendar invitation. Reply STOP to opt out.";

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status });
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyRetell(rawBody: string, signature: string, apiKey: string) {
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
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody + timestamp));
  return hex(signed) === digest;
}

async function calendly(path: string, token: string, init?: RequestInit) {
  const response = await fetch(`https://api.calendly.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Calendly ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

function toE164Phone(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return trimmed;
}

async function sendTwilioSms(to: string) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!accountSid || !authToken) throw new Error("SMS delivery is not configured");

  const form = new URLSearchParams({
    To: to,
    From: "+16153074302",
    Body: BOOKING_MESSAGE,
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
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Twilio ${response.status}: ${JSON.stringify(result)}`);
  return { sid: String(result.sid ?? ""), status: String(result.status ?? "queued") };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const rawBody = await request.text();
  const retellKey = Deno.env.get("RETELL_API_KEY") ?? "";
  const signature = request.headers.get("x-retell-signature") ?? "";
  if (!retellKey || !(await verifyRetell(rawBody, signature, retellKey))) {
    return json(401, { error: "Unauthorized" });
  }

  try {
    const payload = JSON.parse(rawBody);
    const functionName = String(payload.name ?? "");
    const args = payload.args ?? {};
    const leadId = String(payload.call?.metadata?.lead_id ?? "");
    if (!leadId) return json(400, { error: "Missing lead context" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(
        "id, full_name, email, phone, contact_consent_timezone, calendar_booked_at, sms_contact_consent, sms_opted_out, booking_followup_sms_attempted_at, booking_followup_sms_sent_at",
      )
      .eq("id", leadId)
      .single();
    if (leadError) throw leadError;

    if (functionName === "send_calendly_link") {
      if (lead.calendar_booked_at) {
        return json(200, {
          sent: false,
          booked: true,
          message: "The lead already has a confirmed booking. Do not send or read the link.",
        });
      }
      if (!lead.sms_contact_consent || lead.sms_opted_out) {
        return json(200, {
          sent: false,
          message: "Text consent is not available. Do not read the URL aloud.",
        });
      }
      if (lead.booking_followup_sms_sent_at || lead.booking_followup_sms_attempted_at) {
        return json(200, {
          sent: true,
          duplicate: true,
          message: "The Calendly link was already texted. Tell the lead to check their messages.",
        });
      }

      const attemptedAt = new Date().toISOString();
      const { data: claimed, error: claimError } = await supabase
        .from("leads")
        .update({
          booking_followup_sms_attempted_at: attemptedAt,
          booking_followup_sms_status: "sending",
        })
        .eq("id", leadId)
        .is("booking_followup_sms_attempted_at", null)
        .select("phone")
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claimed?.phone) {
        return json(200, {
          sent: true,
          duplicate: true,
          message: "The Calendly link is already being sent. Do not read the URL aloud.",
        });
      }

      try {
        const toPhone = toE164Phone(claimed.phone);
        const message = await sendTwilioSms(toPhone);
        const { error: communicationError } = await supabase.from("lead_communications").upsert(
          {
            lead_id: leadId,
            twilio_message_sid: message.sid,
            direction: "outbound",
            channel: "sms",
            from_phone: "+16153074302",
            to_phone: toPhone,
            body: BOOKING_MESSAGE,
            status: message.status,
            matching_status: "matched",
            occurred_at: new Date().toISOString(),
          },
          { onConflict: "twilio_message_sid" },
        );
        if (communicationError) throw communicationError;
        const { error: updateError } = await supabase
          .from("leads")
          .update({
            booking_followup_sms_sent_at: new Date().toISOString(),
            booking_followup_sms_status: "sent",
            booking_followup_sms_sid: message.sid,
          })
          .eq("id", leadId);
        if (updateError) throw updateError;
        return json(200, {
          sent: true,
          message: "The Calendly link was texted. Tell the lead to open the text and book now.",
        });
      } catch (error) {
        await supabase
          .from("leads")
          .update({ booking_followup_sms_status: "failed" })
          .eq("id", leadId);
        throw error;
      }
    }

    const token = Deno.env.get("CALENDLY_API_TOKEN") ?? "";
    const eventType = Deno.env.get("CALENDLY_EVENT_TYPE_URI") ?? "";
    if (!token || !eventType) return json(503, { error: "Calendly is not configured" });

    if (functionName === "find_calendly_times") {
      if (lead.calendar_booked_at) {
        return json(200, {
          booked: true,
          calendar_booked_at: lead.calendar_booked_at,
          available_times: [],
          instruction:
            "This lead is already booked. Do not send Calendly or offer another time. Send the Experian instructions instead.",
        });
      }
      const start = new Date();
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      const params = new URLSearchParams({
        event_type: eventType,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      });
      const result = await calendly(`/event_type_available_times?${params}`, token);
      const slots = (result.collection ?? []).slice(0, 6).map((slot: Record<string, unknown>) => ({
        start_time: slot.start_time,
        status: slot.status,
      }));
      return json(200, {
        booked: false,
        timezone: lead.contact_consent_timezone ?? "UTC",
        available_times: slots,
        instruction: "Offer two or three of these times and ask the lead which they prefer.",
      });
    }

    if (functionName === "book_calendly_time") {
      if (lead.calendar_booked_at) {
        return json(200, { booked: true, message: "This lead already has a confirmed booking." });
      }
      const startTime = String(args.start_time ?? "");
      if (!startTime) return json(400, { error: "A selected start_time is required" });

      const booking = await calendly("/invitees", token, {
        method: "POST",
        body: JSON.stringify({
          event_type: eventType,
          start_time: startTime,
          invitee: {
            name: lead.full_name,
            email: lead.email,
            timezone: lead.contact_consent_timezone ?? "UTC",
          },
        }),
      });
      const eventUri = String(booking.resource?.event ?? booking.resource?.uri ?? "");
      const { error: bookingError } = await supabase.from("bookings").upsert(
        {
          calendly_event_id: eventUri,
          invitee_name: lead.full_name,
          invitee_email: lead.email,
          invitee_phone: lead.phone,
          event_start_time: startTime,
          status: "confirmed",
          lead_id: leadId,
          notes: "Booked by the Retell qualification agent during the outbound call.",
        },
        { onConflict: "calendly_event_id" },
      );
      if (bookingError) throw bookingError;
      await supabase
        .from("leads")
        .update({
          calendar_booked_at: new Date().toISOString(),
          calendly_event_id: eventUri,
          outbound_call_status: "qualified_booked",
          pipeline_stage: "Call Scheduled",
          status: "Call Scheduled",
        })
        .eq("id", leadId);
      return json(200, {
        booked: true,
        start_time: startTime,
        message: "The strategy session is booked. Confirm the date and time to the lead.",
      });
    }

    return json(400, { error: "Unknown scheduling function" });
  } catch (error) {
    console.error(error);
    return json(500, { error: "Scheduling request failed" });
  }
});
