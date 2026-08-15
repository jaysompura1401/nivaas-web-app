/**
 * server/routes/maps.js  — Map module v3 (scratch rewrite)
 *
 * Endpoints:
 *   GET /api/maps/resolve?url=...
 *     Resolves any Google Maps URL (including maps.app.goo.gl short links)
 *     to exact lat/lng coordinates embedded in the URL or redirect chain.
 *     NEVER falls back to address geocoding — wrong pin is worse than no pin.
 *     Returns: { lat, lng, source, resolved_url }
 *
 *   GET /api/maps/geocode?address=...
 *     Text geocoding via OpenStreetMap Nominatim.
 *     Kept for non-property uses only. NOT used by any map display.
 *
 * Design principles:
 *   1. Only return coords that are embedded in the actual URL / redirect chain.
 *   2. Never geocode locality / address / city for pin placement.
 *   3. If exact coords cannot be found → 422, frontend shows "no location".
 */

import { Router } from "express";
import https from "https";
import http from "http";

const router = Router();

// ─── HTTP GET helper ──────────────────────────────────────────────────────────
// Follows up to 12 redirects manually (does NOT auto-follow with Node's http).
// Returns { finalUrl, body, status }.
//
// Multiple User-Agent strategies tried in order so we handle both:
//   (a) maps.app.goo.gl  → Google now often returns a JS page; we capture the
//       redirect URL from the Location header before the JS runs.
//   (b) full maps.google.com URLs → coords already in the URL, no fetch needed.

const USER_AGENTS = [
  // Googlebot — often gets a clean redirect
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  // Android Chrome — triggers app-redirect HTML that has og:url with coords
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  // Desktop Chrome
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function httpGetWithAgent(url, userAgent, depth = 0) {
  if (depth > 15) return Promise.reject(new Error("Too many redirects"));

  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return reject(new Error("Invalid URL: " + url));
    }

    const lib = parsed.protocol === "https:" ? https : http;

    const req = lib.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "identity",
          Connection: "close",
          // Referer helps some Google endpoints return richer HTML
          Referer: "https://www.google.com/",
        },
      },
      (res) => {
        // Follow 3xx redirects
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          let next = res.headers.location;
          if (next.startsWith("/")) {
            next = `${parsed.protocol}//${parsed.hostname}${next}`;
          }
          // If the Location header itself contains coords — capture it before following
          const earlyCoords = extractCoords(next);
          if (earlyCoords) {
            res.resume();
            return resolve({ finalUrl: next, body: "", status: res.statusCode, earlyCoords });
          }
          res.resume();
          return httpGetWithAgent(next, userAgent, depth + 1).then(resolve).catch(reject);
        }

        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
          if (body.length > 500_000) req.destroy();
        });
        res.on("end", () => resolve({ finalUrl: url, body, status: res.statusCode }));
      }
    );

    req.on("error", reject);
    req.setTimeout(15_000, () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
    req.end();
  });
}

// Try all user agents in sequence, return first successful result
async function httpGet(url) {
  let lastErr = null;
  for (const ua of USER_AGENTS) {
    try {
      const result = await httpGetWithAgent(url, ua, 0);
      return result;
    } catch (e) {
      lastErr = e;
      // Continue to next UA
    }
  }
  throw lastErr ?? new Error("All fetch attempts failed");
}

