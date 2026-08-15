/**
 * AIPricingWidget — shows suggested price range based on market comparables.
 * Drop anywhere a property form exists.
 */
import { pricing as pricingApi, type PricingSuggestion } from "@/lib/api";
import { formatINR } from "@/lib/mock-properties";
import { Sparkles, Loader2, TrendingUp, Info } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  city: string;
  property_type: string;
  listing_type: string;
  bedrooms?: number;
  area_sqft?: number;
  locality?: string;
  property_id?: string;
  onApply?: (price: number) => void;
}

export function AIPricingWidget({
  city, property_type, listing_type, bedrooms, area_sqft, locality, property_id, onApply,
}: Props) {
  const [data, setData]     = useState<PricingSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const ready = !!(city && property_type && listing_type);

  const fetch = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const result = await pricingApi.suggest({
        city, property_type, listing_type,
        bedrooms: bedrooms || undefined,
        area_sqft: area_sqft || undefined,
        locality: locality || undefined,
        property_id: property_id || undefined,
      });
      setData(result);
    } catch (e: any) {
      setError(e.message ?? "Could not fetch pricing suggestion");
    } finally {
      setLoading(false);
    }
  }, [city, property_type, listing_type, bedrooms, area_sqft, locality, property_id]);

  // Auto-fetch when inputs change (debounced via useEffect)
  useEffect(() => {
    if (!ready) { setData(null); return; }
    const timer = setTimeout(fetch, 600);
    return () => clearTimeout(timer);
  }, [fetch, ready]);

  if (!ready) return null;

  return (
    <Card className="p-4 border-primary/30 bg-primary/5 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-primary">AI Price Suggestion</span>
        {data && (
          <span className="text-xs text-muted-foreground ml-auto">
            Based on {data.comparables_count} comparable listings
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Analyzing market data…</span>
        </div>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : data ? (
        <div className="space-y-3">
          {/* Range bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-10">Min</span>
            <div className="flex-1 h-2.5 rounded-full bg-secondary relative overflow-hidden">
              <div className="absolute left-0 top-0 h-full bg-gradient-primary rounded-full" style={{ width: "100%" }} />
            </div>
            <span className="text-xs text-muted-foreground w-10 text-right">Max</span>
          </div>

          {/* Values */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/80 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Minimum</p>
              <p className="text-sm font-bold">{formatINR(data.suggested_min)}</p>
            </div>
            <div className="bg-primary text-white rounded-lg p-2 shadow-md">
              <p className="text-xs text-white/80 flex items-center justify-center gap-1">
                <TrendingUp className="h-3 w-3" /> Optimal
              </p>
              <p className="text-sm font-bold">{formatINR(data.suggested_optimal)}</p>
            </div>
            <div className="bg-white/80 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Maximum</p>
              <p className="text-sm font-bold">{formatINR(data.suggested_max)}</p>
            </div>
          </div>

          {/* Breakdown */}
          {data.breakdown && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              {data.breakdown.area_multiplier !== 1 && (
                <span>Area adjusted ×{data.breakdown.area_multiplier.toFixed(2)}</span>
              )}
              {data.breakdown.locality_premium !== 0 && (
                <span className="ml-2">
                  Locality {data.breakdown.locality_premium > 0 ? "+" : ""}{formatINR(Math.abs(data.breakdown.locality_premium))} premium
                </span>
              )}
              <span className="ml-auto">{data.basis === "market_data" ? "Live market data" : "Market defaults"}</span>
            </div>
          )}

          {onApply && (
            <Button size="sm" variant="outline" className="w-full text-primary border-primary/40"
              onClick={() => onApply(data.suggested_optimal)}>
              Apply Optimal Price ({formatINR(data.suggested_optimal)})
            </Button>
          )}
        </div>
      ) : null}
    </Card>
  );
}
