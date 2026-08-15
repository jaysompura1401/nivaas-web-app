/**
 * /properties/map  — Airbnb-style split-screen map search (scratch rewrite v3)
 *
 * Architecture:
 *   [Navbar]
 *   [Filter bar — sticky]
 *   Desktop ≥ 1024px: [LEFT: scrollable list | RIGHT: sticky map]
 *   Tablet/Mobile:    toggle between List view and Map view
 *
 * Data-fetch strategy (fixes blank map / 0-results bug):
 *   1. On mount / filter change → fetch ALL active properties that have coords.
 *      No bounding-box filter on the first load, so the list is never empty
 *      just because the map hasn't reported its viewport yet.
 *   2. Once the map fires its first "bounds changed" event the user sees a
 *      floating "Search this area" button.
 *   3. Clicking that button (or waiting 2s after panning) re-fetches with
 *      the current viewport bounding box.
 *
 * Location contract:
 *   Only properties whose latitude AND longitude are set in the DB are shown
 *   on the map (has_coords=true). Locality/city are display-only text labels.
 */

import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Navbar } from "@/components/site/Navbar";
import {
  PropertyMap,
  type MapBounds,
  type PropertyMapHandle,
} from "@/components/site/PropertyMap";
import {
  properties as propertiesApi,
  type ApiProperty,
  type PropertyFilters,
} from "@/lib/api";
import { formatINR } from "@/lib/mock-properties";
import {
  Heart,
  Maximize2,
  SlidersHorizontal,
  X,
  Search,
  MapPin,
  Loader2,
  RotateCcw,
  BedDouble,
  Bath,
  Star,
} from "lucide-react";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/properties/map")({
  head: () => ({
    meta: [
      { title: "Map Search — Nivaas" },
      {
        name: "description",
        content:
          "Search properties on an interactive map across Gujarat.",
      },
    ],
  }),
  component: MapSearchPage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const GOLD = "#C9921A";
const BG = "#FAF6EE";
const PLACEHOLDER =
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&auto=format&fit=crop&q=80";
const PAGE_SIZE = 20;

const LISTING_TYPES = [
  { value: "all", label: "All" },
  { value: "rent", label: "Rent" },
  { value: "sale", label: "Buy" },
  { value: "pg", label: "PG" },
];

const PROPERTY_TYPES = [
  "All",
  "Apartment",
  "Villa",
  "PG",
  "Office Space",
  "Plot",
];

// ─── Filter state helpers ─────────────────────────────────────────────────────

interface FilterState {
  q: string;
  city: string;
  listing_type: string;
  property_type: string;
  min_price: number;
  max_price: number;
  furnished: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  q: "",
  city: "",
  listing_type: "all",
  property_type: "All",
  min_price: 0,
  max_price: 50_000_000,
  furnished: false,
};

function parseFilters(raw: string): FilterState {
  const p = new URLSearchParams(
    raw.startsWith("?") ? raw.slice(1) : raw
  );
  return {
    q: p.get("q") ?? "",
    city: p.get("city") ?? "",
    listing_type: p.get("listing_type") ?? "all",
    property_type: p.get("property_type") ?? "All",
    min_price: p.has("min_price") ? Number(p.get("min_price")) : 0,
    max_price: p.has("max_price")
      ? Number(p.get("max_price"))
      : 50_000_000,
    furnished: p.get("furnished") === "true",
  };
}

function filtersToQs(f: FilterState): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.city) p.set("city", f.city);
  if (f.listing_type !== "all") p.set("listing_type", f.listing_type);
  if (f.property_type !== "All") p.set("property_type", f.property_type);
  if (f.min_price > 0) p.set("min_price", String(f.min_price));
  if (f.max_price < 50_000_000) p.set("max_price", String(f.max_price));
  if (f.furnished) p.set("furnished", "true");
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

function hasActiveFilters(f: FilterState): boolean {
  return (
    f.listing_type !== "all" ||
    f.property_type !== "All" ||
    f.furnished ||
    !!f.q ||
    !!f.city ||
    f.min_price > 0 ||
    f.max_price < 50_000_000
  );
}

