import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CalendlyBookingEmbed } from "@/components/CalendlyBookingEmbed";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

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
          "Pick a time for your funding or credit strategy session with the Scale To Legacy team.",
      },
      { property: "og:title", content: "Book Your Strategy Session — Scale To Legacy" },
      {
        property: "og:description",
        content:
          "Pick a time for your funding or credit strategy session with the Scale To Legacy team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookPage,
});

function BookPage() {
  const navigate = useNavigate();
  const [params, setParams] = useState({
    name: "",
    email: "",
    type: "funding" as "funding" | "credit",
  });

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setParams({
      name: search.get("name") ?? "",
      email: search.get("email") ?? "",
      type: search.get("type") === "credit" ? "credit" : "funding",
    });
  }, []);

  useEffect(() => {
    const sessionName =
      params.type === "credit" ? "Credit Strategy Session" : "Funding Strategy Session";
    fbqTrack("InitiateCheckout", {
      content_name: sessionName,
      content_category: "Business Funding",
    });
    fbqTrack("SubmitApplication", {
      content_name: sessionName,
      content_category: "Business Funding",
    });
  }, [params.type]);

  const handleScheduled = useCallback(() => {
    navigate({ to: "/thank-you" });
  }, [navigate]);

  const sessionName = params.type === "credit" ? "credit strategy" : "funding strategy";

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-4xl px-6 pt-12 pb-7 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">Final Step</p>
        <h1 className="mt-3 font-display text-3xl md:text-4xl">
          Complete your {sessionName} session booking
        </h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-xl mx-auto">
          Please choose the available date and time that works best for you below. Your appointment
          is confirmed only after you select a time and receive the confirmation.
        </p>
      </section>
      <section className="mx-auto max-w-4xl px-4 pb-20">
        <CalendlyBookingEmbed
          type={params.type}
          name={params.name}
          email={params.email}
          onScheduled={handleScheduled}
        />
      </section>
    </main>
  );
}
