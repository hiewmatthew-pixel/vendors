// Export favourite vendors to a live Google Sheet (client-side OAuth via
// Google Identity Services) with a CSV download fallback.
//
// Requires a public OAuth Client ID in VITE_GOOGLE_OAUTH_CLIENT_ID.
// See README "Export favourites to Google Sheets" for setup.

const SHEETS_SCOPE = "https://www.googleapis.com/auth/drive.file";
const CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;

const COLUMNS = [
  ["Name", v => v.name],
  ["Category", v => v.category],
  ["Region", v => v.region],
  ["Address", v => v.address || ""],
  ["Phone", v => v.phone || ""],
  ["Website", v => v.website || ""],
  ["Rating", v => v.rating || ""],
  ["Reviews", v => v.reviewCount || ""],
  ["Price", v => (v.priceLevel != null ? "$".repeat(v.priceLevel) : "")],
  ["Hours", v => (v.hours || []).join(" | ")],
  ["Map", v => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.address || v.name)}`],
];

export function isSheetsConfigured() {
  return !!CLIENT_ID;
}

function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
}

function requestToken() {
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SHEETS_SCOPE,
      callback: (resp) => {
        if (resp.error) reject(new Error(resp.error));
        else resolve(resp.access_token);
      },
    });
    client.requestAccessToken({ prompt: "" });
  });
}

export async function exportToSheet(vendors, title) {
  if (!CLIENT_ID) throw new Error("NO_CLIENT_ID");
  await loadGis();
  const token = await requestToken();

  const values = [
    COLUMNS.map(([h]) => h),
    ...vendors.map(v => COLUMNS.map(([, f]) => f(v))),
  ];

  // Create the spreadsheet with the data already in it.
  const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title },
      sheets: [{
        properties: { title: "Vendors" },
        data: [{
          startRow: 0,
          startColumn: 0,
          rowData: values.map(row => ({
            values: row.map(cell => ({
              userEnteredValue:
                typeof cell === "number"
                  ? { numberValue: cell }
                  : { stringValue: String(cell) },
            })),
          })),
        }],
      }],
    }),
  });

  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const sheet = await res.json();
  return sheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}`;
}

export function exportToCsv(vendors, filename = "favourite-vendors.csv") {
  const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const lines = [
    COLUMNS.map(([h]) => esc(h)).join(","),
    ...vendors.map(v => COLUMNS.map(([, f]) => esc(f(v))).join(",")),
  ];
  // Prepend BOM so Excel reads UTF-8 correctly.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
