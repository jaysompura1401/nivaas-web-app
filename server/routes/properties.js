import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import https from "https";
import http from "http";
import pool from "../db.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// LOCATION POLICY (enforced throughout this file):
//
//   ✅ Only owner-provided Google Maps coordinates are stored and returned.
//   ❌ No city-center fallback coordinates.
//   ❌ No random jitter / approximate location injection.
//   ❌ No locality-based geocoding.
//
//   Single source of truth: nivaas_property_locations table.
//   If a property has no row in that table → no location data → no map pin.
// ─────────────────────────────────────────────────────────────────────────────

// ─── HTTP redirect follower ───────────────────────────────────────────────────
// Follows up to 10 redirects. Returns { finalUrl, body, status }.
// Uses a mobile User-Agent so Google serves a redirect page, not a JS app.

function httpGetFollow(url, depth = 0) {
  if (depth > 10) return Promise.reject(new Error("Too many redirects"));
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch { return reject(new Error("Invalid URL")); }
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "identity",
        "Connection": "close",
      }
    }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        let next = res.headers.location;
        if (next.startsWith("/")) next = `${parsed.protocol}//${parsed.hostname}${next}`;
        res.resume();
        return httpGetFollow(next, depth + 1).then(resolve).catch(reject);
      }
      let body = "";
      res.on("data", c => { body += c; if (body.length > 300_000) req.destroy(); });
      res.on("end", () => resolve({ finalUrl: url, body, status: res.statusCode }));
    });
    req.on("error", reject);
    req.setTimeout(12_000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.end();
  });
}

// ─── Coordinate extractor ─────────────────────────────────────────────────────
// Tries every known Google Maps URL encoding. All patterns require ≥4 decimal
// places to avoid false matches on integers.

