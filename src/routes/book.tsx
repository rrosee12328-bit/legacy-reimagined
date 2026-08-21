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
        content: "Pick a time for your Scale To Legacy funding strategy session.",
      },
      { property: "og:title", content: "Book Your Strategy Session — Scale To Legacy" },
      {
        property: "og:description",
        content: "Pick a time for your Scale To Legacy funding strategy session.",
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
    score: "",
    leadId: "",
    bookingToken: "",
  });

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setParams({
      name: search.get("name") ?? "",
      email: search.get("email") ?? "",
      score: search.get("score") ?? "",
      leadId: search.get("lead") ?? "",
      bookingToken: search.get("booking_token") ?? "",
    });
  }, []);

  const isEligibleForFunding = params.score === "hot";

  useEffect(() => {
    if (!isEligibleForFunding) return;
    fbqTrack("InitiateCheckout", {
      content_name: "Funding Strategy Session",
      content_category: "Business Funding",
    });
    fbqTrack("SubmitApplication", {
      content_name: "Funding Strategy Session",
      content_category: "Business Funding",
    });
  }, [isEligibleForFunding]);

  const handleScheduled = useCallback(() => {
    navigate({ to: "/thank-you" });
  }, [navigate]);

  if (!isEligibleForFunding) {
    return (
      <main className="min-h-screen bg-background grid place-items-center px-6 text-center">
        <section className="max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">
            Funding Readiness
          </p>
          <h1 className="mt-3 font-display text-3xl md:text-4xl">
            This booking page is for 680+ funding applicants.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Scale to Legacy funding sessions are reserved for applicants who have completed the
            qualification form and reported a personal credit score of 680 or higher.
          </p>
          <a
            href="/"
            className="mt-7 inline-flex rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground"
          >
            Return to the Funding Readiness Form
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-4xl px-6 pt-12 pb-7 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">Final Step</p>
        <h1 className="mt-3 font-display text-3xl md:text-4xl">
          Complete your funding strategy session booking
        </h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-xl mx-auto">
          Please choose the available date and time that works best for you below. Your appointment
          is confirmed only after you select a time and receive the confirmation.
        </p>
      </section>
      <section className="mx-auto max-w-4xl px-4 pb-20">
        <CalendlyBookingEmbed
          name={params.name}
          email={params.email}
          leadId={params.leadId}
          bookingToken={params.bookingToken}
          onScheduled={handleScheduled}
        />
      </section>
    </main>
  );
}
