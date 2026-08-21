import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

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
      confirmed_credit_score_680_plus: outcome.confirmed_credit_score_680_plus ?? null,
      confirmed_utilization_under_30: outcome.confirmed_utilization_under_30 ?? null,
      funding_amount: outcome.requested_funding_amount || null,
      qualification_notes: outcome.lead_notes || null,
      callback_window: outcome.callback_window || null,
      outbound_call_completed_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("leads").update(update).eq("id", leadId);
    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return new Response("Internal server error", { status: 500 });
  }
});
