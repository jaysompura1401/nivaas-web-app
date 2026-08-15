import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { PropertyCard } from "@/components/site/PropertyCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { properties as propertiesApi, type ApiProperty } from "@/lib/api";
import { cities, propertyTypes } from "@/lib/mock-properties";
import { Search, SlidersHorizontal, MapPin, Loader2, X, Map } from "lucide-react";

export const Route = createFileRoute("/properties/")({
  head: () => ({
    meta: [
      { title: "Browse Properties — Nivaas" },
      { name: "description", content: "Search verified rentals, homes for sale and PGs across Gujarat." },
    ],
  }),
  component: PropertiesList,
});

// ─── helpers ─────────────────────────────────────────────────────────────────
function parseSearch(raw: string) {
  const p = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  return {
    q:              p.get("q")              ?? "",
    city:           p.get("city")           ?? "All",
    listing_type:   p.get("listing_type")   ?? "all",
    property_type:  p.get("property_type")  ?? "All",
    max_price:      p.has("max_price") ? Number(p.get("max_price")) : 50_000_000,
    furnished:      p.get("furnished")      === "true",
    available_from: p.get("available_from") ?? "",
  };
}

function buildSearch(state: ReturnType<typeof parseSearch>): string {
  const p = new URLSearchParams();
  if (state.q)                           p.set("q",              state.q);
  if (state.city          !== "All")     p.set("city",           state.city);
  if (state.listing_type  !== "all")     p.set("listing_type",   state.listing_type);
  if (state.property_type !== "All")     p.set("property_type",  state.property_type);
  if (state.max_price     < 50_000_000)  p.set("max_price",      String(state.max_price));
  if (state.furnished)                   p.set("furnished",      "true");
  if (state.available_from)              p.set("available_from", state.available_from);
  const s = p.toString();
  return s ? `?${s}` : "";
}

