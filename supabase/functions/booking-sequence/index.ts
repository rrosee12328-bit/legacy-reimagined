import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://qlvsbsfddwuocfihsleq.supabase.co";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FROM = "Scale to Legacy <info@scaletolegacynow.com>";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Email templates ──────────────────────────────────────────────────────────

function wrapEmail(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{font-family:Arial,sans-serif;background:#f5f5f0;margin:0;padding:0}
    .c{max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden}
    .h{background:#1a1a2e;padding:24px 36px}
    .h h1{color:#c9a227;font-size:20px;margin:0}
    .h p{color:#fff;font-size:12px;margin:6px 0 0}
    .b{padding:32px 36px;color:#1a1a1a;font-size:15px;line-height:1.8}
    .b p{margin:0 0 14px}
    .f{background:#f5f5f0;padding:16px 36px;text-align:center;font-size:11px;color:#999}
  </style></head><body>
  <div class="c">
    <div class="h"><h1>Scale to Legacy</h1><p>Business Funding Strategy</p></div>
    <div class="b">${body}</div>
    <div class="f"><p>Funding is subject to credit approval. Results vary. Scale to Legacy is not a lender.</p><p>© ${new Date().getFullYear()} Scale to Legacy · scaletolegacynow.com</p></div>
  </div></body></html>`;
}

function email1(name: string, day: string, time: string): string {
  return wrapEmail(`
    <p>Hey ${name},</p>
    <p>You're set for <strong>${day}</strong> at <strong>${time}</strong>.<br/>The Zoom link is in your Calendly confirmation.</p>
    <p>Before we hop on, I want to be upfront about how I run these calls. It's probably different from what you're used to.</p>
    <p>I'm not going to spend the first 20 minutes pitching you. I'm not going to walk you through a presentation or tell you why our process is the best thing since sliced bread.</p>
    <p>What we're actually going to do is look at your credit profile and your business goals together — and map out exactly what funding options may be available to you.</p>
    <p>Where your credit score sits right now. What your utilization looks like. Whether you need an LLC formed or already have one. And what a realistic funding strategy looks like for your specific situation.</p>
    <p>By the time we get off the phone, you'll have a clear picture of what's possible — and what the path looks like to get there.</p>
    <p>Whether or not you decide to move forward is a separate conversation. I'd rather you leave the call with real clarity than leave with a pitch you didn't need.</p>
    <p>Talk soon,<br/><strong>Lonnie</strong></p>
    <p><em>P.S. Most people I sit down with tell me the same thing after our call. They had no idea their personal credit could do what it can do for their business.</em></p>
  `);
}

function email2(name: string, day: string, time: string): string {
  return wrapEmail(`
    <p>Hey ${name},</p>
    <p>Ask any entrepreneur what their credit score is and they can tell you. Ask them what their credit utilization is — and most of them go quiet.</p>
    <p>That number matters more than almost anything else when it comes to accessing business funding.</p>
    <p>Because it's not just about having a good score. It's about how much of your available credit you're using. And it's the number that separates the people who qualify from the people who almost qualify.</p>
    <p>Here's why it matters for you specifically.</p>
    <p>You already have credit built up. You already have income. You may already have a business — or you're ready to start one.</p>
    <p>Everything you need to access 0% interest business capital may already be in place.</p>
    <p>The only reason most people don't get funded isn't because they're not qualified. It's because nobody ever showed them how to use what they already have.</p>
    <p>That's the conversation we're going to have on <strong>${day}</strong>.</p>
    <p>Talk soon,<br/><strong>Lonnie</strong></p>
    <p><em>P.S. Reminder — we're on for ${day} at ${time}. Before we hop on, think about this: what would you do with $50,000 to $200,000 in 0% interest business capital?</em></p>
  `);
}

function email3(name: string, day: string, time: string): string {
  return wrapEmail(`
    <p>Hey ${name},</p>
    <p>I want to share something before we hop on <strong>${day}</strong>.</p>
    <p>One of the most common things I hear from people after our call is this:</p>
    <p><em>"I had no idea my personal credit could do that."</em></p>
    <p>Not business credit. Not a business loan. Not years of tax returns or revenue history.</p>
    <p>Their personal credit score — the one they've been building their whole life — opened the door to 0% interest business capital they didn't know existed.</p>
    <p>That's the part most people miss. They've been going to banks. Getting denied. Trying to figure out what's wrong with their business. When the answer had nothing to do with their business at all.</p>
    <p>It was sitting in their personal credit profile the whole time.</p>
    <p>A 680 score and under 30% utilization is the standard. That's the baseline that connects you to lenders like Chase, Truist, and Amex — at 0% interest for 12 to 18 months.</p>
    <p>No business revenue required. No years of history. No LLC needed — we handle that too if you don't have one.</p>
    <p>Most people don't find out this is possible until someone sits down with them and shows them. That's what <strong>${day}</strong> is for.</p>
    <p>Talk soon,<br/><strong>Lonnie</strong></p>
    <p><em>P.S. We're on for ${day} at ${time}. See you then.</em></p>
  `);
}

function email4(name: string, day: string, time: string): string {
  return wrapEmail(`
    <p>Hey ${name},</p>
    <p>Something has been on my mind since you booked.</p>
    <p>Most of the people I sit down with are running their lives and their businesses the right way. Income is there. Credit is decent. They're doing what they're supposed to do.</p>
    <p>But underneath it all, they know something is off.</p>
    <p>They feel like they should be further along. Like the business should have more capital behind it. Like there's an opportunity they keep almost reaching but can't quite grab.</p>
    <p>If that's where you're at right now — I want you to know you're not alone in that feeling. And usually, the answer isn't what they think it is.</p>
    <p>It's not that they need a better credit score. It's not that they need to wait longer. It's that nobody ever sat down with them and showed them how to use what they already have.</p>
    <p>Our conversation on <strong>${day}</strong> is going to give you the space to look at that. No pressure to do anything. Just a clear picture of what's actually available to you.</p>
    <p>Talk soon,<br/><strong>Lonnie</strong></p>
    <p><em>P.S. We're on for ${day} at ${time}. Come with whatever's on your mind about your business right now. That's the best starting point.</em></p>
  `);
}

function email5(name: string, day: string, time: string): string {
  return wrapEmail(`
    <p>Hey ${name},</p>
    <p>Every person I've worked with who struggled to get business funding was dealing with one of three things.</p>
    <p>Credit score below 680.<br/>Credit utilization above 30%.<br/>No business entity to attach the funding to.</p>
    <p>That's it. Those three things block more business funding than anything else.</p>
    <p>And here's the part that matters.</p>
    <p>Fix any one of them and the picture changes. Fix all three and you're in a completely different position.</p>
    <p>The credit score — we can map a path to get there. The utilization — often fixable faster than people think. The LLC — we handle that in about a week.</p>
    <p>Our conversation on <strong>${day}</strong> is going to show you exactly which of the three applies to you — and what it would take to close the gap.</p>
    <p>Not theory. Not a pitch. Just your actual numbers and your actual options.</p>
    <p>Talk soon,<br/><strong>Lonnie</strong></p>
    <p><em>P.S. If you want to see how the funding process actually works before we hop on, the Calendly confirmation has everything you need to know going in.</em></p>
  `);
}

function email6(name: string, day: string, time: string): string {
  return wrapEmail(`
    <p>Hey ${name},</p>
    <p>Quick heads up on what I'll want to understand when we hop on <strong>${day}</strong>.</p>
    <p>Where your credit score sits right now — even a rough number is fine.<br/>What your credit utilization looks like across your cards.<br/>Whether you have an LLC or are looking to start one.<br/>What you'd use the funding for if you got it.</p>
    <p>That's it. You don't need documents. You don't need to prepare a presentation. You don't need to have everything figured out.</p>
    <p>Just come with a general sense of those four things and we'll take it from there.</p>
    <p>The call is about giving you clarity — not putting you on the spot.</p>
    <p>By the time we're done, you'll know exactly where you stand and what the path forward looks like. That's where the real conversation starts.</p>
    <p>Talk soon,<br/><strong>Lonnie</strong></p>
    <p><em>P.S. If something specific has been on your mind about your credit or your business lately — a denial you got, a goal you've been sitting on — bring that up early in the call. That's usually where the most important conversation lives.</em></p>
  `);
}

function email7(name: string, day: string, time: string): string {
  return wrapEmail(`
    <p>Hey ${name},</p>
    <p>We're on today at <strong>${time}</strong>.<br/>Zoom link is in your Calendly confirmation.</p>
    <p>A few things to have in mind going in:</p>
    <p>Your approximate credit score.<br/>A rough sense of your credit utilization.<br/>What you'd do with the capital if you got it.</p>
    <p>That's all you need. I'll handle the rest.</p>
    <p>See you in a few hours.</p>
    <p><strong>Lonnie</strong></p>
    <p><em>P.S. If anything comes up and you need to reschedule, the link is in your confirmation. Just give me as much notice as you can so I can open the slot for someone else.</em></p>
  `);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const payload = await req.json();

    // Handle Calendly webhook payload
    const event = payload.payload ?? payload;
    const eventType = payload.event ?? "";

    // Only process invitee.created (new booking)
    if (eventType !== "invitee.created" && !event.invitee) {
      return new Response(JSON.stringify({ skipped: true, event: eventType }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const invitee = event.invitee ?? event;
    const scheduledEvent = event.scheduled_event ?? event;

    const name = invitee.name ?? "there";
    const email = invitee.email ?? "";
    const phone = invitee.text_reminder_number ?? null;
    const startTime = new Date(scheduledEvent.start_time ?? scheduledEvent.start ?? new Date());
    const endTime = scheduledEvent.end_time ? new Date(scheduledEvent.end_time) : null;
    const eventName = scheduledEvent.name ?? "Strategy Session";
    const calendlyEventId = scheduledEvent.uri ?? scheduledEvent.uuid ?? `${email}-${startTime.toISOString()}`;

    const dayStr = startTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const timeStr = startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

    // Insert booking record
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .upsert({
        calendly_event_id: calendlyEventId,
        invitee_name: name,
        invitee_email: email,
        invitee_phone: phone,
        event_start_time: startTime.toISOString(),
        event_end_time: endTime?.toISOString() ?? null,
        event_name: eventName,
        status: "confirmed",
      }, { onConflict: "calendly_event_id" })
      .select()
      .single();

    if (bookingError) throw new Error(`Booking insert failed: ${bookingError.message}`);

    const bookingId = booking.id;
    const now = new Date();

    // Schedule all 7 emails
    const schedules = [
      { num: 1, delay: 0,           subject: `locked in for ${dayStr}`,           html: email1(name, dayStr, timeStr) },
      { num: 2, delay: 86400,       subject: "the number most people don't know",  html: email2(name, dayStr, timeStr) },
      { num: 3, delay: 172800,      subject: "they had no idea this was possible", html: email3(name, dayStr, timeStr) },
      { num: 4, delay: 259200,      subject: "something on my mind",               html: email4(name, dayStr, timeStr) },
      { num: 5, delay: 345600,      subject: "three things that block business funding", html: email5(name, dayStr, timeStr) },
      { num: 6, delay: 432000,      subject: "what I'll want to know",             html: email6(name, dayStr, timeStr) },
      // Email 7: morning of the call (9am on event day, or 2 hours before if less than 9am)
      { num: 7, delay: -1,          subject: `today at ${timeStr}`,                html: email7(name, dayStr, timeStr) },
    ];

    const emailRows = schedules.map((s) => {
      let sendAt: Date;
      if (s.num === 7) {
        // Send at 9am on the day of the call
        const callDay = new Date(startTime);
        callDay.setHours(9, 0, 0, 0);
        // If call is before 9am, send 2 hours before
        sendAt = callDay < startTime ? callDay : new Date(startTime.getTime() - 2 * 3600 * 1000);
      } else {
        sendAt = new Date(now.getTime() + s.delay * 1000);
      }

      return {
        booking_id: bookingId,
        to_email: email,
        to_name: name,
        subject: s.subject,
        html_body: s.html,
        send_at: sendAt.toISOString(),
        email_number: s.num,
        status: "pending",
      };
    });

    const { error: scheduleError } = await supabase.from("scheduled_emails").insert(emailRows);
    if (scheduleError) throw new Error(`Schedule insert failed: ${scheduleError.message}`);

    return new Response(JSON.stringify({ success: true, booking_id: bookingId, emails_scheduled: emailRows.length }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
