/**
 * /properties/:id  — Airbnb-style property detail page
 *
 * Map strategy — always Google Maps, 100% client-side, no API key needed:
 *  1. map_url (owner-pinned) → backend resolves to exact coords + named-place embed URL
 *     If resolution fails for any reason → show "Map location not set" (never fall back)
 *  2. lat + lng in DB (only when no map_url) → Google Maps Embed ?q=lat,lng
 *  3. Neither present → show "Map location not set"
 *
 * Locality / address / city are NEVER used to geocode the map pin.
 * They are text-only display labels.
 */
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { PropertyCard } from "@/components/site/PropertyCard";
import {
  properties as propertiesApi, inquiries as inquiriesApi, saved as savedApi,
  complaints as complaintsApi, visits as visitsApi, messages as messagesApi,
  type ApiProperty, type ApiReview, type VisitType,
} from "@/lib/api";
import { formatINR } from "@/lib/mock-properties";
import {
  BedDouble, Bath, Heart, BadgeCheck, ChevronRight, ChevronLeft,
  Phone, MessageSquare, Calendar, Loader2, Wifi, Car, Shield, Zap, Wind,
  CheckCircle2, Box, Leaf, Grid3X3, MapPin, Star, MapPinned, X,
  Maximize2, Navigation, Copy, ExternalLink,
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";

export const Route = createFileRoute("/properties/$id")({
  head: () => ({ meta: [{ title: "Property — Nivaas" }] }),
  // loader runs on the server during SSR — skip it there because the backend
  // is a separate Express process (localhost:4000) that is not reachable via
  // relative /api paths in the SSR Node context. Data is fetched client-side
  // inside PropertyDetail instead, so a page reload never shows "not found".
  loader: async () => {
    if (typeof window === "undefined") return null;
    return null;
  },
  notFoundComponent: () => (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FAF6EE" }}>
      <Navbar />
      <div className="flex-1 flex items-center justify-center text-center p-12">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "#1a1209" }}>Property not found</h1>
          <Link to="/properties" className="mt-6 inline-block rounded-xl px-6 py-3 text-sm font-semibold text-white"
            style={{ backgroundColor: "#C9921A" }}>Browse all</Link>
        </div>
      </div>
      <Footer />
    </div>
  ),
  component: PropertyDetail,
});

// ─── Constants ────────────────────────────────────────────────────────────────
const GOLD        = "#C9921A";
const BG          = "#FAF6EE";
const PLACEHOLDER = "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&auto=format&fit=crop&q=80";

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  "WiFi":             <Wifi  className="h-4 w-4" style={{ color: GOLD }} />,
  "Air Conditioning": <Wind  className="h-4 w-4" style={{ color: GOLD }} />,
  "Air conditioning": <Wind  className="h-4 w-4" style={{ color: GOLD }} />,
  "Parking":          <Car   className="h-4 w-4" style={{ color: GOLD }} />,
  "CCTV Security":    <Shield className="h-4 w-4" style={{ color: GOLD }} />,
  "24x7 Security":    <Shield className="h-4 w-4" style={{ color: GOLD }} />,
  "Power Backup":     <Zap   className="h-4 w-4" style={{ color: GOLD }} />,
  "Lift/Elevator":    <Box   className="h-4 w-4" style={{ color: GOLD }} />,
  "Balcony":          <Leaf  className="h-4 w-4" style={{ color: GOLD }} />,
};

// ─── Map section component (v4 — Leaflet, no iframe) ─────────────────────────
/**
 * MapSection — uses Leaflet (same library as the map search page).
 * Google Maps iframes are blocked by X-Frame-Options: SAMEORIGIN without an API key.
 * Leaflet with CartoDB tiles works 100% without any key.
 *
 * Priority:
 *  1. DB lat/lng  → exact owner pin, instant, zero network
 *  2. map_url only → client-side regex extraction → server resolve (short links)
 *  3. Neither     → "Map location not set"
 *
 * "Open in Google Maps" always opens the owner's original map_url (or a ?q=lat,lng link).
 */

interface MapSectionProps {
  property: ApiProperty;
  onCoordsResolved?: (coords: { lat: number; lng: number }) => void;
}

// Validate GPS coords — reject null, NaN, and the (0,0) artifact
function isValidCoord(
  lat: number | null | undefined,
  lng: number | null | undefined,
): lat is number {
  if (lat == null || lng == null) return false;
  const la = Number(lat);
  const lo = Number(lng);
  return (
    !isNaN(la) && !isNaN(lo) &&
    la >= -90 && la <= 90 &&
    lo >= -180 && lo <= 180 &&
    !(la === 0 && lo === 0)
  );
}

// Extract coords from any Google Maps URL string (client-side, no network)
function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  if (!url) return null;
  let m: RegExpMatchArray | null;
  m = url.match(/@(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);           if (m) return { lat: +m[1], lng: +m[2] };
  m = url.match(/!3d(-?\d{1,3}\.\d{4,})!4d(-?\d{1,3}\.\d{4,})/);       if (m) return { lat: +m[1], lng: +m[2] };
  m = url.match(/[?&]q=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);      if (m) return { lat: +m[1], lng: +m[2] };
  m = url.match(/\bll=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);       if (m) return { lat: +m[1], lng: +m[2] };
  m = url.match(/\bcenter=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);   if (m) return { lat: +m[1], lng: +m[2] };
  m = url.match(/\/@(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);         if (m) return { lat: +m[1], lng: +m[2] };
  m = url.match(/!8m2!3d(-?\d{1,3}\.\d{4,})!4d(-?\d{1,3}\.\d{4,})/);  if (m) return { lat: +m[1], lng: +m[2] };
  m = url.match(/!1d(-?\d{1,3}\.\d{4,})!2d(-?\d{1,3}\.\d{4,})/);       if (m) return { lat: +m[2], lng: +m[1] };
  m = url.match(/[sd]addr=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);   if (m) return { lat: +m[1], lng: +m[2] };
  return null;
}

// Singleton loader for Leaflet — same pattern as PropertyMap.tsx
let detailLeafletPromise: Promise<{ L: typeof import("leaflet"); RL: typeof import("react-leaflet") }> | null = null;
function getDetailLeaflet() {
  if (!detailLeafletPromise) {
    detailLeafletPromise = (async () => {
      await import("leaflet/dist/leaflet.css");
      const [lm, rlm] = await Promise.all([import("leaflet"), import("react-leaflet")]);
      const L = lm.default;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      return { L, RL: rlm };
    })();
  }
  return detailLeafletPromise;
}

// Build a gold SVG pin (same style as the map search page)
function buildDetailPin(): string {
  return `<div style="width:32px;height:42px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35))">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 36" width="32" height="42">
      <path d="M14 0C8.477 0 4 4.477 4 10c0 7.5 10 26 10 26S24 17.5 24 10C24 4.477 19.523 0 14 0z"
        fill="#C9921A" stroke="#b5800e" stroke-width="1.2"/>
      <circle cx="14" cy="10" r="4.5" fill="white" opacity="0.9"/>
    </svg>
  </div>`;
}

// Internal Leaflet map with a single marker
function DetailLeafletMap({
  lat, lng, openLink,
}: { lat: number; lng: number; openLink: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef       = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let destroyed = false;
    getDetailLeaflet().then(({ L, RL: _RL }) => {
      if (destroyed || !containerRef.current) return;

      // Avoid double-init if strict mode remounts
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, {
        center:          [lat, lng],
        zoom:            16,
        zoomControl:     true,
        attributionControl: false,
        scrollWheelZoom: false,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        { subdomains: "abcd", maxZoom: 19 }
      ).addTo(map);

      // Gold SVG pin marker
      const icon = L.divIcon({
        html:       buildDetailPin(),
        className:  "",
        iconSize:   [32, 42],
        iconAnchor: [16, 42],
      });

      L.marker([lat, lng], { icon }).addTo(map);

      mapRef.current = map;
      if (!destroyed) setReady(true);
    });

    return () => {
      destroyed = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Map container */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Loading overlay */}
      {!ready && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#f5ede0", zIndex: 10,
        }}>
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
        </div>
      )}

      {/* "Open in Google Maps" overlay button */}
      {ready && (
        <a
          href={openLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: "absolute", bottom: 10, right: 10, zIndex: 500,
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(6px)",
            borderRadius: 999, padding: "6px 14px",
            fontSize: 11, fontWeight: 700, color: "#1a1209",
            display: "flex", alignItems: "center", gap: 5,
            boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
            textDecoration: "none",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <ExternalLink style={{ width: 11, height: 11 }} />
          Open in Google Maps
        </a>
      )}
    </div>
  );
}

