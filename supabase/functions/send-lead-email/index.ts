import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = "info@scaletolegacynow.com";
const NOTIFY_EMAILS = ["rrose@vektiss.com", "lonnie080875@yahoo.com"];

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

type LeadScore = "hot" | "warm" | "cold";

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Scale to Legacy <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) console.error(`Resend failed for ${to}: ${await res.text()}`);
  return res.ok;
}

function wrapApplicantEmail(body: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f0; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .header { background: #1a1a2e; padding: 32px 40px; text-align: center; }
    .header h1 { color: #c9a227; font-size: 22px; margin: 0 0 4px; }
    .header p { color: #ffffff; font-size: 13px; margin: 0; }
    .body { padding: 36px 40px; color: #1a1a1a; }
    .body h2 { font-size: 24px; margin: 0 0 14px; }
    .body p { font-size: 15px; line-height: 1.7; color: #444; }
    .cta { display: inline-block; margin: 12px 0 20px; background: #c9a227; color: #ffffff !important; text-decoration: none; padding: 14px 24px; border-radius: 999px; font-size: 15px; font-weight: bold; }
    .footer { background: #f5f5f0; padding: 20px 40px; text-align: center; font-size: 11px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Scale to Legacy</h1>
      <p>Business Funding Strategy</p>
    </div>
    <div class="body">${body}</div>
    <div class="footer">
      <p>Funding is subject to credit approval and individual qualification. Results vary. Scale to Legacy is not a lender, bank, or financial institution.</p>
      <p>© ${new Date().getFullYear()} Scale to Legacy · scaletolegacynow.com</p>
    </div>
  </div>
</body>
</html>`;
}

function hotLeadEmail(lead: Lead): string {
  const name = escapeHtml(lead.full_name);
  return wrapApplicantEmail(`
    <h2>Thank you, ${name}.</h2>
    <p>Based on the information you shared, you can move to the next step in the Scale to Legacy funding process.</p>
    <p>Your funding strategy session is where we review your goals, discuss your profile, and help you understand the path that may be available to you.</p>
    <p>If the calendar is open in front of you now, choose the time that works best. Your appointment is not complete until you select a time and receive a confirmation.</p>
    <p>Funding is always subject to lender requirements, credit approval, and individual qualification. We look forward to speaking with you.</p>
    <p style="margin-top:28px;">— The Scale to Legacy Team</p>
  `);
}

function warmLeadEmail(lead: Lead): string {
  const name = escapeHtml(lead.full_name);
  return wrapApplicantEmail(`
    <h2>Thank you, ${name}.</h2>
    <p>Based on the information you shared and your stated readiness to invest, you can move to the next step in the Scale to Legacy credit-support process.</p>
    <p>Your credit strategy session is where we review your current position and discuss a practical path toward becoming better positioned for future funding opportunities.</p>
    <p>If the calendar is open in front of you now, choose the time that works best. Your appointment is not complete until you select a time and receive a confirmation.</p>
    <p>Credit timelines and funding outcomes vary by individual profile and consistent action. We look forward to speaking with you.</p>
    <p style="margin-top:28px;">— The Scale to Legacy Team</p>
  `);
}

function coldLeadEmail(lead: Lead): string {
  const name = escapeHtml(lead.full_name);
  return wrapApplicantEmail(`
    <h2>Thank you for applying, ${name}.</h2>
    <p>Based on the information you shared, you are not currently eligible to move into the Scale to Legacy funding or credit-support process.</p>
    <p>Our credit-support path is designed for people who are ready to make the required investment in improving and positioning their credit profile. Since you indicated that you are not ready for that investment at this time, we are not opening a strategy calendar for you today.</p>
    <p>Your best next step is to focus on strengthening and maintaining your personal credit profile, while creating a plan that allows you to invest in a credit-support solution when you are ready.</p>
    <p>When your situation changes and you are prepared to move forward, you are welcome to submit a new qualification form. We will be here to reassess your next steps then.</p>
    <p style="margin-top:28px;">— The Scale to Legacy Team</p>
  `);
}

const creditLabels: Record<string, string> = {
  below_600: "Below 600",
  "600_649": "600–649",
  "650_679": "650–679",
  "680_699": "680–699",
  "700_749": "700–749",
  "750_plus": "750+",
};

const investmentLabels: Record<string, string> = {
  yes: "Yes, prepared to invest",
  questions: "Has questions first",
  credit_first: "Needs credit help first",
  no: "Not at this time",
};

const notificationConfig: Record<
  LeadScore,
  {
    subjectPrefix: string;
    headline: string;
    badge: string;
    badgeColor: string;
    route: string;
    summary: string;
    nextAction: string;
  }
> = {
  hot: {
    subjectPrefix: "New Hot Lead",
    headline: "New Hot Lead — Scale to Legacy",
    badge: "HOT · FUNDING CALENDAR",
    badgeColor: "#dc2626",
    route: "Funding calendar",
    summary:
      "This applicant reported a score of 680 or higher and has been shown the funding calendar.",
    nextAction: "Review the profile and follow up around the funding appointment.",
  },
  warm: {
    subjectPrefix: "New Warm Lead",
    headline: "New Warm Lead — Scale to Legacy",
    badge: "WARM · CREDIT STRATEGY",
    badgeColor: "#d97706",
    route: "Credit strategy calendar",
    summary:
      "This applicant is below 680 and explicitly selected that they are prepared to invest in the credit-support process. They have been shown the credit strategy calendar.",
    nextAction: "Review the profile and follow up around the credit strategy appointment.",
  },
  cold: {
    subjectPrefix: "New Nurture Lead",
    headline: "New Nurture Lead — Scale to Legacy",
    badge: "COLD · NO CALENDAR",
    badgeColor: "#2563eb",
    route: "Education-only nurture path",
    summary:
      "This applicant is below 680 and did not select that they are prepared to invest. They received next-step education only and were not shown a calendar.",
    nextAction:
      "Keep this lead in nurture. Do not request a booking unless they reapply after their readiness changes.",
  },
};

function internalLeadNotification(lead: Lead, score: LeadScore): string {
  const config = notificationConfig[score];
  const name = escapeHtml(lead.full_name);
  const email = escapeHtml(lead.email);
  const phone = escapeHtml(lead.phone);
  const creditScore = escapeHtml(creditLabels[lead.credit_score] ?? lead.credit_score);
  const utilization = escapeHtml(lead.utilization?.replace(/_/g, " ").replace("plus", "+") ?? "—");
  const investmentReady = escapeHtml(
    investmentLabels[lead.investment_ready ?? ""] ?? lead.investment_ready ?? "—",
  );
  const source = escapeHtml(lead.source ?? "qualify_form");
  const submitted = escapeHtml(new Date(lead.created_at).toLocaleString("en-US", { hour12: true }));

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f0; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .header { background: #1a1a2e; padding: 24px 32px; }
    .header h1 { color: #c9a227; font-size: 20px; margin: 0; }
    .badge { display: inline-block; color: #ffffff; padding: 5px 13px; border-radius: 999px; font-size: 11px; font-weight: bold; letter-spacing: .3px; margin-top: 10px; }
    .body { padding: 28px 32px; }
    .summary { margin: 0 0 12px; color: #444; font-size: 15px; line-height: 1.55; }
    .action { margin: 0 0 20px; padding: 12px 14px; border-left: 4px solid #c9a227; background: #faf8ee; color: #333; font-size: 14px; line-height: 1.45; }
    .row { display: flex; justify-content: space-between; gap: 24px; padding: 10px 0; border-bottom: 1px solid #eeeeee; font-size: 14px; }
    .label { color: #777; }
    .value { font-weight: bold; color: #1a1a1a; text-align: right; word-break: break-word; }
    .footer { background: #f5f5f0; padding: 16px 32px; font-size: 11px; color: #777; text-align: center; }
    a { color: #9a7712; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${config.headline}</h1>
      <span class="badge" style="background:${config.badgeColor};">${config.badge}</span>
    </div>
    <div class="body">
      <p class="summary">${config.summary}</p>
      <p class="action"><strong>Recommended action:</strong> ${config.nextAction}</p>
      <div class="row"><span class="label">Route</span><span class="value">${config.route}</span></div>
      <div class="row"><span class="label">Name</span><span class="value">${name}</span></div>
      <div class="row"><span class="label">Email</span><span class="value">${email}</span></div>
      <div class="row"><span class="label">Phone</span><span class="value">${phone}</span></div>
      <div class="row"><span class="label">Credit score</span><span class="value">${creditScore}</span></div>
      <div class="row"><span class="label">Credit utilization</span><span class="value">${utilization}</span></div>
      <div class="row"><span class="label">Investment readiness</span><span class="value">${investmentReady}</span></div>
      <div class="row"><span class="label">Submitted</span><span class="value">${submitted}</span></div>
      <div class="row"><span class="label">Source</span><span class="value">${source}</span></div>
      <p style="margin:24px 0 0;font-size:14px;">
        <a href="mailto:${email}">Email lead</a> &nbsp;·&nbsp;
        <a href="tel:${phone}">Call lead</a> &nbsp;·&nbsp;
        <a href="https://scaletolegacynow.com/admin">View in CRM</a>
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

    const score: LeadScore = lead.score === "hot" || lead.score === "warm" ? lead.score : "cold";

    let leadEmailSent = false;
    if (score === "hot") {
      leadEmailSent = await sendEmail(
        lead.email,
        "Your Funding Strategy Session Is the Next Step | Scale to Legacy",
        hotLeadEmail(lead),
      );
    } else if (score === "warm") {
      leadEmailSent = await sendEmail(
        lead.email,
        "Your Credit Strategy Session Is the Next Step | Scale to Legacy",
        warmLeadEmail(lead),
      );
    } else {
      leadEmailSent = await sendEmail(
        lead.email,
        "Your Next Step Toward Business Funding | Scale to Legacy",
        coldLeadEmail(lead),
      );
    }

    const notifSubject = `${notificationConfig[score].subjectPrefix}: ${lead.full_name} — Scale to Legacy`;
    let notifSent = false;
    for (const email of NOTIFY_EMAILS) {
      const sent = await sendEmail(email, notifSubject, internalLeadNotification(lead, score));
      if (sent) notifSent = true;
    }

    return new Response(JSON.stringify({ success: true, leadEmailSent, notifSent, score }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
