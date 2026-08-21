import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();
const EXPERIAN_MESSAGE =
  "Scale to Legacy: To verify the score you reported before your funding session, please obtain a current credit report from Experian: https://www.experian.com. Reply STOP to opt out.";

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
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody + timestamp));
  return hex(signed) === digest;
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
  });
  const authorization = `Basic ${btoa(`${accountSid}:${authToken}`)}`;
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(JSON.stringify(payload));
  return String(payload.sid ?? "");
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await request.text();
  const retellKey = Deno.env.get("RETELL_API_KEY");
  const signature = request.headers.get("x-retell-signature") ?? "";
  if (!retellKey || !(await verifySignature(rawBody, signature, retellKey))) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    const leadId = payload.call?.metadata?.lead_id;
    if (!leadId) return Response.json({ sent: false, reason: "Lead was not found" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("phone, sms_contact_consent, sms_opted_out, midcall_experian_sms_sent_at")
      .eq("id", leadId)
      .maybeSingle();
    if (leadError) throw leadError;
    if (!lead?.sms_contact_consent || lead.sms_opted_out) {
      return Response.json({ sent: false, reason: "Text consent is not available" });
    }
    if (lead.midcall_experian_sms_sent_at) {
      return Response.json({ sent: true, duplicate: true });
    }

    const sid = await sendTwilioSms(toE164Phone(lead.phone), EXPERIAN_MESSAGE);
    const { error: updateError } = await supabase
      .from("leads")
      .update({
        midcall_experian_sms_sent_at: new Date().toISOString(),
        midcall_experian_sms_sid: sid,
      })
      .eq("id", leadId);
    if (updateError) throw updateError;

    return Response.json({ sent: true });
  } catch (error) {
    console.error(error);
    return new Response("Could not send the Experian link", { status: 500 });
  }
});
