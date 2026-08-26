import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

function bytesToBase64(bytes: ArrayBuffer) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function verifyTwilioSignature(params: URLSearchParams, authToken: string) {
  let signedValue = `${Deno.env.get("SUPABASE_URL")}/functions/v1/scale-twilio-message-status`;
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
  return bytesToBase64(digest);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!authToken) return new Response("Messaging is not configured", { status: 500 });
  const params = new URLSearchParams(await request.text());
  const expected = await verifyTwilioSignature(params, authToken);
  if (expected !== (request.headers.get("x-twilio-signature") ?? "")) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sid = params.get("MessageSid") ?? params.get("SmsSid");
  if (!sid) return new Response("Invalid payload", { status: 400 });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error } = await supabase
    .from("lead_communications")
    .update({
      status: params.get("MessageStatus") ?? params.get("SmsStatus") ?? "unknown",
      error_code: params.get("ErrorCode") || null,
      error_message: params.get("ErrorMessage") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("twilio_message_sid", sid);
  if (error) {
    console.error(error);
    return new Response("Could not update message", { status: 500 });
  }
  return new Response(null, { status: 204 });
});
