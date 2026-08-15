import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { properties as propertiesApi, type ApiProperty } from "@/lib/api";
import { formatINR } from "@/lib/mock-properties";
import { cn } from "@/lib/utils";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus, Building2, MoreVertical, Trash2, Eye, EyeOff, Loader2, RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/properties/")({
  head: () => ({ meta: [{ title: "My Properties — Nivaas" }] }),
  component: MyProperties,
});

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    active:         { label: "Active",         className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    inactive:       { label: "Inactive",       className: "bg-slate-100 text-slate-600 border-slate-200" },
    rented:         { label: "Rented",         className: "bg-blue-100 text-blue-700 border-blue-200" },
    pending_review: { label: "Pending review", className: "bg-amber-100 text-amber-700 border-amber-200" },
    draft:          { label: "Draft",          className: "bg-gray-100 text-gray-600 border-gray-200" },
  };
  return map[status] ?? { label: status, className: "bg-muted text-muted-foreground border-border" };
}

function MyProperties() {
  const [props, setProps]       = useState<ApiProperty[]>([]);
  const [loading, setLoading]   = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    propertiesApi.mine()
      .then(data => setProps(data))
      .catch(() => toast.error("Could not load properties"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await propertiesApi.delete(id);
      toast.success("Property deleted.");
      setProps(prev => prev.filter(p => p.id !== id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (p: ApiProperty) => {
    const next = p.status === "active" ? "inactive" : "active";
    setTogglingId(p.id);
    try {
      await propertiesApi.update(p.id, { status: next });
      toast.success(`Listing ${next === "active" ? "activated" : "deactivated"}.`);
      setProps(prev => prev.map(x => x.id === p.id ? { ...x, status: next } : x));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <DashboardShell
      title="My Properties"
      subtitle={loading ? "Loading…" : `${props.length} listing${props.length !== 1 ? "s" : ""}`}
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={load} disabled={loading} aria-label="Refresh">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button asChild variant="hero">
            <Link to="/dashboard/properties/new"><Plus className="h-4 w-4 mr-1" />Post property</Link>
          </Button>
        </div>
      }>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : props.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 py-20 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="font-semibold">No properties yet</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs">Post your first listing and start getting inquiries.</p>
          <Button asChild variant="hero" className="mt-5">
            <Link to="/dashboard/properties/new"><Plus className="h-4 w-4 mr-1" />Post property</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {props.map(p => {
            const badge = statusBadge(p.status);
            const cover = (p.images && p.images[0]) ?? p.cover_image_url;
            const meta = [p.bedrooms ? `${p.bedrooms} BHK` : null, p.area_sqft ? `${p.area_sqft} sq ft` : null, p.furnished].filter(Boolean);

            return (
              <div key={p.id} className="flex items-center gap-4 rounded-xl border border-border/60 bg-white px-4 py-3 shadow-sm hover:shadow-md transition">
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {cover ? (
                    <img src={cover} alt={p.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                      <Building2 className="h-6 w-6" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="font-semibold text-sm line-clamp-1">{p.title}</p>
                    {!!p.verified && (
                      <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 py-0">
                        Verified
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[p.locality, p.city].filter(Boolean).join(", ")}
                    {meta.length > 0 && <> · {meta.join(" · ")}</>}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-amber-600">
                      {formatINR(p.price)}
                      {p.listing_type !== "sale" && <span className="text-[11px] font-normal text-muted-foreground">/mo</span>}
                    </span>
                    <span className="text-muted-foreground/40 text-xs">·</span>
                    <span className="text-xs capitalize text-muted-foreground">{p.property_type} · {p.listing_type}</span>
                    <Badge variant="outline" className={cn("text-[10px] py-0 capitalize", badge.className)}>
                      {badge.label}
                    </Badge>
                  </div>
                </div>

                <AlertDialog>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem asChild>
                        <Link to="/properties/$id" params={{ id: p.id }} className="flex items-center gap-2">
                          <Eye className="h-3.5 w-3.5" /> View listing
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleStatus(p)} disabled={togglingId === p.id} className="flex items-center gap-2">
                        {togglingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : p.status === "active" ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        {p.status === "active" ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem className="flex items-center gap-2 text-destructive focus:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
                      <AlertDialogDescription><strong>{p.title}</strong> will be permanently removed.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {deletingId === p.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                        {deletingId === p.id ? "Deleting…" : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
