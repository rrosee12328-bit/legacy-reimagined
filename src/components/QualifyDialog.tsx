import { useCallback, useState } from "react";
import { X, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { CalendlyBookingEmbed } from "@/components/CalendlyBookingEmbed";

// ─── Meta Pixel helper ────────────────────────────────────────────────────────
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}
function fbq(event: string, name: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq(event, name, params ?? {});
  }
}

// ─── Booking links ────────────────────────────────────────────────────────────
const BOOK_PATH = "/book";

function bookUrl(
  a: { full_name: string; email: string; phone?: string },
  meta?: { leadId?: string | null; score?: string | null; bookingToken?: string | null },
) {
  const p = new URLSearchParams({ type: "funding", name: a.full_name, email: a.email });
  if (a.phone) p.set("phone", a.phone);
  if (meta?.leadId) p.set("lead", meta.leadId);
  if (meta?.score) p.set("score", meta.score);
  if (meta?.bookingToken) p.set("booking_token", meta.bookingToken);
  return `${BOOK_PATH}?${p.toString()}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Result = "funding" | "disqualified" | null;

interface Answers {
  full_name: string;
  email: string;
  phone: string;
  credit_score: string;
  utilization: string;
  llc_status: string;
  contact_consent: boolean;
}

// ─── Routing logic ────────────────────────────────────────────────────────────
function routeLead(a: Answers): Result {
  // Initial funding sessions require a self-reported 680+ score and utilization below 30%.
  const hasScoreBenchmark = ["680_699", "700_749", "750_plus"].includes(a.credit_score);
  const hasUtilizationBenchmark = ["under_10", "10_29"].includes(a.utilization);
  return hasScoreBenchmark && hasUtilizationBenchmark ? "funding" : "disqualified";
}

// ─── Supabase lead score ──────────────────────────────────────────────────────
function scoreFromResult(r: Result) {
  return r === "funding" ? "hot" : "cold";
}

// ─── Main component ───────────────────────────────────────────────────────────
export function QualifyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [result, setResult] = useState<Result>(null);
  const [submitting, setSub] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadScore, setScore] = useState<string | null>(null);
  const [bookingToken, setBookingToken] = useState<string | null>(null);

  const handleCalendarScheduled = useCallback(() => {
    window.location.assign("/thank-you");
  }, []);

  const [answers, setAnswers] = useState<Answers>({
    full_name: "",
    email: "",
    phone: "",
    credit_score: "",
    utilization: "",
    llc_status: "",
    contact_consent: false,
  });

  if (!open) return null;

  const filled = [
    !!(answers.full_name && answers.email && answers.phone),
    !!answers.credit_score,
    !!answers.utilization,
    !!answers.llc_status,
  ].filter(Boolean).length;
  const progress = result ? 100 : Math.round((filled / 4) * 100);

  function set<K extends keyof Answers>(field: K, value: Answers[K]) {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  }

  async function submit() {
    if (!answers.full_name || !answers.email || !answers.phone) {
      setError("Please fill in your name, email and phone.");
      return;
    }
    if (!answers.credit_score || !answers.utilization || !answers.llc_status) {
      setError("Please answer all questions.");
      return;
    }
    if (!answers.contact_consent) {
      setError("Please authorize the call and text follow-up before submitting.");
      return;
    }
    setError(null);
    setSub(true);

    const route = routeLead(answers);
    const score = scoreFromResult(route);

    // Generate the id client-side so we can attach it to the booking record
    // without needing SELECT access on the leads table.
    const newLeadId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const newBookingToken =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const { error: dbErr } = await supabase.from("leads").insert({
      id: newLeadId,
      full_name: answers.full_name,
      email: answers.email,
      phone: answers.phone,
      business_name: "—",
      credit_score: answers.credit_score,
      utilization: answers.utilization,
      llc_status: answers.llc_status,
      score,
      source: "qualify_form",
      sms_contact_consent: answers.contact_consent,
      contact_consent_at: new Date().toISOString(),
      contact_consent_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      contact_consent_text:
        "v1: Scale to Legacy automated/AI-generated calls and texts; consent not a condition of purchase; STOP opt-out; message/data rates may apply.",
      calendar_confirmation_token: newBookingToken,
    });

    setSub(false);
    setScore(score);
    setLeadId(newLeadId);
    setBookingToken(newBookingToken);

    if (dbErr) {
      // Non-blocking — still show result even if DB write fails
      console.error("Supabase error:", dbErr.message);
    }

    if (route === "disqualified") {
      window.location.assign("/not-qualified");
      return;
    }

    setResult(route);

    // Only qualified applicants are conversion signals for Meta optimization.
    fbq("track", "Lead", {
      content_name: "Business Funding",
      content_category: "Business Funding",
      status: score,
    });
    fbq("track", "SubmitApplication", {
      content_name: "Funding Pre-Qualification",
      content_category: "Business Funding",
      status: score,
    });

    // Qualified leads stay on this result screen so the embedded calendar opens immediately.
    // The Schedule event fires only after Calendly confirms an actual appointment.
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-up">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl glass p-8 shadow-card">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 rounded-full p-2 hover:bg-accent transition"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Progress bar */}
        <div className="h-1 bg-border rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* ── RESULT SCREENS ───────────────────────────────────────────── */}
        {result === "funding" && (
          <BookingResultScreen
            icon={<CheckCircle2 className="h-8 w-8" />}
            color="text-primary"
            bg="bg-primary/15"
            title="You may qualify for business funding."
            body="You’re on the final step. Please choose the available date and time that works best for you below to complete your funding strategy session booking."
            name={answers.full_name}
            email={answers.email}
            leadId={leadId}
            bookingToken={bookingToken}
            fallbackHref={bookUrl(answers, { leadId, score: leadScore, bookingToken })}
            onScheduled={handleCalendarScheduled}
            onClose={onClose}
            disclaimer="Funding is subject to credit approval and individual qualification. Results vary."
          />
        )}

        {/* ── SINGLE-PAGE FORM ─────────────────────────────────────────── */}
        {!result && (
          <>
            <p className="text-xs uppercase tracking-widest text-gold mb-1">Pre-Qualify</p>
            <h3 className="font-display text-2xl mb-6">
              See if you meet the 680+ funding benchmark — takes about 60 seconds.
            </h3>

            <div className="grid gap-7">
              {/* Contact info */}
              <div className="grid gap-4">
                <Field
                  label="Full Name"
                  value={answers.full_name}
                  onChange={(v) => set("full_name", v)}
                  required
                />
                <Field
                  label="Email Address"
                  type="email"
                  value={answers.email}
                  onChange={(v) => set("email", v)}
                  required
                />
                <Field
                  label="Phone Number"
                  type="tel"
                  value={answers.phone}
                  onChange={(v) => set("phone", v)}
                  required
                />
              </div>

              {/* Credit score */}
              <div className="grid gap-3">
                <QuestionLabel>What is your personal credit score?</QuestionLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { v: "below_600", l: "Below 600" },
                    { v: "600_649", l: "600 – 649" },
                    { v: "650_679", l: "650 – 679" },
                    { v: "680_699", l: "680 – 699" },
                    { v: "700_749", l: "700 – 749" },
                    { v: "750_plus", l: "750+" },
                  ].map((o) => (
                    <OptionBtn
                      key={o.v}
                      label={o.l}
                      selected={answers.credit_score === o.v}
                      onClick={() => {
                        set("credit_score", o.v);
                        setError(null);
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Utilization */}
              <div className="grid gap-3">
                <QuestionLabel>What is your current credit utilization?</QuestionLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { v: "under_10", l: "Under 10%" },
                    { v: "10_29", l: "10% – 29%" },
                    { v: "30_49", l: "30% – 49%" },
                    { v: "50_plus", l: "50% or more" },
                  ].map((o) => (
                    <OptionBtn
                      key={o.v}
                      label={o.l}
                      selected={answers.utilization === o.v}
                      onClick={() => {
                        set("utilization", o.v);
                        setError(null);
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* LLC */}
              <div className="grid gap-3">
                <QuestionLabel>Do you have an LLC or business entity?</QuestionLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { v: "yes", l: "Yes, I have one" },
                    { v: "no", l: "No, but I want one" },
                    { v: "forming", l: "In the process" },
                    { v: "not_sure", l: "Not sure yet" },
                  ].map((o) => (
                    <OptionBtn
                      key={o.v}
                      label={o.l}
                      selected={answers.llc_status === o.v}
                      onClick={() => {
                        set("llc_status", o.v);
                        setError(null);
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-3">
                <label className="flex items-start gap-3 rounded-xl border border-border bg-background p-4 text-left">
                  <input
                    type="checkbox"
                    checked={answers.contact_consent}
                    onChange={(event) => {
                      set("contact_consent", event.target.checked);
                      setError(null);
                    }}
                    className="mt-1 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    By checking this box and clicking “See My Results,” I provide my electronic
                    signature and agree that Scale to Legacy may call and text the number I entered
                    about my funding application, including through automated technology and an
                    artificial or AI-generated voice. Consent is not a condition of purchasing any
                    goods or services. Message and data rates may apply. Reply STOP to opt out.
                  </span>
                </label>
                <button
                  onClick={submit}
                  disabled={submitting || !answers.contact_consent}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-7 py-3.5 font-medium shadow-glow hover:brightness-110 transition disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Checking…
                    </>
                  ) : (
                    <>
                      See My Results <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
                <p className="text-xs text-muted-foreground text-center">
                  Funding is subject to credit approval and individual qualification.
                </p>
              </div>
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BookingResultScreen({
  icon,
  color,
  bg,
  title,
  body,
  name,
  email,
  leadId,
  bookingToken,
  fallbackHref,
  onScheduled,
  onClose,
  disclaimer,
}: {
  icon: React.ReactNode;
  color: string;
  bg: string;
  title: string;
  body: string;
  name: string;
  email: string;
  leadId?: string | null;
  bookingToken?: string | null;
  fallbackHref: string;
  onScheduled: () => void;
  onClose: () => void;
  disclaimer?: string;
}) {
  return (
    <div className="py-2 text-center">
      <div className={`mx-auto rounded-full ${bg} ${color} p-4 w-fit`}>{icon}</div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-gold">Final Step</p>
      <h3 className="mt-1 font-display text-2xl">{title}</h3>
      <p className="mt-3 text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">{body}</p>
      <div className="mt-5 rounded-xl border-2 border-primary bg-primary/10 px-4 py-3 text-left">
        <p className="font-semibold text-sm">Your application is not finished yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a date, choose a time, and submit the Calendly form below. You are booked only
          when you see the confirmation screen and receive the calendar invitation.
        </p>
      </div>
      <div className="mt-6 text-left">
        <CalendlyBookingEmbed
          name={name}
          email={email}
          leadId={leadId}
          bookingToken={bookingToken}
          onScheduled={onScheduled}
        />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Having trouble loading the calendar?{" "}
        <a href={fallbackHref} className="underline hover:text-foreground">
          Open the booking page
        </a>
        .
      </p>
      <button
        onClick={onClose}
        className="mt-4 block mx-auto text-sm text-muted-foreground underline"
      >
        Close
      </button>
      {disclaimer && (
        <p className="mt-5 text-xs text-muted-foreground max-w-sm mx-auto">{disclaimer}</p>
      )}
    </div>
  );
}

function ResultScreen({
  icon,
  color,
  bg,
  title,
  body,
  cta,
  href,
  onClose,
  disclaimer,
}: {
  icon: React.ReactNode;
  color: string;
  bg: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  onClose: () => void;
  disclaimer?: string;
}) {
  return (
    <div className="py-6 text-center">
      <div className={`mx-auto rounded-full ${bg} ${color} p-4 w-fit`}>{icon}</div>
      <h3 className="mt-5 font-display text-2xl">{title}</h3>
      <p className="mt-3 text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">{body}</p>
      <a
        href={href}
        target={href.startsWith("/") ? undefined : "_blank"}
        rel={href.startsWith("/") ? undefined : "noopener noreferrer"}
        className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-7 py-3.5 font-medium shadow-glow hover:brightness-110 transition"
      >
        {cta} <ArrowRight className="h-4 w-4" />
      </a>
      <button
        onClick={onClose}
        className="mt-4 block mx-auto text-sm text-muted-foreground underline"
      >
        Close
      </button>
      {disclaimer && (
        <p className="mt-5 text-xs text-muted-foreground max-w-sm mx-auto">{disclaimer}</p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-primary"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1.5 w-full rounded-xl bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </label>
  );
}

function OptionBtn({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl px-5 py-3.5 text-sm font-medium border transition ${
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background hover:border-primary/40 hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );
}

function QuestionLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-semibold">{children}</span>;
}
