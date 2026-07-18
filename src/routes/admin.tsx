import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  LogOut, RefreshCw, Search, ChevronDown, ChevronUp,
  Phone, Mail, Building2, Calendar, StickyNote, X, Check,
  Flame, TrendingUp, Snowflake, Users, DollarSign, Clock,
  Target, Award, AlertCircle, ChevronRight, LayoutDashboard,
  List, BarChart2, Bell, Edit3, Save,
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
  funding_amount_secured?: number;
  funded_at?: string;
  follow_up_date?: string;
  last_contacted_at?: string;
  assigned_to?: string;
  score: "hot" | "warm" | "cold";
  status: string;
  pipeline_stage?: string;
  notes?: string;
  source?: string;
}

type View = "dashboard" | "leads" | "analytics";

// ─── Constants ────────────────────────────────────────────────────────────────
const ADMIN_PASS = "102026";

const STATUS_OPTIONS = [
  "New", "Contacted", "Call Scheduled", "In Progress",
  "Contract Sent", "Funded", "Not Qualified", "Closed Lost",
];

const PIPELINE_STAGES = [
  "New Lead", "Qualified", "Call Scheduled", "Strategy Session",
  "Contract Sent", "Funded", "Closed",
];

const SCORE_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  hot:  { label: "Hot",  color: "#ef4444", bg: "bg-red-50 border-red-200 text-red-600",    icon: <Flame className="h-3.5 w-3.5" /> },
  warm: { label: "Warm", color: "#f59e0b", bg: "bg-amber-50 border-amber-200 text-amber-600", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  cold: { label: "Cold", color: "#3b82f6", bg: "bg-blue-50 border-blue-200 text-blue-600",  icon: <Snowflake className="h-3.5 w-3.5" /> },
};

const CREDIT_LABELS: Record<string, string> = {
  below_600: "< 600", "600_649": "600–649", "650_679": "650–679",
  "680_699": "680–699", "700_749": "700–749", "750_plus": "750+",
  under_650: "< 650", "650_to_699": "650–699", "700_plus": "700+",
};

const CHART_COLORS = ["#c9a227", "#1a1a2e", "#ef4444", "#f59e0b", "#3b82f6", "#10b981"];

function fmt$(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date} · ${time}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
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
    if (pass === ADMIN_PASS) onAuth();
    else { setErr(true); setPass(""); }
  }
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm glass rounded-3xl p-10 shadow-card text-center">
        <img src="/images/logo.png" alt="Scale to Legacy" className="h-12 mx-auto mb-6" />
        <h1 className="font-display text-2xl mb-1">Admin Access</h1>
        <p className="text-sm text-muted-foreground mb-8">Scale to Legacy CRM</p>
        <form onSubmit={attempt} className="grid gap-4">
          <input type="password" placeholder="Enter password" value={pass}
            onChange={(e) => { setPass(e.target.value); setErr(false); }}
            className="w-full rounded-xl bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          {err && <p className="text-sm text-red-500">Incorrect password.</p>}
          <button type="submit" className="rounded-full bg-primary text-primary-foreground px-6 py-3 font-medium shadow-glow hover:brightness-110 transition">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── CRM Dashboard ────────────────────────────────────────────────────────────
