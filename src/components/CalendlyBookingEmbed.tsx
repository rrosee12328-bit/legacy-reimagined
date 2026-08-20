import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (options: Record<string, unknown>) => void;
    };
    fbq?: (...args: unknown[]) => void;
  }
}

const CALENDLY_BASE = "https://calendly.com/scaletolegacy/30min?back=1&month=2026-08";

interface CalendlyBookingEmbedProps {
  name: string;
  email: string;
  onScheduled: () => void;
}

export function CalendlyBookingEmbed({ name, email, onScheduled }: CalendlyBookingEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasScheduledRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const url = new URL(CALENDLY_BASE);
    url.searchParams.set("hide_gdpr_banner", "1");
    if (name) url.searchParams.set("name", name);
    if (email) url.searchParams.set("email", email);

    function initialize() {
      if (!window.Calendly || !containerRef.current) return;
      containerRef.current.innerHTML = "";
      window.Calendly.initInlineWidget({
        url: url.toString(),
        parentElement: containerRef.current,
        prefill: {
          name: name || undefined,
          email: email || undefined,
        },
      });
      setReady(true);
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://assets.calendly.com/assets/external/widget.js"]',
    );

    if (window.Calendly) {
      initialize();
      return;
    }

    if (existing) {
      existing.addEventListener("load", initialize);
      return () => existing.removeEventListener("load", initialize);
    }

    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    script.addEventListener("load", initialize);
    document.body.appendChild(script);

    return () => script.removeEventListener("load", initialize);
  }, [name, email]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        hasScheduledRef.current ||
        typeof event.origin !== "string" ||
        !event.origin.includes("calendly.com") ||
        event.data?.event !== "calendly.event_scheduled"
      ) {
        return;
      }

      hasScheduledRef.current = true;
      window.fbq?.("track", "Schedule", {
        content_name: "Funding Strategy Session Booked",
        content_category: "Business Funding",
      });
      onScheduled();
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onScheduled]);

  return (
    <div>
      <div
        ref={containerRef}
        aria-label="Strategy session scheduling calendar"
        className="overflow-hidden rounded-2xl border border-border bg-background"
        style={{ minWidth: 320, height: 760 }}
      />
      {!ready && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Loading calendar…{" "}
          <a href={CALENDLY_BASE} target="_blank" rel="noopener noreferrer" className="underline">
            Open calendar in a new tab
          </a>
        </p>
      )}
    </div>
  );
}
