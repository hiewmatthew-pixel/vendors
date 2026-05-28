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

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
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
  "places.photos",
  "nextPageToken",
].join(",");

// How wide (px) to download the saved vendor photo. Used as both the
// card thumbnail and the click-to-enlarge image, so ~640 is a good
// balance of quality vs. repo size.
const PHOTO_WIDTH = 640;

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
          // Google photo resource name of the first photo (if any);
          // downloaded to a local file below, then replaced with `photo`.
          photoName: p.photos?.[0]?.name || null,
          photo: null,
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

// ---- Download one photo per vendor to public/vendor-photos/ ----
// Stored under the stable Google Place ID so re-runs can skip existing
// files. The public/ folder is served at the site root by Vite.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const photoDir = path.join(root, "public", "vendor-photos");
mkdirSync(photoDir, { recursive: true });

async function downloadPhoto(vendor) {
  if (!vendor.photoName) return;
  const file = `${vendor.placeId}.jpg`;
  const dest = path.join(photoDir, file);
  vendor.photo = `/vendor-photos/${file}`;
  if (existsSync(dest)) return; // already downloaded on a previous run
  const url = `https://places.googleapis.com/v1/${vendor.photoName}/media?maxWidthPx=${PHOTO_WIDTH}&key=${apiKey}`;
  try {
    const res = await fetch(url); // follows redirect to the image bytes
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, buf);
  } catch (e) {
    vendor.photo = null;
    console.log(`  photo failed for ${vendor.name}: ${e.message}`);
  }
}

const withPhotos = vendors.filter(v => v.photoName);
console.log(`\nDownloading ${withPhotos.length} photos (max ${PHOTO_WIDTH}px)...`);
const CONCURRENCY = 8;
for (let i = 0; i < withPhotos.length; i += CONCURRENCY) {
  await Promise.all(withPhotos.slice(i, i + CONCURRENCY).map(downloadPhoto));
  process.stdout.write(`\r  ${Math.min(i + CONCURRENCY, withPhotos.length)}/${withPhotos.length}   `);
}
console.log("");

// Drop the internal photoName before writing the data file.
for (const v of vendors) delete v.photoName;

const outPath = path.join(root, "vendor-data.json");
writeFileSync(outPath, JSON.stringify(vendors, null, 2));
console.log(`\n${vendors.filter(v => v.photo).length} vendors have photos`);
console.log(`Wrote ${outPath}`);
