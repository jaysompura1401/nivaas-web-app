/**
 * PropertyMap.tsx - v9
 * Fix: single shared closeTimerRef passed into InnerMap so
 * card onMouseEnter cancels the exact same timer set by pin mouseout.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "@tanstack/react-router";
import type { ApiProperty } from "@/lib/api";
import { formatINR, formatMarkerPrice } from "@/lib/mock-properties";

export interface MapBounds {
  lat_min: number; lat_max: number;
  lng_min: number; lng_max: number;
}
export interface PropertyMapHandle {
  fitAll: () => void;
  panTo: (id: string) => void;
}
interface PropertyMapProps {
  properties: ApiProperty[];
  selectedId?: string | null;
  hoveredId?: string | null;
  onMarkerClick?: (id: string | null) => void;
  onMarkerHover?: (id: string | null) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
  defaultCenter?: [number, number];
  defaultZoom?: number;
  className?: string;
  style?: CSSProperties;
}
interface PopupState {
  property: ApiProperty;
  x: number;
  y: number;
}

const GOLD = "#C9921A";
const DARK = "#1a1209";
const DEFAULT_CENTER: [number, number] = [23.02, 72.57];
const DEFAULT_ZOOM = 10;
const PLACEHOLDER = "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&auto=format&fit=crop&q=80";

interface LeafletModules {
  L: typeof import("leaflet");
  RL: typeof import("react-leaflet");
}
let leafletPromise: Promise<LeafletModules> | null = null;
function getLeaflet(): Promise<LeafletModules> {
  if (!leafletPromise) {
    leafletPromise = (async () => {
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
  return leafletPromise;
}

type PinState = "default" | "hovered" | "selected";

function buildPinHtml(state: PinState, price: number, listingType: string): string {
  const label = formatMarkerPrice(price);
  const suffix = listingType !== "sale" ? "/mo" : "";

  // Pin colors
  let fill: string, stroke: string;
  let scale: string, shadow: string;
  let textColor: string;

  if (state === "hovered") {
    fill = "#1a1209"; stroke = "#000";
    scale = "scale(1.15)"; shadow = "drop-shadow(0 4px 8px rgba(0,0,0,0.45))";
    textColor = "#1a1209";
  } else if (state === "selected") {
    fill = "#C9921A"; stroke = "#b5800e";
    scale = "scale(1.18)"; shadow = "drop-shadow(0 4px 10px rgba(201,146,26,0.55))";
    textColor = "#C9921A";
  } else {
    fill = "#C9921A"; stroke = "#b5800e";
    scale = "scale(1)"; shadow = "drop-shadow(0 2px 4px rgba(0,0,0,0.28))";
    textColor = "#1a1209";
  }

  // Layout: pin centered on top, price text centered below
  // Total width ~60px, pin 28px centered, text below
  return (
    '<div style="' +
      'display:flex;flex-direction:column;align-items:center;gap:1px;' +
      'transform:' + scale + ';' +
      'transform-origin:center bottom;' +
      'transition:transform 0.15s ease,filter 0.15s ease;' +
      'cursor:pointer;pointer-events:none;filter:' + shadow + ';' +
    '">' +
      // Pin SVG (28×36)
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 36" width="28" height="36">' +
        '<path d="M14 0C8.477 0 4 4.477 4 10c0 7.5 10 26 10 26S24 17.5 24 10C24 4.477 19.523 0 14 0z"' +
        ' fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.2"/>' +
        '<circle cx="14" cy="10" r="4.5" fill="white" opacity="0.9"/>' +
      '</svg>' +
      // Price text below pin — no pill, plain bold text with subtle shadow
      '<span style="' +
        'font-family:system-ui,-apple-system,sans-serif;' +
        'font-size:11px;font-weight:800;white-space:nowrap;' +
        'color:' + textColor + ';' +
        'text-shadow:0 1px 3px rgba(255,255,255,0.9),0 0 6px rgba(255,255,255,0.8);' +
        'line-height:1;letter-spacing:-0.2px;' +
      '">' + label + '<span style="font-size:8px;font-weight:600;opacity:0.8;margin-left:1px">' + suffix + '</span></span>' +
    '</div>'
  );
}

// ─── Popup card ───────────────────────────────────────────────────────────────

function PropertyPopupCard({
  popup, onClose, onCancelClose, containerWidth,
}: {
  popup: PopupState;
  onClose: () => void;
  onCancelClose: () => void;
  containerWidth: number;
}) {
  const CARD_W = 280;
  const CARD_H = 310;
  const GAP    = 10;

  let left = popup.x - CARD_W / 2;
  let top  = popup.y - CARD_H - GAP;
  if (top < 8) top = popup.y + GAP + 10;
  left = Math.max(8, Math.min(left, containerWidth - CARD_W - 8));

  const { property } = popup;
  const img = (property.images && property.images[0]) ?? property.cover_image_url ?? PLACEHOLDER;
  const badgeBg = property.listing_type === "sale" ? GOLD : property.listing_type === "pg" ? "#6b4f2a" : DARK;
  const badgeLabel = property.listing_type === "sale" ? "Buy" : property.listing_type === "pg" ? "PG" : "Rent";

  return (
    <div
      style={{
        position: "absolute", left, top, zIndex: 1200, width: CARD_W,
        background: "#fff", borderRadius: 14,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: "1px solid #e8d9c0",
        overflow: "hidden", pointerEvents: "all",
        animation: "pmCardIn 0.18s cubic-bezier(.34,1.56,.64,1) forwards",
      }}
      onMouseEnter={onCancelClose}
      onMouseLeave={onClose}
    >
      <div style={{ height: 145, overflow: "hidden", position: "relative" }}>
        <img src={img} alt={property.title}
          onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        <span style={{
          position: "absolute", top: 8, left: 8, background: badgeBg,
          color: "#fff", borderRadius: 999, padding: "2px 8px",
          fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
        }}>{badgeLabel}</span>
      </div>
      <div style={{ padding: "10px 12px 12px" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: DARK,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {property.title}
        </p>
        {(property.locality || property.city) && (
          <p style={{ margin: "3px 0 8px", fontSize: 11, color: "#a08858",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {[property.locality, property.city].filter(Boolean).join(", ")}
          </p>
        )}
        <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#836737", marginBottom: 10 }}>
          {property.bedrooms != null && property.bedrooms > 0 && <span>{property.bedrooms} bd</span>}
          {property.bathrooms != null && property.bathrooms > 0 && <span>{property.bathrooms} ba</span>}
          {property.area_sqft != null && property.area_sqft > 0 && <span>{property.area_sqft} sqft</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: DARK }}>
            {formatINR(property.price)}
            {property.listing_type !== "sale" && (
              <span style={{ fontSize: 10, fontWeight: 400, color: "#a08858" }}>/mo</span>
            )}
          </span>
          <Link to="/properties/$id" params={{ id: property.id }}
            style={{ background: GOLD, color: "#fff", borderRadius: 999,
              padding: "6px 16px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
            View
          </Link>
        </div>
      </div>
      <style>{`@keyframes pmCardIn{from{opacity:0;transform:scale(0.93)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}

// ─── Inner map ────────────────────────────────────────────────────────────────

interface InnerMapProps extends PropertyMapProps {
  L: LeafletModules["L"];
  RL: LeafletModules["RL"];
  mapHandleRef: React.MutableRefObject<PropertyMapHandle | null>;
  onInternalHover: (popup: PopupState | null) => void;
  onInternalClick: (popup: PopupState | null) => void;
  // Shared timer ref — owned by PropertyMap, used here to set the close delay
  closeTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

function InnerMap({
  L, RL, properties, selectedId, hoveredId,
  onMarkerClick, onMarkerHover, onBoundsChange,
  defaultCenter = DEFAULT_CENTER, defaultZoom = DEFAULT_ZOOM,
  mapHandleRef, onInternalHover, onInternalClick,
  closeTimerRef,
}: InnerMapProps) {
  const { MapContainer, TileLayer, ZoomControl, useMap, useMapEvents } = RL;

  const mapRef       = useRef<ReturnType<typeof L.map> | null>(null);
  const markerMapRef = useRef<Map<string, ReturnType<typeof L.marker>>>(new Map());

  const propertiesRef = useRef(properties);
  const selectedIdRef = useRef(selectedId);
  const hoveredIdRef  = useRef(hoveredId);
  const onHoverRef    = useRef(onInternalHover);
  const onClickRef    = useRef(onInternalClick);
  const onMHoverRef   = useRef(onMarkerHover);
  const onMClickRef   = useRef(onMarkerClick);

  useEffect(() => { propertiesRef.current = properties;      }, [properties]);
  useEffect(() => { selectedIdRef.current = selectedId;      }, [selectedId]);
  useEffect(() => { hoveredIdRef.current  = hoveredId;       }, [hoveredId]);
  useEffect(() => { onHoverRef.current    = onInternalHover; }, [onInternalHover]);
  useEffect(() => { onClickRef.current    = onInternalClick; }, [onInternalClick]);
  useEffect(() => { onMHoverRef.current   = onMarkerHover;   }, [onMarkerHover]);
  useEffect(() => { onMClickRef.current   = onMarkerClick;   }, [onMarkerClick]);

  const refreshMarker = useCallback((id: string) => {
    const marker = markerMapRef.current.get(id);
    if (!marker) return;
    const prop = propertiesRef.current.find((x) => x.id === id);
    if (!prop) return;
    const state: PinState =
      id === selectedIdRef.current ? "selected" :
      id === hoveredIdRef.current  ? "hovered"  : "default";
    marker.setIcon(L.divIcon({ html: buildPinHtml(state, prop.price, prop.listing_type), className: "", iconSize: [60, 50], iconAnchor: [30, 36] }));
    marker.setZIndexOffset(state === "selected" ? 1000 : state === "hovered" ? 500 : 0);
  }, [L]);

  const prevHovRef = useRef<string | null | undefined>(null);
  useEffect(() => {
    const prev = prevHovRef.current;
    if (prev) refreshMarker(prev);
    if (hoveredId) refreshMarker(hoveredId);
    prevHovRef.current = hoveredId;
  }, [hoveredId, refreshMarker]);

  const prevSelRef = useRef<string | null | undefined>(null);
  useEffect(() => {
    const prev = prevSelRef.current;
    if (prev) refreshMarker(prev);
    if (selectedId) refreshMarker(selectedId);
    prevSelRef.current = selectedId;
  }, [selectedId, refreshMarker]);

  useEffect(() => {
    mapHandleRef.current = {
      fitAll() {
        const map = mapRef.current;
        if (!map) return;
        const valid = properties.filter((p) => p.latitude != null && p.longitude != null);
        if (!valid.length) return;
        map.fitBounds(L.latLngBounds(valid.map((p) => [p.latitude!, p.longitude!] as [number, number])), { padding: [40, 40], maxZoom: 14 });
      },
      panTo(id: string) {
        const map = mapRef.current;
        if (!map) return;
        const p = properties.find((x) => x.id === id);
        if (p?.latitude != null && p?.longitude != null)
          map.panTo([p.latitude, p.longitude], { animate: true, duration: 0.6 });
      },
    };
    return () => { mapHandleRef.current = null; };
  });

  function MapController() {
    const map = useMap();
    useEffect(() => { mapRef.current = map; }, [map]);
    useMapEvents({
      moveend: () => {
        if (!onBoundsChange) return;
        const b = map.getBounds();
        onBoundsChange({ lat_min: b.getSouth(), lat_max: b.getNorth(), lng_min: b.getWest(), lng_max: b.getEast() });
      },
      zoomend: () => {
        if (!onBoundsChange) return;
        const b = map.getBounds();
        onBoundsChange({ lat_min: b.getSouth(), lat_max: b.getNorth(), lng_min: b.getWest(), lng_max: b.getEast() });
      },
    });
    useEffect(() => {
      const t = setTimeout(() => {
        if (!onBoundsChange) return;
        const b = map.getBounds();
        onBoundsChange({ lat_min: b.getSouth(), lat_max: b.getNorth(), lng_min: b.getWest(), lng_max: b.getEast() });
      }, 250);
      return () => clearTimeout(t);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  }

  function MarkerLayer() {
    const map = useMap();
    useEffect(() => {
      const currentIds = new Set(
        properties.filter((p) => p.latitude != null && p.longitude != null).map((p) => p.id)
      );
      markerMapRef.current.forEach((m, id) => {
        if (!currentIds.has(id)) { m.remove(); markerMapRef.current.delete(id); }
      });

      for (const p of properties) {
        if (p.latitude == null || p.longitude == null) continue;
        if (markerMapRef.current.has(p.id)) continue;

        const marker = L.marker([p.latitude, p.longitude], {
          icon: L.divIcon({ html: buildPinHtml("default", p.price, p.listing_type), className: "", iconSize: [60, 50], iconAnchor: [30, 36] }),
          zIndexOffset: 0,
        });
        const id = p.id;

        marker.on("mouseover", () => {
          // Cancel any pending close timer (e.g. mouse moving back from card to pin)
          if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
          hoveredIdRef.current = id;
          refreshMarker(id);
          onMHoverRef.current?.(id);
          const prop = propertiesRef.current.find((x) => x.id === id) ?? null;
          if (!prop || prop.latitude == null || prop.longitude == null) return;
          const pt = map.latLngToContainerPoint([prop.latitude, prop.longitude]);
          onHoverRef.current({ property: prop, x: pt.x, y: pt.y });
        });

        marker.on("mouseout", () => {
          hoveredIdRef.current = null;
          refreshMarker(id);
          onMHoverRef.current?.(null);
          // Wait 160ms before hiding — gives mouse time to reach the card.
          // Card's onMouseEnter will cancel this timer if mouse gets there.
          if (selectedIdRef.current !== id) {
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
            closeTimerRef.current = setTimeout(() => {
              closeTimerRef.current = null;
              onHoverRef.current(null);
            }, 160);
          }
        });

        marker.on("click", () => {
          if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
          const prop = propertiesRef.current.find((x) => x.id === id) ?? null;
          if (!prop || prop.latitude == null || prop.longitude == null) return;
          const pt = map.latLngToContainerPoint([prop.latitude, prop.longitude]);
          onClickRef.current({ property: prop, x: pt.x, y: pt.y });
          onMClickRef.current?.(id);
        });

        marker.addTo(map);
        markerMapRef.current.set(id, marker);
      }

      markerMapRef.current.forEach((_, id) => refreshMarker(id));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [properties, map]);

    return null;
  }

  const validProps = properties.filter((p) => p.latitude != null && p.longitude != null);
  const center: [number, number] =
    validProps.length > 0 ? [validProps[0].latitude!, validProps[0].longitude!] : defaultCenter;

  return (
    <MapContainer center={center} zoom={defaultZoom} zoomControl={false} attributionControl={false}
      style={{ width: "100%", height: "100%" }} scrollWheelZoom={false}>
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={19} />
      <ZoomControl position="bottomright" />
      <MapController />
      <MarkerLayer />
    </MapContainer>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export const PropertyMap = forwardRef<PropertyMapHandle, PropertyMapProps>(
  function PropertyMap(props, ref) {
    const {
      properties, selectedId = null, hoveredId = null,
      onMarkerClick, onMarkerHover, className = "", style,
      defaultCenter = DEFAULT_CENTER, defaultZoom = DEFAULT_ZOOM,
    } = props;

    const [modules,   setModules]   = useState<LeafletModules | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [popup,     setPopup]     = useState<PopupState | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerW, setContainerW] = useState(800);
    const internalHandleRef = useRef<PropertyMapHandle | null>(null);

    // THE KEY FIX: single shared timer ref — passed into InnerMap AND read by card callbacks.
    // When mouseout fires on pin, InnerMap sets closeTimerRef.current = setTimeout(...).
    // When mouse enters card, handleCancelClose clears closeTimerRef.current.
    // Same ref object, so the cancel always targets the right timer.
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useImperativeHandle(ref, () => ({
      fitAll: () => internalHandleRef.current?.fitAll(),
      panTo:  (id: string) => internalHandleRef.current?.panTo(id),
    }));

    useEffect(() => {
      getLeaflet().then(setModules).catch((err) => {
        console.error("[PropertyMap] Leaflet load error:", err);
        setLoadError("Failed to load map. Please refresh.");
      });
    }, []);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const ro = new ResizeObserver(() => setContainerW(el.offsetWidth));
      ro.observe(el);
      setContainerW(el.offsetWidth);
      return () => ro.disconnect();
    }, []);

    const handleInternalHover = useCallback((p: PopupState | null) => { setPopup(p); }, []);
    const handleInternalClick = useCallback((p: PopupState | null) => {
      setPopup((prev) => (prev?.property.id === p?.property.id ? null : p));
    }, []);

    // Cancel the close timer when mouse enters the card
    const handleCancelClose = useCallback(() => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    }, []);

    // Close popup immediately (called from card's onMouseLeave)
    const handleClose = useCallback(() => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setPopup(null);
      onMarkerClick?.(null);
    }, [onMarkerClick]);

    const containerStyle: CSSProperties = {
      width: "100%", height: "100%", position: "relative", background: "#e8e0d5", ...style,
    };

    if (loadError) {
      return (
        <div className={className} style={{ ...containerStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#a08858", fontSize: 13, textAlign: "center", padding: 16 }}>{loadError}</p>
        </div>
      );
    }

    if (!modules) {
      return (
        <div className={className} style={{ ...containerStyle, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2, width: 72, height: 72, opacity: 0.4 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} style={{ background: "#c4b49a", borderRadius: 3, animation: `pmPulse ${1.2 + (i % 3) * 0.15}s ease-in-out infinite` }} />
            ))}
          </div>
          <p style={{ color: "#a08858", fontSize: 12 }}>Loading map...</p>
          <style>{`@keyframes pmPulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
        </div>
      );
    }

    return (
      <div ref={containerRef} className={className} style={containerStyle}>
        <InnerMap
          {...props}
          properties={properties} selectedId={selectedId} hoveredId={hoveredId}
          defaultCenter={defaultCenter} defaultZoom={defaultZoom}
          L={modules.L} RL={modules.RL}
          mapHandleRef={internalHandleRef}
          onMarkerClick={onMarkerClick} onMarkerHover={onMarkerHover}
          onInternalHover={handleInternalHover}
          onInternalClick={handleInternalClick}
          closeTimerRef={closeTimerRef}
        />
        {popup && (
          <PropertyPopupCard
            popup={popup}
            onClose={handleClose}
            onCancelClose={handleCancelClose}
            containerWidth={containerW}
          />
        )}
      </div>
    );
  }
);
