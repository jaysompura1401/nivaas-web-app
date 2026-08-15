import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  analyticsExt,
  type ExtendedAnalyticsSummary, type MonthlyIncome, type VisitStats, type TenantDashboard,
} from "@/lib/api";
import { formatINR } from "@/lib/mock-properties";
import { Loader2, TrendingUp, Users, Eye, Calendar, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchProfile } from "@/lib/auth-cache";

export const Route = createFileRoute("/_authenticated/dashboard/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Nivaas" }] }),
  component: Analytics,
});

function MiniBar({ value, max, color = "bg-gradient-primary" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 4;
  return (
    <div className="w-full rounded-t-lg transition-all" style={{ height: `${pct}%` }}>
      <div className={`w-full h-full rounded-t-lg ${color}`} />
    </div>
  );
}

function OwnerAnalytics() {
  const [summary, setSummary] = useState<ExtendedAnalyticsSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyIncome[]>([]);
  const [visitData, setVisitData] = useState<VisitStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([analyticsExt.summary(), analyticsExt.monthly(), analyticsExt.visits()])
      .then(([s, m, v]) => { setSummary(s); setMonthly(m); setVisitData(v); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const kpis = [
    { label: "Total Views",       value: summary?.total_views,       icon: Eye },
    { label: "Inquiries",         value: summary?.total_inquiries,   icon: Users },
    { label: "Saves",             value: summary?.total_saves,       icon: TrendingUp },
    { label: "Active Listings",   value: summary?.active_listings,   icon: null },
    { label: "Verified",          value: summary?.verified_listings, icon: null },
    { label: "Conversion Rate",   value: summary?.conversion_rate != null ? `${summary.conversion_rate}%` : "—", icon: null },
    { label: "Monthly Income",    value: formatINR(Number(summary?.monthly_collected ?? 0)), icon: null },
    { label: "Pending Rent",      value: formatINR(Number(summary?.pending_rent ?? 0)), icon: null },
  ];

  const maxIncome = monthly.length > 0 ? Math.max(...monthly.map(m => Number(m.total))) : 1;
  const maxVisit  = visitData.length  > 0 ? Math.max(...visitData.map(v => Number(v.total))) : 1;

  return (
    <>
      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {kpis.slice(0, 4).map(k => (
          <Card key={k.label} className="p-5 border-border/60 bg-gradient-card">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <p className="mt-2 text-2xl font-bold">
              {typeof k.value === "number" ? k.value.toLocaleString() : (k.value ?? "—")}
            </p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mt-4">
        {kpis.slice(4).map(k => (
          <Card key={k.label} className="p-5 border-border/60 bg-gradient-card">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <p className="mt-2 text-2xl font-bold">
              {typeof k.value === "number" ? k.value.toLocaleString() : (k.value ?? "—")}
            </p>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Monthly rent income */}
        {monthly.length > 0 && (
          <Card className="p-6 border-border/60">
            <h2 className="font-display font-bold mb-1">Monthly Rent Income</h2>
            <p className="text-xs text-muted-foreground mb-4">Last 6 months</p>
            <div className="h-40 flex items-end gap-3">
              {monthly.slice(-6).map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full">
                  <div className="flex-1 w-full flex items-end">
                    <MiniBar value={Number(m.total)} max={maxIncome} />
                  </div>
                  <span className="text-xs text-muted-foreground">{m.month}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Visit trend */}
        {visitData.length > 0 && (
          <Card className="p-6 border-border/60">
            <h2 className="font-display font-bold mb-1">Visit Requests</h2>
            <p className="text-xs text-muted-foreground mb-4">Last 6 months</p>
            <div className="h-40 flex items-end gap-3">
              {visitData.slice(-6).map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full">
                  <div className="flex-1 w-full flex items-end">
                    <MiniBar value={Number(v.total)} max={maxVisit} color="bg-blue-500" />
                  </div>
                  <span className="text-xs text-muted-foreground">{v.month}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Traffic sources */}
      <Card className="mt-6 p-6 border-border/60">
        <h2 className="font-display font-bold">Traffic by Source</h2>
        <div className="mt-4 space-y-4">
          {[
            ["Organic Search",        62],
            ["Direct",                22],
            ["AI Recommendations",    10],
            ["Social / Referral",      6],
          ].map(([l, v]) => (
            <div key={l as string}>
              <div className="flex justify-between text-sm mb-1">
                <span>{l}</span>
                <span className="font-semibold">{v}%</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-gradient-primary" style={{ width: `${v}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Conversion funnel */}
      <Card className="mt-6 p-6 border-border/60">
        <h2 className="font-display font-bold mb-4">Conversion Funnel</h2>
        <div className="space-y-3">
          {[
            { label: "Views",           value: summary?.total_views ?? 0,       width: 100 },
            { label: "Inquiries",       value: summary?.total_inquiries ?? 0,   width: 60 },
            { label: "Visits Booked",   value: summary?.total_visits ?? 0,      width: 35 },
            { label: "Rented/Sold",     value: summary?.rented_listings ?? 0,   width: 15 },
          ].map(step => (
            <div key={step.label} className="flex items-center gap-3">
              <span className="w-32 text-sm text-muted-foreground text-right">{step.label}</span>
              <div className="flex-1 h-8 bg-secondary rounded-lg overflow-hidden">
                <div
                  className="h-full bg-gradient-primary flex items-center px-3"
                  style={{ width: `${step.width}%` }}
                >
                  <span className="text-xs text-white font-semibold">{Number(step.value).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function TenantAnalytics() {
  const [data, setData]     = useState<TenantDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsExt.tenantSummary()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[
          { label: "Total Payments",  value: data?.payment_history.length ?? 0 },
          { label: "Paid",            value: data?.payment_history.filter(p => p.status === "paid").length ?? 0, cls: "text-primary" },
          { label: "Complaints",      value: data?.complaints.total ?? 0 },
          { label: "Visits Booked",   value: data?.visits.total ?? 0 },
        ].map(s => (
          <Card key={s.label} className="p-5 border-border/60">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className={`mt-2 text-3xl font-bold ${s.cls ?? ""}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {data?.active_agreement && (
        <Card className="mt-6 p-6 border-border/60">
          <h2 className="font-display font-bold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" /> Active Agreement
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              ["Property",    (data.active_agreement as any).property_title],
              ["City",        (data.active_agreement as any).city],
              ["Monthly Rent", formatINR(data.active_agreement.monthly_rent)],
              ["Period",      `${data.active_agreement.start_date} → ${data.active_agreement.end_date}`],
            ].map(([l, v]) => (
              <div key={l as string}>
                <p className="text-muted-foreground text-xs">{l}</p>
                <p className="font-medium mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data?.next_payment && (
        <Card className="mt-4 p-5 border-primary/30 border bg-primary/5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-semibold">Next Rent Due: {data.next_payment.due_date}</p>
              <p className="text-sm text-muted-foreground">{formatINR(data.next_payment.amount)} — {data.next_payment.status}</p>
            </div>
          </div>
        </Card>
      )}

      {data?.payment_history && data.payment_history.length > 0 && (
        <Card className="mt-6 border-border/60 overflow-hidden">
          <div className="p-5 border-b border-border/60">
            <h2 className="font-display font-bold">Payment History</h2>
          </div>
          <div className="divide-y divide-border/60">
            {data.payment_history.slice(0, 12).map(p => {
              const s = p.status === "paid" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive";
              return (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">{(p as any).property_title}</p>
                    <p className="text-xs text-muted-foreground">Due {p.due_date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm">{formatINR(p.amount)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s}`}>{p.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}

function Analytics() {
  const [role, setRole] = useState<string>("");
  useEffect(() => {
    fetchProfile().then(p => setRole(p?.role ?? "customer")).catch(() => {});
  }, []);

  if (!role) return (
    <DashboardShell title="Analytics" subtitle="Loading...">
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    </DashboardShell>
  );

  if (role === "customer") {
    return (
      <DashboardShell title="Analytics" subtitle="Your rental dashboard and payment overview">
        <TenantAnalytics />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Analytics" subtitle="Performance across all your listings">
      {role !== "customer" ? (
        <Tabs defaultValue="owner">
          <TabsList className="mb-6">
            <TabsTrigger value="owner">Owner Dashboard</TabsTrigger>
            <TabsTrigger value="tenant">Tenant View</TabsTrigger>
          </TabsList>
          <TabsContent value="owner"><OwnerAnalytics /></TabsContent>
          <TabsContent value="tenant"><TenantAnalytics /></TabsContent>
        </Tabs>
      ) : (
        <TenantAnalytics />
      )}
    </DashboardShell>
  );
}