// ─── Property card (list panel) ───────────────────────────────────────────────

function MapPropertyCard({
  p,
  isHovered,
  isSelected,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  p: ApiProperty;
  isHovered: boolean;
  isSelected: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  const img =
    (p.images && p.images[0]) ?? p.cover_image_url ?? PLACEHOLDER;
  const highlighted = isHovered || isSelected;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{
        borderRadius: 14,
        overflow: "hidden",
        border: `1.5px solid ${highlighted ? GOLD : "#e8d9c0"}`,
        background: "#fff",
        cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s",
        boxShadow: highlighted
          ? "0 4px 18px rgba(201,146,26,0.18)"
          : "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      <Link
        to="/properties/$id"
        params={{ id: p.id }}
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        <div
          style={{
            position: "relative",
            height: 140,
            background: "#f0e4cc",
            overflow: "hidden",
          }}
        >
          <img
            src={img}
            alt={p.title}
            onError={(e) => {
              (e.target as HTMLImageElement).src = PLACEHOLDER;
            }}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 0.3s",
            }}
          />
          {/* Listing type badge */}
          <span
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background:
                p.listing_type === "rent"
                  ? "#1a1209"
                  : p.listing_type === "sale"
                  ? GOLD
                  : "#6b4f2a",
              color: "#fff",
              borderRadius: 999,
              padding: "2px 8px",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            {p.listing_type === "sale"
              ? "Buy"
              : p.listing_type === "pg"
              ? "PG"
              : "Rent"}
          </span>
          {/* Save button placeholder */}
          <button
            onClick={(e) => e.preventDefault()}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: "rgba(255,255,255,0.85)",
              border: "none",
              borderRadius: "50%",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              backdropFilter: "blur(4px)",
            }}
          >
            <Heart style={{ width: 13, height: 13, color: "#836737" }} />
          </button>
        </div>

        {/* Info */}
        <div style={{ padding: "10px 12px 12px" }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 700,
              color: "#1a1209",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {p.title}
          </p>
          <p
            style={{
              margin: "3px 0 6px",
              fontSize: 11,
              color: "#a08858",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            <MapPin
              style={{
                display: "inline",
                width: 10,
                height: 10,
                marginRight: 2,
              }}
            />
            {[p.locality, p.city].filter(Boolean).join(", ")}
          </p>

          {/* Stats */}
          <div
            style={{
              display: "flex",
              gap: 10,
              fontSize: 11,
              color: "#836737",
              marginBottom: 7,
            }}
          >
            {p.bedrooms != null && p.bedrooms > 0 && (
              <span
                style={{ display: "flex", alignItems: "center", gap: 3 }}
              >
                <BedDouble style={{ width: 10, height: 10 }} />
                {p.bedrooms} bd
              </span>
            )}
            {p.bathrooms != null && p.bathrooms > 0 && (
              <span
                style={{ display: "flex", alignItems: "center", gap: 3 }}
              >
                <Bath style={{ width: 10, height: 10 }} />
                {p.bathrooms} ba
              </span>
            )}
            {p.area_sqft != null && p.area_sqft > 0 && (
              <span
                style={{ display: "flex", alignItems: "center", gap: 3 }}
              >
                <Maximize2 style={{ width: 10, height: 10 }} />
                {p.area_sqft} ft²
              </span>
            )}
          </div>

          {/* Price */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{ fontSize: 14, fontWeight: 800, color: "#1a1209" }}
            >
              {formatINR(p.price)}
              {p.listing_type !== "sale" && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 400,
                    color: "#a08858",
                  }}
                >
                  /mo
                </span>
              )}
            </span>
            {p.avg_rating != null && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 11,
                  color: "#1a1209",
                  fontWeight: 600,
                }}
              >
                <Star
                  style={{
                    width: 11,
                    height: 11,
                    fill: GOLD,
                    color: GOLD,
                  }}
                />
                {Number(p.avg_rating).toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  filters,
  onChange,
  onReset,
  totalCount,
  loading,
}: {
  filters: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  onReset: () => void;
  totalCount: number;
  loading: boolean;
}) {
  const [showSearch, setShowSearch] = useState(false);
  const hasActive = hasActiveFilters(filters);

  return (
    <div
      style={{
        position: "sticky",
        top: 60,
        zIndex: 30,
        background: BG,
        borderBottom: "1px solid #e8d9c0",
        padding: "8px 16px",
      }}
    >
      <div style={{ maxWidth: 1600, margin: "0 auto" }}>

        {/* Row 1 — summary info + search icon */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>

          {/* Location */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <MapPin style={{ width: 14, height: 14, color: GOLD, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1209", whiteSpace: "nowrap" }}>
              {filters.city || "Homes in map area"}
            </span>
          </div>

          {/* Divider */}
          <span style={{ color: "#e8d9c0", fontSize: 18 }}>|</span>

          {/* Result count */}
          <span style={{ fontSize: 13, color: "#836737", whiteSpace: "nowrap" }}>
            {loading ? "Loading…" : `${totalCount} home${totalCount !== 1 ? "s" : ""}`}
          </span>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Search icon button */}
          <button
            onClick={() => setShowSearch(v => !v)}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: showSearch ? "#1a1209" : GOLD,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 2px 8px rgba(201,146,26,0.3)",
              transition: "background 0.15s",
            }}
          >
            <Search style={{ width: 14, height: 14, color: "#fff" }} />
          </button>
        </div>

        {/* Search input (expandable) */}
        {showSearch && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#fff",
              borderRadius: 999,
              border: "1px solid #e8d9c0",
              padding: "7px 14px",
              marginBottom: 8,
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            <Search style={{ width: 14, height: 14, color: GOLD, flexShrink: 0 }} />
            <input
              autoFocus
              value={filters.q}
              onChange={(e) => onChange({ q: e.target.value })}
              placeholder="City, locality, or keyword…"
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 13,
                color: "#1a1209",
                width: "100%",
              }}
            />
            {filters.q && (
              <button
                onClick={() => onChange({ q: "" })}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
              >
                <X style={{ width: 12, height: 12, color: "#a08858" }} />
              </button>
            )}
          </div>
        )}

        {/* Row 2 — horizontal scrollable pill filters */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            overflowX: "auto",
            scrollbarWidth: "none",
            paddingBottom: 2,
          }}
        >
          {/* Filters icon pill */}
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              border: `1px solid ${hasActive ? GOLD : "#d4c4a0"}`,
              background: hasActive ? "#fef3d4" : "#fff",
              color: hasActive ? GOLD : "#5a3e1b",
              flexShrink: 0,
              whiteSpace: "nowrap",
              boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
            }}
            onClick={() => onChange({ listing_type: filters.listing_type === "all" ? "all" : "all" })}
            title="Reset listing type"
          >
            <SlidersHorizontal style={{ width: 12, height: 12 }} />
            Filters
            {hasActive && (
              <span style={{
                background: GOLD, color: "#fff", borderRadius: 999,
                padding: "0px 5px", fontSize: 9, fontWeight: 800,
              }}>
                {[
                  filters.listing_type !== "all",
                  filters.property_type !== "All",
                  filters.furnished,
                  !!filters.q,
                  !!filters.city,
                  filters.min_price > 0,
                  filters.max_price < 50_000_000,
                ].filter(Boolean).length}
              </span>
            )}
          </button>

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: "#e8d9c0", flexShrink: 0 }} />

          {/* Listing type pills */}
          {LISTING_TYPES.filter(lt => lt.value !== "all").map((lt) => (
            <button
              key={lt.value}
              onClick={() => onChange({ listing_type: filters.listing_type === lt.value ? "all" : lt.value })}
              style={{
                borderRadius: 999,
                padding: "6px 16px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                border: `1px solid ${filters.listing_type === lt.value ? "#1a1209" : "#d4c4a0"}`,
                background: filters.listing_type === lt.value ? "#1a1209" : "#fff",
                color: filters.listing_type === lt.value ? "#fff" : "#5a3e1b",
                flexShrink: 0,
                whiteSpace: "nowrap",
                transition: "all 0.15s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
              }}
            >
              {lt.label}
            </button>
          ))}

          {/* Property type pills */}
          {PROPERTY_TYPES.filter(pt => pt !== "All").map((pt) => (
            <button
              key={pt}
              onClick={() => onChange({ property_type: filters.property_type === pt ? "All" : pt })}
              style={{
                borderRadius: 999,
                padding: "6px 16px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                border: `1px solid ${filters.property_type === pt ? "#1a1209" : "#d4c4a0"}`,
                background: filters.property_type === pt ? "#1a1209" : "#fff",
                color: filters.property_type === pt ? "#fff" : "#5a3e1b",
                flexShrink: 0,
                whiteSpace: "nowrap",
                transition: "all 0.15s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
              }}
            >
              {pt}
            </button>
          ))}

          {/* Furnished pill */}
          <button
            onClick={() => onChange({ furnished: !filters.furnished })}
            style={{
              borderRadius: 999,
              padding: "6px 16px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              border: `1px solid ${filters.furnished ? GOLD : "#d4c4a0"}`,
              background: filters.furnished ? "#fef3d4" : "#fff",
              color: filters.furnished ? GOLD : "#5a3e1b",
              flexShrink: 0,
              whiteSpace: "nowrap",
              transition: "all 0.15s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
            }}
          >
            Fully Furnished
          </button>

          {/* Quick price pills */}
          {[
            { label: "< ₹20k/mo", val: 20_000 },
            { label: "< ₹50k/mo", val: 50_000 },
            { label: "< ₹1L/mo", val: 100_000 },
          ].map((b) => (
            <button
              key={b.val}
              onClick={() => onChange({ max_price: filters.max_price === b.val ? 50_000_000 : b.val })}
              style={{
                borderRadius: 999,
                padding: "6px 16px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                border: `1px solid ${filters.max_price === b.val ? GOLD : "#d4c4a0"}`,
                background: filters.max_price === b.val ? "#fef3d4" : "#fff",
                color: filters.max_price === b.val ? GOLD : "#5a3e1b",
                flexShrink: 0,
                whiteSpace: "nowrap",
                transition: "all 0.15s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
              }}
            >
              {b.label}
            </button>
          ))}

          {/* City chip */}
          {filters.city && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "#fef3d4",
                border: `1px solid ${GOLD}`,
                borderRadius: 999,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 700,
                color: GOLD,
                flexShrink: 0,
                whiteSpace: "nowrap",
                boxShadow: "0 1px 3px rgba(201,146,26,0.15)",
              }}
            >
              <MapPin style={{ width: 11, height: 11 }} />
              {filters.city}
              <button
                onClick={() => onChange({ city: "" })}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", marginLeft: 2 }}
              >
                <X style={{ width: 10, height: 10, color: GOLD }} />
              </button>
            </div>
          )}

          {/* Reset pill */}
          {hasActive && (
            <button
              onClick={onReset}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                borderRadius: 999,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid #e8d9c0",
                background: "#fff",
                color: "#a08858",
                flexShrink: 0,
                whiteSpace: "nowrap",
                boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
              }}
            >
              <RotateCcw style={{ width: 11, height: 11 }} /> Reset all
            </button>
          )}
        </div>
      </div>

      {/* Hide scrollbar on pill row */}
      <style>{`.filterbar-pills::-webkit-scrollbar{display:none}`}</style>
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

