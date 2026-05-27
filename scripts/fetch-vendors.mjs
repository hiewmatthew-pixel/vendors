// Fetches wedding venues, bakeries, and florists across the GTA from
// Google Places API (New) and writes vendor-data.json.
//
// Usage:
//   GOOGLE_MAPS_API_KEY=xxxx node scripts/fetch-vendors.mjs
// or via npm:
//   GOOGLE_MAPS_API_KEY=xxxx npm run fetch:vendors
//
// Get a key: https://console.cloud.google.com/google/maps-apis/credentials
// Enable: "Places API (New)" in your GCP project before running.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const apiKey = process.env.GOOGLE_MAPS_API_KEY;
if (!apiKey) {
  console.error("ERROR: Set GOOGLE_MAPS_API_KEY environment variable.");
  console.error("  PowerShell:  $env:GOOGLE_MAPS_API_KEY='your-key'; npm run fetch:vendors");
  console.error("  bash:        GOOGLE_MAPS_API_KEY=your-key npm run fetch:vendors");
  process.exit(1);
}

const REGIONS = ["Toronto", "Mississauga", "Vaughan", "Markham", "Hamilton", "Burlington"];
const CATEGORIES = [
  { key: "venue",   query: "wedding venue" },
  { key: "bakery",  query: "wedding cake bakery" },
  { key: "florist", query: "wedding florist" },
];

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.regularOpeningHours",
  "places.types",
  "places.businessStatus",
  "nextPageToken",
].join(",");

const PRICE_LEVEL_MAP = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

async function searchText(query, pageToken) {
  const body = { textQuery: query, pageSize: 20, regionCode: "CA" };
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function fetchAllPages(query, maxPages = 3) {
  const out = [];
  let pageToken;
  for (let i = 0; i < maxPages; i++) {
    const data = await searchText(query, pageToken);
    out.push(...(data.places || []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
    await new Promise(r => setTimeout(r, 1500));
  }
  return out;
}

const seen = new Map();
let nextId = 1;

for (const cat of CATEGORIES) {
  for (const region of REGIONS) {
    const query = `${cat.query} in ${region}, Ontario, Canada`;
    process.stdout.write(`[${cat.key.padEnd(8)}] ${region.padEnd(12)} `);
    try {
      const places = await fetchAllPages(query);
      let added = 0;
      for (const p of places) {
        if (!p.id || !p.location?.latitude) continue;
        if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
        if (seen.has(p.id)) continue;
        seen.set(p.id, {
          id: nextId++,
          placeId: p.id,
          name: p.displayName?.text || "",
          category: cat.key,
          region,
          lat: p.location.latitude,
          lng: p.location.longitude,
          address: p.formattedAddress || "",
          phone: p.nationalPhoneNumber || "",
          website: p.websiteUri || "",
          rating: p.rating || 0,
          reviewCount: p.userRatingCount || 0,
          priceLevel: PRICE_LEVEL_MAP[p.priceLevel] ?? null,
          hours: p.regularOpeningHours?.weekdayDescriptions || [],
          types: p.types || [],
        });
        added++;
      }
      console.log(`→ ${places.length} found, ${added} new`);
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
    }
  }
}

const vendors = Array.from(seen.values());

console.log(`\nTotal unique vendors: ${vendors.length}`);
console.log(`  venues:   ${vendors.filter(v => v.category === "venue").length}`);
console.log(`  bakeries: ${vendors.filter(v => v.category === "bakery").length}`);
console.log(`  florists: ${vendors.filter(v => v.category === "florist").length}`);

const outPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "vendor-data.json");
writeFileSync(outPath, JSON.stringify(vendors, null, 2));
console.log(`\nWrote ${outPath}`);
