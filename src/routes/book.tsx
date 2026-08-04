import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

declare global { interface Window { fbq?: (...args: unknown[]) => void; } }
function fbqTrack(name: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.fbq) window.fbq("track", name, params ?? {});
}

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Book Your Strategy Session — Scale To Legacy" },
      {
        name: "description",
        content:
          "Pick a time for your free funding or credit strategy session with the Scale To Legacy team.",
      },
      { property: "og:title", content: "Book Your Strategy Session — Scale To Legacy" },
      {
        property: "og:description",
        content:
          "Pick a time for your free funding or credit strategy session with the Scale To Legacy team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookPage,
});

const CALENDLY_BASE = "https://calendly.com/scaletolegacy";

function BookPage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // Read prefill + type from the URL without needing typed search params.
  const [params, setParams] = useState<{
    name: string;
    email: string;
    phone: string;
    type: string;
    leadId: string;
    score: string;
  }>({ name: "", email: "", phone: "", type: "funding", leadId: "", score: "" });

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setParams({
      name: sp.get("name") ?? "",
      email: sp.get("email") ?? "",
      phone: sp.get("phone") ?? "",
      type: sp.get("type") ?? "funding",
      leadId: sp.get("lead") ?? "",
      score: sp.get("score") ?? "",
    });
  }, []);

  // Fire InitiateCheckout when the booking page loads
  useEffect(() => {
    fbqTrack("InitiateCheckout", {
      content_name: params.type === "credit" ? "Credit Strategy Session" : "Funding Strategy Session",
      content_category: "Business Funding",
    });
  }, [params.type]);

  // Load Calendly widget script + inline embed
  useEffect(() => {
    const url = new URL(CALENDLY_BASE);
    url.searchParams.set("hide_gdpr_banner", "1");
    if (params.name) url.searchParams.set("name", params.name);
    if (params.email) url.searchParams.set("email", params.email);

    function init() {
      const w = window as unknown as {
        Calendly?: { initInlineWidget: (o: Record<string, unknown>) => void };
      };
      if (!w.Calendly || !containerRef.current) return;
      containerRef.current.innerHTML = "";
      w.Calendly.initInlineWidget({
        url: url.toString(),
        parentElement: containerRef.current,
        prefill: {
          name: params.name || undefined,
          email: params.email || undefined,
        },
      });
      setReady(true);
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://assets.calendly.com/assets/external/widget.js"]',
    );
    if (existing) {
      init();
    } else {
      const s = document.createElement("script");
      s.src = "https://assets.calendly.com/assets/external/widget.js";
      s.async = true;
      s.onload = init;
      document.body.appendChild(s);
    }
  }, [params]);

  // When Calendly confirms the booking: save it to the CRM, then send them
  // to the thank-you page.
  useEffect(() => {
    async function saveAppointment(payload: Record<string, unknown> | undefined) {
      const evt = (payload?.["event"] ?? {}) as { uri?: string };
      const invitee = (payload?.["invitee"] ?? {}) as { uri?: string };

      const { error } = await supabase.from("appointments").insert({
        lead_id: params.leadId || null,
        lead_score: params.score || null,
        session_type: params.type === "credit" ? "credit" : "funding",
        full_name: params.name || null,
        email: params.email || null,
        phone: params.phone || null,
        calendly_event_uri: evt.uri ?? null,
        calendly_invitee_uri: invitee.uri ?? null,
        status: "scheduled",
        source: "website_booking",
      });
      if (error) console.error("Appointment save failed:", error.message);
    }

    function onMessage(e: MessageEvent) {
      if (
        typeof e.origin === "string" &&
        e.origin.includes("calendly.com") &&
        e.data?.event === "calendly.event_scheduled"
      ) {
        const w = window as unknown as { fbq?: (...a: unknown[]) => void };
        w.fbq?.("track", "Schedule", { content_name: "Strategy Session Booked" });
        void saveAppointment(e.data?.payload).finally(() => {
          navigate({ to: "/thank-you" });
        });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate, params]);

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="text-xs uppercase tracking-widest text-gold">Final Step</p>
        <h1 className="mt-3 font-display text-3xl md:text-4xl">
          {params.type === "credit"
            ? "Book your credit strategy session"
            : "Book your funding strategy session"}
        </h1>
        <p className="mt-3 text-muted-foreground text-sm max-w-xl mx-auto">
          Choose a time that works for you. You'll get a confirmation as soon as your
          appointment is scheduled.
        </p>
      </section>
      <div className="mx-auto max-w-4xl px-4 pb-20">
        <div
          ref={containerRef}
          style={{ minWidth: 320, height: 760 }}
          className="rounded-2xl overflow-hidden"
        />
        {!ready && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Loading calendar…{" "}
            <a
              href={CALENDLY_BASE}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Open in a new tab
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
