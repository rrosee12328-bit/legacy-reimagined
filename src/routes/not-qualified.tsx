import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

const EBOOK_URL = "https://www.scaletolegacy.com/the-key-to-scaling";

export const Route = createFileRoute("/not-qualified")({
  head: () => ({
    meta: [
      { title: "Funding Readiness — Scale To Legacy" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: NotQualifiedPage,
});

function NotQualifiedPage() {
  return (
    <main className="min-h-screen bg-background grid place-items-center px-6 py-20 text-center">
      <section className="w-full max-w-xl rounded-3xl glass p-10 shadow-card">
        <div className="mx-auto w-fit rounded-full bg-muted/30 p-4 text-muted-foreground">
          <BookOpen className="h-8 w-8" />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-gold">
          Funding Readiness
        </p>
        <h1 className="mt-2 font-display text-3xl">
          We cannot confirm the initial funding benchmarks yet.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Scale to Legacy funding sessions are reserved for applicants who report a personal
          credit score of 680 or higher and credit utilization below 30%. Strengthen your credit
          profile and reapply when you meet both benchmarks.
        </p>
        <a
          href={EBOOK_URL}
          className="mt-8 inline-flex rounded-full bg-primary px-7 py-3.5 font-medium text-primary-foreground"
        >
          Get the Free Funding Readiness Guide
        </a>
        <Link to="/" className="mt-5 block text-sm text-muted-foreground underline">
          Return to Scale to Legacy
        </Link>
      </section>
    </main>
  );
}
