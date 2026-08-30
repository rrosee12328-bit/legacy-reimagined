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
      const [callsResult, screenshotsResult, communicationsResult, verificationsResult] =
        await Promise.all([
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
        ]);
      if (
        callsResult.error ||
        screenshotsResult.error ||
        communicationsResult.error ||
        verificationsResult.error
      ) {
        throw (
          callsResult.error ??
          screenshotsResult.error ??
          communicationsResult.error ??
          verificationsResult.error
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
      const screenshotsByLead = group(
        screenshots.map((item) => ({
          ...item,
          signed_url: signedByPath.get(item.storage_path) ?? null,
        })),
        "lead_id",
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
            };
          }),
        },
        { headers: corsHeaders },
      );
    }

    if (request.method === "PATCH") {
      const payload = await request.json();
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
        const storagePaths = (evidence ?? [])
          .map((item) => item.storage_path)
          .filter(Boolean);
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
