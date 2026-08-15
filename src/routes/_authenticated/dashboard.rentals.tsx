import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  rentals as rentalsApi, rentalsExt,
  agreements as agreementsApi,
  type ApiPayment, type RentalStats, type ApiAgreement,
} from "@/lib/api";
import { formatINR } from "@/lib/mock-properties";
import {
  CheckCircle2, Clock, AlertTriangle, Download, Send, Loader2,
  Receipt, Home, TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchProfile } from "@/lib/auth-cache";

export const Route = createFileRoute("/_authenticated/dashboard/rentals")({
  head: () => ({ meta: [{ title: "Rental Management — Nivaas" }] }),
  component: Rentals,
});

const statusMap: Record<string, { label: string; icon: any; cls: string }> = {
  paid:    { label: "Paid",     icon: CheckCircle2,  cls: "bg-primary/10 text-primary" },
  pending: { label: "Upcoming", icon: Clock,         cls: "bg-secondary text-secondary-foreground" },
  overdue: { label: "Overdue",  icon: AlertTriangle, cls: "bg-destructive/10 text-destructive" },
  waived:  { label: "Waived",   icon: CheckCircle2,  cls: "bg-muted text-muted-foreground" },
};

function ReceiptModal({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rentalsExt.receipt(paymentId)
      .then(setData)
      .catch(() => toast.error("Could not load receipt"))
      .finally(() => setLoading(false));
  }, [paymentId]);

  const handlePrint = () => window.print();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Rent Receipt
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="space-y-4 text-sm">
            <div className="bg-gradient-primary text-white rounded-xl p-5">
              <p className="text-xs text-white/70">Receipt No.</p>
              <p className="text-lg font-bold">{data.receipt_number}</p>
              <p className="text-xs text-white/70 mt-1">{data.generated_at ? new Date(data.generated_at).toLocaleString("en-IN") : ""}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Property</p>
                <p className="font-medium">{data.property_title}</p>
                <p className="text-muted-foreground text-xs">{data.address}</p>
                <p className="text-muted-foreground text-xs">{data.city}, {data.state} – {data.pincode}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Tenant</p>
                <p className="font-medium">{data.tenant_name}</p>
                <p className="text-muted-foreground text-xs">{data.tenant_email}</p>
                <p className="text-muted-foreground text-xs">{data.tenant_phone}</p>
              </div>
            </div>
            <div className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Rent Due</span><span className="font-medium">{data.due_date}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Paid On</span><span className="font-medium text-primary">{data.paid_date ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Payment Method</span><span className="font-medium">{data.payment_method ?? "—"}</span></div>
              <div className="flex justify-between text-base font-bold pt-2 border-t border-border"><span>Amount Paid</span><span className="text-primary">{formatINR(data.amount)}</span></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handlePrint}>
                <Download className="h-4 w-4 mr-1" /> Print/PDF
              </Button>
              <Button variant="hero" onClick={onClose}>Close</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">Receipt unavailable.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PaymentRow({ r, showReceipt }: { r: ApiPayment; showReceipt: (id: string) => void }) {
  const s = statusMap[r.status] ?? statusMap["pending"];
  const [updating, setUpdating] = useState(false);

  const markPaid = async () => {
    setUpdating(true);
    try {
      await rentalsApi.updateStatus(r.id, {
        status: "paid",
        paid_date: new Date().toISOString().slice(0, 10),
        payment_method: "manual",
      });
      toast.success("Marked as paid");
      window.location.reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setUpdating(false); }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 items-center gap-3 p-5">
      <div className="col-span-2">
        <p className="font-semibold">{r.tenant_name || "Tenant"}</p>
        <p className="text-xs text-muted-foreground">{r.property_title} · {r.locality || r.city}</p>
      </div>
      <p className="text-sm">Due {r.due_date}</p>
      <p className="font-semibold">{formatINR(r.amount)}</p>
      <Badge className={s.cls}><s.icon className="h-3 w-3 mr-1" />{s.label}</Badge>
      <div className="flex items-center gap-1.5 justify-end flex-wrap">
        {r.status === "paid" && (
          <Button size="sm" variant="ghost" onClick={() => showReceipt(r.id)}>
            <Receipt className="h-3 w-3 mr-1" /> Receipt
          </Button>
        )}
        {r.status !== "paid" && r.status !== "waived" && (
          <>
            <Button size="sm" variant="outline" disabled={updating} onClick={markPaid}>
              <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Paid
            </Button>
            <Button size="sm" variant="ghost" onClick={() => toast.info("Reminder sent")}>
              <Send className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function TenantPaymentRow({ r, showReceipt }: { r: ApiPayment; showReceipt: (id: string) => void }) {
  const s = statusMap[r.status] ?? statusMap["pending"];
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 items-center gap-3 p-5">
      <div className="col-span-2">
        <p className="font-semibold">{r.property_title}</p>
        <p className="text-xs text-muted-foreground">{r.locality || r.city}</p>
      </div>
      <p className="text-sm">Due {r.due_date}</p>
      <p className="font-semibold">{formatINR(r.amount)}</p>
      <div className="flex items-center gap-2 justify-end">
        <Badge className={s.cls}><s.icon className="h-3 w-3 mr-1" />{s.label}</Badge>
        {r.status === "paid" && (
          <Button size="sm" variant="ghost" onClick={() => showReceipt(r.id)}>
            <Receipt className="h-3 w-3 mr-1" /> Receipt
          </Button>
        )}
      </div>
    </div>
  );
}

function OwnerView() {
  const [rows, setRows]     = useState<ApiPayment[]>([]);
  const [stats, setStats]   = useState<RentalStats>({ collected: null, pending: null, overdue: null });
  const [loading, setLoading] = useState(true);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [agreements, setAgreements] = useState<ApiAgreement[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    Promise.all([rentalsApi.list(), rentalsApi.stats(), agreementsApi.list()])
      .then(([list, s, ag]) => { setRows(list); setStats(s); setAgreements(ag); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const generateForAgreement = async (agId: string) => {
    setGenerating(true);
    try {
      const result = await rentalsExt.generatePayments(agId);
      toast.success(`${result.created} new payment rows generated`);
      const list = await rentalsApi.list();
      setRows(list);
    } catch (e: any) { toast.error(e.message); }
    finally { setGenerating(false); }
  };

  const signedAgreements = agreements.filter(a => a.status === "signed");

  return (
    <>
      {receiptId && <ReceiptModal paymentId={receiptId} onClose={() => setReceiptId(null)} />}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5 bg-gradient-primary text-white border-0 shadow-elegant">
          <p className="text-xs uppercase tracking-wide text-white/80">Collected this month</p>
          <p className="mt-2 text-3xl font-bold">{formatINR(Number(stats.collected) || 0)}</p>
        </Card>
        <Card className="p-5 border-border/60">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
          <p className="mt-2 text-3xl font-bold">{formatINR(Number(stats.pending) || 0)}</p>
        </Card>
        <Card className="p-5 border-border/60">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Overdue</p>
          <p className="mt-2 text-3xl font-bold text-destructive">{formatINR(Number(stats.overdue) || 0)}</p>
        </Card>
      </div>

      {/* Generate payments for signed agreements */}
      {signedAgreements.length > 0 && (
        <Card className="mt-6 p-5 border-border/60">
          <p className="font-display font-bold mb-3">Generate Monthly Payment Schedule</p>
          <div className="space-y-2">
            {signedAgreements.map(ag => (
              <div key={ag.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
                <div>
                  <p className="text-sm font-medium">{ag.property_title}</p>
                  <p className="text-xs text-muted-foreground">
                    Tenant: {ag.tenant_name} · {formatINR(ag.monthly_rent)}/mo · {ag.start_date} → {ag.end_date}
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled={generating}
                  onClick={() => generateForAgreement(ag.id)}>
                  {generating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <TrendingUp className="h-3 w-3 mr-1" />}
                  Generate
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mt-6 border-border/60 overflow-hidden">
        <div className="p-5 flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold">Rent Collections</h2>
            <p className="text-xs text-muted-foreground">Auto-reminders sent 7 / 3 / 1 day before due date</p>
          </div>
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> Export</Button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground border-t border-border/60">
            No rent records yet. Sign agreements and generate payment schedules to begin.
          </div>
        ) : (
          <div className="border-t border-border/60 divide-y divide-border/60">
            {rows.map(r => (
              <PaymentRow key={r.id} r={r} showReceipt={setReceiptId} />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function TenantView() {
  const [rows, setRows]     = useState<ApiPayment[]>([]);
  const [stats, setStats]   = useState<RentalStats>({ collected: null, pending: null, overdue: null });
  const [loading, setLoading] = useState(true);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([rentalsExt.listTenant(), rentalsExt.statsTenant()])
      .then(([list, s]) => { setRows(list); setStats(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const next = rows.find(r => r.status === "pending" || r.status === "overdue");

  return (
    <>
      {receiptId && <ReceiptModal paymentId={receiptId} onClose={() => setReceiptId(null)} />}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5 bg-gradient-primary text-white border-0 shadow-elegant">
          <p className="text-xs uppercase tracking-wide text-white/80">Paid this month</p>
          <p className="mt-2 text-3xl font-bold">{formatINR(Number(stats.collected) || 0)}</p>
        </Card>
        <Card className={`p-5 border-border/60 ${stats.overdue ? "border-destructive/40" : ""}`}>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Overdue</p>
          <p className={`mt-2 text-3xl font-bold ${Number(stats.overdue) > 0 ? "text-destructive" : ""}`}>
            {formatINR(Number(stats.overdue) || 0)}
          </p>
        </Card>
        <Card className="p-5 border-border/60">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Next Due</p>
          {next ? (
            <>
              <p className="mt-2 text-3xl font-bold">{formatINR(next.amount)}</p>
              <p className="text-xs text-muted-foreground mt-1">Due {next.due_date}</p>
            </>
          ) : (
            <p className="mt-2 text-xl text-muted-foreground">No upcoming</p>
          )}
        </Card>
      </div>

      <Card className="mt-6 border-border/60 overflow-hidden">
        <div className="p-5 border-b border-border/60">
          <h2 className="font-display font-bold">My Rent History</h2>
          <p className="text-xs text-muted-foreground">Download receipts for paid months</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No rent payments found.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {rows.map(r => (
              <TenantPaymentRow key={r.id} r={r} showReceipt={setReceiptId} />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function Rentals() {
  const [role, setRole] = useState<"owner" | "tenant">("owner");
  const [profileRole, setProfileRole] = useState<string>("");

  useEffect(() => {
    fetchProfile().then(p => {
      const r = p?.role ?? "customer";
      setProfileRole(r);
      if (r === "customer") setRole("tenant");
    }).catch(() => {});
  }, []);

  return (
    <DashboardShell title="Rental Management" subtitle="Track rent collections, receipts and payment schedules">
      {profileRole !== "customer" && (
        <Tabs value={role} onValueChange={v => setRole(v as "owner" | "tenant")} className="mb-6">
          <TabsList>
            <TabsTrigger value="owner"><Home className="h-4 w-4 mr-1" /> Owner View</TabsTrigger>
            <TabsTrigger value="tenant"><Receipt className="h-4 w-4 mr-1" /> Tenant View</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      {role === "owner" ? <OwnerView /> : <TenantView />}
    </DashboardShell>
  );
}
