import { createFileRoute } from "@tanstack/react-router";
import { createContext, useContext, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileQuestion,
  Layers,
  Sparkles,
  ShieldCheck,
  Zap,
  HandshakeIcon,
  TrendingUp,
  FileSignature,
  ClipboardCheck,
  BadgeCheck,
} from "lucide-react";
import { QualifyDialog } from "@/components/QualifyDialog";

const QualifyCtx = createContext<() => void>(() => {});
const useQualify = () => useContext(QualifyCtx);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scale to Legacy — Business Funding for Entrepreneurs" },
      {
        name: "description",
        content:
          "Get funded fast using the credit you already have. We help entrepreneurs access up to $300,000 in business funding — approved in as little as 24 hours.",
      },
      { property: "og:title", content: "Scale to Legacy — Business Funding for Entrepreneurs" },
      {
        property: "og:description",
        content:
          "Get funded fast using the credit you already have. We help entrepreneurs access up to $300,000 in business funding — approved in as little as 24 hours.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/images/hero.jpeg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const EBOOK_URL = "https://www.scaletolegacy.com/the-key-to-scaling";

function Home() {
  const [open, setOpen] = useState(false);
  return (
    <QualifyCtx.Provider value={() => setOpen(true)}>
      <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
        <Nav />
        <Hero />
        <Frustrations />
        <Different />
        <Process />
        <LeadMagnet />
        <Testimonials />
        <Founder />
        <FinalCta />
        <Footer />
        <QualifyDialog open={open} onClose={() => setOpen(false)} />
      </div>
    </QualifyCtx.Provider>
  );
}

function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="glass rounded-2xl px-5 py-3 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-3">
            <img src="/images/logo.png" alt="Scale to Legacy" className="h-9 w-auto" />
            <span className="hidden sm:block font-display text-lg tracking-tight">
              Scale <span className="text-gradient-gold">to Legacy</span>
            </span>
          </a>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#why" className="hover:text-foreground transition">Why Us</a>
            <a href="#process" className="hover:text-foreground transition">Process</a>
            <a href="#results" className="hover:text-foreground transition">Results</a>
            <a href="#about" className="hover:text-foreground transition">About</a>
          </nav>
          <button
            onClick={useQualify()}
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium shadow-glow hover:brightness-110 transition"
          >
            Scale Now <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative pt-40 pb-28 md:pt-52 md:pb-36">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div aria-hidden className="absolute inset-0 -z-20 bg-grid opacity-40" />

      <div className="mx-auto max-w-7xl px-6 grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs uppercase tracking-widest text-gold">
            <Sparkles className="h-3.5 w-3.5" /> Funded in as little as 24 hours
          </span>
          <h1 className="mt-6 text-5xl md:text-7xl font-medium leading-[1.02]">
            Get funded using the <span className="text-gradient-gold">credit you already have.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            We help entrepreneurs access up to{" "}
            <span className="text-foreground font-semibold">$300,000</span> in business
            funding — without the delays, denials, or hidden fees. See if you qualify today.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={useQualify()}
              className="group inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-7 py-3.5 text-base font-medium shadow-glow hover:brightness-110 transition"
            >
              Scale My Business Now
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
            </button>
            <a
              href="#process"
              className="inline-flex items-center gap-2 rounded-full glass px-7 py-3.5 text-base font-medium hover:bg-accent transition"
            >
              See how it works
            </a>
          </div>

          <div className="mt-10 flex items-center gap-8 text-sm text-muted-foreground">
            <Stat value="$300K" label="Max funding" />
            <div className="h-8 w-px bg-border" />
            <Stat value="24h" label="Approval speed" />
            <div className="h-8 w-px bg-border" />
            <Stat value="6+" label="Success stories" />
          </div>
        </div>

        <div className="lg:col-span-5 relative animate-fade-up">
          <div className="relative rounded-3xl overflow-hidden shadow-card border border-border">
            <img
              src="/images/hero.jpeg"
              alt="Entrepreneur reviewing funding options"
              className="w-full h-[520px] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 glass rounded-2xl p-4 flex items-center gap-3">
              <div className="rounded-full bg-primary text-primary-foreground p-2">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Pre-qualify with a soft credit pull</p>
                <p className="text-xs text-muted-foreground">No impact to your score</p>
              </div>
            </div>
          </div>
          <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-gradient-to-br from-gold to-gold-soft blur-2xl opacity-60 animate-float" />
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-display text-foreground">{value}</div>
      <div className="text-xs uppercase tracking-widest">{label}</div>
    </div>
  );
}

