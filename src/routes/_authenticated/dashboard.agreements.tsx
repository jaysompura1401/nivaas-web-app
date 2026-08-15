import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { agreements as agreementsApi, type ApiAgreement } from "@/lib/api";
import { FileText, Download, Eye, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/agreements")({
  head: () => ({ meta: [{ title: "Digital Agreements — Nivaas" }] }),
  component: Agreements,
});

const STATUS_COLORS: Record<string, string> = {
  draft:      "bg-gray-100 text-gray-600",
  sent:       "bg-blue-100 text-blue-700",
  signed:     "bg-primary/10 text-primary",
  active:     "bg-primary/10 text-primary",
  expired:    "bg-amber-100 text-amber-700",
  terminated: "bg-destructive/10 text-destructive",
};

function Agreements() {
  const [items, setItems]   = useState<ApiAgreement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    agreementsApi.list()
      .then(data => setItems(data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardShell title="Digital Agreements" subtitle="Auto-generated with e-Stamp & digital signature">
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-8 border-dashed border-border/60 text-center bg-gradient-card">
          <FileText className="h-10 w-10 text-primary mx-auto" />
          <h3 className="mt-3 font-display font-bold">No agreements yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create rental, leave & license, or sale agreements with digital signature and e-Stamp.
          </p>
          <Button variant="hero" className="mt-5">Start new agreement</Button>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {items.map(ag => (
              <Card key={ag.id} className="p-5 border-border/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-primary/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <Badge className={STATUS_COLORS[ag.status] ?? "bg-muted"}>{ag.status}</Badge>
                </div>
                <h3 className="mt-4 font-display font-semibold leading-tight">
                  {ag.property_title || "Property"} — {ag.city || ""}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">{ag.tenant_name || ag.tenant_id}</p>
                <p className="text-xs text-muted-foreground">
                  {ag.start_date} → {ag.end_date}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Eye className="h-3 w-3 mr-1" /> View
                  </Button>
                  {ag.document_url && (
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <a href={ag.document_url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-3 w-3 mr-1" /> PDF
                      </a>
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <Card className="mt-8 p-8 border-dashed border-border/60 text-center bg-gradient-card">
            <FileText className="h-10 w-10 text-primary mx-auto" />
            <h3 className="mt-3 font-display font-bold">Create a new agreement</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Generate rental, leave & license or sale agreements with digital signature and e-Stamp.
            </p>
            <Button variant="hero" className="mt-5">Start new agreement</Button>
          </Card>
        </>
      )}
    </DashboardShell>
  );
}
