import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { CheckCircle2, CalendarCheck, Mail } from "lucide-react";

declare global { interface Window { fbq?: (...args: unknown[]) => void; } }
function fbqTrack(name: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.fbq) window.fbq("track", name, params ?? {});
}

export const Route = createFileRoute("/thank-you")({
  head: () => ({
    meta: [
      { title: "Appointment Confirmed — Scale To Legacy" },
      {
        name: "description",
        content:
          "Your strategy session is confirmed. Check your email for the calendar invite and next steps.",
      },
      { property: "og:title", content: "Appointment Confirmed — Scale To Legacy" },
      {
        property: "og:description",
        content:
          "Your strategy session is confirmed. Check your email for the calendar invite and next steps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ThankYouPage,
});

function ThankYouPage() {
  // Fire Schedule + SubmitApplication + CompleteRegistration on confirmed booking
  useEffect(() => {
    fbqTrack("Schedule", {
      content_name: "Strategy Session Confirmed",
      content_category: "Business Funding",
    });
    fbqTrack("SubmitApplication", {
      content_name: "Strategy Session Confirmed",
      content_category: "Business Funding",
      status: "booked",
    });
    fbqTrack("CompleteRegistration", {
      content_name: "Strategy Session Confirmed",
      content_category: "Business Funding",
      status: "booked",
    });
  }, []);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-xl rounded-3xl glass p-10 text-center shadow-card">
        <div className="mx-auto w-fit rounded-full bg-primary/15 text-primary p-4">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <p className="mt-6 text-xs uppercase tracking-widest text-gold">You're Booked</p>
        <h1 className="mt-2 font-display text-3xl">Your appointment is confirmed.</h1>
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
          Thank you for scheduling your strategy session. A calendar invite and
          confirmation email are on the way with your meeting details.
        </p>

        <div className="mt-8 grid gap-3 text-left">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background px-4 py-3">
            <CalendarCheck className="h-5 w-5 text-primary mt-0.5" />
            <p className="text-sm">
              <span className="font-medium">Add it to your calendar</span> so you don't
              miss it — showing up on time keeps your spot.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-background px-4 py-3">
            <Mail className="h-5 w-5 text-primary mt-0.5" />
            <p className="text-sm">
              <span className="font-medium">Check your inbox</span> for your confirmation.
              If you don't see it, check spam or promotions.
            </p>
          </div>
        </div>

        <Link
          to="/"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-7 py-3.5 font-medium shadow-glow hover:brightness-110 transition"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}