function Frustrations() {
  const items = [
    {
      icon: Clock,
      title: "Stuck in Approval Limbo",
      body: "Waiting weeks just to hear back stalls your plans, slows growth, and costs you opportunities.",
    },
    {
      icon: FileQuestion,
      title: "Denied Without Explanation",
      body: "Most lenders say no without telling you why — or how to improve your chances.",
    },
    {
      icon: Layers,
      title: "Overwhelmed by Options",
      body: "With so many offers out there, it's hard to know what's legit and what actually fits your business.",
    },
  ];
  return (
    <section className="py-24 relative">
      <div className="mx-auto max-w-7xl px-6 grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-5 order-2 lg:order-1">
          <img
            src="/images/frustrated.jpeg"
            alt="Frustrated business owner"
            className="rounded-3xl w-full h-[460px] object-cover shadow-card"
          />
        </div>
        <div className="lg:col-span-7 order-1 lg:order-2">
          <p className="text-sm uppercase tracking-widest text-gold">The Problem</p>
          <h2 className="mt-3 text-4xl md:text-5xl font-medium">
            Are you frustrated because you're…
          </h2>
          <div className="mt-10 grid gap-4">
            {items.map((it) => (
              <div
                key={it.title}
                className="glass rounded-2xl p-5 flex gap-4 hover:border-gold/40 transition"
              >
                <div className="rounded-xl bg-primary/10 text-primary p-3 h-fit">
                  <it.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-xl">{it.title}</h3>
                  <p className="text-muted-foreground mt-1">{it.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Different() {
  const items = [
    { icon: Zap, title: "Fast, Streamlined Process", body: "We cut through the confusion and connect you with the right funding — quickly." },
    { icon: ShieldCheck, title: "No Hidden Fees or Confusing Terms", body: "Simple, transparent, and easy to understand. No surprises — just solutions." },
    { icon: HandshakeIcon, title: "Personalized Funding Matches", body: "Options tailored to your unique business, not one-size-fits-all." },
    { icon: Sparkles, title: "Support From Real People", body: "Our team walks with you through the process — you're never just a number." },
    { icon: TrendingUp, title: "Built for Growth-Minded Entrepreneurs", body: "We don't just fund businesses — we help fuel long-term legacy-building." },
  ];
  return (
    <section id="why" className="py-24 relative">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-96 -z-10"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, color-mix(in oklab, var(--gold) 15%, transparent), transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-3xl">
          <p className="text-sm uppercase tracking-widest text-gold">The Difference</p>
          <h2 className="mt-3 text-4xl md:text-5xl font-medium">
            Forget what you've heard — <span className="text-gradient-gold">this is different.</span>
          </h2>
        </div>

        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((it, i) => (
            <div
              key={it.title}
              className={`glass rounded-3xl p-7 hover:-translate-y-1 transition duration-300 ${
                i === 0 ? "lg:col-span-2 bg-gradient-to-br from-primary/10 to-transparent" : ""
              }`}
            >
              <div className="rounded-2xl bg-primary/15 text-primary p-3 w-fit">
                <it.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-2xl">{it.title}</h3>
              <p className="mt-2 text-muted-foreground">{it.body}</p>
            </div>
          ))}
          <div className="rounded-3xl overflow-hidden relative min-h-[240px]">
            <img
              src="/images/different.jpeg"
              alt="Team collaboration"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5">
              <p className="font-display text-xl">Real partners. Real results.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Process() {
  const steps = [
    { icon: ClipboardCheck, title: "Fill Out the Quick Form", body: "Answer a few questions to see if you pre-qualify — no impact to your credit." },
    { icon: ShieldCheck, title: "We Check Your Credit", body: "A soft pull helps us match you with the best funding options available." },
    { icon: FileSignature, title: "We Send You a Contract", body: "If qualified, receive a clear, transparent agreement to review." },
    { icon: BadgeCheck, title: "You Get Approved — Fast", body: "Final approval happens as quickly as possible. Get answers fast." },
  ];
  return (
    <section id="process" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm uppercase tracking-widest text-gold">The Process</p>
          <h2 className="mt-3 text-4xl md:text-5xl font-medium">Four steps to funded.</h2>
          <p className="mt-4 text-muted-foreground">
            Built for speed and clarity. Most clients move from form to funded in days, not months.
          </p>
        </div>

        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-4 gap-5 relative">
          {steps.map((s, i) => (
            <div key={s.title} className="glass rounded-3xl p-6 relative">
              <div className="text-6xl font-display text-gradient-gold opacity-40 leading-none">
                0{i + 1}
              </div>
              <s.icon className="h-6 w-6 text-primary mt-3" />
              <h3 className="mt-4 font-display text-xl">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LeadMagnet() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative rounded-[2.5rem] overflow-hidden glass p-8 md:p-16 grid lg:grid-cols-2 gap-12 items-center">
          <div
            aria-hidden
            className="absolute -top-24 -right-24 h-96 w-96 rounded-full blur-3xl opacity-30"
            style={{ background: "var(--gradient-gold)" }}
          />
          <div className="relative">
            <p className="text-sm uppercase tracking-widest text-gold">Free Guide</p>
            <h2 className="mt-3 text-4xl md:text-5xl font-medium">
              Transform your business today.
            </h2>
            <p className="mt-5 text-muted-foreground text-lg">
              Don't let financing hurdles hold you back. Whether you're just starting out or
              looking to expand, our expertly crafted guide walks you through the critical
              steps to obtaining the capital you need.
            </p>
            <a
              href={EBOOK_URL}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-7 py-3.5 font-medium shadow-glow hover:brightness-110 transition"
            >
              Get your free e-book <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="relative">
            <img
              src="/images/leadmagnet.png"
              alt="The Key to Scaling — free e-book"
              className="w-full max-w-md mx-auto drop-shadow-2xl animate-float"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const items = [
    { amount: "$130K", speed: "in 24 hours", extra: "+ $130K more in 4 days", who: "Construction Company CEO" },
    { amount: "$150K", speed: "in 4 days", who: "Author & Coach" },
    { amount: "$100K", speed: "in 3 days", who: "Real Estate CEO" },
    { amount: "$100K", speed: "in 7 days", who: "Vending Machine CEO" },
    { amount: "$100K", speed: "in 3 days", who: "Health & Fitness CEO" },
    { amount: "$70K", speed: "in 5 days", who: "Compliance Consulting CEO" },
  ];
  return (
    <section id="results" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm uppercase tracking-widest text-gold">Results</p>
          <h2 className="mt-3 text-4xl md:text-5xl font-medium">
            Real founders. <span className="text-gradient-gold">Real capital.</span>
          </h2>
        </div>
        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((t) => (
            <div
              key={t.who}
              className="glass rounded-3xl p-7 hover:border-gold/40 transition group"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-display text-5xl text-gradient-gold">{t.amount}</span>
                <span className="text-muted-foreground text-sm">{t.speed}</span>
              </div>
              {t.extra && (
                <p className="mt-2 text-sm text-gold-soft">{t.extra}</p>
              )}
              <div className="mt-6 flex items-center gap-2 pt-6 border-t border-border">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <p className="text-sm text-muted-foreground italic">{t.who}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-xs text-muted-foreground max-w-2xl">
          Results vary based on individual credit profile and lender timelines.
        </p>
      </div>
    </section>
  );
}

function Founder() {
  return (
    <section id="about" className="py-24">
      <div className="mx-auto max-w-7xl px-6 grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-5">
          <div className="relative rounded-3xl overflow-hidden">
            <img
              src="/images/founder.png"
              alt="Scale to Legacy founder"
              className="w-full h-[520px] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
          </div>
        </div>
        <div className="lg:col-span-7">
          <p className="text-sm uppercase tracking-widest text-gold">About</p>
          <h2 className="mt-3 text-4xl md:text-5xl font-medium">
            Your trusted partners for <span className="text-gradient-gold">growth.</span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            At Scale to Legacy, we understand that securing the right funding isn't just about
            growing your business — it's about bringing your entrepreneurial vision to life.
            We bring the expertise needed to grow your business with ease.
          </p>
          <p className="mt-4 text-lg text-muted-foreground">
            Our business funding strategist is a certified financial advisor, Dave Ramsey
            Certified Coach, and a seasoned business funding expert. We strive to serve as
            a trusted partner in every client's journey — expanding your business while
            building a lasting legacy.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Chip>Certified Financial Advisor</Chip>
            <Chip>Dave Ramsey Certified Coach</Chip>
            <Chip>Funding Expert</Chip>
          </div>
        </div>
      </div>
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full glass px-4 py-2 text-sm text-muted-foreground">
      {children}
    </span>
  );
}

function FinalCta() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative rounded-[2.5rem] overflow-hidden">
          <img
            src="/images/cta.jpeg"
            alt="Ready to scale"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
          <div className="relative p-10 md:p-20 max-w-2xl">
            <h2 className="text-4xl md:text-6xl font-medium leading-[1.05]">
              Ready to scale your <span className="text-gradient-gold italic">business?</span>
            </h2>
            <p className="mt-6 text-lg text-muted-foreground">
              Get started today and possibly transform your business within as little as a week.
            </p>
            <button
              onClick={useQualify()}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-8 py-4 font-medium shadow-glow hover:brightness-110 transition"
            >
              Scale Your Business <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <img src="/images/logo.png" alt="Scale to Legacy" className="h-8 w-auto" />
          <span className="font-display text-lg">
            Scale <span className="text-gradient-gold">to Legacy</span>
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Scale to Legacy. All rights reserved.
        </p>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <a href="#why" className="hover:text-foreground">Why Us</a>
          <a href="#process" className="hover:text-foreground">Process</a>
          <button onClick={useQualify()} className="hover:text-foreground">Apply</button>
        </div>
      </div>
    </footer>
  );
}
