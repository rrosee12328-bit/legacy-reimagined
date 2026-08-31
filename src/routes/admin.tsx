import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  LogOut,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Building2,
  Calendar,
  StickyNote,
  X,
  Check,
  Flame,
  TrendingUp,
  Snowflake,
  Users,
  DollarSign,
  Clock,
  Target,
  Award,
  AlertCircle,
  ChevronRight,
  LayoutDashboard,
  List,
  BarChart2,
  Bell,
  Edit3,
  Save,
  Image,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Headphones,
  FileText,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin CRM — Scale to Legacy" }] }),
  component: AdminPage,
});

const CRM_ENDPOINT = "https://qlvsbsfddwuocfihsleq.supabase.co/functions/v1/scale-crm-leads";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CallEvidence {
  retell_call_id: string;
  transcript?: string;
  recording_url?: string;
  recording_multi_channel_url?: string;
  duration_ms?: number;
  disconnection_reason?: string;
  call_summary?: string;
  captured_at?: string;
  analysis_data?: Record<string, unknown>;
}

interface Communication {
  id: string;
  twilio_message_sid: string;
  direction: "inbound" | "outbound";
  channel: "sms" | "mms";
  body: string;
  status: string;
  occurred_at: string;
  media?: Array<Record<string, unknown>>;
  error_message?: string | null;
}

interface AnswerVerification {
  verified_value: unknown;
  reviewer: string;
  note?: string | null;
  reviewed_at: string;
}

interface AnswerComparison {
  field: string;
  form_value: unknown;
  call_value: unknown;
  status: "match" | "conflict" | "not_confirmed";
  verification?: AnswerVerification | null;
}

interface CreditScreenshot {
  id: string;
  content_type: string;
  received_at: string;
  signed_url?: string | null;
  twilio_message_sid?: string;
}

interface FollowupStep {
  id: string;
  step_number: number;
  scheduled_at: string;
  status: string;
  sent_at?: string | null;
  cancellation_reason?: string | null;
}

interface AutomationIssue {
  id: string;
  lead_id?: string | null;
  sequence_step_id?: string | null;
  issue_type: string;
  severity: "warning" | "error" | "critical";
  status: "open" | "retrying" | "resolved" | "dismissed";
  summary: string;
  technical_detail?: string | null;
  recommended_action?: string | null;
  retry_count: number;
  last_occurred_at: string;
}

interface AutomationHealth {
  status: "healthy" | "needs_attention";
  last_successful_run_at?: string | null;
  warning?: string | null;
}

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
  outbound_call_status?: string;
  sms_contact_consent?: boolean;
  contact_consent_at?: string;
  contact_consent_timezone?: string;
  contact_consent_text?: string;
  call_evidence?: CallEvidence | null;
  call_history?: CallEvidence[];
  communications?: Communication[];
  answer_comparisons?: AnswerComparison[];
  credit_screenshots?: CreditScreenshot[];
  followup_sequence?: FollowupStep[];
  booking_sequence_status?: string;
  booking_sequence_next_at?: string;
  booking_sequence_step?: number;
  manual_follow_up_needed?: boolean;
  automation_issues?: AutomationIssue[];
}

type View = "dashboard" | "leads" | "analytics";

// ─── Constants ────────────────────────────────────────────────────────────────
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

const PIPELINE_STAGES = [
  "New Lead",
  "Qualified",
  "Call Scheduled",
  "Strategy Session",
  "Contract Sent",
  "Funded",
  "Closed",
];

const SCORE_META: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  hot: {
    label: "Hot",
    color: "#ef4444",
    bg: "bg-red-50 border-red-200 text-red-600",
    icon: <Flame className="h-3.5 w-3.5" />,
  },
  warm: {
    label: "Warm",
    color: "#f59e0b",
    bg: "bg-amber-50 border-amber-200 text-amber-600",
    icon: <TrendingUp className="h-3.5 w-3.5" />,
  },
  cold: {
    label: "Cold",
    color: "#3b82f6",
    bg: "bg-blue-50 border-blue-200 text-blue-600",
    icon: <Snowflake className="h-3.5 w-3.5" />,
  },
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

const CHART_COLORS = ["#c9a227", "#1a1a2e", "#ef4444", "#f59e0b", "#3b82f6", "#10b981"];

