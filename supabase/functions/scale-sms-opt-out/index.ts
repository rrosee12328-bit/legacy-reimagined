import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function toDigits(value: string) {
  return value.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (request.headers.get("x-scale-opt-out-secret") !== Deno.env.get("SCALE_OPT_OUT_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { phone } = await request.json();
    const callerDigits = toDigits(String(phone ?? ""));
    if (callerDigits.length !== 10) return new Response("Invalid phone number", { status: 400 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: leads, error: fetchError } = await supabase
      .from("leads")
      .select("id, phone")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (fetchError) throw fetchError;

    const matchingIds = (leads ?? [])
      .filter((lead) => toDigits(lead.phone) === callerDigits)
      .map((lead) => lead.id);
    if (!matchingIds.length) return Response.json({ updated: 0 });

    const { error: updateError } = await supabase
      .from("leads")
      .update({ sms_opted_out: true })
      .in("id", matchingIds);
    if (updateError) throw updateError;
    return Response.json({ updated: matchingIds.length });
  } catch (error) {
    console.error(error);
    return new Response("Could not record SMS opt-out", { status: 500 });
  }
});
