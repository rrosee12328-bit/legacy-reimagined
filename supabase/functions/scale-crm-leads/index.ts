import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedFields = [
  "status",
  "pipeline_stage",
  "notes",
  "funding_amount_secured",
  "funded_at",
  "follow_up_date",
  "last_contacted_at",
  "assigned_to",
];
const verificationFields = new Set([
  "credit_score",
  "utilization",
  "llc_status",
  "investment_ready",
  "funding_amount",
  "calendar_booking_status",
]);
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://scaletolegacynow.com",
  "Access-Control-Allow-Headers": "content-type, x-scale-crm-password",
  "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
  "Content-Type": "application/json",
};
const BOOKING_URL = "https://calendly.com/scaletolegacy/30min";
const TWILIO_FROM_NUMBER = "+16153074302";
const qualifyingScores = new Set(["680_699", "700_749", "750_plus"]);
const qualifyingUtilization = new Set(["under_10", "10_29", "30_50"]);

function permittedCallingHour(timezone: string) {
  try {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hourCycle: "h23",
      }).format(new Date()),
    );
    return hour >= 8 && hour < 21;
  } catch {
    return false;
  }
}

async function calendlyBookingExists(lead: Record<string, unknown>) {
  const token = Deno.env.get("CALENDLY_API_TOKEN");
  const eventType = Deno.env.get("CALENDLY_EVENT_TYPE_URI");
  if (!token || !eventType) throw new Error("Calendly reconciliation is not configured");
  const headers = { Authorization: `Bearer ${token}` };
  const meResponse = await fetch("https://api.calendly.com/users/me", { headers });
  if (!meResponse.ok) throw new Error(`Calendly user lookup failed: ${meResponse.status}`);
  const me = await meResponse.json();
  const organization = me.resource?.current_organization;
  const params = new URLSearchParams({
    organization,
    event_type: eventType,
    status: "active",
    count: "100",
    min_start_time: new Date(Date.now() - 30 * 86400000).toISOString(),
  });
  params.set(
    "invitee_email",
    String(lead.email ?? "")
      .trim()
      .toLowerCase(),
  );
  const response = await fetch(`https://api.calendly.com/scheduled_events?${params}`, { headers });
  if (!response.ok) throw new Error(`Calendly event lookup failed: ${response.status}`);
  return ((await response.json()).collection ?? []).length > 0;
}

async function auditRecovery(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  issueId: string | null,
  action: string,
  reviewer: string,
  status: string,
  detail: Record<string, unknown> = {},
) {
  await supabase.from("crm_recovery_actions").insert({
    lead_id: leadId,
    issue_id: issueId,
    action_type: action,
    requested_by: reviewer,
    status,
    detail,
  });
}

async function openIssue(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  type: string,
  sourceRef: string,
  summary: string,
  technicalDetail: string,
  recommendedAction: string,
) {
  await supabase.from("automation_issues").upsert(
    {
      lead_id: leadId,
      issue_type: type,
      source: "crm",
      source_ref: sourceRef,
      severity: "error",
      status: "open",
      summary,
      technical_detail: technicalDetail.slice(0, 4000),
      recommended_action: recommendedAction,
      last_occurred_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "source,source_ref,issue_type" },
  );
}

async function cancelBookedSequence(supabase: ReturnType<typeof createClient>, leadId: string) {
  const now = new Date().toISOString();
  await supabase
    .from("leads")
    .update({
      calendar_booked_at: now,
      booking_sequence_status: "cancelled_booked",
      booking_sequence_next_at: null,
    })
    .eq("id", leadId);
  await supabase
    .from("lead_followup_sequence")
    .update({
      status: "cancelled_booked",
      cancellation_reason: "Calendly booking confirmed",
      updated_at: now,
    })
    .eq("lead_id", leadId)
    .in("status", ["pending", "paused", "failed", "processing"]);
}

function toE164Phone(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return trimmed;
}

