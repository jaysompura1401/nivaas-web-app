import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  complaints as complaintsApi,
  type ApiComplaint,
  type ComplaintCategory,
  type ComplaintStatus,
} from "@/lib/api";
import {
  AlertTriangle, CheckCircle2, Clock, Eye, Plus, Loader2, ShieldAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/complaints")({
  head: () => ({ meta: [{ title: "Complaints — Nivaas" }] }),
  component: Complaints,
});

const CATEGORIES: { value: ComplaintCategory; label: string }[] = [
  { value: "fake_listing",        label: "Fake Listing" },
  { value: "fraud",               label: "Fraud" },
  { value: "wrong_information",   label: "Wrong Information" },
  { value: "owner_misbehavior",   label: "Owner Misbehavior" },
  { value: "payment_issue",       label: "Payment Issue" },
  { value: "other",               label: "Other" },
];

const statusConfig: Record<ComplaintStatus, { label: string; cls: string; icon: any }> = {
  open:       { label: "Open",       cls: "bg-destructive/10 text-destructive",           icon: AlertTriangle },
  in_review:  { label: "In Review",  cls: "bg-yellow-100 text-yellow-800",                icon: Clock },
  resolved:   { label: "Resolved",   cls: "bg-primary/10 text-primary",                   icon: CheckCircle2 },
  dismissed:  { label: "Dismissed",  cls: "bg-muted text-muted-foreground",               icon: ShieldAlert },
};

function NewComplaintDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen]         = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({
    subject: "", description: "", category: "other" as ComplaintCategory,
    property_id: "",
  });

  const handleSubmit = async () => {
    if (!form.subject.trim() || !form.description.trim()) {
      toast.error("Subject and description are required");
      return;
    }
    setSaving(true);
    try {
      await complaintsApi.create({
        subject: form.subject,
        description: form.description,
        category: form.category,
        property_id: form.property_id || undefined,
      });
      toast.success("Complaint submitted successfully");
      setOpen(false);
      setForm({ subject: "", description: "", category: "other", property_id: "" });
      onCreated();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="hero" size="sm">
          <Plus className="h-4 w-4 mr-1" /> Raise Complaint
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Raise a Complaint</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Category</Label>
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as ComplaintCategory }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subject</Label>
            <Input placeholder="Brief subject of the complaint" value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
          </div>
          <div>
            <Label>Property ID (optional)</Label>
            <Input placeholder="Paste property ID if reporting a listing" value={form.property_id}
              onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={5} placeholder="Describe the issue in detail..."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Submit Complaint
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ComplaintRow({ c }: { c: ApiComplaint }) {
  const s = statusConfig[c.status] ?? statusConfig.open;
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 items-start gap-3 p-5 hover:bg-muted/30 transition-colors">
      <div className="md:col-span-2">
        <p className="font-semibold text-sm">{c.subject}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {CATEGORIES.find(x => x.value === c.category)?.label} ·{" "}
          {new Date(c.created_at).toLocaleDateString("en-IN")}
        </p>
        {c.property_title && (
          <p className="text-xs text-muted-foreground mt-0.5">Property: {c.property_title}</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground line-clamp-3 md:col-span-2">
        {c.description}
      </p>
      <div className="flex items-center justify-end">
        <Badge className={`${s.cls} gap-1`}>
          <s.icon className="h-3 w-3" /> {s.label}
        </Badge>
      </div>
      {c.admin_notes && (
        <div className="md:col-span-5 bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
          <strong>Admin note:</strong> {c.admin_notes}
        </div>
      )}
    </div>
  );
}

function Complaints() {
  const [rows, setRows]     = useState<ApiComplaint[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    complaintsApi.list()
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const stats = [
    { label: "Total",     count: rows.length,                                             cls: "text-foreground" },
    { label: "Open",      count: rows.filter(r => r.status === "open").length,            cls: "text-destructive" },
    { label: "In Review", count: rows.filter(r => r.status === "in_review").length,       cls: "text-yellow-600" },
    { label: "Resolved",  count: rows.filter(r => r.status === "resolved").length,        cls: "text-primary" },
  ];

  return (
    <DashboardShell
      title="Complaints"
      subtitle="Raise and track complaints about listings, owners, or payments"
      action={<NewComplaintDialog onCreated={load} />}
    >
      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {stats.map(s => (
          <Card key={s.label} className="p-5 border-border/60">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className={`mt-2 text-3xl font-bold ${s.cls}`}>{s.count}</p>
          </Card>
        ))}
      </div>

      {/* List */}
      <Card className="mt-6 border-border/60 overflow-hidden">
        <div className="p-5 border-b border-border/60">
          <h2 className="font-display font-bold">Your Complaints</h2>
          <p className="text-xs text-muted-foreground">Track resolution status below</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No complaints filed yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {rows.map(c => <ComplaintRow key={c.id} c={c} />)}
          </div>
        )}
      </Card>
    </DashboardShell>
  );
}