function MapSection({ property, onCoordsResolved }: MapSectionProps) {
  const [coords,    setCoords]    = useState<{ lat: number; lng: number } | null>(null);
  const [openLink,  setOpenLink]  = useState("");
  const [status,    setStatus]    = useState<"loading" | "ready" | "no_location">("loading");

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      setStatus("loading");
      setCoords(null);

      // Priority 1 — exact coords from DB
      const la = property.latitude  != null ? Number(property.latitude)  : null;
      const lo = property.longitude != null ? Number(property.longitude) : null;

      if (isValidCoord(la, lo)) {
        if (!cancelled) {
          setCoords({ lat: la!, lng: lo! });
          setOpenLink(property.map_url ?? `https://www.google.com/maps?q=${la},${lo}&z=17`);
          setStatus("ready");
          onCoordsResolved?.({ lat: la!, lng: lo! });
        }
        return;
      }

      // Priority 2 — extract from map_url
      if (property.map_url) {
        // 2a. client-side regex (instant for full google.com URLs)
        const cc = extractCoordsFromUrl(property.map_url);
        if (cc && isValidCoord(cc.lat, cc.lng)) {
          if (!cancelled) {
            setCoords(cc);
            setOpenLink(property.map_url);
            setStatus("ready");
            onCoordsResolved?.(cc);
          }
          return;
        }

        // 2b. server resolve (short links)
        try {
          const ctrl = new AbortController();
          const tid  = setTimeout(() => ctrl.abort(), 15_000);
          const res  = await fetch(
            `/api/maps/resolve?url=${encodeURIComponent(property.map_url)}`,
            { signal: ctrl.signal },
          );
          clearTimeout(tid);
          if (!cancelled && res.ok) {
            const d = await res.json();
            if (isValidCoord(d.lat, d.lng)) {
              setCoords({ lat: d.lat, lng: d.lng });
              setOpenLink(property.map_url);
              setStatus("ready");
              onCoordsResolved?.({ lat: d.lat, lng: d.lng });
              return;
            }
          }
        } catch { /* timeout / network error */ }

        // 2c. No coords found but map_url exists
        if (!cancelled) setStatus("no_location");
        return;
      }

      // Priority 3 — no location data
      if (!cancelled) setStatus("no_location");
    }

    resolve();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property.id, property.latitude, property.longitude, property.map_url]);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        height: "clamp(220px, 50vw, 320px)",
        border: "1px solid #e8d9c0",
        position: "relative",
        background: "#f5ede0",
        minWidth: 0,
      }}
    >
      {/* Loading */}
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10"
          style={{ background: "#f5ede0" }}>
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
          <p className="text-xs" style={{ color: "#a08858" }}>Loading map…</p>
        </div>
      )}

      {/* No location */}
      {status === "no_location" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center z-10"
          style={{ background: "#f5ede0" }}>
          <MapPin className="h-9 w-9" style={{ color: "#d4b896" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#836737" }}>Map location not set</p>
            <p className="text-xs mt-1" style={{ color: "#c8b08a" }}>Owner hasn't added an exact map pin yet</p>
          </div>
          {property.map_url && (
            <a href={property.map_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-2 transition hover:bg-amber-50"
              style={{ color: GOLD, border: `1px solid ${GOLD}` }}>
              <ExternalLink className="h-3.5 w-3.5" /> Open location link
            </a>
          )}
        </div>
      )}

      {/* Leaflet map with exact pin */}
      {status === "ready" && coords && (
        <DetailLeafletMap
          lat={coords.lat}
          lng={coords.lng}
          openLink={openLink}
        />
      )}
    </div>
  );
}

// ─── Photo gallery lightbox ───────────────────────────────────────────────────

