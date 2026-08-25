import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();
const BUCKET = "lead-credit-screenshots";
const OPT_OUT_WORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);

function twimlResponse(status = 200) {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status,
    headers: { "Content-Type": "text/xml" },
  });
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function bytesToBase64(bytes: ArrayBuffer) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function verifyTwilioSignature(request: Request, params: URLSearchParams, authToken: string) {
  const signature = request.headers.get("x-twilio-signature") ?? "";
  let signedValue = request.url;
  for (const [key, value] of [...params.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    signedValue += key + value;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(signedValue));
  return bytesToBase64(digest) === signature;
}

function extensionFor(contentType: string) {
  const subtype = contentType.split("/")[1]?.toLowerCase() ?? "jpg";
  if (subtype.includes("jpeg")) return "jpg";
  if (subtype.includes("heic")) return "heic";
  if (subtype.includes("heif")) return "heif";
  if (subtype.includes("webp")) return "webp";
  return "png";
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  if (!authToken || !accountSid) return new Response("Messaging is not configured", { status: 500 });

  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);
  if (!(await verifyTwilioSignature(request, params, authToken))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const from = params.get("From") ?? "";
  const messageSid = params.get("MessageSid") ?? params.get("SmsMessageSid") ?? "";
  const body = (params.get("Body") ?? "").trim().toLowerCase();
  const mediaCount = Number(params.get("NumMedia") ?? "0");
  if (!from || !messageSid) return new Response("Invalid Twilio payload", { status: 400 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const senderDigits = normalizePhone(from);
    const { data: candidates, error: leadError } = await supabase
      .from("leads")
      .select("id, phone")
      .order("created_at", { ascending: false })
      .limit(500);
    if (leadError) throw leadError;
    const lead = (candidates ?? []).find((candidate) => normalizePhone(candidate.phone ?? "") === senderDigits);

    if (OPT_OUT_WORDS.has(body) && lead) {
      const { error } = await supabase.from("leads").update({ sms_opted_out: true }).eq("id", lead.id);
      if (error) throw error;
    }

    if (mediaCount < 1 || !lead) return twimlResponse();

    const authorization = `Basic ${btoa(`${accountSid}:${authToken}`)}`;
    for (let index = 0; index < mediaCount; index += 1) {
      const mediaUrl = params.get(`MediaUrl${index}`);
      const contentType = params.get(`MediaContentType${index}`) ?? "application/octet-stream";
      if (!mediaUrl || !contentType.startsWith("image/")) continue;

      const existing = await supabase
        .from("lead_credit_evidence")
        .select("id")
        .eq("twilio_message_sid", messageSid)
        .eq("media_index", index)
        .maybeSingle();
      if (existing.data) continue;

      const mediaResponse = await fetch(mediaUrl, { headers: { Authorization: authorization } });
      if (!mediaResponse.ok) throw new Error(`Twilio media download failed: ${mediaResponse.status}`);
      const storagePath = `${lead.id}/${messageSid}-${index}.${extensionFor(contentType)}`;
      const mediaBytes = await mediaResponse.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, mediaBytes, { contentType, upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("lead_credit_evidence").insert({
        lead_id: lead.id,
        twilio_message_sid: messageSid,
        media_index: index,
        sender_phone: from,
        storage_path: storagePath,
        content_type: contentType,
      });
      if (insertError) throw insertError;
    }

    return twimlResponse();
  } catch (error) {
    console.error("Inbound MMS processing failed", error);
    return twimlResponse(500);
  }
});