function fmt$(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date} · ${time}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDuration(ms?: number) {
  if (!ms || ms < 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function AdminPage() {
  const [crmPassword, setCrmPassword] = useState(() =>
    sessionStorage.getItem("stl_admin_password"),
  );
  if (!crmPassword)
    return (
      <LoginScreen
        onAuth={(password) => {
          sessionStorage.setItem("stl_admin_password", password);
          setCrmPassword(password);
        }}
      />
    );
  return (
    <CRMDashboard
      crmPassword={crmPassword}
      onLogout={() => {
        sessionStorage.removeItem("stl_admin_password");
        setCrmPassword(null);
      }}
    />
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({ onAuth }: { onAuth: (password: string) => void }) {
  const [pass, setPass] = useState("");
  const [err, setErr] = useState(false);
  async function attempt(e: React.FormEvent) {
    e.preventDefault();
    const response = await fetch(CRM_ENDPOINT, {
      headers: { "x-scale-crm-password": pass },
    });
    if (response.ok) onAuth(pass);
    else {
      setErr(true);
      setPass("");
    }
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
            onChange={(e) => {
              setPass(e.target.value);
              setErr(false);
            }}
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
function CRMDashboard({ crmPassword, onLogout }: { crmPassword: string; onLogout: () => void }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("dashboard");
  const [search, setSearch] = useState("");
  const [filterScore, setFS] = useState("all");
  const [filterStatus, setFSt] = useState("all");
  const [sortField, setSF] = useState<keyof Lead>("created_at");
  const [sortAsc, setSA] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewer, setReviewer] = useState(() =>
    typeof window === "undefined"
      ? "CRM Admin"
      : (localStorage.getItem("scale-crm-reviewer") ?? "CRM Admin"),
  );
  const [verificationSaving, setVerificationSaving] = useState<string | null>(null);
  const [automationIssues, setAutomationIssues] = useState<AutomationIssue[]>([]);
  const [automationHealth, setAutomationHealth] = useState<AutomationHealth>({ status: "healthy" });
  const [recoverySaving, setRecoverySaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(CRM_ENDPOINT, {
      headers: { "x-scale-crm-password": crmPassword },
    });
    if (response.ok) {
      const payload = await response.json();
      setLeads((payload.leads as Lead[]) ?? []);
      setAutomationIssues((payload.automation_issues as AutomationIssue[]) ?? []);
      setAutomationHealth(payload.automation_health ?? { status: "healthy" });
    } else {
      setLeads([]);
      setAutomationIssues([]);
    }
    setLoading(false);
  }, [crmPassword]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveLead(updated: Lead) {
    const response = await fetch(CRM_ENDPOINT, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-scale-crm-password": crmPassword,
      },
      body: JSON.stringify({
        id: updated.id,
        updates: {
          status: updated.status,
          pipeline_stage: updated.pipeline_stage,
          notes: updated.notes,
          funding_amount_secured: updated.funding_amount_secured,
          funded_at: updated.funded_at || null,
          follow_up_date: updated.follow_up_date || null,
          last_contacted_at: updated.last_contacted_at || null,
          assigned_to: updated.assigned_to,
        },
      }),
    });
    if (response.ok) {
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setEditLead(null);
    }
  }

  async function runRecovery(action: string, leadId: string, extra: Record<string, unknown> = {}) {
    const key = `${leadId}:${action}`;
    setRecoverySaving(key);
    const response = await fetch(CRM_ENDPOINT, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-scale-crm-password": crmPassword },
      body: JSON.stringify({
        action,
        id: leadId,
        reviewer: reviewer.trim() || "CRM Admin",
        ...extra,
      }),
    });
    const result = response.headers.get("content-type")?.includes("application/json")
      ? await response.json()
      : { error: await response.text() };
    if (!response.ok || result.blocked_reason || result.reason === "lead_not_eligible") {
      window.alert(result.blocked_reason ?? result.error ?? "This action could not be completed.");
    } else if (action === "trigger_adam_call" && result.queued) {
      window.alert("Adam's call has been queued from the 615 number.");
    }
    await load();
    setRecoverySaving(null);
  }

  async function resolveVerification(
    leadId: string,
    field: string,
    source: "form" | "call",
    note: string,
  ) {
    const reviewerName = reviewer.trim() || "CRM Admin";
    localStorage.setItem("scale-crm-reviewer", reviewerName);
    setReviewer(reviewerName);
    setVerificationSaving(`${leadId}:${field}`);
    const response = await fetch(CRM_ENDPOINT, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-scale-crm-password": crmPassword,
      },
      body: JSON.stringify({
        action: "resolve_verification",
        id: leadId,
        field,
        source,
        reviewer: reviewerName,
        note,
      }),
    });
    if (response.ok) await load();
    setVerificationSaving(null);
  }

  // ── Analytics ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const funded = leads.filter((l) => l.status === "Funded");
    const totalFunded = funded.reduce((s, l) => s + (l.funding_amount_secured ?? 0), 0);
    const hot = leads.filter((l) => l.score === "hot").length;
    const warm = leads.filter((l) => l.score === "warm").length;
    const followUps = leads.filter(
      (l) => l.follow_up_date && new Date(l.follow_up_date) <= new Date(),
    ).length;
    const convRate = leads.length ? Math.round((funded.length / leads.length) * 100) : 0;
    return {
      total: leads.length,
      hot,
      warm,
      funded: funded.length,
      totalFunded,
      followUps,
      convRate,
    };
  }, [leads]);

  // Monthly funded chart data
  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; count: number; amount: number }> = {};
    leads
      .filter((l) => l.status === "Funded" && l.funded_at)
      .forEach((l) => {
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
  const scoreDist = useMemo(
    () => [
      { name: "Hot", value: leads.filter((l) => l.score === "hot").length, color: "#ef4444" },
      { name: "Warm", value: leads.filter((l) => l.score === "warm").length, color: "#f59e0b" },
      { name: "Cold", value: leads.filter((l) => l.score === "cold").length, color: "#3b82f6" },
    ],
    [leads],
  );

  // Pipeline funnel
  const pipelineData = useMemo(
    () =>
      PIPELINE_STAGES.map((stage) => ({
        stage,
        count: leads.filter((l) => (l.pipeline_stage ?? "New Lead") === stage).length,
      })),
    [leads],
  );

  // Filtered leads
  const visible = useMemo(
    () =>
      leads
        .filter((l) => {
          const q = search.toLowerCase();
          const ms =
            !q ||
            [l.full_name, l.email, l.phone, l.business_name].some((v) =>
              v?.toLowerCase().includes(q),
            );
          const msc = filterScore === "all" || l.score === filterScore;
          const mst = filterStatus === "all" || l.status === filterStatus;
          return ms && msc && mst;
        })
        .sort((a, b) => {
          const av = String(a[sortField] ?? "");
          const bv = String(b[sortField] ?? "");
          return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
        }),
    [leads, search, filterScore, filterStatus, sortField, sortAsc],
  );

  useEffect(() => {
    if (!visible.length) {
      setSelectedLeadId(null);
      return;
    }
    if (!selectedLeadId || !visible.some((lead) => lead.id === selectedLeadId)) {
      setSelectedLeadId(visible[0].id);
    }
  }, [visible, selectedLeadId]);

  const selectedLead = visible.find((lead) => lead.id === selectedLeadId) ?? null;

  function toggleSort(f: keyof Lead) {
    if (sortField === f) setSA(!sortAsc);
    else {
      setSF(f);
      setSA(false);
    }
  }

  // Follow-up alerts
  const dueFollowUps = leads.filter(
    (l) =>
      l.follow_up_date &&
      new Date(l.follow_up_date) <= new Date() &&
      l.status !== "Funded" &&
      l.status !== "Closed Lost",
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/images/logo.png" alt="" className="h-8" />
            <span className="font-display text-lg hidden sm:block">
              Scale <span className="text-gradient-gold">to Legacy</span> CRM
            </span>
          </div>
          <nav className="flex items-center gap-1">
            {(["dashboard", "leads", "analytics"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition capitalize ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
              >
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
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                  {stats.followUps}
                </span>
              </div>
            )}
            <button onClick={load} className="rounded-full p-2 hover:bg-accent transition">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-2 text-sm hover:bg-accent transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl w-full px-6 py-8 flex-1">
        {(automationHealth.status === "needs_attention" ||
          automationIssues.some((issue) => ["open", "retrying"].includes(issue.status))) && (
          <section className="mb-6 overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-[0_18px_45px_-28px_rgba(225,29,72,0.5)]">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-rose-50 to-amber-50 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-100 text-rose-700">
                  <AlertCircle className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-slate-950">Needs Attention</p>
                  <p className="text-xs text-slate-600">
                    Automation problems that may require a CRM action.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white">
                {
                  automationIssues.filter((issue) => ["open", "retrying"].includes(issue.status))
                    .length
                }{" "}
                open
              </span>
            </div>
            {automationHealth.warning && (
              <p className="border-t border-rose-100 bg-rose-50/60 px-5 py-3 text-sm font-medium text-rose-800">
                {automationHealth.warning}
              </p>
            )}
            <div className="grid gap-2 p-3 md:grid-cols-2">
              {automationIssues
                .filter((issue) => ["open", "retrying"].includes(issue.status))
                .slice(0, 6)
                .map((issue) => {
                  const lead = leads.find((item) => item.id === issue.lead_id);
                  return (
                    <button
                      key={issue.id}
                      onClick={() => {
                        if (lead) {
                          setSelectedLeadId(lead.id);
                          setView("leads");
                        }
                      }}
                      className="rounded-xl border border-slate-200 p-3 text-left hover:border-rose-200 hover:bg-rose-50/40"
                    >
                      <div className="flex justify-between gap-2">
                        <p className="text-sm font-semibold">{issue.summary}</p>
                        <span className="text-[10px] font-bold uppercase text-rose-600">
                          {issue.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {lead?.full_name ?? "System"} · {fmtDateTime(issue.last_occurred_at)}
                      </p>
                    </button>
                  );
                })}
            </div>
          </section>
        )}
        {/* ── DASHBOARD VIEW ─────────────────────────────────────────────── */}
        {view === "dashboard" && (
          <div className="grid gap-6">
            {/* Follow-up alerts */}
            {dueFollowUps.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    {dueFollowUps.length} follow-up{dueFollowUps.length > 1 ? "s" : ""} due today
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {dueFollowUps.map((l) => l.full_name).join(", ")}
                  </p>
                </div>
              </div>
            )}

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                icon={<Users className="h-5 w-5" />}
                label="Total Leads"
                value={stats.total}
                color="text-foreground"
              />
              <KpiCard
                icon={<Flame className="h-5 w-5" />}
                label="Hot Leads"
                value={stats.hot}
                color="text-red-500"
              />
              <KpiCard
                icon={<DollarSign className="h-5 w-5" />}
                label="Clients Funded"
                value={stats.funded}
                color="text-primary"
              />
              <KpiCard
                icon={<Award className="h-5 w-5" />}
                label="Total Funded"
                value={fmt$(stats.totalFunded)}
                color="text-primary"
                isString
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <KpiCard
                icon={<Target className="h-5 w-5" />}
                label="Conversion Rate"
                value={`${stats.convRate}%`}
                color="text-green-500"
                isString
              />
              <KpiCard
                icon={<TrendingUp className="h-5 w-5" />}
                label="Warm Leads"
                value={stats.warm}
                color="text-amber-500"
              />
              <KpiCard
                icon={<Bell className="h-5 w-5" />}
                label="Follow-ups Due"
                value={stats.followUps}
                color="text-amber-500"
              />
            </div>

            {/* Charts row */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Monthly funded amount */}
              <div className="glass rounded-2xl p-6">
                <h3 className="font-display text-lg mb-4">Monthly Funding Secured</h3>
                {monthlyData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No funded clients yet.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip formatter={(v: number) => fmt$(v)} />
                      <Bar
                        dataKey="amount"
                        fill="#c9a227"
                        radius={[6, 6, 0, 0]}
                        name="Amount Secured"
                      />
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
                      <Bar
                        dataKey="hot"
                        fill="#ef4444"
                        radius={[4, 4, 0, 0]}
                        name="Hot"
                        stackId="a"
                      />
                      <Bar
                        dataKey="warm"
                        fill="#f59e0b"
                        radius={[0, 0, 0, 0]}
                        name="Warm"
                        stackId="a"
                      />
                      <Bar
                        dataKey="cold"
                        fill="#3b82f6"
                        radius={[0, 0, 4, 4]}
                        name="Cold"
                        stackId="a"
                      />
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
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${leads.length ? (p.count / leads.length) * 100 : 0}%`,
                            background: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
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
                      <Pie
                        data={scoreDist}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {scoreDist.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
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
                <button
                  onClick={() => setView("leads")}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  View all <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              <div className="grid gap-3">
                {leads
                  .filter((l) => l.score === "hot")
                  .slice(0, 5)
                  .map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between rounded-xl border border-border p-3 hover:bg-muted/20 transition"
                    >
                      <div>
                        <p className="font-medium text-sm">{l.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.email} · {l.phone}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {fmtDateTime(l.created_at)}
                        </span>
                        <StatusBadge status={l.status} />
                      </div>
                    </div>
                  ))}
                {leads.filter((l) => l.score === "hot").length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hot leads yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── LEADS VIEW ─────────────────────────────────────────────────── */}
        {view === "leads" && (
          <div className="grid gap-5">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_8px_30px_-22px_rgba(15,23,42,0.28)]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search name, email, phone…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                />
              </div>
              <FSelect
                value={filterScore}
                onChange={setFS}
                options={[
                  { v: "all", l: "All Scores" },
                  { v: "hot", l: "🔥 Hot" },
                  { v: "warm", l: "📈 Warm" },
                  { v: "cold", l: "❄️ Cold" },
                ]}
              />
              <FSelect
                value={filterStatus}
                onChange={setFSt}
                options={[
                  { v: "all", l: "All Statuses" },
                  ...STATUS_OPTIONS.map((s) => ({ v: s, l: s })),
                ]}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Showing {visible.length} of {leads.length} leads
            </p>

            <div className="grid min-h-[680px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_-38px_rgba(15,23,42,0.32)] lg:grid-cols-[300px_minmax(0,1fr)]">
              <aside className="border-b border-slate-200 bg-slate-50/70 text-slate-900 lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold">Lead inbox</p>
                    <p className="text-xs text-slate-500">{visible.length} matching leads</p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    {visible.filter((lead) => lead.score === "hot").length} priority
                  </span>
                </div>
                <div className="max-h-[calc(100vh-260px)] min-h-[620px] overflow-y-auto p-2">
                  {loading && (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                      Loading leads…
                    </p>
                  )}
                  {!loading && visible.length === 0 && (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                      No leads found.
                    </p>
                  )}
                  {visible.map((lead) => {
                    const selected = selectedLeadId === lead.id;
                    const lastCall = lead.call_history?.[0] ?? lead.call_evidence;
                    return (
                      <button
                        key={lead.id}
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={`mb-1.5 w-full rounded-xl border p-3 text-left transition ${selected ? "border-emerald-200 bg-white shadow-[0_8px_24px_-16px_rgba(16,185,129,0.55)] ring-1 ring-emerald-100" : "border-transparent hover:border-slate-200 hover:bg-white"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{lead.full_name}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {lead.business_name || lead.email}
                            </p>
                          </div>
                          {lead.score && SCORE_META[lead.score] && (
                            <span
                              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SCORE_META[lead.score].bg}`}
                            >
                              {SCORE_META[lead.score].icon} {SCORE_META[lead.score].label}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span
                            className={`truncate text-[11px] ${selected ? "font-medium text-emerald-700" : "text-slate-500"}`}
                          >
                            {lastCall ? callOutcomeLabel(lead) : "Awaiting first call"}
                          </span>
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {fmtDate(lead.created_at)}
                          </span>
                        </div>
                        <div className="mt-2 flex gap-1.5">
                          {!!lead.call_history?.length && (
                            <Headphones className="h-3.5 w-3.5 text-emerald-600" />
                          )}
                          {!!lead.communications?.length && (
                            <MessageSquare className="h-3.5 w-3.5 text-teal-600" />
                          )}
                          {!!lead.answer_comparisons?.some(
                            (item) => item.status === "conflict" && !item.verification,
                          ) && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <section className="min-w-0 bg-white">
                {selectedLead ? (
                  <LeadWorkspace
                    lead={selectedLead}
                    reviewer={reviewer}
                    setReviewer={setReviewer}
                    saving={verificationSaving}
                    onResolve={resolveVerification}
                    onEdit={() => setEditLead(selectedLead)}
                    onRecovery={runRecovery}
                    recoverySaving={recoverySaving}
                  />
                ) : (
                  <div className="flex min-h-[680px] items-center justify-center p-8 text-center text-sm text-muted-foreground">
                    Select a lead to see their complete communication history.
                  </div>
                )}
              </section>
            </div>

            {/* Legacy stacked cards retained as a non-rendered fallback while the new workspace rolls out. */}
            <div className="hidden">
              {loading && <p className="text-center text-muted-foreground py-12">Loading leads…</p>}
              {!loading && visible.length === 0 && (
                <p className="text-center text-muted-foreground py-12">No leads found.</p>
              )}
              {visible.map((lead) => (
                <div key={lead.id} className="glass rounded-2xl overflow-hidden">
                  {/* Lead row */}
                  <div className="p-4 flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{lead.full_name}</p>
                        {lead.score && SCORE_META[lead.score] && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${SCORE_META[lead.score].bg}`}
                          >
                            {SCORE_META[lead.score].icon} {SCORE_META[lead.score].label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <a
                          href={`mailto:${lead.email}`}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Mail className="h-3 w-3" /> {lead.email}
                        </a>
                        <a
                          href={`tel:${lead.phone}`}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
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
                      <button
                        onClick={() => setEditLead(lead)}
                        className="rounded-full p-2 hover:bg-accent transition"
                        title="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}
                        className="rounded-full p-2 hover:bg-accent transition"
                      >
                        {expanded === lead.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expanded === lead.id && (
                    <div className="border-t border-border bg-muted/10 px-5 py-4">
                      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                        <Detail
                          label="LLC Status"
                          value={lead.llc_status?.replace(/_/g, " ") ?? "—"}
                        />
                        <Detail
                          label="Investment Ready"
                          value={lead.investment_ready?.replace(/_/g, " ") ?? "—"}
                        />
                        <Detail
                          label="Utilization"
                          value={lead.utilization?.replace(/_/g, "–").replace("plus", "+") ?? "—"}
                        />
                        <Detail label="Source" value={lead.source ?? "—"} />
                        <Detail label="Pipeline Stage" value={lead.pipeline_stage ?? "New Lead"} />
                        <Detail label="Assigned To" value={lead.assigned_to ?? "Lonnie"} />
                        <Detail
                          label="Follow-up Date"
                          value={lead.follow_up_date ? fmtDate(lead.follow_up_date) : "—"}
                        />
                        <Detail
                          label="Last Contacted"
                          value={lead.last_contacted_at ? fmtDateTime(lead.last_contacted_at) : "—"}
                        />
                        <Detail
                          label="Call/Text Consent"
                          value={lead.sms_contact_consent ? "Granted" : "Not granted"}
                        />
                        <Detail
                          label="Consent Recorded"
                          value={
                            lead.contact_consent_at
                              ? `${fmtDateTime(lead.contact_consent_at)}${
                                  lead.contact_consent_timezone
                                    ? ` (${lead.contact_consent_timezone})`
                                    : ""
                                }`
                              : "—"
                          }
                        />
                        {lead.status === "Funded" && (
                          <>
                            <Detail
                              label="Amount Secured"
                              value={
                                lead.funding_amount_secured
                                  ? fmt$(lead.funding_amount_secured)
                                  : "—"
                              }
                            />
                            <Detail
                              label="Funded Date"
                              value={lead.funded_at ? fmtDate(lead.funded_at) : "—"}
                            />
                          </>
                        )}
                      </div>
                      {lead.notes && (
                        <div className="mb-4 rounded-xl bg-background border border-border p-3">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                            Notes
                          </p>
                          <p className="text-sm">{lead.notes}</p>
                        </div>
                      )}
                      <CommunicationVerification
                        lead={lead}
                        reviewer={reviewer}
                        setReviewer={setReviewer}
                        saving={verificationSaving}
                        onResolve={resolveVerification}
                      />
                      {!!lead.credit_screenshots?.length && (
                        <div className="mb-4 rounded-xl bg-background border border-border p-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                              <Image className="h-4 w-4" /> Credit Score Screenshots
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {lead.credit_screenshots.length} received
                            </span>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {lead.credit_screenshots.map((screenshot) =>
                              screenshot.signed_url ? (
                                <a
                                  key={screenshot.id}
                                  href={screenshot.signed_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group overflow-hidden rounded-xl border border-border bg-muted/20"
                                >
                                  <img
                                    src={screenshot.signed_url}
                                    alt="Credit score screenshot"
                                    className="h-48 w-full object-contain transition group-hover:scale-[1.02]"
                                  />
                                  <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                                    Received {fmtDateTime(screenshot.received_at)}
                                  </p>
                                </a>
                              ) : null,
                            )}
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {lead.score === "hot" && (
                          <a
                            href="https://calendly.com/scaletolegacy/30min?back=1&month=2026-08"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs font-medium hover:brightness-110 transition"
                          >
                            <Calendar className="h-3.5 w-3.5" /> Schedule Funding Call
                          </a>
                        )}
                        <a
                          href={`mailto:${lead.email}?subject=Scale to Legacy — Your Funding Application&body=Hi ${lead.full_name},%0A%0AThank you for applying with Scale to Legacy.`}
                          className="inline-flex items-center gap-1.5 rounded-full glass px-4 py-2 text-xs font-medium hover:bg-accent transition"
                        >
                          <Mail className="h-3.5 w-3.5" /> Email
                        </a>
                        <a
                          href={`tel:${lead.phone}`}
                          className="inline-flex items-center gap-1.5 rounded-full glass px-4 py-2 text-xs font-medium hover:bg-accent transition"
                        >
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
              <KpiCard
                icon={<DollarSign className="h-5 w-5" />}
                label="Total Funded"
                value={fmt$(stats.totalFunded)}
                color="text-primary"
                isString
              />
              <KpiCard
                icon={<Target className="h-5 w-5" />}
                label="Conversion Rate"
                value={`${stats.convRate}%`}
                color="text-green-500"
                isString
              />
              <KpiCard
                icon={<Award className="h-5 w-5" />}
                label="Avg. Funded"
                value={stats.funded ? fmt$(stats.totalFunded / stats.funded) : "$0"}
                color="text-primary"
                isString
              />
              <KpiCard
                icon={<Users className="h-5 w-5" />}
                label="Total Leads"
                value={stats.total}
                color="text-foreground"
              />
            </div>

            {/* Monthly funding trend */}
            <div className="glass rounded-2xl p-6">
              <h3 className="font-display text-xl mb-2">Monthly Funding Revenue</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Total dollars secured for clients each month
              </p>
              {monthlyData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No funded clients yet — data will appear here once clients are marked as Funded
                  with an amount.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip formatter={(v: number) => [fmt$(v), "Amount Secured"]} />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#c9a227"
                      strokeWidth={2.5}
                      dot={{ fill: "#c9a227", r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Clients funded per month */}
            <div className="glass rounded-2xl p-6">
              <h3 className="font-display text-xl mb-2">Clients Funded Per Month</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Number of clients successfully funded each month
              </p>
              {monthlyData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No funded clients yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      fill="#1a1a2e"
                      radius={[6, 6, 0, 0]}
                      name="Clients Funded"
                    />
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
                    <Bar dataKey="hot" fill="#ef4444" name="Hot" stackId="a" />
                    <Bar dataKey="warm" fill="#f59e0b" name="Warm" stackId="a" />
                    <Bar dataKey="cold" fill="#3b82f6" name="Cold" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="glass rounded-2xl p-6">
                <h3 className="font-display text-lg mb-4">Score Distribution</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={scoreDist}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {scoreDist.map((e) => (
                        <Cell key={e.name} fill={e.color} />
                      ))}
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
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-foreground">
                          No funded clients yet.
                        </td>
                      </tr>
                    )}
                    {leads
                      .filter((l) => l.status === "Funded")
                      .map((l) => (
                        <tr key={l.id} className="hover:bg-muted/20 transition">
                          <td className="py-3 font-medium">{l.full_name}</td>
                          <td className="py-3 text-primary font-semibold">
                            {l.funding_amount_secured ? fmt$(l.funding_amount_secured) : "—"}
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {l.funded_at ? fmtDate(l.funded_at) : "—"}
                          </td>
                          <td className="py-3">
                            {CREDIT_LABELS[l.credit_score] ?? l.credit_score}
                          </td>
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

const VERIFICATION_LABELS: Record<string, string> = {
  credit_score: "Credit score",
  utilization: "Credit utilization",
  llc_status: "LLC status",
  investment_ready: "Investment readiness",
  funding_amount: "Requested funding",
  calendar_booking_status: "Calendar booking",
};

function answerText(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value).replace(/_/g, " ");
}

function callOutcomeLabel(lead: Lead) {
  const value =
    `${lead.outbound_call_status ?? ""} ${lead.call_evidence?.disconnection_reason ?? ""}`.toLowerCase();
  if (value.includes("voicemail")) return "Voicemail left";
  if (value.includes("no_answer") || value.includes("unanswered")) return "No answer";
  if (value.includes("book")) return "Appointment booked";
  if (value.includes("qualified"))
    return value.includes("not_qualified") ? "Not qualified" : "Qualified";
  if (lead.call_history?.length || lead.call_evidence) return "Call completed";
  return "Call pending";
}

function LeadWorkspace({
  lead,
  reviewer,
  setReviewer,
  saving,
  onResolve,
  onEdit,
  onRecovery,
  recoverySaving,
}: {
  lead: Lead;
  reviewer: string;
  setReviewer: (value: string) => void;
  saving: string | null;
  onResolve: (
    leadId: string,
    field: string,
    source: "form" | "call",
    note: string,
  ) => Promise<void>;
  onEdit: () => void;
  onRecovery: (action: string, leadId: string, extra?: Record<string, unknown>) => Promise<void>;
  recoverySaving: string | null;
}) {
  const calls = lead.call_history ?? [];
  const messages = lead.communications ?? [];
  const conflicts = (lead.answer_comparisons ?? []).filter(
    (item) => item.status === "conflict" && !item.verification,
  ).length;
  const latestCall = calls[0] ?? lead.call_evidence;

  return (
    <div>
      <div className="relative overflow-hidden border-b border-slate-200 bg-white px-5 py-6 text-slate-900 md:px-7">
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-emerald-100/60 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-64 rounded-full bg-teal-50 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl">{lead.full_name}</h2>
              <StatusBadge status={lead.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {lead.business_name || "Business funding applicant"}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
              <a
                href={`tel:${lead.phone}`}
                className="inline-flex items-center gap-1.5 hover:text-emerald-700"
              >
                <Phone className="h-3.5 w-3.5" />
                {lead.phone}
              </a>
              <a
                href={`mailto:${lead.email}`}
                className="inline-flex items-center gap-1.5 hover:text-emerald-700"
              >
                <Mail className="h-3.5 w-3.5" />
                {lead.email}
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                if (
                  window.confirm(
                    `Start an Adam call to ${lead.full_name} from the Scale to Legacy 615 number?`,
                  )
                )
                  onRecovery("trigger_adam_call", lead.id);
              }}
              disabled={recoverySaving === `${lead.id}:trigger_adam_call`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold shadow-sm hover:bg-slate-50"
            >
              <Phone className="h-3.5 w-3.5" />
              {recoverySaving === `${lead.id}:trigger_adam_call` ? "Queuing…" : "Call with Adam"}
            </button>
            <a
              href={`tel:${lead.phone}`}
              className="inline-flex items-center rounded-xl px-2 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
            >
              Call from my device
            </a>
            <a
              href="https://calendly.com/scaletolegacy/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold shadow-sm hover:bg-slate-50"
            >
              <Calendar className="h-3.5 w-3.5" />
              Calendar
              <ExternalLink className="h-3 w-3" />
            </a>
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-[0_10px_24px_-12px_rgba(16,185,129,0.65)] hover:bg-emerald-600"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit lead
            </button>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-2 xl:grid-cols-4">
          <SummaryTile
            icon={<Headphones className="h-4 w-4" />}
            label="Latest call"
            value={callOutcomeLabel(lead)}
            detail={
              latestCall ? fmtDateTime(latestCall.captured_at ?? lead.created_at) : "Not called yet"
            }
          />
          <SummaryTile
            icon={<MessageSquare className="h-4 w-4" />}
            label="Messages"
            value={`${messages.length} saved`}
            detail={
              messages.length
                ? `${messages.filter((item) => item.direction === "inbound").length} inbound`
                : "No SMS or MMS yet"
            }
          />
          <SummaryTile
            icon={<FileText className="h-4 w-4" />}
            label="Call records"
            value={`${calls.length || (lead.call_evidence ? 1 : 0)} call${calls.length === 1 ? "" : "s"}`}
            detail={latestCall?.recording_url ? "Audio available" : "No recording yet"}
          />
          <SummaryTile
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Review"
            value={
              conflicts ? `${conflicts} conflict${conflicts === 1 ? "" : "s"}` : "No open conflicts"
            }
            detail={lead.sms_contact_consent ? "Contact consent recorded" : "No contact consent"}
            alert={conflicts > 0}
          />
        </div>
      </div>

      <div className="p-5 md:p-7">
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Detail
            label="Credit score"
            value={CREDIT_LABELS[lead.credit_score] ?? lead.credit_score ?? "—"}
          />
          <Detail
            label="Utilization"
            value={lead.utilization?.replace(/_/g, "–").replace("plus", "+") ?? "—"}
          />
          <Detail label="Pipeline" value={lead.pipeline_stage ?? "New Lead"} />
          <Detail label="Assigned to" value={lead.assigned_to ?? "Lonnie"} />
        </div>
        {lead.notes && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Internal notes
            </p>
            <p className="mt-1 text-sm leading-relaxed">{lead.notes}</p>
          </div>
        )}
        <div className="mb-5 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4 shadow-[0_14px_35px_-25px_rgba(79,70,229,0.55)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-indigo-950">Automation & Recovery</p>
              <p className="text-xs text-indigo-700">
                Monitor reminders, booking checks, delivery problems, and call recovery.
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${(lead.automation_issues ?? []).some((issue) => ["open", "retrying"].includes(issue.status)) ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}
            >
              {(lead.automation_issues ?? []).some((issue) =>
                ["open", "retrying"].includes(issue.status),
              )
                ? "Needs Attention"
                : "Healthy"}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => onRecovery("recheck_calendly", lead.id)}
              className="rounded-lg border border-cyan-200 bg-white px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50"
            >
              Recheck Calendly
            </button>
            <button
              onClick={() => onRecovery("restart_followup_sequence", lead.id)}
              className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-50"
            >
              Restart remaining
            </button>
            {lead.booking_sequence_status === "paused" ? (
              <button
                onClick={() => onRecovery("resume_followup_sequence", lead.id)}
                className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800"
              >
                Resume
              </button>
            ) : (
              <button
                onClick={() => onRecovery("pause_followup_sequence", lead.id)}
                className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800"
              >
                Pause
              </button>
            )}
            <button
              onClick={() => onRecovery("cancel_followup_sequence", lead.id)}
              className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700"
            >
              Cancel
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            {(lead.automation_issues ?? [])
              .filter((issue) => ["open", "retrying"].includes(issue.status))
              .map((issue) => (
                <div key={issue.id} className="rounded-xl border border-rose-200 bg-rose-50/70 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-rose-950">{issue.summary}</p>
                      <p className="mt-0.5 text-xs text-rose-700">{issue.recommended_action}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {issue.sequence_step_id && (
                        <button
                          onClick={() =>
                            onRecovery("retry_followup_step", lead.id, {
                              issue_id: issue.id,
                              step_id: issue.sequence_step_id,
                            })
                          }
                          className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm"
                        >
                          Retry text now
                        </button>
                      )}
                      <button
                        onClick={() =>
                          onRecovery("resolve_automation_issue", lead.id, { issue_id: issue.id })
                        }
                        className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 shadow-sm"
                      >
                        Mark resolved
                      </button>
                    </div>
                  </div>
                  {issue.technical_detail && (
                    <details className="mt-2 text-xs text-slate-600">
                      <summary className="cursor-pointer font-medium">Technical details</summary>
                      <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-2 text-[10px] text-slate-100">
                        {issue.technical_detail}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
          </div>
        </div>
        <CommunicationVerification
          lead={lead}
          reviewer={reviewer}
          setReviewer={setReviewer}
          saving={saving}
          onResolve={onResolve}
        />
      </div>
    </div>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  detail,
  alert = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3.5 ${alert ? "border-red-200 bg-red-50 shadow-sm" : "border-slate-200 bg-slate-50/70 shadow-[0_8px_22px_-18px_rgba(15,23,42,0.35)]"}`}
    >
      <div
        className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider ${alert ? "text-red-600" : "text-emerald-700"}`}
      >
        {icon}
        {label}
      </div>
      <p className={`mt-2 text-sm font-semibold ${alert ? "text-red-700" : "text-slate-900"}`}>
        {value}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-slate-500">{detail}</p>
    </div>
  );
}

function MessageBody({ body }: { body: string }) {
  const parts = body.split(/(https?:\/\/[^\s]+)/g);
  return (
    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={`${part}-${index}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 break-all font-medium text-primary underline underline-offset-2"
          >
            {part}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          part
        ),
      )}
    </p>
  );
}

function CommunicationVerification({
  lead,
  reviewer,
  setReviewer,
  saving,
  onResolve,
}: {
  lead: Lead;
  reviewer: string;
  setReviewer: (value: string) => void;
  saving: string | null;
  onResolve: (
    leadId: string,
    field: string,
    source: "form" | "call",
    note: string,
  ) => Promise<void>;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<"activity" | "verification">("activity");
  const timeline = useMemo(
    () =>
      [
        ...(lead.communications ?? []).map((item) => ({
          kind: "message" as const,
          at: item.occurred_at,
          item,
        })),
        ...(lead.call_history ?? []).map((item) => ({
          kind: "call" as const,
          at: item.captured_at ?? lead.created_at,
          item,
        })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [lead],
  );
  const openReviews = (lead.answer_comparisons ?? []).filter(
    (answer) => answer.status !== "match" && !answer.verification,
  ).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_45px_-34px_rgba(15,23,42,0.4)]">
      <div className="border-b border-slate-200 bg-slate-50/70 p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => setActiveSection("activity")}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${activeSection === "activity" ? "border-emerald-200 bg-white text-emerald-800 shadow-[0_8px_20px_-15px_rgba(16,185,129,0.7)] ring-1 ring-emerald-100" : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-white/70"}`}
          >
            <span className="flex items-center gap-3">
              <span
                className={`grid h-9 w-9 place-items-center rounded-lg ${activeSection === "activity" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200/70 text-slate-500"}`}
              >
                <MessageSquare className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold">Activity</span>
                <span className="block text-[11px] font-normal opacity-75">
                  Calls, audio, texts and files
                </span>
              </span>
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {timeline.length}
            </span>
          </button>
          <button
            onClick={() => setActiveSection("verification")}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${activeSection === "verification" ? "border-amber-200 bg-white text-amber-800 shadow-[0_8px_20px_-15px_rgba(245,158,11,0.65)] ring-1 ring-amber-100" : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-white/70"}`}
          >
            <span className="flex items-center gap-3">
              <span
                className={`grid h-9 w-9 place-items-center rounded-lg ${activeSection === "verification" ? "bg-amber-100 text-amber-700" : "bg-slate-200/70 text-slate-500"}`}
              >
                <ShieldCheck className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold">Verification</span>
                <span className="block text-[11px] font-normal opacity-75">
                  Compare and approve answers
                </span>
              </span>
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${openReviews ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}
            >
              {openReviews}
            </span>
          </button>
        </div>
      </div>

      {activeSection === "verification" && (
        <div className="p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Answer verification</p>
              <p className="text-xs text-slate-500">
                Choose the trusted value only when the form and call differ.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-[11px] font-medium">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-700">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Form
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-violet-700">
                  <span className="h-2 w-2 rounded-full bg-violet-500" />
                  Call
                </span>
              </div>
              <label className="text-xs text-slate-500">
                Reviewer
                <input
                  value={reviewer}
                  onChange={(event) => setReviewer(event.target.value)}
                  className="ml-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-900"
                  aria-label="Reviewer name"
                />
              </label>
            </div>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {(lead.answer_comparisons ?? []).map((answer) => {
              const busy = saving === `${lead.id}:${answer.field}`;
              const statusMeta =
                answer.status === "match"
                  ? {
                      label: "Match",
                      className: "border-green-200 bg-green-50 text-green-700",
                      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                    }
                  : answer.status === "conflict"
                    ? {
                        label: "Conflict",
                        className: "border-red-200 bg-red-50 text-red-700",
                        icon: <XCircle className="h-3.5 w-3.5" />,
                      }
                    : {
                        label: "Not confirmed",
                        className: "border-amber-200 bg-amber-50 text-amber-700",
                        icon: <AlertCircle className="h-3.5 w-3.5" />,
                      };
              return (
                <div
                  key={answer.field}
                  className={`rounded-xl border bg-white p-3 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.3)] ${answer.status === "conflict" ? "border-red-200 ring-1 ring-red-50" : answer.status === "match" ? "border-emerald-200" : "border-amber-200/80"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {VERIFICATION_LABELS[answer.field] ?? answer.field}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${statusMeta.className}`}
                    >
                      {statusMeta.icon} {statusMeta.label}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-2.5 text-sm shadow-[inset_3px_0_0_0_rgba(59,130,246,0.7)]">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                        Form answer
                      </span>
                      <span className="mt-1 block font-medium text-blue-950">
                        {answerText(answer.form_value)}
                      </span>
                    </div>
                    <div className="rounded-lg border border-violet-200 bg-violet-50/80 p-2.5 text-sm shadow-[inset_3px_0_0_0_rgba(139,92,246,0.7)]">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                        Call answer
                      </span>
                      <span className="mt-1 block font-medium text-violet-950">
                        {answerText(answer.call_value)}
                      </span>
                    </div>
                  </div>
                  {answer.verification ? (
                    <div className="mt-2 rounded-lg border border-green-200 bg-green-50 p-2 text-xs text-green-800">
                      Verified as{" "}
                      <strong className="capitalize">
                        {answerText(answer.verification.verified_value)}
                      </strong>{" "}
                      by {answer.verification.reviewer} on{" "}
                      {fmtDateTime(answer.verification.reviewed_at)}
                      {answer.verification.note ? ` — ${answer.verification.note}` : ""}
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        value={notes[answer.field] ?? ""}
                        onChange={(event) =>
                          setNotes((current) => ({
                            ...current,
                            [answer.field]: event.target.value,
                          }))
                        }
                        placeholder="Optional review note"
                        className="min-w-[180px] flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                      />
                      <button
                        disabled={busy || answer.form_value == null}
                        onClick={() =>
                          onResolve(lead.id, answer.field, "form", notes[answer.field] ?? "")
                        }
                        className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                      >
                        Use form
                      </button>
                      <button
                        disabled={busy || answer.call_value == null}
                        onClick={() =>
                          onResolve(lead.id, answer.field, "call", notes[answer.field] ?? "")
                        }
                        className="rounded-full border border-violet-200 bg-violet-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-600 disabled:opacity-40"
                      >
                        Use call
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeSection === "activity" && (
        <div className="p-4 md:p-5">
          {(lead.followup_sequence?.length ?? 0) > 0 && (
            <div className="mb-4 rounded-xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-4 shadow-[0_10px_25px_-20px_rgba(8,145,178,0.8)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-cyan-950">Calendly follow-up sequence</p>
                  <p className="text-xs text-cyan-700">
                    {lead.booking_sequence_status === "active" && lead.booking_sequence_next_at
                      ? `Next booking check and reminder: ${fmtDateTime(lead.booking_sequence_next_at)}`
                      : lead.manual_follow_up_needed
                        ? "Automated reminders complete — manual follow-up needed"
                        : `Status: ${(lead.booking_sequence_status ?? "pending").replaceAll("_", " ")}`}
                  </p>
                </div>
                {lead.manual_follow_up_needed && (
                  <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    Manual follow-up needed
                  </span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(lead.followup_sequence ?? []).map((step) => (
                  <div
                    key={step.id}
                    className="rounded-lg border border-white/80 bg-white/80 px-3 py-2"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700">
                      Touch {step.step_number}
                    </p>
                    <p className="mt-0.5 text-xs font-medium capitalize text-slate-800">
                      {step.status.replaceAll("_", " ")}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {fmtDateTime(step.sent_at ?? step.scheduled_at)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Communication timeline</p>
              <p className="text-xs text-slate-500">Newest calls and messages appear first.</p>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              {timeline.length} activities
            </span>
          </div>
          {timeline.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No calls or messages have been saved yet.
            </p>
          ) : (
            <div className="mt-3 grid gap-3">
              {timeline.map((event) =>
                event.kind === "message" ? (
                  <div
                    key={`message-${event.item.id}`}
                    className={`rounded-xl border p-3 shadow-sm ${event.item.direction === "outbound" ? "ml-6 border-emerald-200 bg-emerald-50/70" : "mr-6 border-slate-200 bg-slate-50/70"}`}
                  >
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">
                        {event.item.direction} {event.item.channel}
                      </span>
                      <span>
                        {fmtDateTime(event.at)} · {event.item.status}
                      </span>
                    </div>
                    {event.item.body && <MessageBody body={event.item.body} />}
                    {event.item.error_message && (
                      <p className="mt-2 text-xs text-red-600">{event.item.error_message}</p>
                    )}
                    {(lead.credit_screenshots ?? [])
                      .filter((shot) => shot.twilio_message_sid === event.item.twilio_message_sid)
                      .map((shot) =>
                        shot.signed_url ? (
                          <a
                            key={shot.id}
                            href={shot.signed_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-block"
                          >
                            <img
                              src={shot.signed_url}
                              alt="MMS attachment"
                              className="max-h-44 rounded-lg border border-border"
                            />
                          </a>
                        ) : null,
                      )}
                  </div>
                ) : (
                  <div
                    key={`call-${event.item.retell_call_id}`}
                    className="rounded-xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/60 p-4 text-slate-900 shadow-[0_12px_30px_-22px_rgba(16,185,129,0.45)]"
                  >
                    <div className="flex flex-wrap justify-between gap-2 text-xs font-medium text-emerald-700">
                      <span className="inline-flex items-center gap-1.5">
                        <Headphones className="h-3.5 w-3.5" />
                        Call recording · {fmtDuration(event.item.duration_ms)}
                      </span>
                      <span>{fmtDateTime(event.at)}</span>
                    </div>
                    {event.item.call_summary && (
                      <p className="mt-2 text-sm">{event.item.call_summary}</p>
                    )}
                    {event.item.recording_url && (
                      <audio controls preload="metadata" className="mt-3 w-full">
                        <source src={event.item.recording_url} />
                      </audio>
                    )}
                    {event.item.transcript && (
                      <details className="mt-3 rounded-lg border border-emerald-100 bg-white p-2">
                        <summary className="cursor-pointer text-xs font-medium uppercase text-emerald-700">
                          Call transcript
                        </summary>
                        <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                          {event.item.transcript}
                        </p>
                      </details>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Edit Lead Modal ──────────────────────────────────────────────────────────
function EditLeadModal({
  lead,
  onSave,
  onClose,
}: {
  lead: Lead;
  onSave: (l: Lead) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ ...lead });
  function set(k: keyof Lead, v: string | number) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl glass p-8 shadow-card">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 rounded-full p-2 hover:bg-accent transition"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="text-xs uppercase tracking-widest text-gold mb-1">Edit Lead</p>
        <h3 className="font-display text-2xl mb-6">{form.full_name}</h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Status</label>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Pipeline Stage
            </label>
            <select
              value={form.pipeline_stage ?? "New Lead"}
              onChange={(e) => set("pipeline_stage", e.target.value)}
              className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Amount Secured ($)
            </label>
            <input
              type="number"
              value={form.funding_amount_secured ?? ""}
              onChange={(e) => set("funding_amount_secured", Number(e.target.value))}
              placeholder="e.g. 85000"
              className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Funded Date
            </label>
            <input
              type="date"
              value={form.funded_at ? form.funded_at.split("T")[0] : ""}
              onChange={(e) => set("funded_at", e.target.value)}
              className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Follow-up Date
            </label>
            <input
              type="date"
              value={form.follow_up_date ?? ""}
              onChange={(e) => set("follow_up_date", e.target.value)}
              className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Assigned To
            </label>
            <input
              type="text"
              value={form.assigned_to ?? "Lonnie"}
              onChange={(e) => set("assigned_to", e.target.value)}
              className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Notes</label>
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => onSave(form)}
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 font-medium shadow-glow hover:brightness-110 transition"
          >
            <Save className="h-4 w-4" /> Save Changes
          </button>
          <button
            onClick={onClose}
            className="rounded-full glass px-6 py-3 font-medium hover:bg-accent transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function KpiCard({
  icon,
  label,
  value,
  color,
  isString,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  isString?: boolean;
}) {
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
    New: "bg-blue-50 text-blue-600 border-blue-200",
    Contacted: "bg-purple-50 text-purple-600 border-purple-200",
    "Call Scheduled": "bg-amber-50 text-amber-600 border-amber-200",
    "In Progress": "bg-orange-50 text-orange-600 border-orange-200",
    "Contract Sent": "bg-indigo-50 text-indigo-600 border-indigo-200",
    Funded: "bg-green-50 text-green-600 border-green-200",
    "Not Qualified": "bg-gray-50 text-gray-500 border-gray-200",
    "Closed Lost": "bg-red-50 text-red-500 border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-muted text-muted-foreground border-border"}`}
    >
      {status}
    </span>
  );
}

function FSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
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
