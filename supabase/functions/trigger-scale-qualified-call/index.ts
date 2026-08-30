import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Content-Type": "application/json",
};

const qualifyingScores = new Set(["680_699", "700_749", "750_plus"]);
const qualifyingUtilization = new Set(["under_10", "10_29", "30_50"]);

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function toE164Phone(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return trimmed;
}

function isPermittedCallingHour(timeZone: string) {
  try {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        hourCycle: "h23",
      }).format(new Date()),
    );
    return hour >= 8 && hour < 21;
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  const expectedSecret = Deno.env.get("SCALE_TRIGGER_SECRET");
  if (!expectedSecret || request.headers.get("x-scale-trigger-secret") !== expectedSecret) {
    return response(401, { error: "Unauthorized" });
  }

  try {
    const payload = await request.json();
    const lead = payload.record ?? payload;
    const qualifies =
      lead?.source === "qualify_form" &&
      lead?.sms_contact_consent === true &&
      Boolean(lead?.contact_consent_at) &&
      qualifyingScores.has(lead?.credit_score) &&
      qualifyingUtilization.has(lead?.utilization);

    if (!qualifies) {
      return response(200, {
        action: "skipped",
        reason: "Credit score or utilization threshold not met",
      });
    }

    const leadId = String(lead.id ?? "");
    const toNumber = toE164Phone(String(lead.phone ?? ""));
    if (!leadId || !toNumber) {
      return response(400, { error: "Missing lead ID or phone number" });
    }

    const leadTimeZone = String(lead.contact_consent_timezone ?? "");
    if (!leadTimeZone || !isPermittedCallingHour(leadTimeZone)) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await supabase
        .from("leads")
        .update({ outbound_call_status: "deferred_outside_calling_hours" })
        .eq("id", leadId);
      return response(200, {
        action: "deferred",
        reason: "Outside permitted calling hours in the lead's time zone",
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: existing, error: existingError } = await supabase
      .from("leads")
      .select("outbound_call_status, retell_call_id")
      .eq("id", leadId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (
      existing?.retell_call_id ||
      ["queued", "calling", "qualified", "unconfirmed", "not_qualified"].includes(
        existing?.outbound_call_status ?? "",
      )
    ) {
      return response(200, {
        action: "skipped",
        reason: "Lead already processed",
      });
    }

    const retellKey = Deno.env.get("RETELL_API_KEY");
    const agentId = Deno.env.get("SCALE_OUTBOUND_AGENT_ID");
    const agentVersion = Number(Deno.env.get("SCALE_OUTBOUND_AGENT_VERSION") ?? "3");
    if (!retellKey || !agentId) {
      throw new Error("Outbound calling is not configured");
    }

    const retellResponse = await fetch("https://api.retellai.com/v2/create-phone-call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${retellKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from_number: "+16153074302",
        to_number: toNumber,
        override_agent_id: agentId,
        override_agent_version: agentVersion,
        agent_override: {
          agent: {
            // A television or another speaker in the room should not repeatedly
            // cut off the agent. Retell recommends the background-speech mode
            // for this environment and a lower sensitivity for false barge-ins.
            denoising_mode: "noise-and-background-speech-cancellation",
            interruption_sensitivity: 0.65,
            responsiveness: 0.8,
          },
        },
        metadata: {
          lead_id: leadId,
          workflow: "scale_to_legacy_qualification",
        },
        retell_llm_dynamic_variables: {
          lead_id: leadId,
          lead_full_name: String(lead.full_name ?? "there"),
          lead_email: String(lead.email ?? ""),
          lead_phone: toNumber,
          lead_timezone: leadTimeZone,
          calendly_booking_url: "https://calendly.com/scaletolegacy/30min",
          calendly_delivery_instruction:
            "Never read or spell the Calendly URL aloud. Check whether the lead is booked. If they are not booked and do not choose a time during the call, call send_calendly_link immediately, confirm the text was sent, and ask them to open it and complete the booking.",
          submitted_credit_score: String(lead.credit_score ?? ""),
          submitted_utilization: String(lead.utilization ?? ""),
          submitted_llc_status: String(lead.llc_status ?? ""),
        },
      }),
    });

    const retellBody = await retellResponse.json().catch(() => ({}));
    if (!retellResponse.ok) {
      await supabase
        .from("leads")
        .update({
          outbound_call_status: "failed",
          qualification_notes: `Outbound call creation failed: ${JSON.stringify(retellBody)}`.slice(
            0,
            1000,
          ),
        })
        .eq("id", leadId);
      return response(502, { error: "Could not create outbound call" });
    }

    await supabase
      .from("leads")
      .update({
        outbound_call_status: "queued",
        retell_call_id: retellBody.call_id ?? null,
        outbound_call_requested_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    return response(201, {
      action: "call_queued",
      call_id: retellBody.call_id ?? null,
    });
  } catch (error) {
    console.error(error);
    return response(500, { error: "Internal server error" });
  }
});
