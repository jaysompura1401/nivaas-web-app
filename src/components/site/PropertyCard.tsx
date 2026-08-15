import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, Maximize2 } from "lucide-react";
import { type ApiProperty, saved as savedApi } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { formatINR } from "@/lib/mock-properties";
import { useEffect, useState } from "react";

const GOLD = "#C9921A";
const PLACEHOLDER = "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&auto=format&fit=crop&q=80";

interface PropertyCardProps {
  p: ApiProperty;
  compact?: boolean;
  initialSaved?: boolean;
  onSaveChange?: (id: string, saved: boolean) => void;
}

export function PropertyCard({ p, compact = false, initialSaved, onSaveChange }: PropertyCardProps) {
  const { profile } = useAuth();
  const navigate    = useNavigate();

  const [isSaved, setIsSaved] = useState(initialSaved ?? false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile || initialSaved !== undefined) return;
    savedApi.check(p.id)
      .then(r => setIsSaved(r.saved))
      .catch(() => {});
  }, [p.id, profile, initialSaved]);

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!profile) { navigate({ to: "/auth" }); return; }
    if (loading) return;
    setLoading(true);
    try {
      if (isSaved) {
        await savedApi.unsave(p.id);
        setIsSaved(false);
        onSaveChange?.(p.id, false);
      } else {
        await savedApi.save(p.id);
        setIsSaved(true);
        onSaveChange?.(p.id, true);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  const coverImage =
    (p.images && p.images.length > 0 ? p.images[0] : null) ??
    p.cover_image_url ??
    PLACEHOLDER;

  const typeLabel = p.bedrooms && p.bedrooms > 0
    ? `${p.bedrooms} BHK ${p.property_type}`
    : p.property_type;

  return (
    <Link
      to="/properties/$id"
      params={{ id: p.id }}
      className="group flex flex-col h-full overflow-hidden rounded-2xl bg-white transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
      style={{ border: "1px solid #f0e4cc" }}
    >
      {/* Image — uses aspect-ratio so it scales with card width */}
      <div className="relative overflow-hidden w-full" style={{ aspectRatio: "4/3" }}>
        <img
          src={coverImage}
          alt={p.title}
          loading="lazy"
          onError={e => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Type badge top-left */}
        <div className="absolute top-2 left-2 max-w-[calc(100%-3rem)]">
          <span
            className="block rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight truncate"
            style={{ backgroundColor: "rgba(255,255,255,0.92)", color: "#1a1209", backdropFilter: "blur(4px)" }}
          >
            {typeLabel}
          </span>
        </div>

        {/* Heart button top-right */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
          style={{ backgroundColor: "rgba(255,255,255,0.92)", backdropFilter: "blur(4px)" }}
          aria-label={isSaved ? "Remove from saved" : "Save property"}
        >
          <Heart
            className="h-3.5 w-3.5 transition-colors duration-200"
            style={{ color: isSaved ? "#ef4444" : "#836737", fill: isSaved ? "#ef4444" : "none" }}
          />
        </button>
      </div>

      {/* Info */}
      <div className="px-2.5 sm:px-3 py-2 sm:py-2.5 flex flex-col flex-1 min-w-0">
        {/* Locality */}
        <p className="text-[10px] sm:text-[11px] truncate" style={{ color: "#a08858" }}>
          {p.property_type} in {p.locality || p.city}
        </p>

        {/* Title */}
        <p className="mt-0.5 text-[12px] sm:text-[13px] font-semibold leading-snug line-clamp-1" style={{ color: "#1a1209" }}>
          {p.title}
        </p>

        {/* Price + area — always one line, never wraps */}
        <div className="mt-auto pt-1 flex items-center gap-1 min-w-0 overflow-hidden">
          {/* Price — shrinks if needed but never wraps */}
          <span className="text-[11px] sm:text-xs font-bold shrink-0" style={{ color: GOLD }}>
            {formatINR(p.price)}
            {p.listing_type !== "sale" && (
              <span className="text-[9px] font-normal" style={{ color: "#a08858" }}>/mo</span>
            )}
          </span>
          {p.area_sqft && p.area_sqft > 0 && (
            <>
              <span className="shrink-0" style={{ color: "#d4b896" }}>·</span>
              <span className="flex items-center gap-0.5 text-[10px] min-w-0 overflow-hidden" style={{ color: "#a08858" }}>
                <Maximize2 className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{p.area_sqft} sq.ft</span>
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
