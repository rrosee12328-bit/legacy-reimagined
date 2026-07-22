import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = "info@scaletolegacynow.com";
const NOTIFY_EMAIL = "rrose@vektiss.com";

interface Lead {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  credit_score: string;
  utilization?: string;
  investment_ready?: string;
  score: "hot" | "warm" | "cold";
  status: string;
  source?: string;
  created_at: string;
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: `Scale to Legacy <${FROM_EMAIL}>`, to: [to], subject, html }),
  });
  return res.ok;
}

function hotLeadEmail(lead: Lead): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f0; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .header { background: #1a1a2e; padding: 32px 40px; text-align: center; }
    .header img { height: 48px; }
    .header h1 { color: #c9a227; font-size: 22px; margin: 16px 0 4px; }
    .body { padding: 36px 40px; color: #1a1a1a; }
    .body h2 { font-size: 24px; margin-bottom: 8px; }
    .body p { font-size: 15px; line-height: 1.7; color: #444; }
    .cta { display: block; margin: 28px auto; background: #c9a227; color: #fff; text-decoration: none; padding: 16px 36px; border-radius: 50px; font-weight: bold; font-size: 15px; text-align: center; width: fit-content; }
    .footer { background: #f5f5f0; padding: 20px 40px; text-align: center; font-size: 11px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Scale to Legacy</h1>
      <p style="color:#fff;font-size:13px;margin:0;">Business Funding Strategy</p>
    </div>
    <div class="body">
      <h2>Hey ${lead.full_name} 👋</h2>
      <p>You just took the first step — and based on your answers, <strong>your profile looks strong.</strong></p>
      <p>Here's what happens next:</p>
      <p>Our team will review your application and reach out within <strong>24 hours</strong> to confirm your spot and walk you through your personalized funding strategy.</p>
      <p>In the meantime, here's what to know:</p>
      <ul style="color:#444;font-size:15px;line-height:2;">
        <li>We use your <strong>personal credit profile</strong> — not business revenue</li>
        <li>0% interest business credit for <strong>12–18 months</strong></li>
        <li>No LLC yet? We handle that too — in about a week</li>
      </ul>
      <p>Keep an eye on your phone and email. We'll be in touch shortly.</p>
      <p style="margin-top:28px;">— The Scale to Legacy Team</p>
    </div>
    <div class="footer">
      <p>Funding is subject to credit approval. Results vary based on individual credit profile. Scale to Legacy is not a lender.</p>
      <p>© ${new Date().getFullYear()} Scale to Legacy · scaletolegacynow.com</p>
    </div>
  </div>
</body>
</html>`;
}

function warmLeadEmail(lead: Lead): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f0; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .header { background: #1a1a2e; padding: 32px 40px; text-align: center; }
    .header h1 { color: #c9a227; font-size: 22px; margin: 16px 0 4px; }
    .body { padding: 36px 40px; color: #1a1a1a; }
    .body h2 { font-size: 24px; margin-bottom: 8px; }
    .body p { font-size: 15px; line-height: 1.7; color: #444; }
    .footer { background: #f5f5f0; padding: 20px 40px; text-align: center; font-size: 11px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Scale to Legacy</h1>
      <p style="color:#fff;font-size:13px;margin:0;">Business Funding Strategy</p>
    </div>
    <div class="body">
      <h2>Hey ${lead.full_name},</h2>
      <p>Thank you for applying with Scale to Legacy.</p>
      <p>Based on your answers, <strong>you're closer than you think</strong> — but your credit profile may need a little work before we can move you into the funding process.</p>
      <p>The good news? We have a clear path to get you there. Our credit strategy team will reach out to build a plan specifically for your profile.</p>
      <p>Once your credit is where it needs to be, we move you directly into the funding process. No starting over. No runaround.</p>
      <p>Keep an eye on your phone — we'll be in touch soon.</p>
      <p style="margin-top:28px;">— The Scale to Legacy Team</p>
    </div>
    <div class="footer">
      <p>Results vary based on individual credit profile. Scale to Legacy is not a lender.</p>
      <p>© ${new Date().getFullYear()} Scale to Legacy · scaletolegacynow.com</p>
    </div>
  </div>
</body>
</html>`;
}

function coldLeadEmail(lead: Lead): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f0; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .header { background: #1a1a2e; padding: 32px 40px; text-align: center; }
    .header h1 { color: #c9a227; font-size: 22px; margin: 16px 0 4px; }
    .body { padding: 36px 40px; color: #1a1a1a; }
    .body h2 { font-size: 24px; margin-bottom: 8px; }
    .body p { font-size: 15px; line-height: 1.7; color: #444; }
    .cta { display: block; margin: 28px auto; background: #1a1a2e; color: #fff; text-decoration: none; padding: 16px 36px; border-radius: 50px; font-weight: bold; font-size: 15px; text-align: center; width: fit-content; }
    .footer { background: #f5f5f0; padding: 20px 40px; text-align: center; font-size: 11px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Scale to Legacy</h1>
      <p style="color:#fff;font-size:13px;margin:0;">Business Funding Strategy</p>
    </div>
    <div class="body">
      <h2>Hey ${lead.full_name},</h2>
      <p>Thank you for taking the time to apply with Scale to Legacy.</p>
      <p>Based on your current profile, now may not be the right moment to move forward — but that doesn't mean the door is closed.</p>
      <p>We put together a free guide that walks you through exactly what it takes to position yourself for business funding in the future. It's a great starting point.</p>
      <a href="https://www.scaletolegacy.com/the-key-to-scaling" class="cta">Get Your Free Guide →</a>
      <p>When you're ready to reapply, we'll be here.</p>
      <p style="margin-top:28px;">— The Scale to Legacy Team</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Scale to Legacy · scaletolegacynow.com</p>
    </div>
  </div>
</body>
</html>`;
}

function hotLeadNotification(lead: Lead): string {
  const creditLabels: Record<string, string> = {
    below_600: "Below 600", "600_649": "600–649", "650_679": "650–679",
    "680_699": "680–699", "700_749": "700–749", "750_plus": "750+",
  };
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f0; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .header { background: #1a1a2e; padding: 24px 32px; }
    .header h1 { color: #c9a227; font-size: 20px; margin: 0; }
    .badge { display: inline-block; background: #ef4444; color: #fff; padding: 4px 14px; border-radius: 50px; font-size: 12px; font-weight: bold; margin-top: 8px; }
    .body { padding: 28px 32px; }
    .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; font-size: 14px; }
    .label { color: #888; }
    .value { font-weight: bold; color: #1a1a1a; }
    .footer { background: #f5f5f0; padding: 16px 32px; font-size: 11px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔥 New Hot Lead — Scale to Legacy</h1>
      <span class="badge">HOT LEAD</span>
    </div>
    <div class="body">
      <p style="font-size:15px;color:#444;margin-bottom:20px;">A new lead just submitted the qualify form and scored as <strong>HOT</strong>. Review and reach out ASAP.</p>
      <div class="row"><span class="label">Name</span><span class="value">${lead.full_name}</span></div>
      <div class="row"><span class="label">Email</span><span class="value">${lead.email}</span></div>
      <div class="row"><span class="label">Phone</span><span class="value">${lead.phone}</span></div>
      <div class="row"><span class="label">Credit Score</span><span class="value">${creditLabels[lead.credit_score] ?? lead.credit_score}</span></div>
      <div class="row"><span class="label">Utilization</span><span class="value">${lead.utilization?.replace(/_/g, "–").replace("plus", "+") ?? "—"}</span></div>
      <div class="row"><span class="label">Investment Ready</span><span class="value">${lead.investment_ready?.replace(/_/g, " ") ?? "—"}</span></div>
      <div class="row"><span class="label">Submitted</span><span class="value">${new Date(lead.created_at).toLocaleString("en-US", { hour12: true })}</span></div>
      <div class="row"><span class="label">Source</span><span class="value">${lead.source ?? "qualify_form"}</span></div>
      <p style="margin-top:24px;font-size:14px;color:#444;">
        <a href="mailto:${lead.email}" style="color:#c9a227;">Email Lead</a> &nbsp;·&nbsp;
        <a href="tel:${lead.phone}" style="color:#c9a227;">Call Lead</a> &nbsp;·&nbsp;
        <a href="https://scaletolegacynow.com/admin" style="color:#c9a227;">View in CRM</a>
      </p>
    </div>
    <div class="footer">Scale to Legacy CRM · scaletolegacynow.com</div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    const lead: Lead = payload.record;

    if (!lead?.email) {
      return new Response("No lead data", { status: 400 });
    }

    const score = lead.score ?? "cold";

    // Send email to the lead based on their score
    let leadEmailSent = false;
    if (score === "hot") {
      leadEmailSent = await sendEmail(
        lead.email,
        "You May Qualify — Here's What Happens Next | Scale to Legacy",
        hotLeadEmail(lead)
      );
    } else if (score === "warm") {
      leadEmailSent = await sendEmail(
        lead.email,
        "You're Closer Than You Think | Scale to Legacy",
        warmLeadEmail(lead)
      );
    } else {
      leadEmailSent = await sendEmail(
        lead.email,
        "Your Free Guide Is Ready | Scale to Legacy",
        coldLeadEmail(lead)
      );
    }

    // Send hot lead notification to team
    let notifSent = false;
    if (score === "hot") {
      notifSent = await sendEmail(
        NOTIFY_EMAIL,
        `🔥 New Hot Lead: ${lead.full_name} — Scale to Legacy`,
        hotLeadNotification(lead)
      );
    }

    return new Response(
      JSON.stringify({ success: true, leadEmailSent, notifSent, score }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