function PhotoGallery({ images, title }: { images: string[]; title: string }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const imgs = (() => {
    const arr = [...images];
    if (arr.length === 0) arr.push(PLACEHOLDER);
    return arr;
  })();

  const openLightbox = (i: number) => { setLightbox(i); setActiveIdx(i); };
  const closeLightbox = () => setLightbox(null);
  const prevImg = () => setActiveIdx(i => (i - 1 + imgs.length) % imgs.length);
  const nextImg = () => setActiveIdx(i => (i + 1) % imgs.length);

  // Keyboard navigation
  useEffect(() => {
    if (lightbox === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  prevImg();
      if (e.key === "ArrowRight") nextImg();
      if (e.key === "Escape")     closeLightbox();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* ── Photo gallery ── */}
      {/* Mobile: single image with tap-to-view; md+: Airbnb-style 5-up grid */}
      <div className="relative rounded-2xl overflow-hidden" style={{ cursor: "pointer" }}>

        {/* ── MOBILE: single hero image (hidden on md+) ── */}
        <div
          className="block md:hidden relative overflow-hidden rounded-2xl"
          style={{ aspectRatio: "4/3" }}
          onClick={() => openLightbox(0)}
        >
          <img
            src={imgs[0]}
            alt={title}
            onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Photo count pill */}
          {imgs.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); openLightbox(0); }}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{
                background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)",
                border: "1px solid rgba(0,0,0,0.12)", fontSize: 12, fontWeight: 600, color: "#1a1209",
              }}
            >
              <Grid3X3 style={{ width: 13, height: 13 }} />
              {imgs.length} photos
            </button>
          )}
        </div>

        {/* ── DESKTOP: 5-up grid (hidden below md) ── */}
        <div
          className="hidden md:grid"
          style={{
            gridTemplateColumns: "2fr 1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            gap: 4,
            height: "min(420px, 52vw)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {/* Main image — spans 2 rows */}
          <div
            style={{ gridRow: "1 / 3", position: "relative", overflow: "hidden" }}
            onClick={() => openLightbox(0)}
          >
            <img
              src={imgs[0]}
              alt={title}
              onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
              style={{ width: "100%", height: "100%", objectFit: "cover",
                transition: "transform 0.35s ease", display: "block" }}
              className="hover:scale-105"
            />
          </div>

          {/* 4 thumbnails */}
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              style={{
                position: "relative", overflow: "hidden",
                borderTopRightRadius: i === 2 ? 16 : 0,
                borderBottomRightRadius: i === 4 ? 16 : 0,
              }}
              onClick={() => openLightbox(i)}
            >
              <img
                src={imgs[i] ?? imgs[0]}
                alt={`${title} — ${i + 1}`}
                onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
                style={{ width: "100%", height: "100%", objectFit: "cover",
                  transition: "transform 0.35s ease", display: "block" }}
                className="hover:scale-105"
              />
              {/* "Show all" overlay on last thumb */}
              {i === 4 && imgs.length > 5 && (
                <div
                  style={{
                    position: "absolute", inset: 0,
                    background: "rgba(0,0,0,0.45)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexDirection: "column", gap: 4,
                  }}
                >
                  <Grid3X3 style={{ width: 18, height: 18, color: "#fff" }} />
                  <span style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>
                    Show all {imgs.length} photos
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* "Show all" pill — positioned inside the grid wrapper */}
          <button
            onClick={() => openLightbox(0)}
            style={{
              position: "absolute",
              bottom: 14, right: 14,
              background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)",
              border: "1px solid rgba(0,0,0,0.12)", borderRadius: 999,
              padding: "6px 14px", fontSize: 12, fontWeight: 600,
              color: "#1a1209", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Grid3X3 style={{ width: 13, height: 13 }} />
            {imgs.length > 1 ? `Show all ${imgs.length} photos` : "View photo"}
          </button>
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightbox !== null && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.92)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}
          onClick={closeLightbox}
        >
          {/* Close */}
          <button
            onClick={closeLightbox}
            style={{
              position: "absolute", top: 20, right: 20,
              background: "rgba(255,255,255,0.12)", border: "none",
              borderRadius: "50%", width: 40, height: 40,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#fff",
            }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>

          {/* Counter */}
          <p style={{ position: "absolute", top: 24, left: 0, right: 0,
            textAlign: "center", color: "#fff", fontSize: 13, fontWeight: 600 }}>
            {activeIdx + 1} / {imgs.length}
          </p>

          {/* Image */}
          <img
            src={imgs[activeIdx]}
            alt={title}
            onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: "90vw", maxHeight: "80vh",
              objectFit: "contain", borderRadius: 8,
              boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            }}
          />

          {/* Prev / Next */}
          {imgs.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); prevImg(); }}
                style={{
                  position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.12)", border: "none",
                  borderRadius: "50%", width: 44, height: 44,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#fff",
                }}
              >
                <ChevronLeft style={{ width: 20, height: 20 }} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); nextImg(); }}
                style={{
                  position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)",
                  background: "rgba(255,255,255,0.12)", border: "none",
                  borderRadius: "50%", width: 44, height: 44,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#fff",
                }}
              >
                <ChevronRight style={{ width: 20, height: 20 }} />
              </button>
            </>
          )}

          {/* Thumbnail strip */}
          {imgs.length > 1 && (
            <div style={{
              position: "absolute", bottom: 20,
              display: "flex", gap: 6, maxWidth: "80vw",
              overflowX: "auto", padding: "0 8px",
            }}>
              {imgs.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`thumb ${i + 1}`}
                  onClick={e => { e.stopPropagation(); setActiveIdx(i); }}
                  onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
                  style={{
                    width: 56, height: 40, objectFit: "cover",
                    borderRadius: 6, cursor: "pointer", flexShrink: 0,
                    border: i === activeIdx ? `2px solid ${GOLD}` : "2px solid transparent",
                    opacity: i === activeIdx ? 1 : 0.6,
                    transition: "opacity 0.15s, border-color 0.15s",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Nearby places — real POIs via Overpass API + Haversine distances ────────

// Haversine distance in km between two lat/lng points
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Walking speed ~5 km/h
function kmToWalkMins(km: number): string {
  const mins = Math.round((km / 5) * 60);
  if (mins < 2) return "< 1 min";
  return `${mins} min`;
}

const OVERPASS_CATEGORIES = [
  {
    label: "Metro / Bus Stop",
    icon: "🚌",
    query: (lat: number, lng: number, r: number) =>
      `node(around:${r},${lat},${lng})[highway=bus_stop];
       node(around:${r},${lat},${lng})[public_transport=stop_position];
       node(around:${r},${lat},${lng})[railway=station];
       node(around:${r},${lat},${lng})[railway=tram_stop];`,
  },
  {
    label: "School / College",
    icon: "🏫",
    query: (lat: number, lng: number, r: number) =>
      `node(around:${r},${lat},${lng})[amenity=school];
       node(around:${r},${lat},${lng})[amenity=college];
       node(around:${r},${lat},${lng})[amenity=university];`,
  },
  {
    label: "Hospital / Clinic",
    icon: "🏥",
    query: (lat: number, lng: number, r: number) =>
      `node(around:${r},${lat},${lng})[amenity=hospital];
       node(around:${r},${lat},${lng})[amenity=clinic];`,
  },
  {
    label: "Supermarket",
    icon: "🛒",
    query: (lat: number, lng: number, r: number) =>
      `node(around:${r},${lat},${lng})[shop=supermarket];
       node(around:${r},${lat},${lng})[shop=convenience];`,
  },
  {
    label: "Restaurant / Food",
    icon: "🍽️",
    query: (lat: number, lng: number, r: number) =>
      `node(around:${r},${lat},${lng})[amenity=restaurant];
       node(around:${r},${lat},${lng})[amenity=fast_food];`,
  },
  {
    label: "ATM / Bank",
    icon: "🏦",
    query: (lat: number, lng: number, r: number) =>
      `node(around:${r},${lat},${lng})[amenity=atm];
       node(around:${r},${lat},${lng})[amenity=bank];`,
  },
];

interface NearbyResult {
  label: string;
  icon: string;
  name: string;
  distKm: number;
  lat: number;
  lng: number;
}

// Fetch nearest POI of each category via Overpass API
async function fetchNearbyPOIs(
  lat: number,
  lng: number,
  radius = 2000,
): Promise<NearbyResult[]> {
  const unionQueries = OVERPASS_CATEGORIES.map(c => c.query(lat, lng, radius)).join("\n");
  const overpassQuery = `[out:json][timeout:15];\n(\n${unionQueries}\n);\nout body;`;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: overpassQuery,
    headers: { "Content-Type": "text/plain" },
  });
  if (!response.ok) throw new Error("Overpass error");
  const data = await response.json();
  const elements: Array<{ lat: number; lon: number; tags?: Record<string, string> }> =
    data.elements ?? [];

  // For each category, find the closest matching node
  return OVERPASS_CATEGORIES.flatMap(cat => {
    const catQuery = cat.query(lat, lng, radius);
    // Identify which amenity/highway/shop tags this category looks for
    const tagMatches = catQuery
      .match(/\[(\w+)=(\w+)\]/g)
      ?.map(t => {
        const [, k, v] = t.match(/\[(\w+)=(\w+)\]/) ?? [];
        return { k, v };
      }) ?? [];

    const matching = elements.filter(el =>
      el.tags &&
      tagMatches.some(({ k, v }) => el.tags![k] === v),
    );
    if (matching.length === 0) return [];

    // Find closest
    const withDist = matching.map(el => ({
      ...el,
      dist: haversineKm(lat, lng, el.lat, el.lon),
    }));
    withDist.sort((a, b) => a.dist - b.dist);
    const closest = withDist[0];
    const name =
      closest.tags?.name ||
      closest.tags?.["name:en"] ||
      closest.tags?.["name:hi"] ||
      cat.label;

    return [{
      label: cat.label,
      icon: cat.icon,
      name,
      distKm: closest.dist,
      lat: closest.lat,
      lng: closest.lon,
    }];
  });
}

function NearbyPlaces({ lat, lng, city, locality }: {
  lat: number; lng: number; city: string; locality?: string | null;
}) {
  const [places, setPlaces]   = useState<NearbyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetchNearbyPOIs(lat, lng, 2000)
      .then(results => {
        if (!cancelled) {
          setPlaces(results);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) { setError(true); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [lat, lng]);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold mb-2" style={{ color: "#a08858" }}>NEARBY</p>

      {loading && (
        <div className="flex items-center gap-2 py-3 px-3 rounded-xl"
          style={{ border: "1px solid #e8d9c0", backgroundColor: "#fff" }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" style={{ color: GOLD }} />
          <span className="text-xs" style={{ color: "#a08858" }}>Finding nearby places…</span>
        </div>
      )}

      {!loading && error && (
        // Fallback: category links to Google Maps search
        OVERPASS_CATEGORIES.map(cat => {
          const q = encodeURIComponent(`${cat.label} near ${[locality, city, "India"].filter(Boolean).join(", ")}`);
          return (
            <a key={cat.label} href={`https://www.google.com/maps/search/${q}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 no-underline transition hover:bg-[#fef3d4]"
              style={{ border: "1px solid #e8d9c0", backgroundColor: "#fff" }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 13 }}>{cat.icon}</span>
                <span className="text-xs font-medium" style={{ color: "#1a1209" }}>{cat.label}</span>
              </div>
              <ExternalLink className="h-3 w-3 shrink-0" style={{ color: "#a08858" }} />
            </a>
          );
        })
      )}

      {!loading && !error && places.map(p => {
        const km = p.distKm < 1
          ? `${Math.round(p.distKm * 1000)} m`
          : `${p.distKm.toFixed(1)} km`;
        const walk = kmToWalkMins(p.distKm);
        const gmUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
        return (
          <a key={p.label} href={gmUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 no-underline transition hover:bg-[#fef3d4]"
            style={{ border: "1px solid #e8d9c0", backgroundColor: "#fff" }}>
            <div className="flex items-center gap-2 min-w-0">
              <span style={{ fontSize: 13, flexShrink: 0 }}>{p.icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "#1a1209" }}>
                  {p.name}
                </p>
                <p className="text-[10px]" style={{ color: "#a08858" }}>{p.label}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold" style={{ color: GOLD }}>{km}</p>
              <p className="text-[10px]" style={{ color: "#a08858" }}>{walk} walk</p>
            </div>
          </a>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function PropertyDetail() {
  const { id }       = Route.useParams();
  const { profile }  = useAuth();
  const navigate     = useNavigate();

  // Fetch property client-side so reloads always work correctly.
  // (The loader is intentionally a no-op to avoid SSR issues with the
  //  separate Express backend not being reachable via relative /api paths.)
  const [property, setProperty]     = useState<ApiProperty | null>(null);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    setProperty(null);
    setFetchError(false);
    propertiesApi.get(id)
      .then(p => setProperty(p))
      .catch(() => setFetchError(true));
  }, [id]);

  const [saved, setSaved]           = useState(false);
  const [showAll, setShowAll]       = useState(false);
  const [similar, setSimilar]       = useState<ApiProperty[]>([]);
  const similarScrollRef            = useRef<HTMLDivElement>(null);
  const [canScrollLeft,  setCanScrollLeft]  = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [resolvedCoords, setResolvedCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Re-seed resolvedCoords whenever property loads
  useEffect(() => {
    if (!property) return;
    const storedLat = property.latitude  ? Number(property.latitude)  : null;
    const storedLng = property.longitude ? Number(property.longitude) : null;
    if (
      storedLat !== null && storedLng !== null &&
      !isNaN(storedLat) && !isNaN(storedLng) &&
      !(storedLat === 0 && storedLng === 0)
    ) {
      setResolvedCoords({ lat: storedLat, lng: storedLng });
    }
  }, [property]);

  // Reviews
  const [reviews, setReviews]           = useState<ApiReview[]>([]);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Sync reviews when property loads
  useEffect(() => {
    if (property?.reviews) setReviews(property.reviews);
  }, [property]);

  // Inquiry
  const [inquiryMsg, setInquiry] = useState("");
  const [sending, setSending]    = useState(false);

  // Visit
  const [visitDate, setVisitDate]         = useState("");
  const [visitTime, setVisitTime]         = useState("10:00");
  const [visitType, setVisitType]         = useState<VisitType>("in_person");
  const [bookingVisit, setBookingVisit]   = useState(false);
  const [showVisitForm, setShowVisitForm] = useState(false);

  // Message
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [messageText, setMessageText]         = useState("");
  const [sendingMessage, setSendingMessage]   = useState(false);

  const images = (() => {
    if (!property) return [];
    const arr = [...(property.images || [])];
    if (arr.length === 0 && property.cover_image_url) arr.push(property.cover_image_url);
    return arr;
  })();

  const amenities = property?.amenities ?? [];
  const visible   = showAll ? amenities : amenities.slice(0, 8);

  useEffect(() => {
    if (!property) return;
    propertiesApi.list({ city: property.city, limit: 100 })
      .then(r => setSimilar(r.data.filter(x => x.id !== property.id)))
      .catch(() => {});
    if (profile) {
      savedApi.check(property.id).then(r => setSaved(r.saved)).catch(() => {});
    }
  }, [property?.id, property?.city, profile]);

  // Similar properties carousel arrows
  const updateSimilarArrows = () => {
    const el = similarScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };
  useEffect(() => {
    const el = similarScrollRef.current;
    if (!el) return;
    updateSimilarArrows();
    el.addEventListener("scroll", updateSimilarArrows, { passive: true });
    window.addEventListener("resize", updateSimilarArrows);
    return () => {
      el.removeEventListener("scroll", updateSimilarArrows);
      window.removeEventListener("resize", updateSimilarArrows);
    };
  }, [similar]);
  const scrollSimilar = (dir: "left" | "right") => {
    similarScrollRef.current?.scrollBy({ left: dir === "left" ? -440 : 440, behavior: "smooth" });
  };

  const toggleSave = useCallback(async () => {
    if (!profile || !property) { navigate({ to: "/auth" }); return; }
    try {
      if (saved) { await savedApi.unsave(property.id); setSaved(false); toast.success("Removed from saved"); }
      else       { await savedApi.save(property.id);   setSaved(true);  toast.success("Saved!"); }
    } catch { toast.error("Failed"); }
  }, [profile, property, saved, navigate]);

  const sendInquiry = useCallback(async () => {
    if (!profile || !property) { navigate({ to: "/auth" }); return; }
    if (!inquiryMsg.trim()) { toast.error("Enter a message"); return; }
    setSending(true);
    try {
      await inquiriesApi.send({ property_id: property.id, message: inquiryMsg });
      toast.success("Inquiry sent!");
      setInquiry("");
    } catch { toast.error("Failed to send"); }
    finally { setSending(false); }
  }, [profile, property, inquiryMsg, navigate]);

  const submitReview = useCallback(async () => {
    if (!profile || !property) { navigate({ to: "/auth" }); return; }
    if (!reviewRating) { toast.error("Please select a star rating"); return; }
    setSubmittingReview(true);
    try {
      const review = await complaintsApi.submitReview(property.id, reviewRating, reviewComment || undefined);
      setReviews(prev => [review, ...prev.filter(r => r.reviewer_id !== profile.id)]);
      setReviewRating(0); setReviewComment("");
      toast.success("Review submitted!");
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmittingReview(false); }
  }, [profile, property, reviewRating, reviewComment, navigate]);

  const sendDirectMessage = useCallback(async () => {
    if (!profile || !property) { navigate({ to: "/auth" }); return; }
    if (!messageText.trim()) { toast.error("Enter a message"); return; }
    setSendingMessage(true);
    try {
      await messagesApi.send({ receiver_id: property.owner_id, content: messageText.trim(), property_id: property.id });
      toast.success("Message sent!");
      setMessageText(""); setShowMessageForm(false);
    } catch (e: any) { toast.error(e.message || "Failed"); }
    finally { setSendingMessage(false); }
  }, [profile, property, messageText, navigate]);

  const bookVisit = useCallback(async () => {
    if (!profile || !property) { navigate({ to: "/auth" }); return; }
    if (!visitDate) { toast.error("Please select a date"); return; }
    setBookingVisit(true);
    try {
      await visitsApi.book({ property_id: property.id, visit_date: visitDate, visit_time: visitTime, visit_type: visitType });
      toast.success("Visit booked! You'll receive a confirmation shortly.");
      setShowVisitForm(false); setVisitDate("");
    } catch (e: any) { toast.error(e.message); }
    finally { setBookingVisit(false); }
  }, [profile, property, visitDate, visitTime, visitType, navigate]);

  // ── Loading / error states (after all hooks) ─────────────────────────────
  if (fetchError) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FAF6EE" }}>
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-center p-12">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "#1a1209" }}>Property not found</h1>
            <Link to="/properties" className="mt-6 inline-block rounded-xl px-6 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: "#C9921A" }}>Browse all</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#FAF6EE" }}>
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#C9921A" }} />
        </div>
        <Footer />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: BG }}>
      <Navbar />

      {/* ── Breadcrumb ───────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 lg:px-10 py-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs" style={{ color: "#a08858" }}>
        <Link to="/" className="hover:underline shrink-0" style={{ color: "#a08858" }}>Home</Link>
        <ChevronRight className="h-3 w-3 shrink-0" />
        <Link to="/properties" className="hover:underline shrink-0" style={{ color: "#a08858" }}>Properties</Link>
        <ChevronRight className="h-3 w-3 shrink-0" />
        <span style={{ color: "#1a1209" }} className="font-medium truncate min-w-0 max-w-[120px] sm:max-w-xs">{property.title}</span>
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <button
            onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied!"); }}
            className="flex items-center gap-1.5 text-xs font-medium hover:underline"
            style={{ color: "#1a1209" }}
          >
            <Copy className="h-3.5 w-3.5" /> Share
          </button>
          <button onClick={toggleSave} className="flex items-center gap-1.5 text-xs font-medium hover:underline" style={{ color: "#1a1209" }}>
            <Heart className={`h-3.5 w-3.5 transition-colors ${saved ? "fill-red-500 text-red-500" : ""}`} />
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-10 pb-16">

        {/* ── Title (above gallery on mobile, standard desktop) ─── */}
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold leading-tight break-words" style={{ color: "#1a1209", fontFamily: "'Sora',sans-serif" }}>
            {property.title}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ color: "#836737" }}>
            {property.avg_rating && (
              <span className="flex items-center gap-1 font-semibold" style={{ color: "#1a1209" }}>
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {Number(property.avg_rating).toFixed(1)}
                <span className="font-normal" style={{ color: "#a08858" }}>
                  ({property.review_count} review{property.review_count !== 1 ? "s" : ""})
                </span>
              </span>
            )}
            {property.verified === 1 && (
              <span className="flex items-center gap-1" style={{ color: "#22c55e" }}>
                <BadgeCheck className="h-3.5 w-3.5" /> Verified
              </span>
            )}
            {property.locality && <span>·</span>}
            {[property.locality, property.city, property.state].filter(Boolean).join(", ")}
          </div>
        </div>

        {/* ── Photo gallery ─────────────────────────────────────── */}
        <div style={{ position: "relative" }}>
          <PhotoGallery images={images} title={property.title} />
        </div>

        {/* ── Main 2-column layout ──────────────────────────────── */}
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">

          {/* ── LEFT: content ──────────────────────────────────── */}
          <div className="min-w-0">

            {/* Quick stats row */}
            <div className="flex flex-wrap gap-2 mb-5">
              {property.bedrooms != null && property.bedrooms > 0 && (
                <div className="flex items-center gap-2 rounded-2xl border px-4 py-2.5" style={{ borderColor: "#e8d9c0", backgroundColor: "#fff" }}>
                  <BedDouble className="h-4 w-4" style={{ color: "#836737" }} />
                  <span className="text-sm font-medium" style={{ color: "#1a1209" }}>{property.bedrooms} Bedroom{property.bedrooms > 1 ? "s" : ""}</span>
                </div>
              )}
              {property.bathrooms != null && property.bathrooms > 0 && (
                <div className="flex items-center gap-2 rounded-2xl border px-4 py-2.5" style={{ borderColor: "#e8d9c0", backgroundColor: "#fff" }}>
                  <Bath className="h-4 w-4" style={{ color: "#836737" }} />
                  <span className="text-sm font-medium" style={{ color: "#1a1209" }}>{property.bathrooms} Bathroom{property.bathrooms > 1 ? "s" : ""}</span>
                </div>
              )}
              {property.area_sqft != null && property.area_sqft > 0 && (
                <div className="flex items-center gap-2 rounded-2xl border px-4 py-2.5" style={{ borderColor: "#e8d9c0", backgroundColor: "#fff" }}>
                  <Maximize2 className="h-4 w-4" style={{ color: "#836737" }} />
                  <span className="text-sm font-medium" style={{ color: "#1a1209" }}>{property.area_sqft} sq.ft</span>
                </div>
              )}
              {property.furnished && (
                <div className="flex items-center gap-2 rounded-2xl border px-4 py-2.5" style={{ borderColor: "#e8d9c0", backgroundColor: "#fff" }}>
                  <CheckCircle2 className="h-4 w-4" style={{ color: "#836737" }} />
                  <span className="text-sm font-medium" style={{ color: "#1a1209" }}>{property.furnished}</span>
                </div>
              )}
            </div>

            {/* Owner strip */}
            {property.owner_name && (
              <div className="flex items-center gap-3 p-4 rounded-2xl mb-5" style={{ border: "1px solid #e8d9c0", backgroundColor: "#fff" }}>
                <div className="h-11 w-11 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0"
                  style={{ backgroundColor: GOLD }}>
                  {property.owner_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "#1a1209" }}>Listed by {property.owner_name}</p>
                  <p className="text-xs" style={{ color: "#a08858" }}>
                    {property.owner_verified ? "✓ Verified owner" : "Property owner"} · Listed {new Date(property.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                  </p>
                </div>
                {property.owner_phone && (
                  <a href={`tel:${property.owner_phone}`}
                    className="shrink-0 flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition hover:bg-[#fef3d4]"
                    style={{ borderColor: "#e8d9c0", color: "#836737" }}>
                    <Phone className="h-3.5 w-3.5" style={{ color: GOLD }} /> Call
                  </a>
                )}
              </div>
            )}

            <hr style={{ borderColor: "#e8d9c0" }} />

            {/* About */}
            {property.description && (
              <div className="mt-6">
                <h2 className="text-lg font-bold mb-3" style={{ color: "#1a1209" }}>About This Property</h2>
                <p className="text-sm leading-relaxed" style={{ color: "#4a3818" }}>{property.description}</p>
                <hr className="mt-6" style={{ borderColor: "#e8d9c0" }} />
              </div>
            )}

            {/* Amenities */}
            {amenities.length > 0 && (
              <div className="mt-6">
                <h2 className="text-lg font-bold mb-4" style={{ color: "#1a1209" }}>What This Place Offers</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
                  {visible.map((a: any) => {
                    const name = a.name || a;
                    return (
                      <div key={name} className="flex items-center gap-3 py-1">
                        <div className="shrink-0">
                          {AMENITY_ICONS[name] ?? <CheckCircle2 className="h-4 w-4" style={{ color: GOLD }} />}
                        </div>
                        <span className="text-sm" style={{ color: "#1a1209" }}>{name}</span>
                      </div>
                    );
                  })}
                </div>
                {amenities.length > 8 && (
                  <button
                    onClick={() => setShowAll(s => !s)}
                    className="mt-5 rounded-xl border px-5 py-2.5 text-sm font-semibold transition hover:border-amber-600"
                    style={{ borderColor: "#1a1209", color: "#1a1209", backgroundColor: "#fff" }}
                  >
                    {showAll ? "Show less" : `Show all ${amenities.length} amenities`}
                  </button>
                )}
                <hr className="mt-6" style={{ borderColor: "#e8d9c0" }} />
              </div>
            )}

            {/* Property details grid */}
            <div className="mt-6">
              <h2 className="text-lg font-bold mb-4" style={{ color: "#1a1209" }}>Property Details</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  ["Property type",  property.property_type],
                  ["Listing type",   property.listing_type?.toUpperCase()],
                  ["Carpet area",    property.carpet_area ? `${property.carpet_area} sq.ft` : null],
                  ["Floor",          property.floor_number && property.total_floors ? `${property.floor_number} of ${property.total_floors}` : null],
                  ["Facing",         property.facing],
                  ["Furnishing",     property.furnished],
                  ["Available from", property.available_from],
                  ["Property age",   property.age_years],
                  ["RERA ID",        property.rera_id],
                  ["Parking",        property.parking_slots ? `${property.parking_slots} slot${property.parking_slots > 1 ? "s" : ""}` : null],
                  ["Preferred",      property.preferred_tenants],
                  ["Min lease",      property.min_lease_months ? `${property.min_lease_months} months` : null],
                ].filter(([, v]) => !!v).map(([k, v]) => (
                  <div key={k as string} className="rounded-2xl p-3.5" style={{ backgroundColor: "#fff", border: "1px solid #e8d9c0" }}>
                    <p className="text-[11px] mb-1" style={{ color: "#a08858" }}>{k}</p>
                    <p className="text-sm font-semibold" style={{ color: "#1a1209" }}>{v}</p>
                  </div>
                ))}
              </div>
              <hr className="mt-6" style={{ borderColor: "#e8d9c0" }} />
            </div>

            {/* ── Location + Map ─────────────────────────────── */}
            <div className="mt-6">
              <h2 className="text-lg font-bold mb-2" style={{ color: "#1a1209" }}>Location</h2>
              {[property.locality, property.city, property.state, property.pincode].filter(Boolean).length > 0 && (
                <p className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "#836737" }}>
                  <MapPin className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
                  {[property.locality, property.city, property.state, property.pincode].filter(Boolean).join(", ")}
                </p>
              )}

              <div className="grid gap-5 min-w-0 lg:grid-cols-[1fr_200px]">
                {/* Map — Google Maps iframe, pin at exact property location */}
                <MapSection property={property} onCoordsResolved={setResolvedCoords} />

                {/* Nearby — real POI names + km distances via Overpass API */}
                {resolvedCoords ? (
                  <NearbyPlaces
                    lat={resolvedCoords.lat}
                    lng={resolvedCoords.lng}
                    city={property.city}
                    locality={property.locality}
                  />
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold mb-2" style={{ color: "#a08858" }}>NEARBY</p>
                    <p className="text-xs" style={{ color: "#c8b08a" }}>
                      Available once map location is resolved.
                    </p>
                  </div>
                )}
              </div>

              {/* Open in Google Maps — always use the original map_url (shows named place) */}
              {(property.map_url || resolvedCoords) && (
                <a
                  href={property.map_url ?? `https://www.google.com/maps?q=${resolvedCoords!.lat},${resolvedCoords!.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                  style={{ color: GOLD }}
                >
                  <Navigation className="h-4 w-4" />
                  Open in Google Maps
                </a>
              )}

              <hr className="mt-6" style={{ borderColor: "#e8d9c0" }} />
            </div>

            {/* ── Reviews ───────────────────────────────────── */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold" style={{ color: "#1a1209" }}>
                  {property.avg_rating ? (
                    <span className="flex items-center gap-2">
                      <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                      {Number(property.avg_rating).toFixed(1)} · {property.review_count} review{property.review_count !== 1 ? "s" : ""}
                    </span>
                  ) : "Reviews"}
                </h2>
              </div>

              {/* Submit review */}
              {profile && profile.role !== "owner" && (
                <div className="rounded-2xl border p-5 mb-5" style={{ borderColor: "#e8d9c0", backgroundColor: "#fff" }}>
                  <p className="text-sm font-semibold mb-3" style={{ color: "#1a1209" }}>Leave a review</p>
                  <div className="flex gap-1.5 mb-3">
                    {[1, 2, 3, 4, 5].map(r => (
                      <button key={r} type="button" onClick={() => setReviewRating(r)} className="transition-transform hover:scale-110">
                        <Star className={`h-6 w-6 ${r <= reviewRating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                      </button>
                    ))}
                  </div>
                  <textarea rows={3} value={reviewComment} onChange={e => setReviewComment(e.target.value)}
                    placeholder="Share your experience…"
                    className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none outline-none mb-3"
                    style={{ borderColor: "#e8d9c0", backgroundColor: "#faf6ee", color: "#1a1209" }} />
                  <button onClick={submitReview} disabled={submittingReview || !reviewRating}
                    className="rounded-xl py-2 px-5 text-sm font-semibold text-white flex items-center gap-2 transition hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: GOLD }}>
                    {submittingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit review"}
                  </button>
                </div>
              )}

              {/* Reviews list — 2-col on desktop */}
              {reviews.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {reviews.map(r => (
                    <div key={r.id} className="rounded-2xl border p-4" style={{ borderColor: "#e8d9c0", backgroundColor: "#fff" }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                            style={{ backgroundColor: GOLD }}>
                            {r.reviewer_name?.charAt(0).toUpperCase() ?? "U"}
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "#1a1209" }}>{r.reviewer_name ?? "Anonymous"}</p>
                            <div className="flex gap-0.5 mt-0.5">
                              {Array.from({ length: r.rating }).map((_, i) => (
                                <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                              ))}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs" style={{ color: "#a08858" }}>
                          {new Date(r.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                        </span>
                      </div>
                      {r.comment && <p className="text-sm leading-relaxed" style={{ color: "#4a3818" }}>{r.comment}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-center py-8 rounded-2xl" style={{ color: "#a08858", border: "1px dashed #e8d9c0" }}>
                  No reviews yet. Be the first to review!
                </p>
              )}
              <hr className="mt-6" style={{ borderColor: "#e8d9c0" }} />
            </div>

            {/* Similar properties */}
            {similar.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold" style={{ color: "#1a1209" }}>Similar properties</h2>
                  <Link to="/properties" className="flex items-center gap-1 text-sm font-medium" style={{ color: GOLD }}>
                    View all <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="relative">
                  {/* Left arrow */}
                  {canScrollLeft && (
                    <button
                      onClick={() => scrollSimilar("left")}
                      className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md transition hover:shadow-lg hover:scale-105"
                      style={{ border: "1px solid #e8d9c0" }}
                      aria-label="Scroll left"
                    >
                      <ChevronLeft className="h-4 w-4" style={{ color: "#1a1209" }} />
                    </button>
                  )}
                  {/* Right arrow */}
                  {canScrollRight && (
                    <button
                      onClick={() => scrollSimilar("right")}
                      className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md transition hover:shadow-lg hover:scale-105"
                      style={{ border: "1px solid #e8d9c0" }}
                      aria-label="Scroll right"
                    >
                      <ChevronRight className="h-4 w-4" style={{ color: "#1a1209" }} />
                    </button>
                  )}
                  <div
                    ref={similarScrollRef}
                    className="flex gap-3 overflow-x-auto pb-3"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
                  >
                    {similar.map(p => (
                      <div key={p.id} className="shrink-0" style={{ width: "clamp(160px, 44vw, 208px)" }}>
                        <PropertyCard p={p} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: sticky sidebar ──────────────────────────── */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">

            {/* Price card */}
            <div className="rounded-2xl p-5 shadow-md" style={{ border: "1px solid #e8d9c0", backgroundColor: "#fff" }}>
              {/* Price */}
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-3xl font-extrabold" style={{ color: "#1a1209" }}>
                  {formatINR(property.price)}
                </span>
                {property.listing_type !== "sale" && (
                  <span className="text-base font-medium" style={{ color: "#836737" }}>/month</span>
                )}
              </div>
              {property.deposit != null && (
                <p className="text-xs mb-1" style={{ color: "#a08858" }}>
                  Deposit: {formatINR(property.deposit)}
                </p>
              )}
              {property.maintenance_fee > 0 && (
                <p className="text-xs mb-3" style={{ color: "#a08858" }}>
                  + ₹{property.maintenance_fee.toLocaleString("en-IN")}/mo maintenance
                </p>
              )}
              {property.price_negotiable === 1 && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold mb-3"
                  style={{ backgroundColor: "#e8f5e9", color: "#22c55e" }}>
                  ✓ Price negotiable
                </span>
              )}

              <hr className="mb-4" style={{ borderColor: "#e8d9c0" }} />

              {/* Action buttons */}
              <div className="space-y-2.5">
                {/* Book a visit */}
                {!showVisitForm ? (
                  <button
                    onClick={() => { if (!profile) navigate({ to: "/auth" }); else setShowVisitForm(true); }}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition hover:opacity-90"
                    style={{ backgroundColor: GOLD, boxShadow: "0 4px 14px rgba(201,146,26,0.35)" }}
                  >
                    <Calendar className="h-4 w-4" /> Book a visit
                  </button>
                ) : (
                  <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "#e8d9c0", backgroundColor: "#fef9f0" }}>
                    <p className="text-sm font-semibold" style={{ color: "#1a1209" }}>Schedule your visit</p>
                    <div className="flex gap-2">
                      {(["in_person", "virtual"] as VisitType[]).map(vt => (
                        <button key={vt} type="button"
                          onClick={() => setVisitType(vt)}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition"
                          style={{
                            backgroundColor: visitType === vt ? "#1a1209" : "#fff",
                            color: visitType === vt ? "#fff" : "#836737",
                            border: `1px solid ${visitType === vt ? "#1a1209" : "#e8d9c0"}`,
                          }}
                        >
                          {vt === "in_person" ? <MapPinned className="h-3.5 w-3.5" /> : <Navigation className="h-3.5 w-3.5" />}
                          {vt === "in_person" ? "In person" : "Virtual"}
                        </button>
                      ))}
                    </div>
                    <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                      style={{ borderColor: "#e8d9c0", color: "#1a1209" }} />
                    <select value={visitTime} onChange={e => setVisitTime(e.target.value)}
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                      style={{ borderColor: "#e8d9c0", color: "#1a1209" }}>
                      {["09:00","10:00","11:00","12:00","14:00","15:00","16:00","17:00","18:00"]
                        .map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => setShowVisitForm(false)}
                        className="flex-1 rounded-xl border py-2 text-sm font-medium transition hover:bg-[#fef3d4]"
                        style={{ borderColor: "#e8d9c0", color: "#836737" }}>
                        Cancel
                      </button>
                      <button onClick={bookVisit} disabled={bookingVisit || !visitDate}
                        className="flex-1 rounded-xl py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: GOLD }}>
                        {bookingVisit ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Confirm"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Contact owner */}
                {property.owner_phone && (
                  <a href={`tel:${property.owner_phone}`}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-semibold transition hover:bg-[#fef9f0]"
                    style={{ borderColor: "#e8d9c0", color: "#1a1209" }}>
                    <Phone className="h-4 w-4" style={{ color: GOLD }} /> Contact owner
                  </a>
                )}

                {/* Send message */}
                <button
                  onClick={() => { if (!profile) { navigate({ to: "/auth" }); return; } setShowMessageForm(v => !v); }}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-semibold transition hover:bg-[#fef9f0]"
                  style={{ borderColor: "#e8d9c0", color: "#1a1209" }}>
                  <MessageSquare className="h-4 w-4" style={{ color: GOLD }} /> Send message
                </button>
                {showMessageForm && (
                  <div className="rounded-2xl border p-4 space-y-2.5" style={{ borderColor: "#e8d9c0", backgroundColor: "#fef9f0" }}>
                    <textarea rows={3} value={messageText} onChange={e => setMessageText(e.target.value)}
                      placeholder="Hi, I'm interested in this property…"
                      className="w-full rounded-xl border px-3 py-2 text-sm resize-none outline-none"
                      style={{ borderColor: "#e8d9c0", backgroundColor: "#fff", color: "#1a1209" }} />
                    <div className="flex gap-2">
                      <button onClick={() => { setShowMessageForm(false); setMessageText(""); }}
                        className="flex-1 rounded-xl border py-2 text-sm font-medium" style={{ borderColor: "#e8d9c0", color: "#836737" }}>
                        Cancel
                      </button>
                      <button onClick={sendDirectMessage} disabled={sendingMessage || !messageText.trim()}
                        className="flex-1 rounded-xl py-2 text-sm font-bold text-white disabled:opacity-50"
                        style={{ backgroundColor: GOLD }}>
                        {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Send"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <hr className="my-4" style={{ borderColor: "#e8d9c0" }} />

              {/* Send inquiry */}
              <p className="text-sm font-semibold mb-2" style={{ color: "#1a1209" }}>Send an inquiry</p>
              <textarea rows={3} value={inquiryMsg} onChange={e => setInquiry(e.target.value)}
                placeholder="Hi, I'm interested in this property…"
                className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none outline-none"
                style={{ borderColor: "#e8d9c0", backgroundColor: "#faf6ee", color: "#1a1209" }} />
              <button onClick={sendInquiry} disabled={sending}
                className="mt-2 w-full rounded-2xl py-3 text-sm font-bold text-white flex items-center justify-center gap-2 transition hover:opacity-90"
                style={{ backgroundColor: GOLD }}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send inquiry"}
              </button>
            </div>

            {/* Verified badge card */}
            {!!property.verified && (
              <div className="rounded-2xl p-4" style={{ border: "1px solid #e8d9c0", backgroundColor: "#fff" }}>
                <div className="flex items-center gap-2 mb-2">
                  <BadgeCheck className="h-5 w-5" style={{ color: "#22c55e" }} />
                  <span className="text-sm font-semibold" style={{ color: "#1a1209" }}>Verified property</span>
                </div>
                <p className="text-xs mb-3" style={{ color: "#836737" }}>This property is verified by Nivaas.</p>
                <hr style={{ borderColor: "#e8d9c0" }} />
                <div className="mt-3 space-y-1 text-xs" style={{ color: "#836737" }}>
                  <p>ID: {property.rera_id || "NV" + property.id.slice(0, 6).toUpperCase()}</p>
                  <p>Listed: {new Date(property.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  <p>Updated: {new Date(property.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
              </div>
            )}

            {/* Need help card */}
            <div className="rounded-2xl p-4" style={{ border: "1px solid #e8d9c0", backgroundColor: "#fff" }}>
              <p className="text-sm font-semibold mb-1" style={{ color: "#1a1209" }}>Need help?</p>
              <p className="text-xs mb-3" style={{ color: "#836737" }}>Our support team is here to help.</p>
              <button className="w-full flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition hover:bg-[#fef9f0]"
                style={{ borderColor: "#e8d9c0", color: "#1a1209" }}>
                <MessageSquare className="h-4 w-4" style={{ color: GOLD }} /> Chat with us
              </button>
            </div>
          </div>

        </div>{/* end 2-col grid */}
      </div>

      <Footer />
    </div>
  );
}
