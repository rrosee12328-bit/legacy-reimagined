import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  LogOut, RefreshCw, Search, ChevronDown, ChevronUp,
  Phone, Mail, Building2, Calendar, StickyNote, X, Check,
  Flame, TrendingUp, Snowflake, Users, DollarSign, Clock,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin CRM — Scale to Legacy" }] }),
  component: AdminPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface Lead {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string;
  business_name: string;
  credit_score: string;
  utilization?: string;
  llc_status?: string;
  investment_ready?: string;
  funding_amount?: string;
  score: "hot" | "warm" | "cold";
  status: string;
  notes?: string;
  source?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ADMIN_PASS = "102026";

const STATUS_OPTIONS = [
  "New",
  "Contacted",
  "Call Scheduled",
  "In Progress",
  "Contract Sent",
  "Funded",
  "Not Qualified",
  "Closed Lost",
];

const SCORE_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  hot:  { label: "Hot",  color: "text-red-500 bg-red-50 border-red-200",    icon: <Flame className="h-3.5 w-3.5" /> },
  warm: { label: "Warm", color: "text-amber-500 bg-amber-50 border-amber-200", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  cold: { label: "Cold", color: "text-blue-500 bg-blue-50 border-blue-200",  icon: <Snowflake className="h-3.5 w-3.5" /> },
};

const CREDIT_LABELS: Record<string, string> = {
  below_600: "< 600",
  "600_649": "600–649",
  "650_679": "650–679",
  "680_699": "680–699",
  "700_749": "700–749",
  "750_plus": "750+",
  under_650: "< 650",
  "650_to_699": "650–699",
  "700_plus": "700+",
};

// ─── Main page ────────────────────────────────────────────────────────────────
function AdminPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("stl_admin") === "1");

  if (!authed) return <LoginScreen onAuth={() => { sessionStorage.setItem("stl_admin", "1"); setAuthed(true); }} />;
  return <CRMDashboard onLogout={() => { sessionStorage.removeItem("stl_admin"); setAuthed(false); }} />;
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({ onAuth }: { onAuth: () => void }) {
  const [pass, setPass] = useState("");
  const [err, setErr]   = useState(false);

  function attempt(e: React.FormEvent) {
    e.preventDefault();
    if (pass === ADMIN_PASS) { onAuth(); }
    else { setErr(true); setPass(""); }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm glass rounded-3xl p-10 shadow-card text-center">
        <img src="/images/logo.png" alt="Scale to Legacy" className="h-12 mx-auto mb-6" />
        <h1 className="font-display text-2xl mb-1">Admin Access</h1>
        <p className="text-sm text-muted-foreground mb-8">Scale to Legacy CRM</p>
        <form onSubmit={attempt} className="grid gap-4">
          <input
            type="password"
            placeholder="Enter password"
            value={pass}
            onChange={(e) => { setPass(e.target.value); setErr(false); }}
            className="w-full rounded-xl bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {err && <p className="text-sm text-red-500">Incorrect password.</p>}
          <button
            type="submit"
            className="rounded-full bg-primary text-primary-foreground px-6 py-3 font-medium shadow-glow hover:brightness-110 transition"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── CRM Dashboard ────────────────────────────────────────────────────────────
function CRMDashboard({ onLogout }: { onLogout: () => void }) {
  const [leads, setLeads]         = useState<Lead[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [filterScore, setFilter]  = useState("all");
  const [filterStatus, setFStatus]= useState("all");
  const [sortField, setSortField] = useState<keyof Lead>("created_at");
  const [sortAsc, setSortAsc]     = useState(false);
  const [editNote, setEditNote]   = useState<{ id: string; text: string } | null>(null);
  const [expanded, setExpanded]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    setLeads((data as Lead[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, status: string) {
    await supabase.from("leads").update({ status }).eq("id", id);
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status } : l));
  }

  async function saveNote(id: string, notes: string) {
    await supabase.from("leads").update({ notes }).eq("id", id);
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, notes } : l));
    setEditNote(null);
  }

  // Stats
  const hot  = leads.filter((l) => l.score === "hot").length;
  const warm = leads.filter((l) => l.score === "warm").length;
  const cold = leads.filter((l) => l.score === "cold").length;
  const funded = leads.filter((l) => l.status === "Funded").length;

  // Filter + sort
  const visible = leads
    .filter((l) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        l.full_name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.phone?.includes(q) ||
        l.business_name?.toLowerCase().includes(q);
      const matchScore  = filterScore  === "all" || l.score  === filterScore;
      const matchStatus = filterStatus === "all" || l.status === filterStatus;
      return matchSearch && matchScore && matchStatus;
    })
    .sort((a, b) => {
      const av = (a[sortField] ?? "") as string;
      const bv = (b[sortField] ?? "") as string;
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  function toggleSort(field: keyof Lead) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  }

  function SortIcon({ field }: { field: keyof Lead }) {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/logo.png" alt="Scale to Legacy" className="h-8" />
            <span className="font-display text-lg">CRM <span className="text-gradient-gold">Dashboard</span></span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={load} className="rounded-full p-2 hover:bg-accent transition" title="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm hover:bg-accent transition">
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard icon={<Users className="h-5 w-5" />} label="Total Leads" value={leads.length} color="text-foreground" />
          <StatCard icon={<Flame className="h-5 w-5" />} label="Hot Leads" value={hot} color="text-red-500" />
          <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Warm Leads" value={warm} color="text-amber-500" />
          <StatCard icon={<DollarSign className="h-5 w-5" />} label="Funded" value={funded} color="text-primary" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl bg-background border border-border pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <FilterSelect value={filterScore} onChange={setFilter} options={[
            { v: "all", l: "All Scores" },
            { v: "hot",  l: "🔥 Hot" },
            { v: "warm", l: "📈 Warm" },
            { v: "cold", l: "❄️ Cold" },
          ]} />
          <FilterSelect value={filterStatus} onChange={setFStatus} options={[
            { v: "all", l: "All Statuses" },
            ...STATUS_OPTIONS.map((s) => ({ v: s, l: s })),
          ]} />
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <Th onClick={() => toggleSort("created_at")}>Date <SortIcon field="created_at" /></Th>
                  <Th onClick={() => toggleSort("full_name")}>Name <SortIcon field="full_name" /></Th>
                  <Th>Contact</Th>
                  <Th onClick={() => toggleSort("credit_score")}>Credit <SortIcon field="credit_score" /></Th>
                  <Th onClick={() => toggleSort("score")}>Score <SortIcon field="score" /></Th>
                  <Th onClick={() => toggleSort("status")}>Status <SortIcon field="status" /></Th>
                  <Th>Notes</Th>
                  <Th>Details</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">Loading leads…</td></tr>
                )}
                {!loading && visible.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">No leads found.</td></tr>
                )}
                {visible.map((lead) => (
                  <>
                    <tr key={lead.id} className="bg-background hover:bg-muted/20 transition">
                      <Td>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          <span>{new Date(lead.created_at).toLocaleDateString()}</span>
                        </div>
                      </Td>
                      <Td>
                        <div className="font-medium">{lead.full_name}</div>
                        {lead.business_name && lead.business_name !== "—" && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Building2 className="h-3 w-3" /> {lead.business_name}
                          </div>
                        )}
                      </Td>
                      <Td>
                        <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-primary hover:underline text-xs">
                          <Mail className="h-3.5 w-3.5" /> {lead.email}
                        </a>
                        <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-xs mt-0.5">
                          <Phone className="h-3.5 w-3.5" /> {lead.phone}
                        </a>
                      </Td>
                      <Td>
                        <span className="text-xs font-medium">
                          {CREDIT_LABELS[lead.credit_score] ?? lead.credit_score}
                        </span>
                        {lead.utilization && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Util: {lead.utilization.replace("_", "–").replace("plus", "+")}
                          </div>
                        )}
                      </Td>
                      <Td>
                        {lead.score && SCORE_LABELS[lead.score] && (
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${SCORE_LABELS[lead.score].color}`}>
                            {SCORE_LABELS[lead.score].icon}
                            {SCORE_LABELS[lead.score].label}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <select
                          value={lead.status ?? "New"}
                          onChange={(e) => updateStatus(lead.id, e.target.value)}
                          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </Td>
                      <Td>
                        {editNote?.id === lead.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              value={editNote.text}
                              onChange={(e) => setEditNote({ id: lead.id, text: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") saveNote(lead.id, editNote.text); if (e.key === "Escape") setEditNote(null); }}
                              className="rounded-lg border border-border bg-background px-2 py-1 text-xs w-36 focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                            <button onClick={() => saveNote(lead.id, editNote.text)} className="text-primary hover:text-primary/80"><Check className="h-4 w-4" /></button>
                            <button onClick={() => setEditNote(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditNote({ id: lead.id, text: lead.notes ?? "" })}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                          >
                            <StickyNote className="h-3.5 w-3.5" />
                            <span className="max-w-[120px] truncate">{lead.notes || "Add note…"}</span>
                          </button>
                        )}
                      </Td>
                      <Td>
                        <button
                          onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}
                          className="text-xs text-primary hover:underline"
                        >
                          {expanded === lead.id ? "Hide" : "View"}
                        </button>
                      </Td>
                    </tr>
                    {expanded === lead.id && (
                      <tr key={`${lead.id}-detail`} className="bg-muted/10">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <Detail label="LLC Status" value={lead.llc_status?.replace("_", " ") ?? "—"} />
                            <Detail label="Investment Ready" value={lead.investment_ready?.replace("_", " ") ?? "—"} />
                            <Detail label="Funding Amount" value={lead.funding_amount ?? "—"} />
                            <Detail label="Source" value={lead.source ?? "—"} />
                            <Detail label="Submitted" value={new Date(lead.created_at).toLocaleString()} />
                            <Detail label="Full Notes" value={lead.notes || "None"} />
                          </div>
                          <div className="mt-4 flex gap-3">
                            <a
                              href={`https://calendly.com/vektiss-info/30-minute-vektiss-discovery`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs font-medium hover:brightness-110 transition"
                            >
                              <Calendar className="h-3.5 w-3.5" /> Schedule Call
                            </a>
                            <a
                              href={`mailto:${lead.email}?subject=Scale to Legacy — Your Funding Application&body=Hi ${lead.full_name},%0A%0AThank you for applying with Scale to Legacy.`}
                              className="inline-flex items-center gap-1.5 rounded-full glass px-4 py-2 text-xs font-medium hover:bg-accent transition"
                            >
                              <Mail className="h-3.5 w-3.5" /> Email Lead
                            </a>
                            <a
                              href={`tel:${lead.phone}`}
                              className="inline-flex items-center gap-1.5 rounded-full glass px-4 py-2 text-xs font-medium hover:bg-accent transition"
                            >
                              <Phone className="h-3.5 w-3.5" /> Call Lead
                            </a>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Showing {visible.length} of {leads.length} leads
        </p>
      </main>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className={`${color} mb-3`}>{icon}</div>
      <div className="text-3xl font-display">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

function Th({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <th
      onClick={onClick}
      className={`px-4 py-3 text-left whitespace-nowrap ${onClick ? "cursor-pointer hover:text-foreground select-none" : ""}`}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-medium capitalize">{value}</div>
    </div>
  );
}
