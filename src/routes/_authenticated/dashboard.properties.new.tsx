import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AIPricingWidget } from "@/components/dashboard/AIPricingWidget";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCallback, useEffect, useRef, useState } from "react";
import { properties as propertiesApi, uploadImages, type ApiPropertyImage } from "@/lib/api";
import { cities, propertyTypes } from "@/lib/mock-properties";
import {
  Loader2, ChevronLeft, ChevronRight, Check,
  ImagePlus, X, Star, Upload, AlertCircle, MapPin, Navigation, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

export const Route = createFileRoute("/_authenticated/dashboard/properties/new")({
  head: () => ({ meta: [{ title: "Post Property — Nivaas" }] }),
  component: NewProperty,
});

// ─── Constants ────────────────────────────────────────────────────────────────
const AMENITY_OPTIONS = [
  "WiFi","Air Conditioning","Parking","Power Backup","Water Supply 24/7","Lift/Elevator",
  "CCTV Security","Security Guard","Gym","Swimming Pool","Clubhouse","Children Play Area",
  "Housekeeping","Laundry","Meals Included","Pet Friendly","Balcony","Gas Pipeline",
  "Intercom","Jogging Track",
];

const STEPS = [
  { id: 1, label: "Basic info" },
  { id: 2, label: "Configuration" },
  { id: 3, label: "Location" },
  { id: 4, label: "Photos" },       // ← NEW step
  { id: 5, label: "Pricing" },
];

interface FormState {
  title: string; description: string; property_type: string; listing_type: string;
  bedrooms: string; bathrooms: string; area_sqft: string; furnished: string;
  amenities: string[]; city: string; locality: string; address: string;
  price: string; deposit: string;
  latitude: string; longitude: string;
  map_url: string;
}

const INITIAL: FormState = {
  title: "", description: "", property_type: "Apartment", listing_type: "rent",
  bedrooms: "", bathrooms: "", area_sqft: "", furnished: "Semi-Furnished",
  amenities: [], city: "Ahmedabad", locality: "", address: "", price: "", deposit: "",
  latitude: "", longitude: "", map_url: "",
};

// ─── Extract lat/lng from any Google Maps URL format ─────────────────────────
// All patterns require ≥4 decimal places to avoid matching version numbers,
// port numbers, or other integers that appear in URLs.
// Mirrors the server-side extractCoords() in server/routes/maps.js.
function extractLatLng(url: string): { lat: string; lng: string } | null {
  if (!url) return null;
  let m: RegExpMatchArray | null;

  // 1. @lat,lng,zoom  — standard browser URL after searching / dropping a pin
  //    e.g. maps.google.com/maps/@23.06089,72.54780,17z
  m = url.match(/@(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);
  if (m) return { lat: m[1], lng: m[2] };

  // 2. !3d<lat>!4d<lng>  — place embed links
  //    e.g. /maps/place/Name/@lat,lng/...!3d23.0608!4d72.5478
  m = url.match(/!3d(-?\d{1,3}\.\d{4,})!4d(-?\d{1,3}\.\d{4,})/);
  if (m) return { lat: m[1], lng: m[2] };

  // 3. ?q=lat,lng  — numeric coords only (not text place names)
  m = url.match(/[?&]q=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);
  if (m) return { lat: m[1], lng: m[2] };

  // 4. ll=lat,lng
  m = url.match(/\bll=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);
  if (m) return { lat: m[1], lng: m[2] };

  // 5. center=lat,lng
  m = url.match(/\bcenter=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);
  if (m) return { lat: m[1], lng: m[2] };

  // 6. /@lat,lng  — path-embedded (share links after /maps/)
  m = url.match(/\/@(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);
  if (m) return { lat: m[1], lng: m[2] };

  // 7. !8m2!3d<lat>!4d<lng>  — directions embed variant
  m = url.match(/!8m2!3d(-?\d{1,3}\.\d{4,})!4d(-?\d{1,3}\.\d{4,})/);
  if (m) return { lat: m[1], lng: m[2] };

  // 8. daddr=lat,lng or saddr=lat,lng  — directions links
  m = url.match(/[sd]addr=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);
  if (m) return { lat: m[1], lng: m[2] };

  return null;
}

// Validate that extracted coords are plausible GPS values.
function validLatLng(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) && !isNaN(lng) &&
    lat >= -90  && lat <= 90   &&
    lng >= -180 && lng <= 180  &&
    !(lat === 0 && lng === 0)   // (0,0) = bad extraction artifact, not a real property
  );
}

// ─── Image preview type ───────────────────────────────────────────────────────
interface PreviewImage {
  file: File;
  previewUrl: string;
  isCover: boolean;
}

// ─── Main Component ───────────────────────────────────────────────────────────
function NewProperty() {
  const [step, setStep]         = useState(1);
  const [loading, setLoading]     = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string>("");
  const [resolvingSlow, setResolvingSlow] = useState(false); // show "taking long?" hint
  const [form, setForm]           = useState<FormState>(INITIAL);
  const [images, setImages]     = useState<PreviewImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef            = useRef<HTMLInputElement>(null);
  const navigate                = useNavigate();

  const upd = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));
  const toggleAmenity = (name: string) =>
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(name)
        ? f.amenities.filter(a => a !== name)
        : [...f.amenities, name],
    }));

  // ── Auto-resolve map_url whenever the owner pastes a Google Maps link ────────
  // Flow:
  //  1. Client-side regex extraction (instant, no network) — covers all full google.com URLs.
  //  2. Server-side resolve (debounced 600ms) — for short links (maps.app.goo.gl) that
  //     require redirect-following + HTML scanning.
  //  3. Strict validLatLng() check on every result — rejects (0,0) and out-of-range values.
  // On success → lat/lng saved to form state and submitted to DB at listing creation.
  const resolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const url = form.map_url.trim();

    // Clear coords when field is emptied
    if (!url) {
      setResolveError("");
      setResolvingSlow(false);
      setForm(f => ({ ...f, latitude: "", longitude: "" }));
      return;
    }

    // Step 1 — instant client-side extraction from the URL string itself.
    // Works for any full maps.google.com URL (which contains coords in the URL).
    // Short links (maps.app.goo.gl) won't have coords here → go to Step 2.
    const direct = extractLatLng(url);
    if (direct) {
      const lat = Number(direct.lat), lng = Number(direct.lng);
      if (validLatLng(lat, lng)) {
        setResolveError("");
        setForm(f => ({ ...f, latitude: direct.lat, longitude: direct.lng }));
        return;
      }
    }

    // Step 2 — short link or unrecognised format → call backend resolver.
    // The server follows redirects and scans HTML body for exact embedded coords.
    // It NEVER geocodes place names — 422 is returned if exact coords can't be found.
    if (resolveTimer.current) clearTimeout(resolveTimer.current);
    setResolving(true);
    setResolvingSlow(false);
    setResolveError("");
    setForm(f => ({ ...f, latitude: "", longitude: "" })); // clear stale coords during resolution

    resolveTimer.current = setTimeout(async () => {
      // Show "taking long?" hint after 6 seconds
      const slowTimer = setTimeout(() => setResolvingSlow(true), 6_000);

      try {
        // 30s timeout — Google short links sometimes take time to resolve server-side
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);

        const res = await fetch(
          `/api/maps/resolve?url=${encodeURIComponent(url)}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        const data = await res.json();

        if (res.ok && data.lat && data.lng && validLatLng(Number(data.lat), Number(data.lng))) {
          setForm(f => ({ ...f, latitude: String(data.lat), longitude: String(data.lng) }));
          setResolveError("");
        } else {
          setResolveError(
            data.tip ??
            data.error ??
            "Could not extract exact coordinates. Try: Google Maps → long-press the exact pin → Share → Copy link.",
          );
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          setResolveError(
            "Resolving timed out. Try pasting a full Google Maps URL instead: maps.google.com → search your property → copy the browser URL."
          );
        } else {
          setResolveError("Network error — make sure the server is running.");
        }
      } finally {
        clearTimeout(slowTimer);
        setResolvingSlow(false);
        setResolving(false);
      }
    }, 600);

    return () => {
      if (resolveTimer.current) clearTimeout(resolveTimer.current);
    };
  }, [form.map_url]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Image handlers ───────────────────────────────────────────────────────────
  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const valid = arr.filter(f => ["image/jpeg","image/jpg","image/png","image/webp"].includes(f.type));
    if (valid.length !== arr.length) toast.error("Only JPG, PNG and WEBP allowed.");

    const remaining = 10 - images.length;
    if (remaining <= 0) { toast.error("Maximum 10 images allowed."); return; }

    const toAdd = valid.slice(0, remaining).map((file, i) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      isCover: images.length === 0 && i === 0,
    }));

    setImages(prev => {
      const updated = [...prev, ...toAdd];
      // Ensure exactly one cover
      if (!updated.some(x => x.isCover) && updated.length > 0) {
        updated[0] = { ...updated[0], isCover: true };
      }
      return updated;
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      const next = prev.filter((_, i) => i !== index);
      // Re-assign cover if removed image was cover
      if (prev[index].isCover && next.length > 0) {
        next[0] = { ...next[0], isCover: true };
      }
      return next;
    });
  };

  const setCover = (index: number) => {
    setImages(prev => prev.map((img, i) => ({ ...img, isCover: i === index })));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [images]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  // ── Step validation ───────────────────────────────────────────────────────────
  const canAdvance = () => {
    if (step === 1) return form.title.trim().length > 0;
    if (step === 3) {
      if (!form.locality.trim()) return false;
      // Block if user has pasted a map link but coords haven't resolved yet
      if (form.map_url.trim() && resolving) return false;
      return true;
    }
    if (step === 4) return images.length > 0;
    if (step === 5) return form.price.trim().length > 0;
    return true;
  };

  const next = () => {
    if (!canAdvance()) {
      if (step === 3 && form.map_url.trim() && resolving)
        toast.info("Please wait — resolving your Google Maps link…");
      else if (step === 4)
        toast.error("Please upload at least one property photo.");
      else
        toast.error("Please fill the required fields.");
      return;
    }
    setStep(s => Math.min(s + 1, STEPS.length));
  };
  const prev = () => setStep(s => Math.max(s - 1, 1));

  // ── Submit ────────────────────────────────────────────────────────────────────
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdvance()) { toast.error("Please fill required fields."); return; }
    if (images.length === 0) { toast.error("At least one photo is required."); return; }

    setLoading(true);
    try {
      // 1. Create property
      const property = await propertiesApi.create({
        title:         form.title.trim(),
        description:   form.description.trim() || undefined,
        property_type: form.property_type,
        listing_type:  form.listing_type as "rent" | "sale" | "pg",
        bedrooms:      form.bedrooms  ? Number(form.bedrooms)  : undefined,
        bathrooms:     form.bathrooms ? Number(form.bathrooms) : undefined,
        area_sqft:     form.area_sqft ? Number(form.area_sqft) : undefined,
        furnished:     form.furnished,
        amenities:     form.amenities.length > 0 ? form.amenities as any : undefined,
        city:          form.city,
        locality:      form.locality.trim() || undefined,
        address:       form.address.trim()  || undefined,
        price:         Number(form.price),
        deposit:       form.deposit ? Number(form.deposit) : undefined,
        latitude:      form.latitude  ? Number(form.latitude)  : undefined,
        longitude:     form.longitude ? Number(form.longitude) : undefined,
        map_url:       form.map_url.trim() || undefined,
      });

      // 2. Upload images — cover first
      const coverFirst = [...images].sort((a, b) => (b.isCover ? 1 : 0) - (a.isCover ? 1 : 0));
      await uploadImages(property.id, coverFirst.map(i => i.file));

      toast.success("Property posted successfully!");
      navigate({ to: "/dashboard/properties" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to post property");
    } finally {
      setLoading(false);
    }
  };

  // ── Step bar ──────────────────────────────────────────────────────────────────
  const StepBar = () => (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center flex-1 last:flex-none">
          <button type="button" onClick={() => step > s.id && setStep(s.id)}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold border-2 transition",
              step === s.id  ? "border-primary bg-primary text-white"
              : step > s.id  ? "border-primary bg-primary/10 text-primary cursor-pointer"
              : "border-muted-foreground/30 bg-background text-muted-foreground cursor-default",
            )}>
            {step > s.id ? <Check className="h-4 w-4" /> : s.id}
          </button>
          <span className={cn("ml-2 text-xs font-medium hidden sm:block", step >= s.id ? "text-foreground" : "text-muted-foreground")}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && (
            <div className={cn("mx-3 flex-1 h-px", step > s.id ? "bg-primary/40" : "bg-muted-foreground/20")} />
          )}
        </div>
      ))}
    </div>
  );

  // ── Step panels ───────────────────────────────────────────────────────────────
  const panels = [
    // ── Step 1: Basic Info ────────────────────────────────────────────────────
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Listing title <span className="text-destructive">*</span></Label>
        <Input value={form.title} onChange={e => upd("title", e.target.value)}
          placeholder="e.g. Spacious 2BHK in Prahladnagar" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Property type</Label>
          <Select value={form.property_type} onValueChange={v => upd("property_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{propertyTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Listing type</Label>
          <Select value={form.listing_type} onValueChange={v => upd("listing_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rent">Rent</SelectItem>
              <SelectItem value="sale">Sale</SelectItem>
              <SelectItem value="pg">PG</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={e => upd("description", e.target.value)}
          rows={4} placeholder="Tell tenants/buyers what makes this property special…" />
      </div>
    </div>,

    // ── Step 2: Configuration ─────────────────────────────────────────────────
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5"><Label>Bedrooms</Label>
          <Input type="number" min={0} value={form.bedrooms} onChange={e => upd("bedrooms", e.target.value)} placeholder="e.g. 2" />
        </div>
        <div className="space-y-1.5"><Label>Bathrooms</Label>
          <Input type="number" min={0} value={form.bathrooms} onChange={e => upd("bathrooms", e.target.value)} placeholder="e.g. 2" />
        </div>
        <div className="space-y-1.5"><Label>Area (sq ft)</Label>
          <Input type="number" min={0} value={form.area_sqft} onChange={e => upd("area_sqft", e.target.value)} placeholder="e.g. 1200" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Furnished status</Label>
        <Select value={form.furnished} onValueChange={v => upd("furnished", v)}>
          <SelectTrigger className="w-60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Fully Furnished">Fully Furnished</SelectItem>
            <SelectItem value="Semi-Furnished">Semi-Furnished</SelectItem>
            <SelectItem value="Unfurnished">Unfurnished</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Amenities</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
          {AMENITY_OPTIONS.map(a => (
            <label key={a} className={cn(
              "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm cursor-pointer transition select-none",
              form.amenities.includes(a)
                ? "border-primary bg-primary/5 text-primary font-medium"
                : "border-border hover:border-primary/40",
            )}>
              <Checkbox checked={form.amenities.includes(a)}
                onCheckedChange={() => toggleAmenity(a)} className="pointer-events-none" />
              {a}
            </label>
          ))}
        </div>
      </div>
    </div>,

    // ── Step 3: Location ──────────────────────────────────────────────────────
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>City</Label>
          <Select value={form.city} onValueChange={v => upd("city", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Locality <span className="text-destructive">*</span></Label>
          <Input value={form.locality} onChange={e => upd("locality", e.target.value)} placeholder="e.g. Bopal" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Full address</Label>
        <Textarea rows={2} value={form.address} onChange={e => upd("address", e.target.value)}
          placeholder="Building name, street, landmark…" />
      </div>

      {/* ── Google Maps Location ─────────────────────────────────────── */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-primary" />
          Google Maps Location
        </Label>

        {/* Instructions */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs space-y-1.5">
          <p className="font-semibold text-foreground">📍 How to share your property location:</p>
          <div className="space-y-1 text-muted-foreground">
            <p><span className="font-medium text-foreground">Mobile (Android/iPhone):</span></p>
            <p>1. Open Google Maps → search your property address</p>
            <p>2. Long press on the exact location pin</p>
            <p>3. Tap <span className="font-semibold">Share</span> → Copy link</p>
            <p>4. Paste below — coordinates are extracted automatically ✅</p>
            <p className="mt-1"><span className="font-medium text-foreground">Desktop:</span> maps.google.com → search → click Share → Copy link</p>
          </div>
          <p className="text-[11px] pt-1 border-t border-border/40">
            ✅ Works: <span className="font-mono">maps.app.goo.gl/...</span> · full Google Maps URLs
            <br />⚠️ May not work: <span className="font-mono">share.google/...</span> links (use maps.app.goo.gl instead)
          </p>
        </div>

        {/* Input — auto-resolves on paste, no button needed */}
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={form.map_url}
            onChange={e => upd("map_url", e.target.value)}
            placeholder="Paste Google Maps link here…"
            className="pl-9 pr-10"
          />
          {/* Inline status indicator */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {resolving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!resolving && form.latitude && form.longitude && (
              <Check className="h-4 w-4 text-green-600" />
            )}
          </div>
        </div>

        {/* Status feedback */}
        {resolving && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              Resolving your Google Maps link… please wait.
            </div>
            {resolvingSlow && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-700 space-y-1">
                <p className="font-semibold">⏳ Taking longer than usual…</p>
                <p>You can also paste a <strong>full Google Maps URL</strong> directly from your browser address bar — it works instantly without any network call.</p>
                <p className="text-[11px] font-mono mt-1">Example: https://www.google.com/maps/place/.../@23.0608,72.5477,17z/...</p>
              </div>
            )}
          </div>
        )}

        {!resolving && form.latitude && form.longitude && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 space-y-2">
            {/* Success header */}
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 shrink-0">
                <MapPin className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-700">Location pinned successfully ✓</p>
                <p className="text-xs text-green-600 font-mono mt-0.5">
                  Latitude: {Number(form.latitude).toFixed(6)}
                </p>
                <p className="text-xs text-green-600 font-mono">
                  Longitude: {Number(form.longitude).toFixed(6)}
                </p>
              </div>
              <button type="button"
                onClick={() => { upd("latitude",""); upd("longitude",""); upd("map_url",""); }}
                className="ml-auto text-xs text-destructive/70 hover:text-destructive hover:underline shrink-0">
                Clear
              </button>
            </div>
            {/* Verify link */}
            <a
              href={`https://www.google.com/maps?q=${form.latitude},${form.longitude}&z=17`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Verify on Google Maps
            </a>
          </div>
        )}

        {!resolving && resolveError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-xs text-destructive flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{resolveError}</span>
          </div>
        )}

        {!resolving && !form.latitude && !resolveError && form.map_url.trim() && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Could not extract coordinates. Try a full maps.google.com URL instead.
          </div>
        )}
      </div>
    </div>,

    // ── Step 4: Photos (NEW) ──────────────────────────────────────────────────
    <div className="space-y-5">
      <div>
        <Label className="text-base font-semibold">
          Property Photos <span className="text-destructive">*</span>
        </Label>
        <p className="text-sm text-muted-foreground mt-1">
          Upload up to 10 photos. The first photo (marked with ★) will be the cover image.
          <span className="ml-1 text-xs">Allowed: JPG, PNG, WEBP · Max 10 MB each</span>
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed cursor-pointer transition-all py-10 px-6",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          images.length >= 10 && "opacity-50 pointer-events-none",
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-3">
          <Upload className="h-6 w-6 text-primary" />
        </div>
        <p className="font-semibold text-sm">
          {isDragging ? "Drop photos here" : "Click to upload or drag & drop"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {images.length}/10 photos added
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {/* Required warning */}
      {images.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          At least 1 photo is required to post your property.
        </div>
      )}

      {/* Image previews grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.map((img, i) => (
            <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border-2 transition"
              style={{ borderColor: img.isCover ? "hsl(var(--primary))" : "transparent" }}>

              <img src={img.previewUrl} alt={`Photo ${i + 1}`}
                className="h-full w-full object-cover" />

              {/* Cover badge */}
              {img.isCover && (
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                  <Star className="h-2.5 w-2.5 fill-white" /> Cover
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                {!img.isCover && (
                  <button type="button" onClick={() => setCover(i)}
                    title="Set as cover"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 hover:bg-white transition">
                    <Star className="h-4 w-4 text-amber-500" />
                  </button>
                )}
                <button type="button" onClick={() => removeImage(i)}
                  title="Remove photo"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 hover:bg-white transition">
                  <X className="h-4 w-4 text-destructive" />
                </button>
              </div>

              {/* Index number */}
              <div className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white font-medium">
                {i + 1}
              </div>
            </div>
          ))}

          {/* Add more button */}
          {images.length < 10 && (
            <button type="button"
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary">
              <ImagePlus className="h-6 w-6" />
              <span className="text-xs font-medium">Add more</span>
            </button>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        💡 Tip: Hover over a photo and click <Star className="inline h-3 w-3 text-amber-500" /> to set it as the cover image shown in listings.
      </p>
    </div>,

    // ── Step 5: Pricing ───────────────────────────────────────────────────────
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>
            {form.listing_type === "sale" ? "Sale price (₹)" : "Monthly rent (₹)"}
            <span className="text-destructive"> *</span>
          </Label>
          <Input type="number" min={0} value={form.price}
            onChange={e => upd("price", e.target.value)}
            placeholder={form.listing_type === "sale" ? "e.g. 4500000" : "e.g. 28000"} />
        </div>
        {form.listing_type !== "sale" && (
          <div className="space-y-1.5">
            <Label>Security deposit (₹)</Label>
            <Input type="number" min={0} value={form.deposit}
              onChange={e => upd("deposit", e.target.value)} placeholder="e.g. 56000" />
          </div>
        )}
      </div>

      {/* AI Pricing Suggestion */}
      <AIPricingWidget
        city={form.city}
        property_type={form.property_type}
        listing_type={form.listing_type}
        bedrooms={form.bedrooms ? Number(form.bedrooms) : undefined}
        area_sqft={form.area_sqft ? Number(form.area_sqft) : undefined}
        locality={form.locality || undefined}
        onApply={price => upd("price", String(price))}
      />

      {/* Summary */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-5 space-y-2 text-sm">
        <p className="font-semibold mb-3">Listing summary</p>
        {form.title     && <SummaryRow label="Title"    value={form.title} />}
        <SummaryRow label="Type"     value={`${form.property_type} · ${form.listing_type.toUpperCase()}`} />
        {form.bedrooms  && <SummaryRow label="Config"   value={`${form.bedrooms} BHK · ${form.bathrooms || "–"} bath · ${form.area_sqft || "–"} sq ft`} />}
        <SummaryRow label="Location" value={`${form.locality || "–"}, ${form.city}`} />
        <SummaryRow label="Photos"   value={`${images.length} photo${images.length !== 1 ? "s" : ""} uploaded`} />
        {form.amenities.length > 0 && (
          <SummaryRow label="Amenities"
            value={form.amenities.slice(0, 5).join(", ") + (form.amenities.length > 5 ? ` +${form.amenities.length - 5} more` : "")} />
        )}
        {form.latitude && form.longitude && (
          <SummaryRow label="Map pin" value={`${Number(form.latitude).toFixed(4)}, ${Number(form.longitude).toFixed(4)}`} />
        )}
      </div>
    </div>,
  ];

  return (
    <DashboardShell title="Post a property" subtitle="Takes about 3 minutes">
      <form onSubmit={submit} className="max-w-3xl">
        <Card className="p-6 lg:p-8 border-border/60">
          <StepBar />
          <div className="min-h-[320px]">{panels[step - 1]}</div>

          <div className="mt-8 flex items-center justify-between border-t border-border/40 pt-6">
            <Button type="button" variant="outline"
              onClick={step === 1 ? () => navigate({ to: "/dashboard/properties" }) : prev}>
              <ChevronLeft className="h-4 w-4 mr-1" />{step === 1 ? "Cancel" : "Back"}
            </Button>

            {step < STEPS.length ? (
              <Button type="button" onClick={next}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button type="submit" variant="hero" size="lg" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {loading ? "Publishing…" : "Publish property"}
              </Button>
            )}
          </div>
        </Card>
      </form>
    </DashboardShell>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
