import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PropertyCard } from "@/components/site/PropertyCard";
import { saved as savedApi, type ApiProperty } from "@/lib/api";
import { useEffect, useState } from "react";
import { Loader2, Heart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/saved")({
  head: () => ({ meta: [{ title: "Saved Properties — Nivaas" }] }),
  component: Saved,
});

function Saved() {
  const [props, setProps]   = useState<ApiProperty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    savedApi.list()
      .then(data => setProps(data))
      .catch(() => setProps([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardShell title="Saved Properties" subtitle="Homes you've bookmarked for later">
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : props.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 py-20 text-center">
          <Heart className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="font-semibold">No saved properties yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Browse properties and tap the heart icon to save them here.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {props.map(p => <PropertyCard key={p.id} p={p} />)}
        </div>
      )}
    </DashboardShell>
  );
}