function MapSearchPage() {
  const routerState = useRouterState();
  const rawSearch =
    (routerState.location.searchStr as string | undefined) ??
    (typeof window !== "undefined" ? window.location.search : "");

  // ── Filter state ────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<FilterState>(() =>
    parseFilters(rawSearch)
  );

  // ── Property data ───────────────────────────────────────────────────────
  const [allProps, setAllProps] = useState<ApiProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // ── Map state ───────────────────────────────────────────────────────────
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  // pendingAreaSearch: show "Search this area" button after user pans
  const [pendingAreaSearch, setPendingAreaSearch] = useState(false);

  // ── Hover / selection ───────────────────────────────────────────────────
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showMobileCard, setShowMobileCard] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────
  const mapRef = useRef<PropertyMapHandle>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch helpers ───────────────────────────────────────────────────────

  /**
   * fetchProps — the single authoritative fetch function.
   *
   * @param currentFilters  current filter state
   * @param currentBounds   viewport bounding box (null = no bbox filter)
   * @param currentPage     0-indexed page number
   * @param append          true = append to existing list (infinite scroll)
   */
  const fetchProps = useCallback(
    (
      currentFilters: FilterState,
      currentBounds: MapBounds | null,
      currentPage: number,
      append = false
    ) => {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);

      fetchTimerRef.current = setTimeout(async () => {
        setLoading(true);
        setError(null);

        try {
          const apiFilters: PropertyFilters = {
            limit: PAGE_SIZE,
            offset: currentPage * PAGE_SIZE,
            sort: "newest",
          };

          if (currentFilters.q) apiFilters.q = currentFilters.q;
          if (currentFilters.city) apiFilters.city = currentFilters.city;
          if (currentFilters.listing_type !== "all")
            apiFilters.listing_type = currentFilters.listing_type;
          if (currentFilters.property_type !== "All")
            apiFilters.property_type = currentFilters.property_type;
          if (currentFilters.min_price > 0)
            apiFilters.min_price = currentFilters.min_price;
          if (currentFilters.max_price < 50_000_000)
            apiFilters.max_price = currentFilters.max_price;
          if (currentFilters.furnished)
            apiFilters.furnished = "Fully Furnished";

          // Map view: always request only properties with exact owner-provided coords.
          // This ensures no city-center-fallback or coordinate-less properties appear
          // as pins — every marker on the map is an exact owner-pinned location.
          apiFilters.has_coords = "true";

          if (currentBounds) {
            apiFilters.lat_min = currentBounds.lat_min;
            apiFilters.lat_max = currentBounds.lat_max;
            apiFilters.lng_min = currentBounds.lng_min;
            apiFilters.lng_max = currentBounds.lng_max;
          }

          const res = await propertiesApi.list(apiFilters);

          setTotalCount(res.count);
          setAllProps((prev) =>
            append ? [...prev, ...res.data] : res.data
          );
          setHasMore(res.data.length === PAGE_SIZE);
          setPendingAreaSearch(false);
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "Failed to load properties";
          console.error("[MapSearchPage] fetchProps error:", msg);
          setError(msg);
          if (!append) setAllProps([]);
          setHasMore(false);
        } finally {
          setLoading(false);
        }
      }, 300);
    },
    // intentionally stable — all dynamic values passed as arguments
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── Keep a ref to latest filters so callbacks never go stale ──────────
  // NOTE: filtersRef is updated synchronously inside setFilters/updateFilter
  // so that handleBoundsChange always reads the freshest filter values even
  // when it fires in the same tick as a filter state update.
  const filtersRef = useRef(filters);

  const boundsRef = useRef<MapBounds | null>(null);
  useEffect(() => { boundsRef.current = bounds; }, [bounds]);

  const boundsReadyRef = useRef(false);

  // ── Initial load + filter-change re-fetch ───────────────────────────────
  useEffect(() => {
    setPage(0);
    setAllProps([]);
    setHasMore(true);
    setPendingAreaSearch(false);
    // Cancel any pending bounds-triggered fetch so it doesn't overwrite us
    if (boundsTimerRef.current) {
      clearTimeout(boundsTimerRef.current);
      boundsTimerRef.current = null;
    }
    // Use current bounds if already known, otherwise fetch without bbox.
    // Do NOT reset boundsReadyRef — doing so would cause the map's next
    // moveend to trigger a competing 500ms re-fetch that overwrites results.
    const currentBounds = boundsReadyRef.current ? boundsRef.current : null;
    fetchProps(filters, currentBounds, 0, false);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Map bounds change handler ───────────────────────────────────────────
  const handleBoundsChange = useCallback((b: MapBounds) => {
    setBounds(b);
    boundsRef.current = b;

    if (!boundsReadyRef.current) {
      boundsReadyRef.current = true;
      if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
      boundsTimerRef.current = setTimeout(() => {
        setPage(0);
        setAllProps([]);
        fetchProps(filtersRef.current, b, 0, false);
      }, 500);
    } else {
      setPendingAreaSearch(true);
      if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
      boundsTimerRef.current = setTimeout(() => {
        setPage(0);
        setAllProps([]);
        fetchProps(filtersRef.current, b, 0, false);
      }, 2000);
    }
  }, [fetchProps]);

  // ── Manual "Search this area" ───────────────────────────────────────────
  const handleSearchArea = useCallback(() => {
    if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    const b = boundsRef.current;
    if (!b) return;
    setPage(0);
    setAllProps([]);
    setPendingAreaSearch(false);
    fetchProps(filtersRef.current, b, 0, false);
  }, [fetchProps]);

  // ── Infinite scroll ─────────────────────────────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchProps(filtersRef.current, boundsReadyRef.current ? boundsRef.current : null, nextPage, true);
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, page, fetchProps]);

  // ── Bidirectional hover sync ────────────────────────────────────────────
  // Card hovered → pan map to that marker
  const handleCardMouseEnter = useCallback(
    (p: ApiProperty) => {
      setHoveredId(p.id);
      if (p.latitude != null && p.longitude != null) {
        mapRef.current?.panTo(p.id);
      }
    },
    []
  );

  // Marker hovered → scroll card into view
  useEffect(() => {
    if (!hoveredId || !listRef.current) return;
    const el = cardRefs.current.get(hoveredId);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [hoveredId]);

  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const el = cardRefs.current.get(selectedId);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  // ── Marker events ───────────────────────────────────────────────────────
  const handleMarkerClick = useCallback((id: string | null) => {
    setSelectedId((prev) => (prev === id ? null : id));
    if (id) setShowMobileCard(true);
  }, []);

  const handleMarkerHover = useCallback((id: string | null) => {
    setHoveredId(id);
  }, []);

  // ── Filter helpers ──────────────────────────────────────────────────────
  const updateFilter = useCallback((patch: Partial<FilterState>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      // Sync ref immediately so handleBoundsChange uses the latest filters
      // even if it fires before the next render cycle completes.
      filtersRef.current = next;
      if (typeof window !== "undefined") {
        window.history.replaceState(
          null,
          "",
          `/properties/map${filtersToQs(next)}`
        );
      }
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    filtersRef.current = DEFAULT_FILTERS;
    setFilters(DEFAULT_FILTERS);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/properties/map");
    }
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────
  const selectedProp = useMemo(
    () =>
      selectedId ? allProps.find((p) => p.id === selectedId) ?? null : null,
    [selectedId, allProps]
  );

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: BG,
        fontFamily: "system-ui,-apple-system,sans-serif",
        overflow: "hidden",
      }}
    >
      <Navbar />

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onChange={updateFilter}
        onReset={resetFilters}
        totalCount={totalCount}
        loading={loading}
      />

      {/* Fullscreen map container */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>

        {/* Map fills the entire area */}
        <PropertyMap
          ref={mapRef}
          properties={allProps}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onMarkerClick={handleMarkerClick}
          onMarkerHover={handleMarkerHover}
          onBoundsChange={handleBoundsChange}
          defaultCenter={[23.02, 72.57]}
          defaultZoom={10}
          style={{ width: "100%", height: "100%" }}
        />

        {/* City label overlay — top left corner of map */}
        {filters.city && (
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              zIndex: 900,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.95)",
              border: "1px solid #e8d9c0",
              borderRadius: 999,
              padding: "7px 14px",
              fontSize: 13,
              fontWeight: 700,
              color: "#1a1209",
              boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
              backdropFilter: "blur(6px)",
            }}
          >
            <MapPin style={{ width: 13, height: 13, color: GOLD }} />
            {filters.city}
            <button
              onClick={() => updateFilter({ city: "" })}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: 0, display: "flex", alignItems: "center", marginLeft: 2,
              }}
            >
              <X style={{ width: 11, height: 11, color: "#a08858" }} />
            </button>
          </div>
        )}

        {/* "Search this area" floating button */}
        {pendingAreaSearch && (
          <button
            onClick={handleSearchArea}
            style={{
              position: "absolute",
              top: 16,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1001,
              background: "#1a1209",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "9px 20px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 7,
              boxShadow: "0 4px 16px rgba(0,0,0,0.22)",
              whiteSpace: "nowrap",
              animation: "fadeInDown 0.2s ease",
            }}
          >
            <RotateCcw style={{ width: 13, height: 13 }} />
            Search this area
          </button>
        )}

        {/* Loading indicator overlay */}
        {loading && (
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 60,
              zIndex: 900,
              background: "rgba(255,255,255,0.92)",
              borderRadius: 999,
              padding: "6px 14px",
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 12,
              color: "#836737",
              fontWeight: 600,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              backdropFilter: "blur(4px)",
            }}
          >
            <Loader2 style={{ width: 13, height: 13, color: GOLD, animation: "spin 1s linear infinite" }} />
            Loading…
          </div>
        )}

        {/* Result count badge — bottom left */}
        {!loading && totalCount > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 24,
              left: 16,
              zIndex: 900,
              background: "rgba(255,255,255,0.95)",
              border: "1px solid #e8d9c0",
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              color: "#1a1209",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              backdropFilter: "blur(4px)",
            }}
          >
            {totalCount} home{totalCount !== 1 ? "s" : ""} in this area
          </div>
        )}

        {/* Selected property card drawer — slides up from bottom */}
        {selectedProp && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1002,
              width: "min(420px, calc(100% - 32px))",
              padding: "0 0 20px",
              animation: "slideUp 0.25s cubic-bezier(.34,1.56,.64,1)",
            }}
          >
            <div style={{ position: "relative" }}>
              <button
                onClick={() => { setSelectedId(null); setShowMobileCard(false); }}
                style={{
                  position: "absolute",
                  top: -14,
                  right: 8,
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "#fff",
                  border: "1px solid #e8d9c0",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.14)",
                }}
              >
                <X style={{ width: 12, height: 12, color: "#836737" }} />
              </button>
              <MapPropertyCard
                p={selectedProp}
                isHovered={false}
                isSelected={true}
                onMouseEnter={() => {}}
                onMouseLeave={() => {}}
                onClick={() => {}}
              />
            </div>
          </div>
        )}

        {/* Error toast */}
        {error && !loading && (
          <div
            style={{
              position: "absolute",
              bottom: 80,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1001,
              background: "#fff3cd",
              border: "1px solid #ffc107",
              borderRadius: 12,
              padding: "10px 18px",
              fontSize: 13,
              color: "#856404",
              boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
              whiteSpace: "nowrap",
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Global styles */}
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-8px) translateX(-50%); }
          to   { opacity: 1; transform: translateY(0)    translateX(-50%); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px) translateX(-50%); }
          to   { opacity: 1; transform: translateY(0)    translateX(-50%); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        /* Hide scrollbar on filter pill row */
        .filterbar-pills::-webkit-scrollbar { display: none; }
        /* Leaflet popup reset */
        .leaflet-popup-content-wrapper {
          padding: 0 !important;
          border-radius: 16px !important;
          overflow: hidden !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18) !important;
        }
        .leaflet-popup-tip-container { display: none !important; }
        .leaflet-popup-content { margin: 0 !important; }
        .leaflet-container { font-family: system-ui,-apple-system,sans-serif; }
      `}</style>
    </div>
  );
}

