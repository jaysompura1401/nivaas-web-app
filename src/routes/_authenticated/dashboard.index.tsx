import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Eye, Wallet, Plus, ArrowUpRight, Building2, Loader2,
  Heart, Calendar, ShieldAlert, Home, AlertTriangle, CheckCircle2,
  Clock, Search, FileText, Receipt, MessageSquare,
} from "lucide-react";
import { PropertyCard } from "@/components/site/PropertyCard";
import {
  analyticsExt, rentalsExt, visits as visitsApi,
  saved as savedApi, complaints as complaintsApi,
  analytics, rentals as rentalsApi, properties as propertiesApi,
  messages as messagesApi,
  type ApiProperty, type RentalStats, type MonthlyIncome,
  type ApiVisit, type ApiComplaint, type TenantDashboard, type ApiMessage,
} from "@/lib/api";
import { formatINR } from "@/lib/mock-properties";
import { useEffect, useState } from "react";
import { fetchProfile, type CachedProfile } from "@/lib/auth-cache";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: "Dashboard — Nivaas" }] }),
  component: DashboardHome,
});

// ─── Customer Dashboard ────────────────────────────────────────────────────────
function CustomerDashboard({ profile }: { profile: CachedProfile }) {
  const [data,       setData]    = useState<TenantDashboard | null>(null);
  const [savedProps, setSaved]   = useState<ApiProperty[]>([]);
  const [visits,     setVisits]  = useState<ApiVisit[]>([]);
  const [threads,    setThreads] = useState<ApiMessage[]>([]);
  const [loading,    setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsExt.tenantSummary().catch(() => null),
      savedApi.list().catch(() => []),
      visitsApi.list("customer").catch(() => []),
      messagesApi.threads().catch(() => []),
    ]).then(([d, sv, vi, th]) => {
      setData(d as TenantDashboard | null);
      setSaved((sv as ApiProperty[]).slice(0, 3));
      setVisits((vi as ApiVisit[]).filter(v => v.status !== "cancelled").slice(0, 3));
      setThreads((th as ApiMessage[]).slice(0, 4));
    }).finally(() => setLoading(false));
  }, []);

  const nextPayment = data?.next_payment;
  const agreement   = data?.active_agreement as any;

  const statCards = [
    { label: "Saved Properties", value: loading ? "—" : String(savedProps.length),                                                             icon: Heart,      cls: "text-pink-500"   },
    { label: "Upcoming Visits",  value: loading ? "—" : String(visits.filter(v => v.status === "pending" || v.status === "confirmed").length), icon: Calendar,   cls: "text-primary"    },
    { label: "Open Complaints",  value: loading ? "—" : String(data?.complaints?.open ?? 0),                                                   icon: ShieldAlert, cls: "text-destructive"},
    { label: "Payments Made",    value: loading ? "—" : String(data?.payment_history?.filter(p => p.status === "paid").length ?? 0),           icon: Receipt,    cls: "text-green-600"  },
  ];

  return (
    <DashboardShell
      title={`Welcome, ${profile.full_name?.split(" ")[0] ?? "there"} 👋`}
      subtitle="Your rental dashboard"
      action={
        <Button asChild variant="hero" size="sm" className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm whitespace-nowrap">
          <Link to="/properties"><Search className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Browse </span>Properties</Link>
        </Button>
      }
    >
      {/* ── Stat cards — 2 cols on mobile, 4 on xl ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {statCards.map(s => (
          <Card key={s.label} className="p-4 sm:p-5 border-border/60 bg-gradient-card">
            <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center mb-2 sm:mb-3">
              <s.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${s.cls}`} />
            </div>
            <p className="text-xl sm:text-2xl font-bold">
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : s.value}
            </p>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* ── Active agreement + next rent ── */}
      {(agreement || nextPayment) && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {agreement && (
            <Card className="p-4 sm:p-5 border-border/60">
              <div className="flex items-center gap-2 mb-3">
                <Home className="h-4 w-4 text-primary shrink-0" />
                <h2 className="font-display font-bold text-sm sm:text-base">Active Rental</h2>
              </div>
              <p className="font-semibold text-sm">{agreement.property_title}</p>
              <p className="text-xs text-muted-foreground">{agreement.city}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Monthly Rent</p>
                  <p className="font-semibold text-primary text-sm">{formatINR(agreement.monthly_rent)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valid Until</p>
                  <p className="font-semibold text-sm">{agreement.end_date}</p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="mt-3 w-full text-xs sm:text-sm">
                <Link to="/dashboard/rentals">View Agreement <ArrowUpRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </Card>
          )}

          {nextPayment && (
            <Card className={`p-4 sm:p-5 border ${nextPayment.status === "overdue" ? "border-destructive/50 bg-destructive/5" : "border-primary/30 bg-primary/5"}`}>
              <div className="flex items-center gap-2 mb-3">
                {nextPayment.status === "overdue"
                  ? <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  : <Clock className="h-4 w-4 text-primary shrink-0" />}
                <h2 className="font-display font-bold text-sm sm:text-base">
                  {nextPayment.status === "overdue" ? "Rent Overdue!" : "Next Rent Due"}
                </h2>
              </div>
              <p className="text-2xl sm:text-3xl font-bold">{formatINR(nextPayment.amount)}</p>
              <p className="text-xs text-muted-foreground mt-1">Due: {nextPayment.due_date}</p>
              <Badge className={`mt-2 text-xs ${nextPayment.status === "overdue" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                {nextPayment.status}
              </Badge>
              <Button asChild variant={nextPayment.status === "overdue" ? "destructive" : "hero"} size="sm" className="mt-3 w-full text-xs sm:text-sm">
                <Link to="/dashboard/rentals">Pay Now <ArrowUpRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* ── Upcoming visits + Recent payments ── */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2 min-w-0">
        <Card className="p-4 sm:p-5 border-border/60 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-display font-bold text-sm sm:text-base truncate">Upcoming Visits</h2>
            <Button asChild variant="ghost" size="sm" className="text-xs h-7 px-2 shrink-0">
              <Link to="/dashboard/visits">View all <ArrowUpRight className="h-3 w-3 ml-0.5" /></Link>
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : visits.length === 0 ? (
            <div className="text-center py-6">
              <Calendar className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No visits scheduled.</p>
              <Button asChild variant="outline" size="sm" className="mt-3 text-xs">
                <Link to="/properties">Browse & Book</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {visits.map(v => {
                const statusCls = v.status === "confirmed" ? "bg-primary/10 text-primary" : "bg-yellow-100 text-yellow-800";
                const [hh, mm] = v.visit_time.split(":").map(Number);
                const ampm = hh >= 12 ? "PM" : "AM";
                const h12  = hh % 12 || 12;
                const timeLabel = `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
                return (
                  <div key={v.id} className="flex items-center justify-between gap-2 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{v.property_title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(v.visit_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {timeLabel}
                      </p>
                    </div>
                    <Badge className={`text-xs shrink-0 ${statusCls}`}>{v.status}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-5 border-border/60 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-display font-bold text-sm sm:text-base truncate">Recent Payments</h2>
            <Button asChild variant="ghost" size="sm" className="text-xs h-7 px-2 shrink-0">
              <Link to="/dashboard/rentals">View all <ArrowUpRight className="h-3 w-3 ml-0.5" /></Link>
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !data?.payment_history?.length ? (
            <div className="text-center py-6">
              <Receipt className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.payment_history.slice(0, 4).map(p => (
                <div key={p.id} className="flex items-center justify-between gap-2 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{(p as any).property_title ?? "Rent"}</p>
                    <p className="text-xs text-muted-foreground">Due {p.due_date}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-sm">{formatINR(p.amount)}</p>
                    <Badge className={`text-xs mt-0.5 ${p.status === "paid" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                      {p.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Recent Messages ── */}
      <div className="mt-5">
        <Card className="p-4 sm:p-5 border-border/60 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-display font-bold text-sm sm:text-base truncate">Recent Messages</h2>
            <Button asChild variant="ghost" size="sm" className="text-xs h-7 px-2 shrink-0">
              <Link to="/dashboard/messages">View all <ArrowUpRight className="h-3 w-3 ml-0.5" /></Link>
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : threads.length === 0 ? (
            <div className="text-center py-6">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {threads.map(t => (
                <div key={`${t.other_user_id}-${t.property_id}`} className="flex items-center gap-2 border-b border-border/60 pb-3 last:border-0 last:pb-0 overflow-hidden">
                  <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary shrink-0 text-sm">
                    {(t.other_user_name || "U").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-medium text-sm truncate">{t.other_user_name || "Owner"}</p>
                      <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0 ml-1">
                        {new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {t.property_title && (
                      <p className="text-xs text-primary truncate">{t.property_title}</p>
                    )}
                    <p className="text-xs text-muted-foreground truncate">{t.content}</p>
                  </div>
                  {!t.is_read && t.receiver_id === profile.id && (
                    <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Saved properties ── */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display font-bold text-base sm:text-lg">Saved Properties</h2>
            <p className="text-xs text-muted-foreground">Properties you've bookmarked</p>
          </div>
          <Button asChild variant="outline" size="sm" className="text-xs h-8">
            <Link to="/dashboard/saved"><Heart className="h-3.5 w-3.5 mr-1" /> View All</Link>
          </Button>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
            {[1, 2, 3].map(i => <div key={i} className="rounded-2xl bg-muted/40 animate-pulse h-52 sm:h-64" />)}
          </div>
        ) : savedProps.length === 0 ? (
          <Card className="p-8 sm:p-10 text-center border-dashed border-border/60">
            <Heart className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-semibold">No saved properties yet</p>
            <p className="text-sm text-muted-foreground mt-1">Browse listings and click ♡ to save</p>
            <Button asChild variant="hero" className="mt-4">
              <Link to="/properties"><Search className="h-4 w-4 mr-1" /> Browse Properties</Link>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
            {savedProps.map(p => <PropertyCard key={p.id} p={p} />)}
          </div>
        )}
      </div>

      {/* ── Quick actions ── */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { to: "/properties",           icon: Search,      label: "Browse Properties", sub: "Find your next home"      },
          { to: "/dashboard/visits",     icon: Calendar,    label: "My Visits",          sub: "Schedule & manage visits" },
          { to: "/dashboard/complaints", icon: ShieldAlert, label: "Raise Complaint",    sub: "Report issues or fraud"   },
        ].map(a => (
          <Link key={a.to} to={a.to}>
            <Card className="p-4 border-border/60 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center mb-2 sm:mb-3 group-hover:bg-primary/20 transition-colors">
                <a.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <p className="font-semibold text-sm">{a.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">{a.sub}</p>
            </Card>
          </Link>
        ))}
      </div>
    </DashboardShell>
  );
}

// ─── Owner / Admin Dashboard ───────────────────────────────────────────────────
function OwnerDashboard({ profile }: { profile: CachedProfile }) {
  const [summary,  setSummary]  = useState<any>(null);
  const [monthly,  setMonthly]  = useState<MonthlyIncome[]>([]);
  const [myProps,  setMyProps]  = useState<ApiProperty[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [visits,   setVisits]   = useState<ApiVisit[]>([]);
  const [threads,  setThreads]  = useState<ApiMessage[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      analytics.summary().catch(() => null),
      analytics.monthly().catch(() => []),
      propertiesApi.mine().catch(() => []),
      rentalsApi.list().catch(() => []),
      visitsApi.list("owner").catch(() => []),
      messagesApi.threads().catch(() => []),
    ]).then(([sum, mon, props, pays, vi, th]) => {
      setSummary(sum);
      setMonthly(mon as MonthlyIncome[]);
      setMyProps((props as ApiProperty[]).slice(0, 3));
      setPayments((pays as any[]).filter(p => p.status !== "paid").slice(0, 3));
      setVisits((vi as ApiVisit[]).filter(v => v.status !== "cancelled").slice(0, 4));
      setThreads((th as ApiMessage[]).slice(0, 4));
    }).finally(() => setLoading(false));
  }, []);

  const stats = [
    { label: "Total Views",     value: summary?.total_views      != null ? Number(summary.total_views).toLocaleString()       : "—", icon: Eye,        cls: "text-blue-500"  },
    { label: "Active Listings", value: summary?.active_listings  != null ? String(summary.active_listings)                    : "—", icon: Building2,  cls: "text-primary"   },
    { label: "Inquiries",       value: summary?.total_inquiries  != null ? String(summary.total_inquiries)                    : "—", icon: TrendingUp, cls: "text-amber-500" },
    { label: "Rent Collected",  value: summary?.yearly_collected != null ? formatINR(Number(summary.yearly_collected))        : "—", icon: Wallet,     cls: "text-green-600" },
  ];

  const maxIncome = monthly.length > 0 ? Math.max(...monthly.map(m => Number(m.total))) : 1;
  const MONTHS    = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const chartData = monthly.length > 0
    ? monthly.slice(-6).map(m => ({ label: m.month, pct: Math.round((Number(m.total) / maxIncome) * 100) }))
    : Array.from({ length: 6 }, (_, i) => ({ label: MONTHS[i], pct: 0 }));

  return (
    <DashboardShell
      title={`Welcome back, ${profile.full_name?.split(" ")[0] ?? "Owner"} 👋`}
      subtitle="Here's what's happening with your properties"
      action={
        <Button asChild variant="hero" size="sm" className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm whitespace-nowrap">
          <Link to="/dashboard/properties/new"><Plus className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Post </span>Property</Link>
        </Button>
      }
    >
      {/* ── Stat cards — always 2×2 on mobile, 4-col on xl ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {stats.map(s => (
          <Card key={s.label} className="p-4 sm:p-5 border-border/60 bg-gradient-card">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-muted flex items-center justify-center mb-2 sm:mb-3">
              <s.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${s.cls}`} />
            </div>
            <p className="text-xl sm:text-2xl font-bold">
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : s.value}
            </p>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* ── Income chart + upcoming rent ── */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="p-4 sm:p-6 border-border/60">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-bold text-sm sm:text-lg">Rental Income</h2>
              <p className="text-xs text-muted-foreground">Last 6 months</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs h-7 px-2">
              <Link to="/dashboard/analytics">Full report <ArrowUpRight className="h-3 w-3 ml-0.5" /></Link>
            </Button>
          </div>
          {/* Chart — shorter on mobile */}
          <div className="h-36 sm:h-48 flex items-end gap-1.5 sm:gap-3">
            {chartData.map((b, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 sm:gap-2 h-full justify-end">
                <div className="w-full rounded-t-lg bg-gradient-primary transition-all" style={{ height: `${b.pct || 4}%` }} />
                <span className="text-[10px] sm:text-xs text-muted-foreground">{b.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 sm:p-6 border-border/60">
          <h2 className="font-display font-bold text-sm sm:text-lg mb-1">Upcoming Rent</h2>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="h-8 w-8 mx-auto text-primary/40 mb-2" />
              <p className="text-sm text-muted-foreground">All rent up to date!</p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {payments.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-2 border-b last:border-0 border-border/60 pb-3 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{r.tenant_name || "Tenant"}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.property_title} · Due {r.due_date}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-sm">{formatINR(r.amount)}</p>
                    {r.status === "overdue" && (
                      <Badge className="text-xs bg-destructive/10 text-destructive mt-0.5">Overdue</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button asChild variant="outline" size="sm" className="w-full mt-4 text-xs sm:text-sm">
            <Link to="/dashboard/rentals">View all <ArrowUpRight className="h-3 w-3 ml-1" /></Link>
          </Button>
        </Card>
      </div>

      {/* ── My Properties ── */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display font-bold text-base sm:text-lg">Your Properties</h2>
            <p className="text-xs text-muted-foreground">Currently listed on Nivaas</p>
          </div>
          <Button asChild variant="outline" size="sm" className="text-xs h-8">
            <Link to="/dashboard/properties"><Building2 className="h-3.5 w-3.5 mr-1" /> Manage</Link>
          </Button>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
            {[1, 2, 3].map(i => <div key={i} className="rounded-2xl bg-muted/40 animate-pulse h-52 sm:h-64" />)}
          </div>
        ) : myProps.length === 0 ? (
          <Card className="p-8 sm:p-10 text-center border-dashed border-border/60">
            <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-semibold">No properties yet</p>
            <Button asChild variant="hero" className="mt-4">
              <Link to="/dashboard/properties/new"><Plus className="h-4 w-4 mr-1" /> Post Property</Link>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
            {myProps.map(p => <PropertyCard key={p.id} p={p} />)}
          </div>
        )}
      </div>

      {/* ── Visit Requests + Recent Messages ── */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2 min-w-0">
        <Card className="p-4 sm:p-5 border-border/60 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-display font-bold text-sm sm:text-base truncate">Visit Requests</h2>
            <Button asChild variant="ghost" size="sm" className="text-xs h-7 px-2 shrink-0">
              <Link to="/dashboard/visits">View all <ArrowUpRight className="h-3 w-3 ml-0.5" /></Link>
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : visits.length === 0 ? (
            <div className="text-center py-6">
              <Calendar className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No visit requests yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visits.map(v => {
                const statusCls = v.status === "confirmed"
                  ? "bg-primary/10 text-primary"
                  : v.status === "pending"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-muted text-muted-foreground";
                const [hh, mm] = v.visit_time.split(":").map(Number);
                const ampm = hh >= 12 ? "PM" : "AM";
                const h12  = hh % 12 || 12;
                const timeLabel = `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
                return (
                  <div key={v.id} className="flex items-center justify-between gap-2 border-b border-border/60 pb-3 last:border-0 last:pb-0 overflow-hidden">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{v.property_title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {v.customer_name} · {new Date(v.visit_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} {timeLabel}
                      </p>
                    </div>
                    <Badge className={`text-xs shrink-0 ${statusCls}`}>{v.status}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-5 border-border/60 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-display font-bold text-sm sm:text-base truncate">Recent Messages</h2>
            <Button asChild variant="ghost" size="sm" className="text-xs h-7 px-2 shrink-0">
              <Link to="/dashboard/messages">View all <ArrowUpRight className="h-3 w-3 ml-0.5" /></Link>
            </Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : threads.length === 0 ? (
            <div className="text-center py-6">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {threads.map(t => (
                <div key={`${t.other_user_id}-${t.property_id}`} className="flex items-center gap-2 border-b border-border/60 pb-3 last:border-0 last:pb-0 overflow-hidden">
                  <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary shrink-0 text-sm">
                    {(t.other_user_name || "U").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-medium text-sm truncate">{t.other_user_name || "Tenant"}</p>
                      <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0 ml-1">
                        {new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {t.property_title && (
                      <p className="text-xs text-primary truncate">{t.property_title}</p>
                    )}
                    <p className="text-xs text-muted-foreground truncate">{t.content}</p>
                  </div>
                  {!t.is_read && t.receiver_id === profile.id && (
                    <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Quick actions — 2×2 on mobile, 4-col on sm+ ── */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { to: "/dashboard/properties/new", icon: Plus,       label: "Post Property", sub: "List a new property"       },
          { to: "/dashboard/rentals",        icon: Wallet,     label: "Collect Rent",  sub: "Track & remind tenants"    },
          { to: "/dashboard/agreements",     icon: FileText,   label: "Agreements",    sub: "Create & manage leases"    },
          { to: "/dashboard/analytics",      icon: TrendingUp, label: "Analytics",     sub: "Views & income"            },
        ].map(a => (
          <Link key={a.to} to={a.to}>
            <Card className="p-3 sm:p-4 border-border/60 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group h-full">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                <a.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <p className="font-semibold text-xs sm:text-sm leading-tight">{a.label}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 hidden sm:block">{a.sub}</p>
            </Card>
          </Link>
        ))}
      </div>

    </DashboardShell>
  );
}

// ─── Root switcher ─────────────────────────────────────────────────────────────
function DashboardHome() {
  const [profile, setProfile] = useState<CachedProfile | null>(null);
  const [ready,   setReady]   = useState(false);

  useEffect(() => {
    fetchProfile().then(p => { setProfile(p); setReady(true); }).catch(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <DashboardShell title="Dashboard" subtitle="Loading…">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardShell>
    );
  }

  if (!profile) {
    return (
      <DashboardShell title="Dashboard" subtitle="">
        <div className="flex items-center justify-center py-32">
          <p className="text-muted-foreground">Could not load profile.</p>
        </div>
      </DashboardShell>
    );
  }

  if (profile.role === "customer") {
    return <CustomerDashboard profile={profile} />;
  }

  return <OwnerDashboard profile={profile} />;
}
