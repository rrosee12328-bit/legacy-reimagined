import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

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

    const token = Deno.env.get("CALENDLY_API_TOKEN") ?? "";
    const eventType = Deno.env.get("CALENDLY_EVENT_TYPE_URI") ?? "";
    if (!token || !eventType) return json(503, { error: "Calendly is not configured" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, full_name, email, phone, contact_consent_timezone, calendar_booked_at")
      .eq("id", leadId)
      .single();
    if (leadError) throw leadError;

    if (functionName === "find_calendly_times") {
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
