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

const REGIONS = [
  // GTA
  "Toronto", "Mississauga", "Vaughan", "Markham", "Hamilton", "Burlington",
  // Adjacent Southern Ontario
  "Oakville", "Milton", "Oshawa", "Whitby", "Kitchener", "Waterloo",
  "Guelph", "Barrie", "Niagara Falls", "Niagara-on-the-Lake",
];
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

// How wide (px) to download saved vendor photos. Used as both the card
// thumbnail and the click-to-enlarge gallery, so ~640 is a good balance
// of quality vs. repo size.
const PHOTO_WIDTH = 640;
// How many photos to download per vendor (gallery size).
const PHOTO_COUNT = 3;

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
          // Google photo resource names (up to PHOTO_COUNT); downloaded
          // to local files below and replaced with `photos` paths.
          photoNames: (p.photos || []).slice(0, PHOTO_COUNT).map(ph => ph.name),
          photo: null,   // first photo path (thumbnail) — set after download
          photos: [],    // all downloaded photo paths (gallery)
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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function downloadOne(photoName, dest, attempt = 0) {
  if (existsSync(dest)) return true; // already downloaded on a previous run
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${PHOTO_WIDTH}&key=${apiKey}`;
  const res = await fetch(url); // follows redirect to the image bytes
  if (res.status === 429 && attempt < 5) {
    // Rate limited — exponential backoff (0.8s, 1.6s, 3.2s, ...) then retry
    await sleep(800 * 2 ** attempt);
    return downloadOne(photoName, dest, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return true;
}

async function downloadVendorPhotos(vendor) {
  const paths = [];
  for (let i = 0; i < vendor.photoNames.length; i++) {
    const file = `${vendor.placeId}-${i}.jpg`;
    const dest = path.join(photoDir, file);
    try {
      await downloadOne(vendor.photoNames[i], dest);
      paths.push(`/vendor-photos/${file}`);
    } catch (e) {
      console.log(`  photo ${i} failed for ${vendor.name}: ${e.message}`);
    }
  }
  vendor.photos = paths;
  vendor.photo = paths[0] || null;
}

const withPhotos = vendors.filter(v => v.photoNames.length);
const totalPhotos = withPhotos.reduce((s, v) => s + v.photoNames.length, 0);
console.log(`\nDownloading up to ${totalPhotos} photos for ${withPhotos.length} vendors (max ${PHOTO_WIDTH}px)...`);
// Keep concurrency modest to avoid the Places Photo API rate limit (429).
const CONCURRENCY = 3;
for (let i = 0; i < withPhotos.length; i += CONCURRENCY) {
  await Promise.all(withPhotos.slice(i, i + CONCURRENCY).map(downloadVendorPhotos));
  process.stdout.write(`\r  ${Math.min(i + CONCURRENCY, withPhotos.length)}/${withPhotos.length} vendors   `);
}
console.log("");

// Drop the internal photoNames before writing the data file.
for (const v of vendors) delete v.photoNames;

const outPath = path.join(root, "vendor-data.json");
writeFileSync(outPath, JSON.stringify(vendors, null, 2));
console.log(`\n${vendors.filter(v => v.photo).length} vendors have photos`);
console.log(`Wrote ${outPath}`);