function CRMDashboard({ onLogout }: { onLogout: () => void }) {
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<View>("dashboard");
  const [search, setSearch]     = useState("");
  const [filterScore, setFS]    = useState("all");
  const [filterStatus, setFSt]  = useState("all");
  const [sortField, setSF]      = useState<keyof Lead>("created_at");
  const [sortAsc, setSA]        = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    setLeads((data as Lead[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveLead(updated: Lead) {
    const { error } = await supabase.from("leads").update({
      status: updated.status,
      pipeline_stage: updated.pipeline_stage,
      notes: updated.notes,
      funding_amount_secured: updated.funding_amount_secured,
      funded_at: updated.funded_at || null,
      follow_up_date: updated.follow_up_date || null,
      last_contacted_at: updated.last_contacted_at || null,
      assigned_to: updated.assigned_to,
    }).eq("id", updated.id);
    if (!error) {
      setLeads((prev) => prev.map((l) => l.id === updated.id ? updated : l));
      setEditLead(null);
    }
  }

  // ── Analytics ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const funded = leads.filter((l) => l.status === "Funded");
    const totalFunded = funded.reduce((s, l) => s + (l.funding_amount_secured ?? 0), 0);
    const hot = leads.filter((l) => l.score === "hot").length;
    const warm = leads.filter((l) => l.score === "warm").length;
    const followUps = leads.filter((l) => l.follow_up_date && new Date(l.follow_up_date) <= new Date()).length;
    const convRate = leads.length ? Math.round((funded.length / leads.length) * 100) : 0;
    return { total: leads.length, hot, warm, funded: funded.length, totalFunded, followUps, convRate };
  }, [leads]);

  // Monthly funded chart data
  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; count: number; amount: number }> = {};
    leads.filter((l) => l.status === "Funded" && l.funded_at).forEach((l) => {
      const d = new Date(l.funded_at!);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      if (!map[key]) map[key] = { month: label, count: 0, amount: 0 };
      map[key].count++;
      map[key].amount += l.funding_amount_secured ?? 0;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [leads]);

  // Monthly leads chart
  const monthlyLeads = useMemo(() => {
    const map: Record<string, { month: string; hot: number; warm: number; cold: number }> = {};
    leads.forEach((l) => {
      const d = new Date(l.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      if (!map[key]) map[key] = { month: label, hot: 0, warm: 0, cold: 0 };
      if (l.score === "hot") map[key].hot++;
      else if (l.score === "warm") map[key].warm++;
      else map[key].cold++;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [leads]);

  // Score distribution
  const scoreDist = useMemo(() => [
    { name: "Hot",  value: leads.filter((l) => l.score === "hot").length,  color: "#ef4444" },
    { name: "Warm", value: leads.filter((l) => l.score === "warm").length, color: "#f59e0b" },
    { name: "Cold", value: leads.filter((l) => l.score === "cold").length, color: "#3b82f6" },
  ], [leads]);

  // Pipeline funnel
  const pipelineData = useMemo(() =>
    PIPELINE_STAGES.map((stage) => ({
      stage,
      count: leads.filter((l) => (l.pipeline_stage ?? "New Lead") === stage).length,
    })), [leads]);

  // Filtered leads
  const visible = useMemo(() => leads
    .filter((l) => {
      const q = search.toLowerCase();
      const ms = !q || [l.full_name, l.email, l.phone, l.business_name].some((v) => v?.toLowerCase().includes(q));
      const msc = filterScore === "all" || l.score === filterScore;
      const mst = filterStatus === "all" || l.status === filterStatus;
      return ms && msc && mst;
    })
    .sort((a, b) => {
      const av = String(a[sortField] ?? "");
      const bv = String(b[sortField] ?? "");
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    }), [leads, search, filterScore, filterStatus, sortField, sortAsc]);

  function toggleSort(f: keyof Lead) { if (sortField === f) setSA(!sortAsc); else { setSF(f); setSA(false); } }

  // Follow-up alerts
  const dueFollowUps = leads.filter((l) => l.follow_up_date && new Date(l.follow_up_date) <= new Date() && l.status !== "Funded" && l.status !== "Closed Lost");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/images/logo.png" alt="" className="h-8" />
            <span className="font-display text-lg hidden sm:block">Scale <span className="text-gradient-gold">to Legacy</span> CRM</span>
          </div>
          <nav className="flex items-center gap-1">
            {(["dashboard", "leads", "analytics"] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition capitalize ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
                {v === "dashboard" && <LayoutDashboard className="h-4 w-4" />}
                {v === "leads" && <List className="h-4 w-4" />}
                {v === "analytics" && <BarChart2 className="h-4 w-4" />}
                {v}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {stats.followUps > 0 && (
              <div className="relative">
                <Bell className="h-5 w-5 text-amber-500" />
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{stats.followUps}</span>
              </div>
            )}
            <button onClick={load} className="rounded-full p-2 hover:bg-accent transition">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={onLogout} className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-2 text-sm hover:bg-accent transition">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl w-full px-6 py-8 flex-1">

        {/* ── DASHBOARD VIEW ─────────────────────────────────────────────── */}
        {view === "dashboard" && (
          <div className="grid gap-6">
            {/* Follow-up alerts */}
            {dueFollowUps.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">{dueFollowUps.length} follow-up{dueFollowUps.length > 1 ? "s" : ""} due today</p>
                  <p className="text-xs text-amber-600 mt-0.5">{dueFollowUps.map((l) => l.full_name).join(", ")}</p>
                </div>
              </div>
            )}

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard icon={<Users className="h-5 w-5" />} label="Total Leads" value={stats.total} color="text-foreground" />
              <KpiCard icon={<Flame className="h-5 w-5" />} label="Hot Leads" value={stats.hot} color="text-red-500" />
              <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Clients Funded" value={stats.funded} color="text-primary" />
              <KpiCard icon={<Award className="h-5 w-5" />} label="Total Funded" value={fmt$(stats.totalFunded)} color="text-primary" isString />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <KpiCard icon={<Target className="h-5 w-5" />} label="Conversion Rate" value={`${stats.convRate}%`} color="text-green-500" isString />
              <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Warm Leads" value={stats.warm} color="text-amber-500" />
              <KpiCard icon={<Bell className="h-5 w-5" />} label="Follow-ups Due" value={stats.followUps} color="text-amber-500" />
            </div>

            {/* Charts row */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Monthly funded amount */}
              <div className="glass rounded-2xl p-6">
                <h3 className="font-display text-lg mb-4">Monthly Funding Secured</h3>
                {monthlyData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No funded clients yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => fmt$(v)} />
                      <Bar dataKey="amount" fill="#c9a227" radius={[6, 6, 0, 0]} name="Amount Secured" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Monthly leads by score */}
              <div className="glass rounded-2xl p-6">
                <h3 className="font-display text-lg mb-4">Monthly Lead Volume</h3>
                {monthlyLeads.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No leads yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={monthlyLeads}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="hot"  fill="#ef4444" radius={[4, 4, 0, 0]} name="Hot" stackId="a" />
                      <Bar dataKey="warm" fill="#f59e0b" radius={[0, 0, 0, 0]} name="Warm" stackId="a" />
                      <Bar dataKey="cold" fill="#3b82f6" radius={[0, 0, 4, 4]} name="Cold" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Pipeline + Score dist */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="glass rounded-2xl p-6">
                <h3 className="font-display text-lg mb-4">Pipeline Funnel</h3>
                <div className="grid gap-2">
                  {pipelineData.map((p, i) => (
                    <div key={p.stage} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-32 shrink-0">{p.stage}</span>
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${leads.length ? (p.count / leads.length) * 100 : 0}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                      <span className="text-sm font-medium w-6 text-right">{p.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass rounded-2xl p-6">
                <h3 className="font-display text-lg mb-4">Lead Score Distribution</h3>
                {leads.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No leads yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={scoreDist} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                        {scoreDist.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Recent hot leads */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg">Recent Hot Leads</h3>
                <button onClick={() => setView("leads")} className="text-xs text-primary hover:underline flex items-center gap-1">
                  View all <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              <div className="grid gap-3">
                {leads.filter((l) => l.score === "hot").slice(0, 5).map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-xl border border-border p-3 hover:bg-muted/20 transition">
                    <div>
                      <p className="font-medium text-sm">{l.full_name}</p>
                      <p className="text-xs text-muted-foreground">{l.email} · {l.phone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{fmtDateTime(l.created_at)}</span>
                      <StatusBadge status={l.status} />
                    </div>
                  </div>
                ))}
                {leads.filter((l) => l.score === "hot").length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No hot leads yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── LEADS VIEW ─────────────────────────────────────────────────── */}
        {view === "leads" && (
          <div className="grid gap-5">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Search name, email, phone…" value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl bg-background border border-border pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <FSelect value={filterScore} onChange={setFS} options={[
                { v: "all", l: "All Scores" }, { v: "hot", l: "🔥 Hot" }, { v: "warm", l: "📈 Warm" }, { v: "cold", l: "❄️ Cold" },
              ]} />
              <FSelect value={filterStatus} onChange={setFSt} options={[
                { v: "all", l: "All Statuses" }, ...STATUS_OPTIONS.map((s) => ({ v: s, l: s })),
              ]} />
            </div>

            <p className="text-xs text-muted-foreground">Showing {visible.length} of {leads.length} leads</p>

            {/* Lead cards */}
            <div className="grid gap-3">
              {loading && <p className="text-center text-muted-foreground py-12">Loading leads…</p>}
              {!loading && visible.length === 0 && <p className="text-center text-muted-foreground py-12">No leads found.</p>}
              {visible.map((lead) => (
                <div key={lead.id} className="glass rounded-2xl overflow-hidden">
                  {/* Lead row */}
                  <div className="p-4 flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{lead.full_name}</p>
                        {lead.score && SCORE_META[lead.score] && (
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${SCORE_META[lead.score].bg}`}>
                            {SCORE_META[lead.score].icon} {SCORE_META[lead.score].label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <a href={`mailto:${lead.email}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {lead.email}
                        </a>
                        <a href={`tel:${lead.phone}`} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {lead.phone}
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {fmtDateTime(lead.created_at)}
                      </span>
                      <span className="text-xs font-medium bg-muted rounded-lg px-2 py-1">
                        Credit: {CREDIT_LABELS[lead.credit_score] ?? lead.credit_score}
                      </span>
                      {lead.status === "Funded" && lead.funding_amount_secured && (
                        <span className="text-xs font-semibold text-primary bg-primary/10 rounded-lg px-2 py-1">
                          {fmt$(lead.funding_amount_secured)} funded
                        </span>
                      )}
                      <StatusBadge status={lead.status} />
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditLead(lead)} className="rounded-full p-2 hover:bg-accent transition" title="Edit">
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}
                        className="rounded-full p-2 hover:bg-accent transition">
                        {expanded === lead.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expanded === lead.id && (
                    <div className="border-t border-border bg-muted/10 px-5 py-4">
                      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                        <Detail label="LLC Status" value={lead.llc_status?.replace(/_/g, " ") ?? "—"} />
                        <Detail label="Investment Ready" value={lead.investment_ready?.replace(/_/g, " ") ?? "—"} />
                        <Detail label="Utilization" value={lead.utilization?.replace(/_/g, "–").replace("plus", "+") ?? "—"} />
                        <Detail label="Source" value={lead.source ?? "—"} />
                        <Detail label="Pipeline Stage" value={lead.pipeline_stage ?? "New Lead"} />
                        <Detail label="Assigned To" value={lead.assigned_to ?? "Lonnie"} />
                        <Detail label="Follow-up Date" value={lead.follow_up_date ? fmtDate(lead.follow_up_date) : "—"} />
                        <Detail label="Last Contacted" value={lead.last_contacted_at ? fmtDateTime(lead.last_contacted_at) : "—"} />
                        {lead.status === "Funded" && (
                          <>
                            <Detail label="Amount Secured" value={lead.funding_amount_secured ? fmt$(lead.funding_amount_secured) : "—"} />
                            <Detail label="Funded Date" value={lead.funded_at ? fmtDate(lead.funded_at) : "—"} />
                          </>
                        )}
                      </div>
                      {lead.notes && (
                        <div className="mb-4 rounded-xl bg-background border border-border p-3">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                          <p className="text-sm">{lead.notes}</p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <a href={`https://calendly.com/vektiss-info/30-minute-vektiss-discovery`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs font-medium hover:brightness-110 transition">
                          <Calendar className="h-3.5 w-3.5" /> Schedule Call
                        </a>
                        <a href={`mailto:${lead.email}?subject=Scale to Legacy — Your Funding Application&body=Hi ${lead.full_name},%0A%0AThank you for applying with Scale to Legacy.`}
                          className="inline-flex items-center gap-1.5 rounded-full glass px-4 py-2 text-xs font-medium hover:bg-accent transition">
                          <Mail className="h-3.5 w-3.5" /> Email
                        </a>
                        <a href={`tel:${lead.phone}`}
                          className="inline-flex items-center gap-1.5 rounded-full glass px-4 py-2 text-xs font-medium hover:bg-accent transition">
                          <Phone className="h-3.5 w-3.5" /> Call
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ANALYTICS VIEW ─────────────────────────────────────────────── */}
        {view === "analytics" && (
          <div className="grid gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Total Funded" value={fmt$(stats.totalFunded)} color="text-primary" isString />
              <KpiCard icon={<Target className="h-5 w-5" />} label="Conversion Rate" value={`${stats.convRate}%`} color="text-green-500" isString />
              <KpiCard icon={<Award className="h-5 w-5" />} label="Avg. Funded" value={stats.funded ? fmt$(stats.totalFunded / stats.funded) : "$0"} color="text-primary" isString />
              <KpiCard icon={<Users className="h-5 w-5" />} label="Total Leads" value={stats.total} color="text-foreground" />
            </div>

            {/* Monthly funding trend */}
            <div className="glass rounded-2xl p-6">
              <h3 className="font-display text-xl mb-2">Monthly Funding Revenue</h3>
              <p className="text-sm text-muted-foreground mb-6">Total dollars secured for clients each month</p>
              {monthlyData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No funded clients yet — data will appear here once clients are marked as Funded with an amount.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [fmt$(v), "Amount Secured"]} />
                    <Line type="monotone" dataKey="amount" stroke="#c9a227" strokeWidth={2.5} dot={{ fill: "#c9a227", r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Clients funded per month */}
            <div className="glass rounded-2xl p-6">
              <h3 className="font-display text-xl mb-2">Clients Funded Per Month</h3>
              <p className="text-sm text-muted-foreground mb-6">Number of clients successfully funded each month</p>
              {monthlyData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No funded clients yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#1a1a2e" radius={[6, 6, 0, 0]} name="Clients Funded" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Lead volume + score breakdown */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="glass rounded-2xl p-6">
                <h3 className="font-display text-lg mb-4">Lead Volume by Month</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyLeads}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="hot"  fill="#ef4444" name="Hot"  stackId="a" />
                    <Bar dataKey="warm" fill="#f59e0b" name="Warm" stackId="a" />
                    <Bar dataKey="cold" fill="#3b82f6" name="Cold" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="glass rounded-2xl p-6">
                <h3 className="font-display text-lg mb-4">Score Distribution</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={scoreDist} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {scoreDist.map((e) => <Cell key={e.name} fill={e.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Funded clients list */}
            <div className="glass rounded-2xl p-6">
              <h3 className="font-display text-lg mb-4">All Funded Clients</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <tr>
                      <th className="pb-3 text-left">Client</th>
                      <th className="pb-3 text-left">Amount Secured</th>
                      <th className="pb-3 text-left">Funded Date</th>
                      <th className="pb-3 text-left">Credit Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {leads.filter((l) => l.status === "Funded").length === 0 && (
                      <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No funded clients yet.</td></tr>
                    )}
                    {leads.filter((l) => l.status === "Funded").map((l) => (
                      <tr key={l.id} className="hover:bg-muted/20 transition">
                        <td className="py-3 font-medium">{l.full_name}</td>
                        <td className="py-3 text-primary font-semibold">{l.funding_amount_secured ? fmt$(l.funding_amount_secured) : "—"}</td>
                        <td className="py-3 text-muted-foreground">{l.funded_at ? fmtDate(l.funded_at) : "—"}</td>
                        <td className="py-3">{CREDIT_LABELS[l.credit_score] ?? l.credit_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── EDIT LEAD MODAL ──────────────────────────────────────────────── */}
      {editLead && (
        <EditLeadModal lead={editLead} onSave={saveLead} onClose={() => setEditLead(null)} />
      )}
    </div>
  );
}

// ─── Edit Lead Modal ──────────────────────────────────────────────────────────
function EditLeadModal({ lead, onSave, onClose }: { lead: Lead; onSave: (l: Lead) => void; onClose: () => void }) {
  const [form, setForm] = useState({ ...lead });
  function set(k: keyof Lead, v: string | number) { setForm((p) => ({ ...p, [k]: v })); }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl glass p-8 shadow-card">
        <button onClick={onClose} className="absolute top-5 right-5 rounded-full p-2 hover:bg-accent transition">
          <X className="h-5 w-5" />
        </button>
        <p className="text-xs uppercase tracking-widest text-gold mb-1">Edit Lead</p>
        <h3 className="font-display text-2xl mb-6">{form.full_name}</h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Status</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value)}
              className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Pipeline Stage</label>
            <select value={form.pipeline_stage ?? "New Lead"} onChange={(e) => set("pipeline_stage", e.target.value)}
              className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Amount Secured ($)</label>
            <input type="number" value={form.funding_amount_secured ?? ""} onChange={(e) => set("funding_amount_secured", Number(e.target.value))}
              placeholder="e.g. 85000"
              className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Funded Date</label>
            <input type="date" value={form.funded_at ? form.funded_at.split("T")[0] : ""} onChange={(e) => set("funded_at", e.target.value)}
              className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Follow-up Date</label>
            <input type="date" value={form.follow_up_date ?? ""} onChange={(e) => set("follow_up_date", e.target.value)}
              className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Assigned To</label>
            <input type="text" value={form.assigned_to ?? "Lonnie"} onChange={(e) => set("assigned_to", e.target.value)}
              className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Notes</label>
          <textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={4}
            className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={() => onSave(form)}
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 font-medium shadow-glow hover:brightness-110 transition">
            <Save className="h-4 w-4" /> Save Changes
          </button>
          <button onClick={onClose} className="rounded-full glass px-6 py-3 font-medium hover:bg-accent transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, color, isString }: { icon: React.ReactNode; label: string; value: number | string; color: string; isString?: boolean }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className={`${color} mb-3`}>{icon}</div>
      <div className="text-2xl font-display">{isString ? value : value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    "New": "bg-blue-50 text-blue-600 border-blue-200",
    "Contacted": "bg-purple-50 text-purple-600 border-purple-200",
    "Call Scheduled": "bg-amber-50 text-amber-600 border-amber-200",
    "In Progress": "bg-orange-50 text-orange-600 border-orange-200",
    "Contract Sent": "bg-indigo-50 text-indigo-600 border-indigo-200",
    "Funded": "bg-green-50 text-green-600 border-green-200",
    "Not Qualified": "bg-gray-50 text-gray-500 border-gray-200",
    "Closed Lost": "bg-red-50 text-red-500 border-red-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-muted text-muted-foreground border-border"}`}>
      {status}
    </span>
  );
}

function FSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-medium capitalize">{value}</div>
    </div>
  );
}
