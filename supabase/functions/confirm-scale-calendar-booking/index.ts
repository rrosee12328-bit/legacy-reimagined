import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const { leadId, token } = await request.json();
    if (!leadId || !token)
      return new Response("Invalid confirmation", { status: 400, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supabase
      .from("leads")
      .update({ calendar_booked_at: new Date().toISOString() })
      .eq("id", leadId)
      .eq("calendar_confirmation_token", token)
      .is("calendar_booked_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return Response.json({ confirmed: Boolean(data) }, { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return new Response("Could not confirm calendar booking", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
