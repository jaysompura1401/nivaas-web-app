import { createFileRoute, redirect } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  admin as adminApi, complaints as complaintsApi,
  type AdminStats, type ApiUser, type ApiComplaint, type ApiProperty, type ApiAuditLog,
  type ComplaintStatus,
} from "@/lib/api";
import { formatINR } from "@/lib/mock-properties";
import {
  Users, Building2, ShieldAlert, BarChart3, CheckCircle2, XCircle,
  Clock, Loader2, AlertTriangle, FileSearch,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchProfile } from "@/lib/auth-cache";

export const Route = createFileRoute("/_authenticated/dashboard/admin")({
  head: () => ({ meta: [{ title: "Admin Console — Nivaas" }] }),
  beforeLoad: async () => {
    const p = await fetchProfile();
    if (p && !["admin", "verification_team"].includes(p.role)) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminConsole,
});

// ─── Stats Overview ───────────────────────────────────────────────────────────
function StatsOverview({ stats }: { stats: AdminStats | null }) {
  if (!stats) return null;
  const cards = [
    { label: "Total Users",       value: stats.users?.total ?? 0,               icon: Users },
    { label: "Properties",        value: stats.properties?.total ?? 0,           icon: Building2 },
    { label: "Active Agreements", value: stats.agreements?.active ?? 0,          icon: CheckCircle2 },
    { label: "Open Complaints",   value: stats.complaints?.open ?? 0,            icon: AlertTriangle, cls: "text-destructive" },
    { label: "Pending Visits",    value: stats.visits?.pending ?? 0,             icon: Clock },
    { label: "Total Revenue",     value: formatINR(stats.revenue?.total_collected ?? 0), icon: BarChart3 },
  ];
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
      {cards.map(c => (
        <Card key={c.label} className="p-5 border-border/60">
          <c.icon className="h-5 w-5 text-muted-foreground mb-2" />
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
          <p className={`mt-1 text-xl font-bold ${c.cls ?? ""}`}>{c.value}</p>
        </Card>
      ))}
    </div>
  );
}

// ─── User Management ──────────────────────────────────────────────────────────
function UserManagement() {
  const [users, setUsers]     = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const load = () => {
    setLoading(true);
    adminApi.users({ q: q || undefined, role: roleFilter || undefined })
      .then(r => setUsers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const updateRole = async (id: string, role: string) => {
    try {
      await adminApi.updateUser(id, { role });
      toast.success("Role updated");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const toggleVerified = async (id: string, current: number) => {
    try {
      await adminApi.updateUser(id, { is_verified: !current });
      toast.success("Verification status updated");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap">
        <Input placeholder="Search name or email…" value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === "Enter" && load()} className="max-w-xs" />
        <Select value={roleFilter} onValueChange={v => { setRoleFilter(v === "all" ? "" : v); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {["customer","owner","admin","agent","verification_team"].map(r => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load}>Search</Button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card className="border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>KYC</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={v => updateRole(u.id, v)}>
                      <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["customer","owner","admin","agent","verification_team"].map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge className="text-xs">{(u as any).kyc_status ?? "none"}</Badge>
                  </TableCell>
                  <TableCell>
                    {u.is_verified ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost"
                      onClick={() => toggleVerified(u.id, u.is_verified as number)}>
                      {u.is_verified ? "Unverify" : "Verify"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ─── Property Approvals ───────────────────────────────────────────────────────
function PropertyApprovals() {
  const [props, setProps]     = useState<ApiProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [vsFilter, setVsFilter]         = useState("pending");

  const load = () => {
    setLoading(true);
    adminApi.properties({ status: statusFilter || undefined, verification_status: vsFilter || undefined })
      .then(r => setProps(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const updateProp = async (id: string, body: any) => {
    try {
      await adminApi.updateProperty(id, body);
      toast.success("Property updated");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap">
        <Select value={vsFilter} onValueChange={v => setVsFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Verification Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {["unverified","pending","verified","rejected"].map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {["draft","pending_review","active","inactive","rented"].map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load}>Filter</Button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card className="border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium max-w-48 truncate">{p.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{(p as any).owner_name}</TableCell>
                  <TableCell>{p.city}</TableCell>
                  <TableCell>
                    <Badge className="text-xs">{p.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${p.verified ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {(p as any).verification_status ?? (p.verified ? "verified" : "unverified")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="text-xs h-7"
                        onClick={() => updateProp(p.id, { verification_status: "verified", verified: true })}>
                        Verify
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive"
                        onClick={() => updateProp(p.id, { status: "inactive" })}>
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ─── Complaint Management ─────────────────────────────────────────────────────
function ComplaintManagement() {
  const [items, setItems]     = useState<ApiComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("open");

  const load = () => {
    setLoading(true);
    adminApi.complaints({ status: statusFilter || undefined })
      .then(r => setItems(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const resolve = async (id: string, status: ComplaintStatus) => {
    try {
      await complaintsApi.updateStatus(id, status, status === "resolved" ? "Issue resolved by admin." : undefined);
      toast.success(`Complaint marked as ${status}`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v === "all" ? "" : v); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {["open","in_review","resolved","dismissed"].map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load}>Filter</Button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card className="border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Reporter</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium max-w-48 truncate">{c.subject}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.reporter_name}</TableCell>
                  <TableCell className="text-xs">{c.category.replace(/_/g, " ")}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${
                      c.status === "open" ? "bg-destructive/10 text-destructive" :
                      c.status === "resolved" ? "bg-primary/10 text-primary" :
                      "bg-muted text-muted-foreground"
                    }`}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("en-IN")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      {c.status !== "resolved" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => resolve(c.id, "resolved")}>
                          Resolve
                        </Button>
                      )}
                      {c.status !== "dismissed" && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                          onClick={() => resolve(c.id, "dismissed")}>
                          Dismiss
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────
function AuditLogs() {
  const [logs, setLogs]       = useState<ApiAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.auditLogs({ limit: 100 })
      .then(r => setLogs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return loading ? (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ) : (
    <Card className="border-border/60 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map(l => (
            <TableRow key={l.id}>
              <TableCell>
                <Badge className="text-xs bg-muted text-muted-foreground">{l.action}</Badge>
              </TableCell>
              <TableCell className="text-sm">
                <p>{l.actor_name ?? l.actor_id}</p>
                <p className="text-xs text-muted-foreground">{l.actor_role}</p>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {l.entity && `${l.entity} / ${l.entity_id?.slice(0, 8)}…`}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(l.created_at).toLocaleString("en-IN")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function AdminConsole() {
  const [stats, setStats]     = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.stats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardShell title="Admin Console" subtitle="Platform management, approvals and audit logs">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <StatsOverview stats={stats} />

          <Tabs defaultValue="users" className="mt-8">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="users">
                <Users className="h-4 w-4 mr-1" /> Users
              </TabsTrigger>
              <TabsTrigger value="properties">
                <Building2 className="h-4 w-4 mr-1" /> Properties
              </TabsTrigger>
              <TabsTrigger value="complaints">
                <ShieldAlert className="h-4 w-4 mr-1" /> Complaints
              </TabsTrigger>
              <TabsTrigger value="audit">
                <FileSearch className="h-4 w-4 mr-1" /> Audit Logs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users"      className="mt-6"><UserManagement /></TabsContent>
            <TabsContent value="properties" className="mt-6"><PropertyApprovals /></TabsContent>
            <TabsContent value="complaints" className="mt-6"><ComplaintManagement /></TabsContent>
            <TabsContent value="audit"      className="mt-6"><AuditLogs /></TabsContent>
          </Tabs>
        </>
      )}
    </DashboardShell>
  );
}