function extractCoordsFromStr(src) {
  if (!src || typeof src !== "string") return null;
  let m;
  m = src.match(/@(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);           if (m) return { lat: +m[1], lng: +m[2] };
  m = src.match(/!3d(-?\d{1,3}\.\d{4,})!4d(-?\d{1,3}\.\d{4,})/);       if (m) return { lat: +m[1], lng: +m[2] };
  m = src.match(/[?&]q=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);      if (m) return { lat: +m[1], lng: +m[2] };
  m = src.match(/\bll=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);       if (m) return { lat: +m[1], lng: +m[2] };
  m = src.match(/\bcenter=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);   if (m) return { lat: +m[1], lng: +m[2] };
  m = src.match(/\/@(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);         if (m) return { lat: +m[1], lng: +m[2] };
  m = src.match(/!8m2!3d(-?\d{1,3}\.\d{4,})!4d(-?\d{1,3}\.\d{4,})/);  if (m) return { lat: +m[1], lng: +m[2] };
  m = src.match(/!1d(-?\d{1,3}\.\d{4,})!2d(-?\d{1,3}\.\d{4,})/);       if (m) return { lat: +m[2], lng: +m[1] };
  m = src.match(/[sd]addr=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);   if (m) return { lat: +m[1], lng: +m[2] };
  m = src.match(/"lat"\s*:\s*(-?\d{1,3}\.\d{4,}).*?"(?:lng|lon)"\s*:\s*(-?\d{1,3}\.\d{4,})/s); if (m) return { lat: +m[1], lng: +m[2] };
  return null;
}

function validCoords(c) {
  if (!c) return false;
  return (
    typeof c.lat === "number" && typeof c.lng === "number" &&
    !isNaN(c.lat) && !isNaN(c.lng) &&
    c.lat >= -90 && c.lat <= 90 &&
    c.lng >= -180 && c.lng <= 180 &&
    !(c.lat === 0 && c.lng === 0)
  );
}

// ─── Google Maps URL resolver ─────────────────────────────────────────────────
// 4-step cascade. Returns { lat, lng } or null — never throws.
// Step 1: Direct regex on the URL string (instant for full maps.google.com URLs).
// Step 2: Follow redirects (maps.app.goo.gl short links → real URL).
// Step 3: Regex on the final redirected URL.
// Step 4: Scan HTML body for og:url, canonical, window.location, JSON coords.

async function resolveCoordsFromMapUrl(mapUrl) {
  if (!mapUrl) return null;
  try {
    // Step 1 — direct
    const direct = extractCoordsFromStr(mapUrl);
    if (validCoords(direct)) return direct;

    // Step 2 — follow redirects
    const { finalUrl, body } = await httpGetFollow(mapUrl);

    // Step 3 — regex on final URL
    if (finalUrl && finalUrl !== mapUrl) {
      const redirectCoords = extractCoordsFromStr(finalUrl);
      if (validCoords(redirectCoords)) return redirectCoords;
    }

    // Step 4 — scan HTML body
    const patterns = [
      /property=["']og:url["'][^>]+content=["']([^"']+)["']/i,
      /content=["']([^"']+)["'][^>]+property=["']og:url["']/i,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      /window\.location(?:\.replace)?\s*\(\s*["']([^"']+google\.com[^"']+)["']/i,
    ];
    for (const pat of patterns) {
      const m = body.match(pat);
      if (m) {
        const c = extractCoordsFromStr(m[1]);
        if (validCoords(c)) return c;
      }
    }
    const gmUrls = body.match(/https?:\/\/(?:www\.)?(?:maps\.)?google\.com\/maps[^\s"'<>]{20,}/g);
    if (gmUrls) {
      for (const u of gmUrls) {
        const c = extractCoordsFromStr(u);
        if (validCoords(c)) return c;
      }
    }
  } catch (e) {
    console.warn("[resolveCoordsFromMapUrl] failed for", mapUrl, "—", e.message);
  }
  return null;
}

// ─── Save / upsert a location row ─────────────────────────────────────────────
// Inserts or replaces the row in nivaas_property_locations.
// Called from POST and PATCH whenever valid coords are available.

async function upsertPropertyLocation(propertyId, googleMapsUrl, lat, lng) {
  await pool.query(
    `INSERT INTO nivaas_property_locations
       (id, property_id, google_maps_url, latitude, longitude)
     VALUES (UUID(), ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       google_maps_url = VALUES(google_maps_url),
       latitude        = VALUES(latitude),
       longitude       = VALUES(longitude),
       updated_at      = CURRENT_TIMESTAMP`,
    [propertyId, googleMapsUrl, lat, lng]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/properties
// ─────────────────────────────────────────────────────────────────────────────
// Query params: city, listing_type, property_type, min_price, max_price,
//               furnished, q (search), limit, offset, sort,
//               bedrooms, available_from, locality,
//               lat_min, lat_max, lng_min, lng_max  (bounding-box for map)
//               has_coords ("true" = only return properties with exact location)
//
// LOCATION NOTE: Coordinates in the response come exclusively from
// nivaas_property_locations (LEFT JOINed). If a property has no row there,
// location fields are null. NO fallback / approximate coordinates are injected.

router.get("/", optionalAuth, async (req, res) => {
  try {
    const {
      city, listing_type, property_type, min_price, max_price,
      furnished, q, limit = 50, offset = 0, sort = "newest",
      bedrooms, available_from, locality,
      lat_min, lat_max, lng_min, lng_max, has_coords,
    } = req.query;

    // ── WHERE clause ──────────────────────────────────────────────────────────
    let where = " WHERE p.status = 'active'";
    const whereParams = [];

    if (city)           { where += " AND p.city = ?";            whereParams.push(city); }
    if (locality)       { where += " AND p.locality LIKE ?";     whereParams.push(`%${locality}%`); }
    if (listing_type)   { where += " AND p.listing_type = ?";    whereParams.push(listing_type); }
    if (property_type)  { where += " AND p.property_type = ?";   whereParams.push(property_type); }
    if (min_price)      { where += " AND p.price >= ?";          whereParams.push(Number(min_price)); }
    if (max_price)      { where += " AND p.price <= ?";          whereParams.push(Number(max_price)); }
    if (furnished)      { where += " AND p.furnished = ?";       whereParams.push(furnished); }
    if (bedrooms)       { where += " AND p.bedrooms = ?";        whereParams.push(Number(bedrooms)); }
    if (available_from) {
      where += " AND (p.available_from IS NULL OR p.available_from <= ?)";
      whereParams.push(available_from);
    }
    if (q) {
      where += " AND (p.title LIKE ? OR p.locality LIKE ? OR p.city LIKE ? OR p.address LIKE ?)";
      const like = `%${q}%`;
      whereParams.push(like, like, like, like);
    }

    // Bounding-box: filter on exact coords in property_locations
    if (lat_min !== undefined) { where += " AND pl.latitude >= ?";  whereParams.push(Number(lat_min)); }
    if (lat_max !== undefined) { where += " AND pl.latitude <= ?";  whereParams.push(Number(lat_max)); }
    if (lng_min !== undefined) { where += " AND pl.longitude >= ?"; whereParams.push(Number(lng_min)); }
    if (lng_max !== undefined) { where += " AND pl.longitude <= ?"; whereParams.push(Number(lng_max)); }

    // has_coords=true → only properties that have an exact owner-pinned location
    if (has_coords === "true") {
      where += " AND pl.property_id IS NOT NULL";
    }

    // ── COUNT query ───────────────────────────────────────────────────────────
    const countSql = `
      SELECT COUNT(DISTINCT p.id) AS total
      FROM nivaas_properties p
      LEFT JOIN nivaas_property_locations pl ON pl.property_id = p.id
      ${where}`;
    const [[{ total }]] = await pool.query(countSql, whereParams);

    // ── DATA query ────────────────────────────────────────────────────────────
    let sql = `
      SELECT
        p.*,
        u.full_name  AS owner_name,
        u.phone      AS owner_phone,
        ROUND(AVG(r.rating), 1) AS avg_rating,
        COUNT(DISTINCT r.id)    AS review_count,
        pl.google_maps_url      AS location_google_maps_url,
        pl.latitude             AS location_latitude,
        pl.longitude            AS location_longitude
      FROM nivaas_properties p
      LEFT JOIN nivaas_users u ON u.id = p.owner_id
      LEFT JOIN nivaas_reviews r ON r.property_id = p.id
      LEFT JOIN nivaas_property_locations pl ON pl.property_id = p.id
      ${where}
      GROUP BY p.id, pl.latitude, pl.longitude, pl.google_maps_url
    `;

    if (sort === "price_asc")    sql += " ORDER BY p.price ASC";
    else if (sort === "price_desc") sql += " ORDER BY p.price DESC";
    else                         sql += " ORDER BY p.created_at DESC";

    sql += " LIMIT ? OFFSET ?";
    const dataParams = [...whereParams, Number(limit), Number(offset)];

    const [rows] = await pool.query(sql, dataParams);

    // ── Attach images ─────────────────────────────────────────────────────────
    const ids = rows.map(r => r.id);
    let images = [];
    if (ids.length > 0) {
      [images] = await pool.query(
        "SELECT property_id, url, is_cover, sort_order FROM nivaas_property_images WHERE property_id IN (?) ORDER BY sort_order ASC",
        [ids]
      );
    }
    const imgMap = {};
    images.forEach(img => {
      if (!imgMap[img.property_id]) imgMap[img.property_id] = [];
      imgMap[img.property_id].push(img.url);
    });

    // ── Build response ────────────────────────────────────────────────────────
    // location_latitude / location_longitude come from nivaas_property_locations.
    // If NULL → this property has no exact owner-provided location.
    // NO fallback is injected. Frontend must treat null coords as "no pin".

    const result = rows.map(p => {
      const lat = p.location_latitude  != null ? Number(p.location_latitude)  : null;
      const lng = p.location_longitude != null ? Number(p.location_longitude) : null;
      const hasExactLocation = lat !== null && lng !== null && !(lat === 0 && lng === 0);

      return {
        ...p,
        // Expose exact owner coords (null if not provided)
        latitude:      hasExactLocation ? lat : null,
        longitude:     hasExactLocation ? lng : null,
        map_url:       p.location_google_maps_url ?? p.map_url ?? null,
        // Always false — we never inject approximate coordinates
        location_approximate: false,
        images: imgMap[p.id] || (p.cover_image_url ? [p.cover_image_url] : []),
      };
    });

    res.json({ data: result, count: Number(total) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/properties/:id
// ─────────────────────────────────────────────────────────────────────────────
// Returns the property with location joined from nivaas_property_locations.
// Coordinates are null if owner never provided a Google Maps link.

router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT
         p.*,
         u.full_name AS owner_name, u.phone AS owner_phone,
         u.email AS owner_email, u.avatar_url AS owner_avatar,
         u.is_verified AS owner_verified,
         ROUND(AVG(r.rating),1) AS avg_rating,
         COUNT(DISTINCT r.id)   AS review_count,
         pl.google_maps_url     AS location_google_maps_url,
         pl.latitude            AS location_latitude,
         pl.longitude           AS location_longitude
       FROM nivaas_properties p
       LEFT JOIN nivaas_users u ON u.id = p.owner_id
       LEFT JOIN nivaas_reviews r ON r.property_id = p.id
       LEFT JOIN nivaas_property_locations pl ON pl.property_id = p.id
       WHERE p.id = ?
       GROUP BY p.id, pl.latitude, pl.longitude, pl.google_maps_url`,
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Property not found" });
    const property = rows[0];

    // Expose exact owner coords under the canonical fields
    const lat = property.location_latitude  != null ? Number(property.location_latitude)  : null;
    const lng = property.location_longitude != null ? Number(property.location_longitude) : null;
    const hasExactLocation = lat !== null && lng !== null && !(lat === 0 && lng === 0);

    property.latitude  = hasExactLocation ? lat : null;
    property.longitude = hasExactLocation ? lng : null;
    property.map_url   = property.location_google_maps_url ?? property.map_url ?? null;
    property.location_approximate = false;

    // Attach images
    const [imgs] = await pool.query(
      "SELECT url, is_cover, caption, sort_order FROM nivaas_property_images WHERE property_id = ? ORDER BY sort_order ASC",
      [id]
    );
    property.images = imgs.map(i => i.url);
    if (property.images.length === 0 && property.cover_image_url) {
      property.images = [property.cover_image_url];
    }

    // Amenities
    const [amenRows] = await pool.query(
      `SELECT a.name, a.icon, a.category
       FROM nivaas_property_amenities pa
       JOIN nivaas_amenities a ON a.id = pa.amenity_id
       WHERE pa.property_id = ?`,
      [id]
    );
    property.amenities = amenRows;

    // Reviews
    const [reviews] = await pool.query(
      `SELECT rv.*, u.full_name AS reviewer_name, u.avatar_url AS reviewer_avatar
       FROM nivaas_reviews rv
       JOIN nivaas_users u ON u.id = rv.reviewer_id
       WHERE rv.property_id = ?
       ORDER BY rv.created_at DESC LIMIT 10`,
      [id]
    );
    property.reviews = reviews;

    // Increment views
    await pool.query(
      "UPDATE nivaas_properties SET views_count = views_count + 1 WHERE id = ?",
      [id]
    );

    res.json(property);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/properties
// ─────────────────────────────────────────────────────────────────────────────
// Creates a property. If map_url is provided, resolves coordinates and saves
// them to nivaas_property_locations (single source of truth).
// lat/lng on nivaas_properties are kept in sync for legacy query compatibility.

router.post("/", requireAuth, async (req, res) => {
  try {
    const id = uuidv4();
    const {
      title, description, property_type = "Apartment", listing_type = "rent",
      bedrooms, bathrooms, balconies = 0, area_sqft, carpet_area,
      floor_number, total_floors, age_years, furnished = "Unfurnished",
      facing, parking_slots = 0, city, state, locality, address,
      pincode, price, deposit, maintenance_fee = 0,
      brokerage = 0, price_negotiable = 0, available_from, min_lease_months = 11,
      preferred_tenants, cover_image_url, rera_id, amenities = [],
    } = req.body;

    const map_url  = req.body.map_url  || null;
    // Accept pre-resolved coords from the frontend (from the location step resolver)
    const clientLat = req.body.latitude  ? Number(req.body.latitude)  : null;
    const clientLng = req.body.longitude ? Number(req.body.longitude) : null;

    if (!title || !city || !price) {
      return res.status(400).json({ error: "title, city and price are required" });
    }

    // ── Resolve coordinates ───────────────────────────────────────────────────
    // Priority 1: client sent pre-resolved lat/lng (from the new-property form resolver)
    // Priority 2: server resolves from map_url (safety net for direct API calls)
    // If no valid coords → no location row is created (no fake data ever stored).

    let resolvedLat = null;
    let resolvedLng = null;

    if (clientLat && clientLng && validCoords({ lat: clientLat, lng: clientLng })) {
      resolvedLat = clientLat;
      resolvedLng = clientLng;
      console.log(`[POST /properties] Using client-resolved coords: ${resolvedLat},${resolvedLng}`);
    } else if (map_url) {
      const coords = await resolveCoordsFromMapUrl(map_url);
      if (coords) {
        resolvedLat = coords.lat;
        resolvedLng = coords.lng;
        console.log(`[POST /properties] Server-resolved coords: ${resolvedLat},${resolvedLng}`);
      }
    }

    // ── Insert property ───────────────────────────────────────────────────────
    await pool.query(
      `INSERT INTO nivaas_properties
         (id, owner_id, title, description, property_type, listing_type, status,
          bedrooms, bathrooms, balconies, area_sqft, carpet_area, floor_number,
          total_floors, age_years, furnished, facing, parking_slots, city, state,
          locality, address, pincode, latitude, longitude, map_url, price, deposit,
          maintenance_fee, brokerage, price_negotiable, available_from,
          min_lease_months, preferred_tenants, cover_image_url, rera_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, req.user.id, title, description || null, property_type, listing_type, "active",
        bedrooms || null, bathrooms || null, balconies, area_sqft || null,
        carpet_area || null, floor_number || null, total_floors || null,
        age_years || null, furnished, facing || null, parking_slots,
        city, state || null, locality || null, address || null, pincode || null,
        resolvedLat, resolvedLng, map_url,
        price, deposit || null,
        maintenance_fee, brokerage, price_negotiable ? 1 : 0,
        available_from || null, min_lease_months, preferred_tenants || null,
        cover_image_url || null, rera_id || null,
      ]
    );

    // ── Save to property_locations (only if exact coords exist) ───────────────
    if (resolvedLat && resolvedLng && map_url) {
      await upsertPropertyLocation(id, map_url, resolvedLat, resolvedLng);
      console.log(`[POST /properties] Location saved for property ${id}`);
    } else {
      console.log(`[POST /properties] No exact location for property ${id} — map pin will not appear`);
    }

    // ── Amenities ─────────────────────────────────────────────────────────────
    if (amenities.length > 0) {
      const placeholders = amenities.map(() => "?").join(",");
      const [amenRows] = await pool.query(
        `SELECT id, name FROM nivaas_amenities WHERE name IN (${placeholders})`,
        amenities
      );
      if (amenRows.length > 0) {
        const vals = amenRows.map(a => [id, a.id]);
        await pool.query("INSERT IGNORE INTO nivaas_property_amenities (property_id, amenity_id) VALUES ?", [vals]);
      }
    }

    // Return with location joined
    const [newProp] = await pool.query(
      `SELECT p.*, pl.google_maps_url AS location_google_maps_url,
              pl.latitude AS location_latitude, pl.longitude AS location_longitude
       FROM nivaas_properties p
       LEFT JOIN nivaas_property_locations pl ON pl.property_id = p.id
       WHERE p.id = ?`,
      [id]
    );

    const p = newProp[0];
    const lat = p.location_latitude  != null ? Number(p.location_latitude)  : null;
    const lng = p.location_longitude != null ? Number(p.location_longitude) : null;
    const hasLoc = lat !== null && lng !== null && !(lat === 0 && lng === 0);

    res.status(201).json({
      ...p,
      latitude:  hasLoc ? lat : null,
      longitude: hasLoc ? lng : null,
      map_url:   p.location_google_maps_url ?? p.map_url ?? null,
      location_approximate: false,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/properties/:id
// ─────────────────────────────────────────────────────────────────────────────
// Updates property fields. If map_url changes, re-resolves coordinates and
// updates nivaas_property_locations accordingly.

router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const [check] = await pool.query(
      "SELECT owner_id FROM nivaas_properties WHERE id = ?", [id]
    );
    if (check.length === 0) return res.status(404).json({ error: "Not found" });
    if (check[0].owner_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const allowed = [
      "title","description","property_type","listing_type","status","bedrooms","bathrooms",
      "area_sqft","carpet_area","furnished","city","locality","address","price","deposit",
      "cover_image_url","available_from","preferred_tenants","price_negotiable","map_url",
    ];
    const updates = [];
    const values  = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: "Nothing to update" });

    // ── Resolve location if map_url is being updated ──────────────────────────
    const newMapUrl    = req.body.map_url;
    const clientLat    = req.body.latitude  ? Number(req.body.latitude)  : null;
    const clientLng    = req.body.longitude ? Number(req.body.longitude) : null;

    if (newMapUrl) {
      let resolvedLat = null;
      let resolvedLng = null;

      // Priority 1: client sent pre-resolved coords
      if (clientLat && clientLng && validCoords({ lat: clientLat, lng: clientLng })) {
        resolvedLat = clientLat;
        resolvedLng = clientLng;
      } else {
        // Priority 2: check if we already have coords for this exact URL
        const [existing] = await pool.query(
          "SELECT map_url FROM nivaas_properties WHERE id = ?", [id]
        );
        const [existingLoc] = await pool.query(
          "SELECT latitude, longitude FROM nivaas_property_locations WHERE property_id = ?", [id]
        );

        const sameUrl   = existing[0]?.map_url === newMapUrl;
        const hasCoords = existingLoc[0]?.latitude && existingLoc[0]?.longitude;

        if (sameUrl && hasCoords) {
          // URL unchanged and location already stored — nothing to re-resolve
          resolvedLat = Number(existingLoc[0].latitude);
          resolvedLng = Number(existingLoc[0].longitude);
        } else {
          // New URL (or coords missing) — resolve from scratch
          const coords = await resolveCoordsFromMapUrl(newMapUrl);
          if (coords) {
            resolvedLat = coords.lat;
            resolvedLng = coords.lng;
            console.log(`[PATCH /properties/${id}] Resolved coords: ${resolvedLat},${resolvedLng}`);
          }
        }
      }

      // Update lat/lng on nivaas_properties (legacy sync)
      if (resolvedLat && resolvedLng) {
        updates.push("latitude = ?", "longitude = ?");
        values.push(resolvedLat, resolvedLng);

        // Upsert into authoritative location table
        await upsertPropertyLocation(id, newMapUrl, resolvedLat, resolvedLng);
      } else {
        // map_url provided but coords could not be resolved —
        // remove any stale location row so no wrong pin is shown
        await pool.query(
          "DELETE FROM nivaas_property_locations WHERE property_id = ?", [id]
        );
        console.warn(`[PATCH /properties/${id}] Could not resolve coords for new map_url — location row removed`);
      }
    }

    values.push(id);
    await pool.query(`UPDATE nivaas_properties SET ${updates.join(", ")} WHERE id = ?`, values);

    // Return updated property with location joined
    const [rows] = await pool.query(
      `SELECT p.*, pl.google_maps_url AS location_google_maps_url,
              pl.latitude AS location_latitude, pl.longitude AS location_longitude
       FROM nivaas_properties p
       LEFT JOIN nivaas_property_locations pl ON pl.property_id = p.id
       WHERE p.id = ?`,
      [id]
    );

    const p = rows[0];
    const lat = p.location_latitude  != null ? Number(p.location_latitude)  : null;
    const lng = p.location_longitude != null ? Number(p.location_longitude) : null;
    const hasLoc = lat !== null && lng !== null && !(lat === 0 && lng === 0);

    res.json({
      ...p,
      latitude:  hasLoc ? lat : null,
      longitude: hasLoc ? lng : null,
      map_url:   p.location_google_maps_url ?? p.map_url ?? null,
      location_approximate: false,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/properties/:id/resolve-coords
// ─────────────────────────────────────────────────────────────────────────────
// Admin / owner backfill endpoint.
// Resolves and saves exact coordinates for a property that has a map_url
// but no entry in nivaas_property_locations.

router.post("/:id/resolve-coords", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      "SELECT owner_id, map_url FROM nivaas_properties WHERE id = ?", [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    if (rows[0].owner_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { map_url } = rows[0];
    if (!map_url) return res.status(422).json({ error: "No map_url set for this property" });

    // Check if location already exists
    const [locRows] = await pool.query(
      "SELECT latitude, longitude FROM nivaas_property_locations WHERE property_id = ?", [id]
    );
    if (locRows.length > 0 && locRows[0].latitude && locRows[0].longitude) {
      return res.json({
        lat: Number(locRows[0].latitude),
        lng: Number(locRows[0].longitude),
        source: "already_stored",
      });
    }

    const coords = await resolveCoordsFromMapUrl(map_url);
    if (!coords) {
      return res.status(422).json({
        error: "Could not extract coordinates from the stored map_url. Ask the owner to re-provide their Google Maps link."
      });
    }

    await upsertPropertyLocation(id, map_url, coords.lat, coords.lng);
    // Sync to main table for legacy compatibility
    await pool.query(
      "UPDATE nivaas_properties SET latitude = ?, longitude = ? WHERE id = ?",
      [coords.lat, coords.lng, id]
    );

    console.log(`[resolve-coords] Stored location for ${id}: ${coords.lat},${coords.lng}`);
    res.json({ lat: coords.lat, lng: coords.lng, source: "resolved" });
  } catch (err) {
    console.error("[resolve-coords]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/properties/:id
// ─────────────────────────────────────────────────────────────────────────────

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [check] = await pool.query(
      "SELECT owner_id FROM nivaas_properties WHERE id = ?", [id]
    );
    if (check.length === 0) return res.status(404).json({ error: "Not found" });
    if (check[0].owner_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    // nivaas_property_locations is deleted via ON DELETE CASCADE
    await pool.query("DELETE FROM nivaas_properties WHERE id = ?", [id]);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/properties/owner/mine
// ─────────────────────────────────────────────────────────────────────────────

router.get("/owner/mine", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*,
              pl.google_maps_url AS location_google_maps_url,
              pl.latitude        AS location_latitude,
              pl.longitude       AS location_longitude,
              COUNT(DISTINCT i.id)  AS inquiry_count,
              COUNT(DISTINCT sp.id) AS save_count
       FROM nivaas_properties p
       LEFT JOIN nivaas_property_locations pl ON pl.property_id = p.id
       LEFT JOIN nivaas_inquiries i ON i.property_id = p.id
       LEFT JOIN nivaas_saved_properties sp ON sp.property_id = p.id
       WHERE p.owner_id = ?
       GROUP BY p.id, pl.latitude, pl.longitude, pl.google_maps_url
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );

    // Attach cover images
    const ids = rows.map(r => r.id);
    let images = [];
    if (ids.length > 0) {
      [images] = await pool.query(
        "SELECT property_id, url FROM nivaas_property_images WHERE property_id IN (?) AND is_cover = 1",
        [ids]
      );
    }
    const imgMap = {};
    images.forEach(i => { imgMap[i.property_id] = i.url; });

    const result = rows.map(p => {
      const lat = p.location_latitude  != null ? Number(p.location_latitude)  : null;
      const lng = p.location_longitude != null ? Number(p.location_longitude) : null;
      const hasLoc = lat !== null && lng !== null && !(lat === 0 && lng === 0);
      return {
        ...p,
        latitude:  hasLoc ? lat : null,
        longitude: hasLoc ? lng : null,
        map_url:   p.location_google_maps_url ?? p.map_url ?? null,
        location_approximate: false,
        images: p.cover_image_url ? [p.cover_image_url] : (imgMap[p.id] ? [imgMap[p.id]] : []),
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
