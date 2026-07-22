import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://qlvsbsfddwuocfihsleq.supabase.co";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = "Scale to Legacy <info@scaletolegacynow.com>";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  return res.ok;
}

serve(async (req) => {
  // This function is called by a cron job or manually
  // It processes all pending emails that are due to be sent

  try {
    const now = new Date().toISOString();

    // Fetch all pending emails that are due
    const { data: emails, error } = await supabase
      .from("scheduled_emails")
      .select("*")
      .eq("status", "pending")
      .lte("send_at", now)
      .order("send_at", { ascending: true })
      .limit(50);

    if (error) throw new Error(`Fetch error: ${error.message}`);
    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No emails due" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    let sent = 0;
    let failed = 0;

    for (const email of emails) {
      try {
        const success = await sendEmail(email.to_email, email.subject, email.html_body);

        if (success) {
          await supabase
            .from("scheduled_emails")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", email.id);
          sent++;
        } else {
          await supabase
            .from("scheduled_emails")
            .update({ status: "failed", error: "Resend returned non-200" })
            .eq("id", email.id);
          failed++;
        }
      } catch (err) {
        await supabase
          .from("scheduled_emails")
          .update({ status: "failed", error: String(err) })
          .eq("id", email.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ processed: emails.length, sent, failed }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
