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
  const messageStatus = params.get("MessageStatus") ?? params.get("SmsStatus") ?? "unknown";
  const { error } = await supabase
    .from("lead_communications")
    .update({
      status: messageStatus,
      error_code: params.get("ErrorCode") || null,
      error_message: params.get("ErrorMessage") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("twilio_message_sid", sid);
  if (error) {
    console.error(error);
    return new Response("Could not update message", { status: 500 });
  }
  const sequenceStatus =
    messageStatus === "delivered"
      ? "delivered"
      : ["failed", "undelivered"].includes(messageStatus)
        ? "failed"
        : null;
  if (sequenceStatus) {
    const { data: sequenceStep, error: sequenceError } = await supabase
      .from("lead_followup_sequence")
      .update({
        status: sequenceStatus,
        last_error: params.get("ErrorMessage") || null,
        updated_at: new Date().toISOString(),
      })
      .eq("twilio_message_sid", sid)
      .select("id, lead_id, step_number")
      .maybeSingle();
    if (sequenceError) console.error(sequenceError);
    if (sequenceStep && sequenceStatus === "failed") {
      await supabase.from("automation_issues").upsert(
        {
          lead_id: sequenceStep.lead_id,
          sequence_step_id: sequenceStep.id,
          issue_type: "sms_delivery_failed",
          source: "twilio",
          source_ref: sid,
          severity: "error",
          status: "open",
          summary: `Booking reminder ${sequenceStep.step_number} was not delivered.`,
          technical_detail: params.get("ErrorMessage") || params.get("ErrorCode") || messageStatus,
          recommended_action: "Retry the text after confirming the number and Calendly status.",
          last_occurred_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "source,source_ref,issue_type" },
      );
    } else if (sequenceStep && sequenceStatus === "delivered") {
      await supabase
        .from("automation_issues")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: "system",
          resolution_note: "Twilio confirmed delivery.",
        })
        .eq("sequence_step_id", sequenceStep.id)
        .in("status", ["open", "retrying"]);
    }
  }
  return new Response(null, { status: 204 });
});