function bookingReminder(firstName: string) {
  return `Hi ${firstName}, this is Scale to Legacy. Your qualification for business funding is incomplete until you book your required call. Book here: ${BOOKING_URL}. Your appointment is confirmed only after you see the confirmation screen and receive the calendar invitation. Reply STOP to opt out.`;
}

async function sendTwilioSms(to: string, body: string) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!accountSid || !authToken) throw new Error("SMS delivery is not configured");
  const form = new URLSearchParams({
    To: to,
    From: TWILIO_FROM_NUMBER,
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
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Twilio ${response.status}: ${JSON.stringify(result)}`);
  return { sid: String(result.sid ?? ""), status: String(result.status ?? "queued") };
}

function isAuthorized(request: Request) {
  const password = Deno.env.get("SCALE_CRM_ADMIN_PASSWORD");
  return Boolean(password && request.headers.get("x-scale-crm-password") === password);
}

function scalar(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function comparison(field: string, lead: Record<string, unknown>, call?: Record<string, unknown>) {
  const analysis = (call?.analysis_data ?? {}) as Record<string, unknown>;
  let formValue: unknown = null;
  let callValue: unknown = null;
  if (field === "credit_score") {
    formValue = lead.credit_score;
    const confirmed =
      analysis.confirmed_credit_score_680_plus ?? lead.confirmed_credit_score_680_plus;
    callValue = confirmed === true ? "680_plus" : confirmed === false ? "under_680" : null;
    const formComparable = ["680_699", "700_749", "750_plus"].includes(String(formValue))
      ? "680_plus"
      : formValue
        ? "under_680"
        : null;
    return {
      field,
      form_value: formValue,
      call_value: callValue,
      status: !callValue ? "not_confirmed" : formComparable === callValue ? "match" : "conflict",
    };
  }
  if (field === "utilization") {
    formValue = lead.utilization;
    const confirmed =
      analysis.confirmed_utilization_under_30 ?? lead.confirmed_utilization_under_30;
    callValue = confirmed === true ? "under_30" : confirmed === false ? "30_plus" : null;
    const formComparable = ["under_10", "10_29"].includes(String(formValue))
      ? "under_30"
      : formValue
        ? "30_plus"
        : null;
    return {
      field,
      form_value: formValue,
      call_value: callValue,
      status: !callValue ? "not_confirmed" : formComparable === callValue ? "match" : "conflict",
    };
  }
  if (field === "llc_status") {
    formValue = lead.llc_status;
    callValue = analysis.confirmed_llc_status ?? analysis.llc_status ?? null;
  } else if (field === "investment_ready") {
    formValue = lead.investment_ready;
    callValue = analysis.confirmed_investment_ready ?? analysis.investment_ready ?? null;
  } else if (field === "funding_amount") {
    formValue = lead.funding_amount;
    callValue = analysis.requested_funding_amount ?? null;
  } else {
    formValue = lead.calendar_booked_at ? "booked" : "not_booked";
    callValue = analysis.calendar_booking_status ?? analysis.calendar_booked ?? null;
    if (typeof callValue === "boolean") callValue = callValue ? "booked" : "not_booked";
  }
  return {
    field,
    form_value: formValue,
    call_value: callValue,
    status: !scalar(callValue)
      ? "not_confirmed"
      : scalar(formValue) === scalar(callValue)
        ? "match"
        : "conflict",
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!isAuthorized(request))
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (request.method === "GET") {
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (leadsError) throw leadsError;
      const leadIds = (leads ?? []).map((lead) => lead.id);
      const [
        callsResult,
        screenshotsResult,
        communicationsResult,
        verificationsResult,
        sequenceResult,
        issuesResult,
        actionsResult,
        callAttemptsResult,
        lastRunResult,
      ] = await Promise.all([
        leadIds.length
          ? supabase
              .from("lead_call_evidence")
              .select("*")
              .in("lead_id", leadIds)
              .order("captured_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        leadIds.length
          ? supabase
              .from("lead_credit_evidence")
              .select("id, lead_id, twilio_message_sid, storage_path, content_type, received_at")
              .in("lead_id", leadIds)
              .order("received_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        leadIds.length
          ? supabase
              .from("lead_communications")
              .select("*")
              .in("lead_id", leadIds)
              .order("occurred_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        leadIds.length
          ? supabase.from("lead_answer_verifications").select("*").in("lead_id", leadIds)
          : Promise.resolve({ data: [], error: null }),
        leadIds.length
          ? supabase
              .from("lead_followup_sequence")
              .select("*")
              .in("lead_id", leadIds)
              .order("step_number", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("automation_issues")
          .select("*")
          .order("last_occurred_at", { ascending: false }),
        leadIds.length
          ? supabase
              .from("crm_recovery_actions")
              .select("*")
              .in("lead_id", leadIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        leadIds.length
          ? supabase
              .from("lead_call_attempts")
              .select("*")
              .in("lead_id", leadIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("automation_runs")
          .select("*")
          .eq("worker", "process-scale-lead-followups")
          .eq("status", "success")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (
        callsResult.error ||
        screenshotsResult.error ||
        communicationsResult.error ||
        verificationsResult.error ||
        sequenceResult.error ||
        issuesResult.error ||
        actionsResult.error ||
        callAttemptsResult.error ||
        lastRunResult.error
      ) {
        throw (
          callsResult.error ??
          screenshotsResult.error ??
          communicationsResult.error ??
          verificationsResult.error ??
          sequenceResult.error ??
          issuesResult.error ??
          actionsResult.error ??
          callAttemptsResult.error ??
          lastRunResult.error
        );
      }
      const screenshots = screenshotsResult.data ?? [];
      const paths = screenshots.map((item) => item.storage_path);
      const signedResult = paths.length
        ? await supabase.storage.from("lead-credit-screenshots").createSignedUrls(paths, 3600)
        : { data: [], error: null };
      if (signedResult.error) throw signedResult.error;
      const signedByPath = new Map(
        (signedResult.data ?? []).map((item, index) => [paths[index], item.signedUrl]),
      );
      const group = (items: Array<Record<string, unknown>>, key: string) => {
        const map = new Map<string, Array<Record<string, unknown>>>();
        for (const item of items)
          map.set(String(item[key]), [...(map.get(String(item[key])) ?? []), item]);
        return map;
      };
      const callsByLead = group(
        (callsResult.data ?? []) as Array<Record<string, unknown>>,
        "lead_id",
      );
      const communicationsByLead = group(
        (communicationsResult.data ?? []) as Array<Record<string, unknown>>,
        "lead_id",
      );
      const verificationByLead = group(
        (verificationsResult.data ?? []) as Array<Record<string, unknown>>,
        "lead_id",
      );
      const sequenceByLead = group(
        (sequenceResult.data ?? []) as Array<Record<string, unknown>>,
        "lead_id",
      );
      const screenshotsByLead = group(
        screenshots.map((item) => ({
          ...item,
          signed_url: signedByPath.get(item.storage_path) ?? null,
        })),
        "lead_id",
      );
      const issuesByLead = group(
        (issuesResult.data ?? []).filter((item) => item.lead_id) as Array<Record<string, unknown>>,
        "lead_id",
      );
      const actionsByLead = group(
        (actionsResult.data ?? []) as Array<Record<string, unknown>>,
        "lead_id",
      );
      const callAttemptsByLead = group(
        (callAttemptsResult.data ?? []) as Array<Record<string, unknown>>,
        "lead_id",
      );
      const lastSuccessfulRun = lastRunResult.data;
      const processorHealthy = Boolean(
        lastSuccessfulRun?.started_at &&
        Date.now() - new Date(lastSuccessfulRun.started_at).getTime() <= 15 * 60 * 1000,
      );

      // Recover calls whose webhook delivery was missed. Retell still retains
      // the transcript and recording, so a protected CRM read can repair the
      // evidence record without exposing the Retell API key to the browser.
      const retellKey = Deno.env.get("RETELL_API_KEY");
      if (retellKey) {
        await Promise.all(
          (leads ?? []).map(async (lead) => {
            const callId = String(lead.retell_call_id ?? "");
            if (!callId || (callsByLead.get(lead.id)?.length ?? 0) > 0) return;
            try {
              const response = await fetch(`https://api.retellai.com/v2/get-call/${callId}`, {
                headers: { Authorization: `Bearer ${retellKey}` },
              });
              if (!response.ok) return;
              const call = await response.json();
              const analysis = call.call_analysis ?? {};
              const evidence = {
                lead_id: lead.id,
                retell_call_id: call.call_id ?? callId,
                transcript: call.transcript ?? null,
                recording_url: call.recording_url ?? null,
                recording_multi_channel_url: call.recording_multi_channel_url ?? null,
                duration_ms: call.duration_ms ?? null,
                disconnection_reason: call.disconnection_reason ?? null,
                call_summary: analysis.call_summary ?? null,
                analysis_data:
                  analysis.custom_analysis_data?.scale_qualification ??
                  analysis.custom_analysis_data ??
                  {},
                captured_at: call.start_timestamp
                  ? new Date(Number(call.start_timestamp)).toISOString()
                  : new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              const { data: saved } = await supabase
                .from("lead_call_evidence")
                .upsert(evidence, { onConflict: "retell_call_id" })
                .select("*")
                .single();
              callsByLead.set(lead.id, [saved ?? evidence]);
            } catch (error) {
              console.error("Unable to recover Retell call", callId, error);
            }
          }),
        );
      }

      return Response.json(
        {
          leads: (leads ?? []).map((lead) => {
            const calls = callsByLead.get(lead.id) ?? [];
            const reviews = verificationByLead.get(lead.id) ?? [];
            const reviewByField = new Map(reviews.map((item) => [item.field_name, item]));
            const comparisons = [...verificationFields].map((field) => ({
              ...comparison(field, lead, calls[0]),
              verification: reviewByField.get(field) ?? null,
            }));
            return {
              ...lead,
              call_evidence: calls[0] ?? null,
              call_history: calls,
              communications: communicationsByLead.get(lead.id) ?? [],
              credit_screenshots: screenshotsByLead.get(lead.id) ?? [],
              answer_comparisons: comparisons,
              followup_sequence: sequenceByLead.get(lead.id) ?? [],
              automation_issues: issuesByLead.get(lead.id) ?? [],
              recovery_actions: actionsByLead.get(lead.id) ?? [],
              call_attempts: callAttemptsByLead.get(lead.id) ?? [],
            };
          }),
          automation_issues: issuesResult.data ?? [],
          automation_health: {
            status: processorHealthy ? "healthy" : "needs_attention",
            last_successful_run_at: lastSuccessfulRun?.started_at ?? null,
            warning: processorHealthy
              ? null
              : "The follow-up processor has not completed successfully in the last 15 minutes.",
          },
        },
        { headers: corsHeaders },
      );
    }

    if (request.method === "PATCH") {
      const payload = await request.json();
      const reviewer =
        String(payload.reviewer ?? "CRM Admin")
          .trim()
          .slice(0, 100) || "CRM Admin";

      if (payload.action === "resolve_automation_issue") {
        const issueId = String(payload.issue_id ?? "");
        if (!issueId)
          return new Response("Missing issue id", { status: 400, headers: corsHeaders });
        const { data: issue, error: issueError } = await supabase
          .from("automation_issues")
          .update({
            status: "resolved",
            resolved_at: new Date().toISOString(),
            resolved_by: reviewer,
            resolution_note:
              String(payload.note ?? "")
                .trim()
                .slice(0, 1000) || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", issueId)
          .select("lead_id")
          .single();
        if (issueError) throw issueError;
        await auditRecovery(
          supabase,
          issue.lead_id,
          issueId,
          payload.action,
          reviewer,
          "completed",
        );
        return Response.json({ resolved: true }, { headers: corsHeaders });
      }

      if (payload.action === "recheck_calendly") {
        const leadId = String(payload.id ?? "");
        const { data: lead, error } = await supabase
          .from("leads")
          .select("*")
          .eq("id", leadId)
          .single();
        if (error) throw error;
        try {
          const booked = Boolean(lead.calendar_booked_at) || (await calendlyBookingExists(lead));
          if (booked) {
            await cancelBookedSequence(supabase, leadId);
            await supabase
              .from("automation_issues")
              .update({
                status: "resolved",
                resolved_at: new Date().toISOString(),
                resolved_by: reviewer,
                resolution_note: "Calendly booking confirmed",
                updated_at: new Date().toISOString(),
              })
              .eq("lead_id", leadId)
              .in("status", ["open", "retrying"]);
          }
          await auditRecovery(supabase, leadId, null, payload.action, reviewer, "completed", {
            booked,
          });
          return Response.json({ booked }, { headers: corsHeaders });
        } catch (error) {
          await openIssue(
            supabase,
            leadId,
            "calendly_recheck_failed",
            leadId,
            "Calendly could not be checked",
            String(error),
            "Retry the Calendly check",
          );
          await auditRecovery(supabase, leadId, null, payload.action, reviewer, "failed", {
            error: String(error),
          });
          throw error;
        }
      }

      if (["retry_followup_step", "restart_followup_sequence"].includes(payload.action)) {
        const leadId = String(payload.id ?? "");
        const { data: lead, error } = await supabase
          .from("leads")
          .select("*")
          .eq("id", leadId)
          .single();
        if (error) throw error;
        if (lead.calendar_booked_at || (await calendlyBookingExists(lead))) {
          await cancelBookedSequence(supabase, leadId);
          return Response.json(
            { restarted: false, reason: "already_booked" },
            { headers: corsHeaders },
          );
        }
        if (
          !lead.sms_contact_consent ||
          lead.sms_opted_out ||
          !qualifyingScores.has(lead.credit_score) ||
          !qualifyingUtilization.has(lead.utilization)
        ) {
          return Response.json(
            { restarted: false, reason: "lead_not_eligible" },
            { headers: corsHeaders },
          );
        }
        let query = supabase
          .from("lead_followup_sequence")
          .update({
            status: "pending",
            attempts: 0,
            scheduled_at: new Date().toISOString(),
            cancellation_reason: null,
            updated_at: new Date().toISOString(),
          })
          .eq("lead_id", leadId)
          .in(
            "status",
            payload.action === "retry_followup_step"
              ? ["failed"]
              : ["failed", "cancelled_manual", "paused"],
          );
        if (payload.step_id) query = query.eq("id", String(payload.step_id));
        const { error: updateError } = await query;
        if (updateError) throw updateError;
        await supabase
          .from("leads")
          .update({
            booking_sequence_status: "active",
            booking_sequence_next_at: new Date().toISOString(),
          })
          .eq("id", leadId);
        await supabase
          .from("automation_issues")
          .update({ status: "retrying", retry_count: 0, updated_at: new Date().toISOString() })
          .eq("lead_id", leadId)
          .in("status", ["open"]);
        await auditRecovery(
          supabase,
          leadId,
          payload.issue_id ?? null,
          payload.action,
          reviewer,
          "completed",
        );
        return Response.json({ restarted: true }, { headers: corsHeaders });
      }

      if (payload.action === "trigger_adam_call") {
        const leadId = String(payload.id ?? "");
        const { data: lead, error } = await supabase
          .from("leads")
          .select("*")
          .eq("id", leadId)
          .single();
        if (error) throw error;
        let blockedReason = "";
        if (
          !qualifyingScores.has(lead.credit_score) ||
          !qualifyingUtilization.has(lead.utilization)
        )
          blockedReason = "The lead no longer meets the qualification benchmarks.";
        else if (!lead.sms_contact_consent || !lead.contact_consent_at)
          blockedReason = "Required call consent is missing.";
        else if (lead.sms_opted_out) blockedReason = "The lead has opted out.";
        else if (lead.calendar_booked_at || (await calendlyBookingExists(lead)))
          blockedReason = "The lead already has a confirmed Calendly booking.";
        else if (!permittedCallingHour(String(lead.contact_consent_timezone ?? "")))
          blockedReason = "The lead is outside permitted calling hours.";
        else if (["queued", "calling"].includes(String(lead.outbound_call_status ?? "")))
          blockedReason = "A call is already queued or active.";
        const { data: recent } = await supabase
          .from("lead_call_attempts")
          .select("created_at")
          .eq("lead_id", leadId)
          .eq("source", "crm")
          .gte("created_at", new Date(Date.now() - 86400000).toISOString())
          .limit(1)
          .maybeSingle();
        if (!blockedReason && recent)
          blockedReason = "A CRM-triggered Adam call was already placed in the last 24 hours.";
        if (blockedReason)
          return Response.json(
            { queued: false, blocked_reason: blockedReason },
            { headers: corsHeaders },
          );

        const retellKey = Deno.env.get("RETELL_API_KEY");
        const agentId = Deno.env.get("SCALE_OUTBOUND_AGENT_ID");
        if (!retellKey || !agentId) throw new Error("Outbound calling is not configured");
        const attempt = await supabase
          .from("lead_call_attempts")
          .insert({ lead_id: leadId, requested_by: reviewer, source: "crm", status: "requesting" })
          .select("id")
          .single();
        if (attempt.error) throw attempt.error;
        try {
          const response = await fetch("https://api.retellai.com/v2/create-phone-call", {
            method: "POST",
            headers: { Authorization: `Bearer ${retellKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from_number: TWILIO_FROM_NUMBER,
              to_number: toE164Phone(String(lead.phone ?? "")),
              override_agent_id: agentId,
              override_agent_version: "latest_published",
              agent_override: {
                agent: {
                  denoising_mode: "noise-and-background-speech-cancellation",
                  interruption_sensitivity: 0.65,
                  responsiveness: 0.8,
                },
              },
              metadata: {
                lead_id: leadId,
                workflow: "scale_to_legacy_qualification",
                requested_by: reviewer,
              },
              retell_llm_dynamic_variables: {
                lead_id: leadId,
                lead_full_name: String(lead.full_name ?? "there"),
                lead_email: String(lead.email ?? ""),
                lead_phone: toE164Phone(String(lead.phone ?? "")),
                lead_timezone: String(lead.contact_consent_timezone ?? ""),
                calendly_booking_url: BOOKING_URL,
                submitted_credit_score: String(lead.credit_score ?? ""),
                submitted_utilization: String(lead.utilization ?? ""),
                submitted_llc_status: String(lead.llc_status ?? ""),
              },
            }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(`Retell ${response.status}: ${JSON.stringify(body)}`);
          await supabase
            .from("lead_call_attempts")
            .update({
              retell_call_id: body.call_id,
              status: "queued",
              updated_at: new Date().toISOString(),
            })
            .eq("id", attempt.data.id);
          await supabase
            .from("leads")
            .update({
              outbound_call_status: "queued",
              retell_call_id: body.call_id,
              outbound_call_requested_at: new Date().toISOString(),
            })
            .eq("id", leadId);
          await auditRecovery(supabase, leadId, null, payload.action, reviewer, "completed", {
            retell_call_id: body.call_id,
          });
          return Response.json({ queued: true, call_id: body.call_id }, { headers: corsHeaders });
        } catch (error) {
          await supabase
            .from("lead_call_attempts")
            .update({
              status: "failed",
              failure_detail: String(error).slice(0, 4000),
              updated_at: new Date().toISOString(),
            })
            .eq("id", attempt.data.id);
          await openIssue(
            supabase,
            leadId,
            "retell_call_creation_failed",
            attempt.data.id,
            "Adam call could not be started",
            String(error),
            "Review the error and try the call again",
          );
          await auditRecovery(supabase, leadId, null, payload.action, reviewer, "failed", {
            error: String(error),
          });
          throw error;
        }
      }
      if (payload.action === "cancel_followup_sequence") {
        const leadId = String(payload.id ?? "");
        if (!leadId) return new Response("Missing lead id", { status: 400, headers: corsHeaders });
        const { error: cancelError } = await supabase
          .from("lead_followup_sequence")
          .update({
            status: "cancelled_manual",
            cancellation_reason: "Cancelled by CRM user",
            updated_at: new Date().toISOString(),
          })
          .eq("lead_id", leadId)
          .in("status", ["pending", "processing"]);
        if (cancelError) throw cancelError;
        const { error: leadError } = await supabase
          .from("leads")
          .update({
            booking_sequence_status: "cancelled_manual",
            booking_sequence_next_at: null,
          })
          .eq("id", leadId);
        if (leadError) throw leadError;
        return Response.json({ cancelled: true }, { headers: corsHeaders });
      }
      if (["pause_followup_sequence", "resume_followup_sequence"].includes(payload.action)) {
        const leadId = String(payload.id ?? "");
        if (!leadId) return new Response("Missing lead id", { status: 400, headers: corsHeaders });
        const pause = payload.action === "pause_followup_sequence";
        const { error: sequenceError } = await supabase
          .from("lead_followup_sequence")
          .update({ status: pause ? "paused" : "pending", updated_at: new Date().toISOString() })
          .eq("lead_id", leadId)
          .eq("status", pause ? "pending" : "paused");
        if (sequenceError) throw sequenceError;
        const { data: next } = await supabase
          .from("lead_followup_sequence")
          .select("scheduled_at")
          .eq("lead_id", leadId)
          .eq("status", pause ? "paused" : "pending")
          .order("step_number")
          .limit(1)
          .maybeSingle();
        const { error: leadError } = await supabase
          .from("leads")
          .update({
            booking_sequence_status: pause ? "paused" : "active",
            booking_sequence_next_at: pause
              ? null
              : (next?.scheduled_at ?? new Date().toISOString()),
          })
          .eq("id", leadId);
        if (leadError) throw leadError;
        return Response.json({ status: pause ? "paused" : "active" }, { headers: corsHeaders });
      }
      if (payload.action === "send_booking_reminder") {
        const leadId = String(payload.id ?? "");
        if (!leadId) return new Response("Missing lead id", { status: 400, headers: corsHeaders });
        const { data: lead, error: leadError } = await supabase
          .from("leads")
          .select(
            "id, full_name, phone, sms_contact_consent, sms_opted_out, calendar_booked_at, booking_followup_sms_attempted_at, booking_followup_sms_sent_at",
          )
          .eq("id", leadId)
          .single();
        if (leadError) throw leadError;
        if (!lead.sms_contact_consent || lead.sms_opted_out)
          return Response.json(
            { sent: false, reason: "no_consent_or_opted_out" },
            { headers: corsHeaders },
          );
        if (lead.calendar_booked_at)
          return Response.json({ sent: false, reason: "already_booked" }, { headers: corsHeaders });
        if (lead.booking_followup_sms_attempted_at || lead.booking_followup_sms_sent_at)
          return Response.json(
            { sent: false, reason: "already_attempted" },
            { headers: corsHeaders },
          );

        const attemptedAt = new Date().toISOString();
        const { data: claimed, error: claimError } = await supabase
          .from("leads")
          .update({
            booking_followup_sms_attempted_at: attemptedAt,
            booking_followup_sms_status: "sending",
          })
          .eq("id", leadId)
          .is("booking_followup_sms_attempted_at", null)
          .select("phone, full_name")
          .maybeSingle();
        if (claimError) throw claimError;
        if (!claimed?.phone)
          return Response.json(
            { sent: false, reason: "already_attempted" },
            { headers: corsHeaders },
          );

        const firstName =
          String(claimed.full_name ?? "there")
            .trim()
            .split(/\s+/)[0] || "there";
        const toPhone = toE164Phone(String(claimed.phone));
        const body = bookingReminder(firstName);
        try {
          const message = await sendTwilioSms(toPhone, body);
          const { error: communicationError } = await supabase.from("lead_communications").upsert(
            {
              lead_id: leadId,
              twilio_message_sid: message.sid,
              direction: "outbound",
              channel: "sms",
              from_phone: TWILIO_FROM_NUMBER,
              to_phone: toPhone,
              body,
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
          return Response.json({ sent: true, status: message.status }, { headers: corsHeaders });
        } catch (error) {
          await supabase
            .from("leads")
            .update({ booking_followup_sms_status: "failed" })
            .eq("id", leadId);
          throw error;
        }
      }
      if (payload.action === "resolve_verification") {
        const { id, field, source, reviewer, note } = payload;
        if (
          !id ||
          !verificationFields.has(field) ||
          !["form", "call"].includes(source) ||
          !String(reviewer ?? "").trim()
        ) {
          return new Response("Invalid verification payload", {
            status: 400,
            headers: corsHeaders,
          });
        }
        const { data: lead, error: leadError } = await supabase
          .from("leads")
          .select("*")
          .eq("id", id)
          .single();
        if (leadError) throw leadError;
        const { data: call, error: callError } = await supabase
          .from("lead_call_evidence")
          .select("*")
          .eq("lead_id", id)
          .order("captured_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (callError) throw callError;
        const values = comparison(field, lead, call ?? undefined);
        const verifiedValue = source === "form" ? values.form_value : values.call_value;
        if (verifiedValue === null || verifiedValue === undefined || verifiedValue === "") {
          return new Response("Selected source has no answer", {
            status: 400,
            headers: corsHeaders,
          });
        }
        const { error } = await supabase.from("lead_answer_verifications").upsert(
          {
            lead_id: id,
            field_name: field,
            form_value: values.form_value,
            call_value: values.call_value,
            verified_value: verifiedValue,
            reviewer: String(reviewer).trim().slice(0, 100),
            note:
              String(note ?? "")
                .trim()
                .slice(0, 1000) || null,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "lead_id,field_name" },
        );
        if (error) throw error;
        return Response.json({ ok: true }, { headers: corsHeaders });
      }

      if (payload.action === "delete_leads") {
        const ids: unknown[] = Array.isArray(payload.ids) ? payload.ids : [];
        const leadIds = ids.map(String).filter(Boolean);
        if (!leadIds.length) {
          return new Response("No lead ids provided", { status: 400, headers: corsHeaders });
        }
        // Remove dependent records first, then the leads themselves.
        const { data: evidence } = await supabase
          .from("lead_credit_evidence")
          .select("storage_path")
          .in("lead_id", leadIds);
        const storagePaths = (evidence ?? []).map((item) => item.storage_path).filter(Boolean);
        if (storagePaths.length) {
          await supabase.storage.from("lead-credit-screenshots").remove(storagePaths);
        }
        for (const table of [
          "lead_credit_evidence",
          "lead_call_evidence",
          "lead_communications",
          "lead_answer_verifications",
          "bookings",
        ]) {
          const { error } = await supabase.from(table).delete().in("lead_id", leadIds);
          if (error) throw error;
        }
        const { error } = await supabase.from("leads").delete().in("id", leadIds);
        if (error) throw error;
        return Response.json({ ok: true, deleted: leadIds.length }, { headers: corsHeaders });
      }

      const { id, updates } = payload;
      if (!id || !updates || typeof updates !== "object")
        return new Response("Invalid update payload", { status: 400, headers: corsHeaders });
      const safeUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key]) => allowedFields.includes(key)),
      );
      const { error } = await supabase.from("leads").update(safeUpdates).eq("id", id);
      if (error) throw error;
      return Response.json({ ok: true }, { headers: corsHeaders });
    }
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return new Response("CRM request failed", { status: 500, headers: corsHeaders });
  }
});
