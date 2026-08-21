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

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://scaletolegacynow.com",
  "Access-Control-Allow-Headers": "content-type, x-scale-crm-password",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  "Content-Type": "application/json",
};

function isAuthorized(request: Request) {
  const password = Deno.env.get("SCALE_CRM_ADMIN_PASSWORD");
  return Boolean(password && request.headers.get("x-scale-crm-password") === password);
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
      const { data: evidence, error: evidenceError } = leadIds.length
        ? await supabase.from("lead_call_evidence").select("*").in("lead_id", leadIds)
        : { data: [], error: null };
      if (evidenceError) throw evidenceError;
      const evidenceByLead = new Map((evidence ?? []).map((item) => [item.lead_id, item]));
      return Response.json(
        {
          leads: (leads ?? []).map((lead) => ({
            ...lead,
            call_evidence: evidenceByLead.get(lead.id) ?? null,
          })),
        },
        { headers: corsHeaders },
      );
    }

    if (request.method === "PATCH") {
      const { id, updates } = await request.json();
      if (!id || !updates || typeof updates !== "object") {
        return new Response("Invalid update payload", { status: 400, headers: corsHeaders });
      }
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
