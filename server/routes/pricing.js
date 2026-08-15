/**
 * pricing.js — AI Pricing Engine
 * Suggests optimal rent/sale price based on comparable listings.
 * No external ML service required — uses statistical analysis of existing data.
 */
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ─── GET /api/pricing/suggest ─────────────────────────────────────────────────
router.get("/suggest", requireAuth, async (req, res) => {
  try {
    const {
      city, property_type, listing_type,
      bedrooms, area_sqft, locality, property_id,
    } = req.query;

    if (!city || !property_type || !listing_type) {
      return res.status(400).json({ error: "city, property_type and listing_type are required" });
    }

    const params = [city, property_type, listing_type];
    let sql = `
      SELECT p.price, p.area_sqft, p.bedrooms, p.locality
      FROM nivaas_properties p
      WHERE p.status = 'active'
        AND p.city = ?
        AND p.property_type = ?
        AND p.listing_type = ?
    `;

    if (property_id) { sql += " AND p.id != ?"; params.push(property_id); }

    if (bedrooms) {
      sql += " AND p.bedrooms BETWEEN ? AND ?";
      params.push(Math.max(1, Number(bedrooms) - 1), Number(bedrooms) + 1);
    }

    sql += " ORDER BY p.created_at DESC LIMIT 100";
    const [comparables] = await pool.query(sql, params);

    let prices = comparables.map(c => Number(c.price)).filter(p => p > 0);

    if (prices.length < 5) {
      const [broad] = await pool.query(
        `SELECT price FROM nivaas_properties
         WHERE status='active' AND city=? AND listing_type=? LIMIT 50`,
        [city, listing_type]
      );
      prices = [...prices, ...broad.map(c => Number(c.price))];
    }

    if (prices.length === 0) {
      const defaults = {
        rent: {
          Apartment: [8000, 80000], Villa: [20000, 200000],
          PG: [3000, 15000], "Office Space": [15000, 300000],
          Plot: [5000, 50000], Warehouse: [20000, 500000], "Farm House": [15000, 150000],
        },
        sale: {
          Apartment: [1500000, 15000000], Villa: [5000000, 80000000],
          PG: [1000000, 8000000], "Office Space": [2000000, 50000000],
          Plot: [500000, 20000000], Warehouse: [3000000, 100000000], "Farm House": [2000000, 50000000],
        },
      };
      const range = defaults[listing_type]?.[property_type] ?? [10000, 100000];
      return res.json({
        suggested_min: range[0],
        suggested_max: range[1],
        suggested_optimal: Math.round((range[0] + range[1]) / 2),
        comparables_count: 0,
        basis: "market_defaults",
      });
    }

    prices.sort((a, b) => a - b);
    const p25 = prices[Math.floor(prices.length * 0.25)];
    const p50 = prices[Math.floor(prices.length * 0.50)];
    const p75 = prices[Math.floor(prices.length * 0.75)];

    let areaMultiplier = 1;
    if (area_sqft && comparables.length > 0) {
      const avgArea = comparables.reduce((s, c) => s + Number(c.area_sqft || 0), 0) / comparables.length;
      if (avgArea > 0) {
        areaMultiplier = Math.max(0.6, Math.min(1.4, Number(area_sqft) / avgArea));
      }
    }

    let localityPremium = 0;
    if (locality && comparables.length > 0) {
      const localComps = comparables.filter(c => c.locality === locality);
      if (localComps.length >= 3) {
        const localAvg = localComps.reduce((s, c) => s + Number(c.price), 0) / localComps.length;
        const cityAvg  = prices.reduce((a, b) => a + b, 0) / prices.length;
        localityPremium = localAvg - cityAvg;
      }
    }

    const suggestedMin     = Math.round((p25 * areaMultiplier + localityPremium) / 100) * 100;
    const suggestedOptimal = Math.round((p50 * areaMultiplier + localityPremium) / 100) * 100;
    const suggestedMax     = Math.round((p75 * areaMultiplier + localityPremium) / 100) * 100;

    // Cache the suggestion (non-blocking, ignore if table doesn't exist yet)
    const cacheId = uuidv4();
    pool.query(
      `INSERT INTO nivaas_pricing_suggestions
         (id, property_id, city, locality, property_type, listing_type, bedrooms,
          area_sqft, suggested_min, suggested_max, suggested_optimal, basis)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        cacheId, property_id || null, city, locality || null,
        property_type, listing_type,
        bedrooms ? Number(bedrooms) : null,
        area_sqft ? Number(area_sqft) : null,
        suggestedMin, suggestedMax, suggestedOptimal,
        JSON.stringify({ comparables_count: prices.length, p25, p50, p75, areaMultiplier, localityPremium }),
      ]
    ).catch(() => {});

    res.json({
      suggested_min:     suggestedMin,
      suggested_max:     suggestedMax,
      suggested_optimal: suggestedOptimal,
      comparables_count: prices.length,
      basis: "market_data",
      breakdown: { p25_market: p25, p50_market: p50, p75_market: p75, area_multiplier: areaMultiplier, locality_premium: localityPremium },
    });
  } catch (err) {
    console.error("Pricing error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/pricing/trending ────────────────────────────────────────────────
router.get("/trending", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         p.city,
         p.property_type,
         p.listing_type,
         COUNT(p.id)                   AS count,
         ROUND(AVG(p.price)::numeric)  AS avg_price,
         ROUND(MIN(p.price)::numeric)  AS min_price,
         ROUND(MAX(p.price)::numeric)  AS max_price
       FROM nivaas_properties p
       WHERE p.status = 'active'
       GROUP BY p.city, p.property_type, p.listing_type
       ORDER BY count DESC
       LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