// ─── Coordinate extractor ─────────────────────────────────────────────────────
// Tries every known Google Maps coordinate encoding, most precise first.
// All patterns require ≥4 decimal places to avoid false matches on integers.
function extractCoords(src) {
  if (!src || typeof src !== "string") return null;
  let m;

  // 1. @lat,lng,zoom — standard browser URL  e.g. @23.06089,72.54780,17z
  m = src.match(/@(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);
  if (m) return { lat: +m[1], lng: +m[2], source: "@lat,lng" };

  // 2. !3d<lat>!4d<lng> — place / embed links
  m = src.match(/!3d(-?\d{1,3}\.\d{4,})!4d(-?\d{1,3}\.\d{4,})/);
  if (m) return { lat: +m[1], lng: +m[2], source: "!3d!4d" };

  // 3. ?q=lat,lng — numeric only (skip if value has letters = place name)
  m = src.match(/[?&]q=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);
  if (m) return { lat: +m[1], lng: +m[2], source: "?q=" };

  // 4. ll=lat,lng — older format
  m = src.match(/\bll=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);
  if (m) return { lat: +m[1], lng: +m[2], source: "ll=" };

  // 5. center=lat,lng
  m = src.match(/\bcenter=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);
  if (m) return { lat: +m[1], lng: +m[2], source: "center=" };

  // 6. /@lat,lng — path-embedded
  m = src.match(/\/@(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);
  if (m) return { lat: +m[1], lng: +m[2], source: "/@" };

  // 7. !8m2!3d<lat>!4d<lng> — directions embed variant
  m = src.match(/!8m2!3d(-?\d{1,3}\.\d{4,})!4d(-?\d{1,3}\.\d{4,})/);
  if (m) return { lat: +m[1], lng: +m[2], source: "!8m2!3d!4d" };

  // 8. !1d<lng>!2d<lat> — older embed (note reversed order)
  m = src.match(/!1d(-?\d{1,3}\.\d{4,})!2d(-?\d{1,3}\.\d{4,})/);
  if (m) return { lat: +m[2], lng: +m[1], source: "!1d!2d" };

  // 9. daddr= / saddr= — directions link
  m = src.match(/[sd]addr=(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);
  if (m) return { lat: +m[1], lng: +m[2], source: "daddr/saddr" };

  // 10. /maps/place/.../lat,lng — some share links put coords in the path
  m = src.match(/\/maps\/place\/[^/]+\/(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);
  if (m) return { lat: +m[1], lng: +m[2], source: "place/lat,lng" };

  return null;
}

// ─── HTML body scanner ────────────────────────────────────────────────────────
// When Google returns a 200 HTML page (JS redirect, share page, etc.)
// we scan for the canonical maps.google.com URL that contains coords.
// Returns { coords, canonicalUrl } or null.
function scanHtmlBody(body, fallbackUrl) {
  if (!body) return null;

  // 1. og:url meta tag — most reliable; Google puts the full place URL here
  for (const pat of [
    /property=["']og:url["']\s+content=["']([^"']+)["']/i,
    /content=["']([^"']+)["']\s+property=["']og:url["']/i,
  ]) {
    const m = body.match(pat);
    if (m) {
      const coords = extractCoords(m[1]);
      if (coords) return { coords, canonicalUrl: m[1] };
    }
  }

  // 2. <link rel="canonical" href="...">
  const canonPat =
    body.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ??
    body.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  if (canonPat) {
    const coords = extractCoords(canonPat[1]);
    if (coords) return { coords, canonicalUrl: canonPat[1] };
  }

  // 3. window.location.replace("https://maps.google.com/...") in inline JS
  const wlPat = body.match(
    /window\.location(?:\.replace)?\s*\(\s*["']([^"']+google\.com[^"']+)["']/i
  );
  if (wlPat) {
    const coords = extractCoords(wlPat[1]);
    if (coords) return { coords, canonicalUrl: wlPat[1] };
  }

  // 4. meta http-equiv refresh
  const metaRefresh =
    body.match(/http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"']+)/i) ??
    body.match(/content=["'][^"']*url=([^"']+)["'][^>]*http-equiv=["']refresh["']/i);
  if (metaRefresh) {
    const target = metaRefresh[1].trim();
    const coords = extractCoords(target);
    if (coords) return { coords, canonicalUrl: target };
  }

  // 5. Any maps.google.com URL in the body that contains coords
  const gmUrls = body.match(
    /https?:\/\/(?:www\.)?(?:maps\.)?google\.com\/maps[^\s"'<>]{20,}/g
  );
  if (gmUrls) {
    for (const candidate of gmUrls) {
      const coords = extractCoords(candidate);
      if (coords) return { coords, canonicalUrl: candidate };
    }
  }

  // 6. JSON coord patterns — "lat":23.0608,"lng":72.5477 (≥4 dp required)
  const jsonCoords = body.match(
    /"lat"\s*:\s*(-?\d{1,3}\.\d{4,})\s*,\s*"(?:lng|lon)"\s*:\s*(-?\d{1,3}\.\d{4,})/
  );
  if (jsonCoords) {
    return {
      coords: { lat: +jsonCoords[1], lng: +jsonCoords[2], source: "json" },
      canonicalUrl: fallbackUrl,
    };
  }

  // 7. Numeric array coords [lat, lng] in JS data blobs (≥6 dp = high precision GPS)
  const arrayCoords = body.match(/\[(-?\d{1,3}\.\d{6,}),(-?\d{1,3}\.\d{6,})\]/);
  if (arrayCoords) {
    const lat = +arrayCoords[1];
    const lng = +arrayCoords[2];
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return {
        coords: { lat, lng, source: "array" },
        canonicalUrl: fallbackUrl,
      };
    }
  }

  // 8. maps.app.goo.gl share page — Google embeds coords in various JS data structures
  // Pattern: ",...,lat,lng,..." inside JS arrays (Google Maps internal data)
  const gooGlPatterns = [
    // [null,null,lat,lng] — common in Google's share pages
    /\[null,null,(-?\d{1,3}\.\d{5,}),(-?\d{1,3}\.\d{5,})\]/,
    // [lat,lng] anywhere with 5+ decimal places (high-precision GPS)
    /(?:^|[^-\d])(-2[0-9]\.\d{5,}|[0-3][0-9]\.\d{5,}),\s*(-?\d{2,3}\.\d{5,})/,
    // ftm= or similar params in JS
    /["'](-?\d{1,3}\.\d{6,})["'],\s*["'](-?\d{1,3}\.\d{6,})["']/,
  ];
  for (const pat of gooGlPatterns) {
    const m = body.match(pat);
    if (m) {
      const lat = +m[1], lng = +m[2];
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0)) {
        return { coords: { lat, lng, source: "gooGl_js" }, canonicalUrl: fallbackUrl };
      }
    }
  }

  // 9. All 5+ decimal coordinate pairs in the entire body (last resort)
  const allCoordPairs = [...body.matchAll(/(-?\d{1,3}\.\d{5,})[,\s]+(-?\d{1,3}\.\d{5,})/g)];
  for (const match of allCoordPairs) {
    const lat = +match[1], lng = +match[2];
    // India bounding box: lat 6–37, lng 68–97
    if (lat >= 6 && lat <= 37 && lng >= 68 && lng <= 97) {
      return { coords: { lat, lng, source: "body_scan_india" }, canonicalUrl: fallbackUrl };
    }
  }

  return null;
}

// ─── Coordinate validator ─────────────────────────────────────────────────────
function validCoords(lat, lng) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    // Reject (0,0) — almost always an extraction artifact, not a real location
    !(lat === 0 && lng === 0)
  );
}

// ─── Build canonical Google Maps URL from coords ──────────────────────────────
function buildMapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}&z=17`;
}

// ─── GET /api/maps/resolve?url=... ────────────────────────────────────────────
router.get("/resolve", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== "string" || !url.trim()) {
      return res.status(400).json({ error: "url parameter is required" });
    }

    const inputUrl = url.trim();

    // ── Step 1: direct extraction from the URL string itself ──────────────
    // Works immediately for full maps.google.com URLs that already embed coords.
    // Short links (maps.app.goo.gl) have no coords here — they go to Step 2.
    const directCoords = extractCoords(inputUrl);
    if (directCoords && validCoords(directCoords.lat, directCoords.lng)) {
      const resolved_url = inputUrl.includes("google.com")
        ? inputUrl
        : buildMapsUrl(directCoords.lat, directCoords.lng);
      return res.json({
        lat: directCoords.lat,
        lng: directCoords.lng,
        source: "direct_url_" + directCoords.source,
        resolved_url,
      });
    }

    // ── Step 2: fetch the URL and follow all redirects ────────────────────
    // maps.app.goo.gl → redirect chain → full maps.google.com URL
    let fetchResult;
    try {
      fetchResult = await httpGet(inputUrl);
    } catch (fetchErr) {
      return res.status(422).json({
        error: "Could not fetch this link: " + fetchErr.message,
        tip: "Open Google Maps → search your property → long-press the exact pin → tap Share → Copy link. Paste the maps.app.goo.gl link here.",
      });
    }

    const { finalUrl, body, status, earlyCoords } = fetchResult;

    // ── Step 3a: coords captured from Location header during redirect ─────
    if (earlyCoords && validCoords(earlyCoords.lat, earlyCoords.lng)) {
      return res.json({
        lat: earlyCoords.lat,
        lng: earlyCoords.lng,
        source: "redirect_header_" + (earlyCoords.source || ""),
        resolved_url: finalUrl,
      });
    }

    // ── Step 3b: try coords in the final redirected URL ───────────────────
    if (finalUrl && finalUrl !== inputUrl) {
      const redirectCoords = extractCoords(finalUrl);
      if (redirectCoords && validCoords(redirectCoords.lat, redirectCoords.lng)) {
        const resolved_url = finalUrl.includes("google.com")
          ? finalUrl
          : buildMapsUrl(redirectCoords.lat, redirectCoords.lng);
        return res.json({
          lat: redirectCoords.lat,
          lng: redirectCoords.lng,
          source: "redirect_url_" + redirectCoords.source,
          resolved_url,
        });
      }
    }

    // ── Step 4: deep-scan the HTML body ───────────────────────────────────
    const htmlResult = scanHtmlBody(body, finalUrl || inputUrl);
    if (htmlResult && validCoords(htmlResult.coords.lat, htmlResult.coords.lng)) {
      const { coords, canonicalUrl } = htmlResult;
      const resolved_url =
        canonicalUrl && canonicalUrl.includes("google.com")
          ? canonicalUrl
          : buildMapsUrl(coords.lat, coords.lng);
      return res.json({
        lat: coords.lat,
        lng: coords.lng,
        source: "html_body_" + (coords.source || "scan"),
        resolved_url,
      });
    }

    // ── Step 5: try fetching the finalUrl directly if it's a maps.google.com URL ──
    // Sometimes the first fetch lands on a JS page; a second fetch of the canonical
    // URL with a different UA gives us the real place page with coords.
    if (finalUrl && finalUrl !== inputUrl && finalUrl.includes("google.com/maps")) {
      try {
        const secondFetch = await httpGetWithAgent(
          finalUrl,
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          0
        );
        if (secondFetch.earlyCoords && validCoords(secondFetch.earlyCoords.lat, secondFetch.earlyCoords.lng)) {
          return res.json({
            lat: secondFetch.earlyCoords.lat,
            lng: secondFetch.earlyCoords.lng,
            source: "second_fetch_header",
            resolved_url: secondFetch.finalUrl || finalUrl,
          });
        }
        const secondResult = extractCoords(secondFetch.finalUrl);
        if (secondResult && validCoords(secondResult.lat, secondResult.lng)) {
          return res.json({
            lat: secondResult.lat,
            lng: secondResult.lng,
            source: "second_fetch_url",
            resolved_url: secondFetch.finalUrl,
          });
        }
        const secondHtml = scanHtmlBody(secondFetch.body, secondFetch.finalUrl);
        if (secondHtml && validCoords(secondHtml.coords.lat, secondHtml.coords.lng)) {
          return res.json({
            lat: secondHtml.coords.lat,
            lng: secondHtml.coords.lng,
            source: "second_fetch_html_" + (secondHtml.coords.source || ""),
            resolved_url: secondHtml.canonicalUrl || finalUrl,
          });
        }
      } catch {
        // ignore — fall through to 422
      }
    }

    // ── Step 6: coords not found — return 422, NEVER geocode ─────────────
    console.warn(
      `[maps/resolve] Could not extract coords from: ${inputUrl} (final: ${finalUrl}, http: ${status})`
    );
    return res.status(422).json({
      error: "Could not extract exact coordinates from this link.",
      tip:
        "Google Maps → search your property → long-press the exact pin on the map → tap Share → Copy link. Use the maps.app.goo.gl link.",
      debug: {
        inputUrl,
        finalUrl: finalUrl ?? "(no redirect)",
        httpStatus: status,
      },
    });
  } catch (err) {
    console.error("[maps/resolve] Internal error:", err.message);
    res.status(500).json({ error: "Internal server error: " + err.message });
  }
});

// ─── GET /api/maps/geocode?address=... ───────────────────────────────────────
// Text geocoding via OpenStreetMap Nominatim.
// IMPORTANT: This endpoint is NOT used for property map display.
// It exists only for external / admin tooling.
router.get("/geocode", async (req, res) => {
  try {
    const { address, city, locality, state } = req.query;

    let query = address;
    if (!query && (city || locality)) {
      query = [locality, city, state, "India"].filter(Boolean).join(", ");
    }
    if (!query) {
      return res
        .status(400)
        .json({ error: "address, or at least city/locality, is required" });
    }

    const q = encodeURIComponent(String(query));
    let result;
    try {
      result = await httpGet(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=in`
      );
    } catch (e) {
      return res
        .status(502)
        .json({ error: "Nominatim unreachable: " + e.message });
    }

    let data;
    try {
      data = JSON.parse(result.body);
    } catch {
      data = [];
    }

    if (Array.isArray(data) && data.length > 0) {
      return res.json({
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        display_name: data[0].display_name,
        source: "nominatim",
        query,
      });
    }

    res.status(404).json({ error: "Location not found for: " + query });
  } catch (err) {
    console.error("[maps/geocode] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