// ─── component ───────────────────────────────────────────────────────────────
function PropertiesList() {
  const routerState = useRouterState();
  // TanStack Router's location.search is a parsed object — use searchStr for the raw string
  const locationSearchStr = routerState.location.searchStr as string | undefined;
  // Fall back to window.location.search so it works on first SSR-free render too
  const rawSearch = locationSearchStr ?? (typeof window !== "undefined" ? window.location.search : "");

  // Initialise state from URL — so navbar tabs & external links work on first load
  const [filters, setFilters] = useState(() => parseSearch(rawSearch));
  const [allProps, setAllProps] = useState<ApiProperty[]>([]);
  const [loading, setLoading]  = useState(true);

  // When the URL search string changes externally (e.g. Navbar tab click),
  // re-sync the filter state from the URL
  useEffect(() => {
    setFilters(parseSearch(rawSearch));
  }, [rawSearch]);

  // Helper that updates a single filter key, syncs to URL immediately
  const updateFilter = useCallback(<K extends keyof ReturnType<typeof parseSearch>>(
    key: K,
    value: ReturnType<typeof parseSearch>[K],
  ) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      const search = buildSearch(next);
      // Update the browser URL without a full navigation/re-render cycle
      window.history.replaceState(null, "", `/properties${search}`);
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    const blank = parseSearch("");
    setFilters(blank);
    window.history.replaceState(null, "", "/properties");
  }, []);

  // Fetch properties whenever filters change (debounced 350 ms)
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      propertiesApi.list({
        city:          filters.city          !== "All" ? filters.city          : undefined,
        listing_type:  filters.listing_type  !== "all" ? filters.listing_type  : undefined,
        property_type: filters.property_type !== "All" ? filters.property_type : undefined,
        max_price:     filters.max_price      < 50_000_000 ? filters.max_price : undefined,
        furnished:     filters.furnished      ? "Fully Furnished"               : undefined,
        q:             filters.q              || undefined,
        limit:         500,
      })
        .then(res => setAllProps(res.data))
        .catch(() => setAllProps([]))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [filters]);

  // Active filter chips (for dismissable display)
  const activeChips: { label: string; clear: () => void }[] = [];
  if (filters.property_type !== "All")    activeChips.push({ label: filters.property_type,  clear: () => updateFilter("property_type", "All") });
  if (filters.listing_type  !== "all")    activeChips.push({ label: filters.listing_type.toUpperCase(), clear: () => updateFilter("listing_type", "all") });
  if (filters.city          !== "All")    activeChips.push({ label: filters.city,            clear: () => updateFilter("city", "All") });
  if (filters.furnished)                  activeChips.push({ label: "Furnished",             clear: () => updateFilter("furnished", false) });
  if (filters.q)                          activeChips.push({ label: `"${filters.q}"`,        clear: () => updateFilter("q", "") });
  if (filters.available_from)             activeChips.push({ label: `From ${filters.available_from}`, clear: () => updateFilter("available_from", "") });

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* ── Hero search bar ──────────────────────────────────────────────── */}
      <section className="bg-gradient-hero text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <h1 className="font-display text-3xl sm:text-4xl font-bold">Browse Properties</h1>
          <p className="mt-2 text-white/85">
            {filters.property_type !== "All"
              ? `${filters.property_type}s across Gujarat`
              : "Verified rentals, homes for sale and premium PGs across Gujarat."}
          </p>

          <div className="mt-6 rounded-2xl bg-white/95 backdrop-blur p-2 flex flex-col md:flex-row gap-2 shadow-elegant">
            {/* City + keyword */}
            <div className="flex items-center gap-2 px-3 flex-1 min-w-0">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <select
                value={filters.city}
                onChange={e => updateFilter("city", e.target.value)}
                className="bg-transparent text-sm font-medium py-3 outline-none pr-2 text-foreground"
              >
                <option value="All">All Cities</option>
                {cities.map(c => <option key={c}>{c}</option>)}
              </select>
              <div className="h-6 w-px bg-border" />
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={filters.q}
                onChange={e => updateFilter("q", e.target.value)}
                placeholder="Search title, locality…"
                className="border-0 shadow-none focus-visible:ring-0 bg-transparent"
              />
            </div>

            {/* Rent / Buy / PG toggle */}
            <div className="flex gap-1 p-1 bg-secondary rounded-lg shrink-0">
              {[["all","All"],["rent","Rent"],["sale","Buy"],["pg","PG"]] .map(([v,l]) => (
                <button
                  key={v}
                  onClick={() => updateFilter("listing_type", v)}
                  className={`px-3 py-2 rounded-md text-xs font-medium transition ${
                    filters.listing_type === v
                      ? "bg-white text-primary shadow-sm"
                      : "text-secondary-foreground/70 hover:text-primary"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 grid gap-8 lg:grid-cols-[280px_1fr]">

        {/* ── Sidebar filters ─────────────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5 border-border/60">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <h3 className="font-display font-semibold">Filters</h3>
              </div>
              {activeChips.length > 0 && (
                <button onClick={resetFilters} className="text-xs text-destructive hover:underline">
                  Reset all
                </button>
              )}
            </div>

            {/* Property type */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Property type
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["All", ...propertyTypes].map(t => (
                  <button
                    key={t}
                    onClick={() => updateFilter("property_type", t)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition ${
                      filters.property_type === t
                        ? "bg-gradient-primary text-white border-transparent shadow-sm"
                        : "bg-white border-border text-foreground/70 hover:border-primary/50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Price slider */}
            <div className="mt-5">
              <div className="flex justify-between text-xs mb-3">
                <span className="font-medium text-muted-foreground uppercase tracking-wide">Max price</span>
                <span className="font-semibold text-primary">
                  ₹{filters.max_price.toLocaleString("en-IN")}
                </span>
              </div>
              <Slider
                min={5_000}
                max={50_000_000}
                step={5_000}
                value={[filters.max_price]}
                onValueChange={([v]) => updateFilter("max_price", v)}
              />
            </div>

            {/* Furnished toggle */}
            <div className="mt-5 flex items-center gap-2">
              <Checkbox
                id="fur"
                checked={filters.furnished}
                onCheckedChange={v => updateFilter("furnished", !!v)}
              />
              <label htmlFor="fur" className="text-sm cursor-pointer">Fully furnished only</label>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full mt-6"
              onClick={resetFilters}
            >
              Reset filters
            </Button>
          </Card>
        </aside>

        {/* ── Results ──────────────────────────────────────────────────────── */}
        <div>
          {/* Active filter chips */}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {activeChips.map(chip => (
                <Badge
                  key={chip.label}
                  className="gap-1.5 bg-primary/10 text-primary border border-primary/20 pr-1.5 cursor-pointer"
                  onClick={chip.clear}
                >
                  {chip.label}
                  <X className="h-3 w-3" />
                </Badge>
              ))}
            </div>
          )}

          {/* Result count */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {loading ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                </span>
              ) : (
                <>
                  <span className="font-semibold text-foreground">{allProps.length}</span> properties found
                  {filters.property_type !== "All" && (
                    <span className="ml-1 text-muted-foreground">· {filters.property_type}</span>
                  )}
                </>
              )}
            </p>
            <div className="flex items-center gap-2">
              {/* Map view toggle */}
              <button
                onClick={() => {
                  // Carry current filters into the map URL
                  const qs = buildSearch(filters).replace("?", "");
                  const mapQs = qs
                    .split("&")
                    .filter(p => p && !p.startsWith("available_from"))
                    .join("&");
                  window.location.href = `/properties/map${mapQs ? `?${mapQs}` : ""}`;
                }}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[#fef3d4]"
                style={{ borderColor: "#e8d9c0", color: "#836737", backgroundColor: "#fff" }}
              >
                <Map className="h-3.5 w-3.5" style={{ color: "#C9921A" }} />
                Map view
              </button>
              <Badge variant="secondary">Newest first</Badge>
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-muted/40 animate-pulse h-64" />
              ))}
            </div>
          ) : allProps.length === 0 ? (
            <Card className="p-12 text-center border-dashed border-border/60">
              <Search className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-display font-semibold">No properties found</p>
              <p className="text-sm text-muted-foreground mt-1">Try widening your filters.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>
                Clear filters
              </Button>
            </Card>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {allProps.map(p => <PropertyCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
