import { useState } from "react";
import { X, ArrowRight, Loader2, CheckCircle2, TrendingUp, BookOpen } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─── Calendly links ───────────────────────────────────────────────────────────
const FUNDING_CALENDLY = "https://calendly.com/vektiss-info/30-minute-vektiss-discovery";
const CREDIT_CALENDLY  = "https://calendly.com/vektiss-info/30-minute-vektiss-discovery";
const EBOOK_URL        = "https://www.scaletolegacy.com/the-key-to-scaling";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4 | 5;
type Result = "funding" | "credit" | "disqualified" | null;

interface Answers {
  full_name: string;
  email: string;
  phone: string;
  credit_score: string;
  utilization: string;
  llc_status: string;
  investment_ready: string;
}

// ─── Routing logic ────────────────────────────────────────────────────────────
function routeLead(a: Answers): Result {
  const highScore   = ["680_699", "700_749", "750_plus"].includes(a.credit_score);
  const lowUtil     = ["under_10", "10_29"].includes(a.utilization);
  const hasMoney    = ["yes", "questions"].includes(a.investment_ready);
  const creditMoney = a.investment_ready === "credit_first";
  const noMoney     = a.investment_ready === "no";

  if (noMoney) return "disqualified";
  if (highScore && lowUtil && hasMoney) return "funding";
  if (hasMoney || creditMoney) return "credit";
  return "disqualified";
}

// ─── Supabase lead score ──────────────────────────────────────────────────────
function scoreFromResult(r: Result) {
  if (r === "funding") return "hot";
  if (r === "credit")  return "warm";
  return "cold";
}

