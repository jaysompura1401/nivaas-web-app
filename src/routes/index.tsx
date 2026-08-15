import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { PropertyCard } from "@/components/site/PropertyCard";
import { properties as propertiesApi, type ApiProperty } from "@/lib/api";
import { cities } from "@/lib/mock-properties";
import {
  Search, CalendarDays, Wallet, Home as HomeIcon, ArrowRight,
  ChevronDown, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nivaas — Rent, Buy & Manage Homes across Gujarat" },
      { name: "description", content: "Discover verified rentals, homes for sale, PGs and commercial spaces across Gujarat." },
    ],
  }),
  component: Home,
});

const GOLD = "#C9921A";
const BG   = "#FAF6EE";

// ── Budget preset options ────────────────────────────────────────────────────
const BUDGET_PRESETS = [
  { label: "Under ₹10,000",    max: 10_000  },
  { label: "₹10k – ₹20k",     max: 20_000  },
  { label: "₹20k – ₹35k",     max: 35_000  },
  { label: "₹35k – ₹60k",     max: 60_000  },
  { label: "₹60k – ₹1 Lakh",  max: 100_000 },
  { label: "Above ₹1 Lakh",   max: 9_999_999 },
];

// ── Home component ────────────────────────────────────────────────────────────
function Home() {
  const [locationInput, setLocationInput]     = useState("");
  const [showCitySuggest, setShowCitySuggest] = useState(false);
  const locationRef = useRef<HTMLDivElement>(null);

  const [moveInDate, setMoveInDate] = useState("");
  const moveInRef = useRef<HTMLInputElement>(null);

  const [budgetLabel, setBudgetLabel] = useState("");
  const [budgetMax,   setBudgetMax]   = useState<number | null>(null);
  const [showBudget,  setShowBudget]  = useState(false);
  const budgetRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowCitySuggest(false);
      }
      if (budgetRef.current && !budgetRef.current.contains(e.target as Node)) {
        setShowBudget(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const citySuggestions = locationInput.trim()
    ? cities.filter(c => c.toLowerCase().includes(locationInput.toLowerCase()))
    : cities;

  const clearBudget = () => { setBudgetLabel(""); setBudgetMax(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    const trimmedLoc = locationInput.trim();
    if (trimmedLoc) {
      const isCity = cities.some(c => c.toLowerCase() === trimmedLoc.toLowerCase());
      if (isCity) params.set("city", trimmedLoc);
      else        params.set("q", trimmedLoc);
    }
    if (moveInDate)        params.set("available_from", moveInDate);
    if (budgetMax !== null) params.set("max_price", String(budgetMax));
    const qs = params.toString();
    window.location.href = `/properties${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: BG }}>
      <Navbar />

      {/* ── SEARCH BAR ─────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-10 pt-7 pb-3" style={{ backgroundColor: BG }}>
        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full rounded-2xl bg-white overflow-visible relative"
          style={{ maxWidth: 760, border: "1px solid #e8d9c0", boxShadow: "0 2px 16px rgba(201,146,26,0.08)" }}
        >
          {/* Mobile: stacked layout; sm+: single row */}
          <div className="flex flex-col sm:flex-row sm:items-stretch">

            {/* ── WHERE ─────────────────────────────────── */}
            <div
              ref={locationRef}
              className="relative flex flex-1 items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5 sm:border-r border-b sm:border-b-0"
              style={{ borderColor: "#e8d9c0" }}
            >
              <div
                className="shrink-0 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: "#fef3d4" }}
              >
                <HomeIcon className="h-4 w-4" style={{ color: GOLD }} />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#1a1209" }}>
                  Where
                </label>
                <input
                  type="text"
                  value={locationInput}
                  onChange={e => { setLocationInput(e.target.value); setShowCitySuggest(true); }}
                  onFocus={() => setShowCitySuggest(true)}
                  placeholder="Search city or locality"
                  className="mt-0.5 w-full bg-transparent text-xs outline-none placeholder:text-[#c8b08a]"
                  style={{ color: "#1a1209" }}
                  autoComplete="off"
                />
              </div>
              {locationInput && (
                <button type="button" onClick={() => setLocationInput("")} className="shrink-0">
                  <X className="h-3.5 w-3.5" style={{ color: "#c8b08a" }} />
                </button>
              )}

              {/* City suggestions dropdown */}
              {showCitySuggest && citySuggestions.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 rounded-xl bg-white py-1 z-50"
                  style={{ border: "1px solid #e8d9c0", boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}
                >
                  {citySuggestions.map(city => (
                    <button
                      key={city}
                      type="button"
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors hover:bg-[#fef9f0]"
                      style={{ color: "#1a1209" }}
                      onClick={() => { setLocationInput(city); setShowCitySuggest(false); }}
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                        style={{ backgroundColor: "#fef3d4", color: GOLD }}
                      >
                        {city.slice(0, 1)}
                      </span>
                      <span>{city}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── MOVE IN ───────────────────────────────── */}
            <div
              className="flex flex-1 items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5 sm:border-r border-b sm:border-b-0 cursor-pointer select-none"
              style={{ borderColor: "#e8d9c0" }}
              onClick={() => moveInRef.current?.showPicker?.() ?? moveInRef.current?.click()}
            >
              {/* Custom calendar icon — the ONLY icon shown */}
              <div
                className="shrink-0 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl pointer-events-none"
                style={{ backgroundColor: "#fef3d4" }}
              >
                <CalendarDays className="h-4 w-4" style={{ color: GOLD }} />
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider cursor-pointer" style={{ color: "#1a1209" }}>
                  Move in
                </label>
                <div className="relative mt-0.5 h-4">
                  {/* Shown when no date is selected */}
                  {!moveInDate && (
                    <span
                      className="absolute inset-0 flex items-center text-xs pointer-events-none"
                      style={{ color: "#c8b08a" }}
                    >
                      Add dates
                    </span>
                  )}
                  {/* Native date input — browser calendar icon hidden via CSS */}
                  <input
                    ref={moveInRef}
                    type="date"
                    value={moveInDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={e => setMoveInDate(e.target.value)}
                    className="date-no-icon absolute inset-0 w-full bg-transparent text-xs outline-none cursor-pointer"
                    style={{
                      color: moveInDate ? "#1a1209" : "transparent",
                      colorScheme: "light",
                    }}
                  />
                </div>
              </div>

              {/* Clear button when date is selected */}
              {moveInDate && (
                <button
                  type="button"
                  className="shrink-0"
                  onClick={e => { e.stopPropagation(); setMoveInDate(""); }}
                >
                  <X className="h-3.5 w-3.5" style={{ color: "#c8b08a" }} />
                </button>
              )}
            </div>

            {/* ── BUDGET ────────────────────────────────── */}
            <div
              ref={budgetRef}
              className="relative flex flex-1 items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5 cursor-pointer select-none"
              onClick={() => setShowBudget(o => !o)}
            >
              <div className="flex flex-col min-w-0 flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider cursor-pointer" style={{ color: "#1a1209" }}>
                  Budget
                </label>
                <span className="mt-0.5 text-xs" style={{ color: budgetLabel ? "#1a1209" : "#c8b08a" }}>
                  {budgetLabel || "Select budget"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {budgetLabel && (
                  <button type="button" onClick={e => { e.stopPropagation(); clearBudget(); }}>
                    <X className="h-3.5 w-3.5" style={{ color: "#c8b08a" }} />
                  </button>
                )}
                <ChevronDown
                  className="shrink-0 h-4 w-4 transition-transform"
                  style={{ color: "#c8b08a", transform: showBudget ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </div>

              {showBudget && (
                <div
                  className="absolute top-full right-0 mt-1 w-52 rounded-xl bg-white py-1 z-50"
                  style={{ border: "1px solid #e8d9c0", boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}
                  onClick={e => e.stopPropagation()}
                >
                  <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#a08858" }}>
                    Monthly Rent / Price
                  </p>
                  {BUDGET_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      className="w-full px-4 py-2.5 text-sm text-left transition-colors hover:bg-[#fef9f0] flex items-center justify-between"
                      style={{ color: budgetMax === preset.max ? GOLD : "#1a1209", fontWeight: budgetMax === preset.max ? 700 : 400 }}
                      onClick={() => { setBudgetLabel(preset.label); setBudgetMax(preset.max); setShowBudget(false); }}
                    >
                      {preset.label}
                      {budgetMax === preset.max && <span className="text-xs font-bold" style={{ color: GOLD }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── SEARCH BUTTON ─────────────────────────── */}
            <button
              type="submit"
              className="search-btn flex items-center justify-center w-full sm:w-14 h-12 sm:h-auto transition hover:opacity-90 active:scale-95 shrink-0"
              style={{
                backgroundColor: GOLD,
                borderBottomLeftRadius: 16,
                borderBottomRightRadius: 16,
              }}
              aria-label="Search"
            >
              <Search className="h-5 w-5 text-white" />
              <span className="ml-2 text-sm font-semibold text-white sm:hidden">Search</span>
            </button>
          </div>
        </form>

        {/* Active filter pills */}
        {(locationInput || moveInDate || budgetLabel) && (
          <div className="mx-auto mt-2 flex gap-2 flex-wrap" style={{ maxWidth: 760 }}>
            {locationInput && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: "#fef3d4", color: GOLD, border: "1px solid #f0e4cc" }}>
                📍 {locationInput}
                <button type="button" onClick={() => setLocationInput("")}><X className="h-3 w-3" /></button>
              </span>
            )}
            {moveInDate && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: "#fef3d4", color: GOLD, border: "1px solid #f0e4cc" }}>
                📅 {new Date(moveInDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                <button type="button" onClick={() => setMoveInDate("")}><X className="h-3 w-3" /></button>
              </span>
            )}
            {budgetLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: "#fef3d4", color: GOLD, border: "1px solid #f0e4cc" }}>
                💰 {budgetLabel}
                <button type="button" onClick={clearBudget}><X className="h-3 w-3" /></button>
              </span>
            )}
          </div>
        )}
      </section>

      {/* ── CITY-WISE PROPERTY ROWS ─────────────────────────────── */}
      {cities.map(city => <CitySection key={city} city={city} />)}

      <Footer />
    </div>
  );
}

// ── City Section ──────────────────────────────────────────────────────────────
const CAROUSEL_THRESHOLD = 6;

function CitySection({ city }: { city: string }) {
  const [props, setProps]     = useState<ApiProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft,  setCanScrollLeft]  = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    propertiesApi.list({ city, limit: 100 })
      .then(res => setProps(res.data))
      .catch(() => setProps([]))
      .finally(() => setLoading(false));
  }, [city]);

  const isCarousel = props.length > CAROUSEL_THRESHOLD;

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    if (!isCarousel) return;
    const el = scrollRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => updateArrows());
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [props, isCarousel]);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -420 : 420, behavior: "smooth" });
  };

  if (!loading && props.length === 0) return null;

  return (
    <section className="px-4 sm:px-6 lg:px-10 py-7" style={{ backgroundColor: BG }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="min-w-0">
          <h2 className="font-bold text-lg sm:text-xl leading-tight" style={{ color: "#1a1209", fontFamily: "'Sora',sans-serif" }}>
            Popular stays in <span style={{ color: GOLD }}>{city}</span>
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "#a08858" }}>
            Handpicked homes for your perfect stay
          </p>
        </div>
        <Link
          to="/properties/map"
          search={{ city }}
          className="shrink-0 flex items-center gap-1 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition hover:opacity-80"
          style={{ color: GOLD, border: "1px solid #e8d9c0", backgroundColor: "#fff" }}
        >
          View all <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        </Link>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="flex gap-3 overflow-x-hidden pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="shrink-0 h-52 rounded-2xl animate-pulse"
              style={{
                backgroundColor: "#f0e4cc",
                // Responsive skeleton widths: ~45vw on mobile, ~33vw on sm, fixed on md+
                width: "clamp(140px, 44vw, 190px)",
              }}
            />
          ))}
        </div>
      )}

      {/* ── 6 or fewer → responsive grid ── */}
      {!loading && !isCarousel && (
        <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {props.map(p => (
            <PropertyCard key={p.id} p={p} compact />
          ))}
        </div>
      )}

      {/* ── More than 6 → scrollable carousel with arrows ── */}
      {!loading && isCarousel && (
        <div className="relative">
          {canScrollLeft && (
            <button
              onClick={() => scroll("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white shadow-md transition hover:shadow-lg hover:scale-105"
              style={{ border: "1px solid #e8d9c0" }}
              aria-label="Scroll left"
            >
              <svg className="h-4 w-4" fill="none" stroke="#1a1209" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {canScrollRight && (
            <button
              onClick={() => scroll("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white shadow-md transition hover:shadow-lg hover:scale-105"
              style={{ border: "1px solid #e8d9c0" }}
              aria-label="Scroll right"
            >
              <svg className="h-4 w-4" fill="none" stroke="#1a1209" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-3"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
          >
            {props.map(p => (
              // Responsive card width: ~45vw on mobile, ~33vw on sm, 190px on md+
              <div
                key={p.id}
                className="shrink-0"
                style={{ width: "clamp(140px, 44vw, 190px)" }}
              >
                <PropertyCard p={p} compact />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
