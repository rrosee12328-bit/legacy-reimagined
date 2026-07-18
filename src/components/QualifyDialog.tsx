import { useState } from "react";
import { z } from "zod";
import { X, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase, scoreLead, type LeadInput } from "@/lib/supabase";

const schema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(7).max(30),
  business_name: z.string().trim().min(2).max(150),
  business_type: z.string().trim().max(100).optional().or(z.literal("")),
  time_in_business: z.enum(["under_6_months", "6_to_24_months", "over_2_years"]),
  monthly_revenue: z.enum(["under_3k", "3k_to_10k", "over_10k"]),
  credit_score: z.enum(["under_650", "650_to_699", "700_plus"]),
  funding_amount: z.string().trim().min(1).max(50),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export function QualifyDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "hot" | "warm" | "cold">(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd.entries());
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please review your info.");
      return;
    }
    setSubmitting(true);
    const input = parsed.data as LeadInput;
    const score = scoreLead(input);
    const { error: dbError } = await supabase.from("leads").insert({
      ...input,
      business_type: input.business_type || null,
      notes: input.notes || null,
      score,
      source: "website",
    });
    setSubmitting(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setDone(score);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-up">
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl glass p-8 shadow-card">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 rounded-full p-2 hover:bg-accent transition"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {done ? (
          <div className="py-8 text-center">
            <div className="mx-auto rounded-full bg-primary/15 text-primary p-4 w-fit">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="mt-5 font-display text-3xl">
              You're in — we'll be in touch.
            </h3>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">
              {done === "hot" &&
                "Great news — your profile looks like a strong fit. A funding strategist will reach out within 24 hours."}
              {done === "warm" &&
                "Your profile shows real promise. Our team will review and reach out shortly with next steps."}
              {done === "cold" &&
                "Thanks for applying. We'll review your details and follow up with the best options available to you."}
            </p>
            <button
              onClick={onClose}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-7 py-3.5 font-medium hover:brightness-110 transition"
            >
              Close <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-widest text-gold">
              Pre-qualify
            </p>
            <h3 className="mt-2 font-display text-3xl">
              See if you qualify for funding.
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Takes 60 seconds. No impact to your credit score.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Full name" name="full_name" required />
                <Field label="Email" name="email" type="email" required />
                <Field label="Phone" name="phone" type="tel" required />
                <Field label="Business name" name="business_name" required />
                <Field label="Business type" name="business_type" placeholder="e.g. Real Estate" />
                <Field label="Funding amount needed" name="funding_amount" placeholder="e.g. $100,000" required />
              </div>

              <Select label="Time in business" name="time_in_business" required
                options={[
                  { v: "", l: "Select…" },
                  { v: "under_6_months", l: "Less than 6 months" },
                  { v: "6_to_24_months", l: "6 months – 2 years" },
                  { v: "over_2_years", l: "2+ years" },
                ]}
              />
              <Select label="Average monthly revenue" name="monthly_revenue" required
                options={[
                  { v: "", l: "Select…" },
                  { v: "under_3k", l: "Under $3,000" },
                  { v: "3k_to_10k", l: "$3,000 – $10,000" },
                  { v: "over_10k", l: "Over $10,000" },
                ]}
              />
              <Select label="Personal credit score" name="credit_score" required
                options={[
                  { v: "", l: "Select…" },
                  { v: "under_650", l: "Below 650" },
                  { v: "650_to_699", l: "650 – 699" },
                  { v: "700_plus", l: "700+" },
                ]}
              />

              <label className="block">
                <span className="text-sm font-medium">Anything else? (optional)</span>
                <textarea
                  name="notes"
                  rows={3}
                  className="mt-1.5 w-full rounded-xl bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-7 py-3.5 font-medium shadow-glow hover:brightness-110 transition disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                  </>
                ) : (
                  <>
                    Submit application <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
              <p className="text-xs text-muted-foreground text-center">
                By submitting, you agree to be contacted about funding options.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-primary"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </label>
  );
}

function Select({
  label,
  name,
  required,
  options,
}: {
  label: string;
  name: string;
  required?: boolean;
  options: { v: string; l: string }[];
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-primary"> *</span>}
      </span>
      <select
        name={name}
        required={required}
        defaultValue=""
        className="mt-1.5 w-full rounded-xl bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v} disabled={o.v === ""}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}