// ─── Main component ───────────────────────────────────────────────────────────
export function QualifyDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep]       = useState<Step>(1);
  const [result, setResult]   = useState<Result>(null);
  const [submitting, setSub]  = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [answers, setAnswers] = useState<Answers>({
    full_name: "",
    email: "",
    phone: "",
    credit_score: "",
    utilization: "",
    llc_status: "",
    investment_ready: "",
  });

  if (!open) return null;

  const progress = result ? 100 : Math.round(((step - 1) / 5) * 100);

  function set(field: keyof Answers, value: string) {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  }

  function next() { setStep((s) => (s < 5 ? ((s + 1) as Step) : s)); }
  function back() { setStep((s) => (s > 1 ? ((s - 1) as Step) : s)); }

  async function submit() {
    if (!answers.investment_ready) { setError("Please select an option."); return; }
    setError(null);
    setSub(true);

    const route = routeLead(answers);
    const score = scoreFromResult(route);

    const { error: dbErr } = await supabase.from("leads").insert({
      full_name:        answers.full_name,
      email:            answers.email,
      phone:            answers.phone,
      business_name:    "—",
      credit_score:     answers.credit_score,
      utilization:      answers.utilization,
      llc_status:       answers.llc_status,
      investment_ready: answers.investment_ready,
      score,
      source:           "qualify_form",
    });

    setSub(false);

    if (dbErr) {
      // Non-blocking — still show result even if DB write fails
      console.error("Supabase error:", dbErr.message);
    }

    setResult(route);

    // Redirect hot/warm leads to Calendly after a short delay
    if (route === "funding" || route === "credit") {
      const url = route === "funding" ? FUNDING_CALENDLY : CREDIT_CALENDLY;
      setTimeout(() => window.open(url, "_blank"), 1800);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-up">
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
      />
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
          <ResultScreen
            icon={<CheckCircle2 className="h-8 w-8" />}
            color="text-primary"
            bg="bg-primary/15"
            title="You may qualify for business funding!"
            body="Your profile looks strong. We're opening your strategy session booking now — or click below to schedule at your convenience."
            cta="Book Your Funding Strategy Session"
            href={FUNDING_CALENDLY}
            onClose={onClose}
            disclaimer="Funding is subject to credit approval. Results vary based on individual credit profile."
          />
        )}

        {result === "credit" && (
          <ResultScreen
            icon={<TrendingUp className="h-8 w-8" />}
            color="text-gold"
            bg="bg-gold/15"
            title="You're closer than you think."
            body="Your credit profile may need some work before you're ready for business funding — and that's exactly what we help with. Book a free credit strategy session to build your plan."
            cta="Book Your Credit Strategy Session"
            href={CREDIT_CALENDLY}
            onClose={onClose}
            disclaimer="Credit improvement timelines vary based on individual profiles and consistent action."
          />
        )}

        {result === "disqualified" && (
          <ResultScreen
            icon={<BookOpen className="h-8 w-8" />}
            color="text-muted-foreground"
            bg="bg-muted/30"
            title="Not quite ready yet — here's a free resource."
            body="Based on your answers, now may not be the right time to move forward. Grab our free guide to learn exactly what it takes to position yourself for business funding in the future."
            cta="Get the Free Guide"
            href={EBOOK_URL}
            onClose={onClose}
          />
        )}

        {/* ── FORM STEPS ───────────────────────────────────────────────── */}
        {!result && (
          <>
            <p className="text-xs uppercase tracking-widest text-gold mb-1">
              Step {step} of 5 — Pre-Qualify
            </p>
            <h3 className="font-display text-2xl mb-6">
              {step === 1 && "Let's start with your basic info."}
              {step === 2 && "What is your personal credit score?"}
              {step === 3 && "What is your current credit utilization?"}
              {step === 4 && "Do you have an LLC or business entity?"}
              {step === 5 && "Are you ready to invest in getting funded?"}
            </h3>

            {/* Step 1 — Contact info */}
            {step === 1 && (
              <div className="grid gap-4">
                <Field label="Full Name" value={answers.full_name} onChange={(v) => set("full_name", v)} required />
                <Field label="Email Address" type="email" value={answers.email} onChange={(v) => set("email", v)} required />
                <Field label="Phone Number" type="tel" value={answers.phone} onChange={(v) => set("phone", v)} required />
                <NavButtons
                  onNext={() => {
                    if (!answers.full_name || !answers.email || !answers.phone) {
                      setError("Please fill in all fields.");
                      return;
                    }
                    setError(null);
                    next();
                  }}
                  showBack={false}
                />
              </div>
            )}

            {/* Step 2 — Credit score */}
            {step === 2 && (
              <div className="grid gap-3">
                {[
                  { v: "below_600", l: "Below 600" },
                  { v: "600_649",   l: "600 – 649" },
                  { v: "650_679",   l: "650 – 679" },
                  { v: "680_699",   l: "680 – 699" },
                  { v: "700_749",   l: "700 – 749" },
                  { v: "750_plus",  l: "750+" },
                ].map((o) => (
                  <OptionBtn
                    key={o.v}
                    label={o.l}
                    selected={answers.credit_score === o.v}
                    onClick={() => { set("credit_score", o.v); setError(null); }}
                  />
                ))}
                <NavButtons
                  onNext={() => {
                    if (!answers.credit_score) { setError("Please select an option."); return; }
                    setError(null); next();
                  }}
                  onBack={back}
                />
              </div>
            )}

            {/* Step 3 — Utilization */}
            {step === 3 && (
              <div className="grid gap-3">
                {[
                  { v: "under_10", l: "Under 10%" },
                  { v: "10_29",    l: "10% – 29%" },
                  { v: "30_49",    l: "30% – 49%" },
                  { v: "50_plus",  l: "50% or more" },
                ].map((o) => (
                  <OptionBtn
                    key={o.v}
                    label={o.l}
                    selected={answers.utilization === o.v}
                    onClick={() => { set("utilization", o.v); setError(null); }}
                  />
                ))}
                <NavButtons
                  onNext={() => {
                    if (!answers.utilization) { setError("Please select an option."); return; }
                    setError(null); next();
                  }}
                  onBack={back}
                />
              </div>
            )}

            {/* Step 4 — LLC status */}
            {step === 4 && (
              <div className="grid gap-3">
                {[
                  { v: "yes",      l: "Yes, I have one" },
                  { v: "no",       l: "No, but I want one" },
                  { v: "forming",  l: "In the process" },
                  { v: "not_sure", l: "Not sure yet" },
                ].map((o) => (
                  <OptionBtn
                    key={o.v}
                    label={o.l}
                    selected={answers.llc_status === o.v}
                    onClick={() => { set("llc_status", o.v); setError(null); }}
                  />
                ))}
                <NavButtons
                  onNext={() => {
                    if (!answers.llc_status) { setError("Please select an option."); return; }
                    setError(null); next();
                  }}
                  onBack={back}
                />
              </div>
            )}

            {/* Step 5 — Investment readiness */}
            {step === 5 && (
              <div className="grid gap-3">
                <p className="text-sm text-muted-foreground -mt-2 mb-2">
                  Our process requires a $2,000 upfront investment (credited toward your total) to get started.
                </p>
                {[
                  { v: "yes",          l: "Yes, I'm ready to invest" },
                  { v: "questions",    l: "I have questions first" },
                  { v: "credit_first", l: "I need credit help first" },
                  { v: "no",           l: "Not at this time" },
                ].map((o) => (
                  <OptionBtn
                    key={o.v}
                    label={o.l}
                    selected={answers.investment_ready === o.v}
                    onClick={() => { set("investment_ready", o.v); setError(null); }}
                  />
                ))}
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-7 py-3.5 font-medium shadow-glow hover:brightness-110 transition disabled:opacity-60"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Checking…</>
                  ) : (
                    <>See My Results <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
                <button onClick={back} className="text-sm text-muted-foreground underline text-center">
                  ← Back
                </button>
                <p className="text-xs text-muted-foreground text-center">
                  By submitting, you agree to be contacted about funding options. Funding subject to credit approval.
                </p>
              </div>
            )}

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

function ResultScreen({
  icon, color, bg, title, body, cta, href, onClose, disclaimer,
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
        target="_blank"
        rel="noopener noreferrer"
        className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-7 py-3.5 font-medium shadow-glow hover:brightness-110 transition"
      >
        {cta} <ArrowRight className="h-4 w-4" />
      </a>
      <button onClick={onClose} className="mt-4 block mx-auto text-sm text-muted-foreground underline">
        Close
      </button>
      {disclaimer && (
        <p className="mt-5 text-xs text-muted-foreground max-w-sm mx-auto">{disclaimer}</p>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", required,
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
        {label}{required && <span className="text-primary"> *</span>}
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
  label, selected, onClick,
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

function NavButtons({
  onNext, onBack, showBack = true,
}: {
  onNext: () => void;
  onBack?: () => void;
  showBack?: boolean;
}) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      <button
        type="button"
        onClick={onNext}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-7 py-3.5 font-medium shadow-glow hover:brightness-110 transition"
      >
        Continue <ArrowRight className="h-4 w-4" />
      </button>
      {showBack && onBack && (
        <button type="button" onClick={onBack} className="text-sm text-muted-foreground underline text-center">
          ← Back
        </button>
      )}
    </div>
  );
}
