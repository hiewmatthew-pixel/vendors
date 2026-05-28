import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import VENDORS from "./vendor-data.json";
import { exportToSheet, exportToCsv, isSheetsConfigured } from "./googleSheets.js";

const FAVE_KEY = "ggs_favourites";

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

const SORT_OPTIONS = [
  { key: "rating", label: "Top Rated" },
  { key: "reviews", label: "Most Reviewed" },
  { key: "name", label: "Name (A–Z)" },
];

const REGIONS = Array.from(new Set(VENDORS.map(v => v.region))).sort();
const CATEGORIES = [
  { key: "venue", label: "Venues", icon: "🏛" },
  { key: "bakery", label: "Bakeries", icon: "🎂" },
  { key: "florist", label: "Florists", icon: "💐" },
];

const CAT_COLORS = {
  venue: { bg: "#2D2926", text: "#C9A063", border: "#C9A063" },
  bakery: { bg: "#3E2723", text: "#FFAB91", border: "#FFAB91" },
  florist: { bg: "#1B3A2D", text: "#A8E6CF", border: "#A8E6CF" },
};

function StarRating({ rating, reviewCount }) {
  if (!rating) return null;
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.3;
  return (
    <span style={{ color: "#C9A063", fontSize: 13, letterSpacing: 1 }}>
      {"★".repeat(full)}{half ? "½" : ""}
      <span style={{ color: "#5b5246", marginLeft: 4, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
        {rating.toFixed(1)}
        {reviewCount ? ` (${reviewCount.toLocaleString()})` : ""}
      </span>
    </span>
  );
}

function priceSymbol(level) {
  if (level == null) return "—";
  return "$".repeat(Math.max(1, Math.min(4, level)));
}

function navBtnStyle(side) {
  return {
    position: "absolute", top: "50%", [side]: 8, transform: "translateY(-50%)",
    background: "rgba(20,17,13,0.6)", color: "#f0ece2", border: "none",
    borderRadius: "50%", width: 36, height: 36, fontSize: 22, lineHeight: 1,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  };
}

function vendorPhotos(v) {
  if (v.photos && v.photos.length) return v.photos;
  if (v.photo) return [v.photo];
  return [];
}

function HeartButton({ isFavourite, onToggle }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      title={isFavourite ? "Remove from favourites" : "Save to favourites"}
      style={{
        position: "absolute", top: 8, right: 8, zIndex: 3,
        width: 32, height: 32, borderRadius: "50%", border: "none",
        background: "rgba(20,17,13,0.6)", backdropFilter: "blur(4px)",
        cursor: "pointer", fontSize: 16, lineHeight: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: isFavourite ? "#ff6b81" : "#f0ece2",
      }}
    >
      {isFavourite ? "♥" : "♡"}
    </button>
  );
}

function VendorThumb({ vendor, onImageClick, isFavourite, onToggleFavourite, height = 130 }) {
  const c = CAT_COLORS[vendor.category];
  const cat = CATEGORIES.find(x => x.key === vendor.category);
  const photos = vendorPhotos(vendor);
  if (photos.length) {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onImageClick(vendor); }}
        style={{ height, margin: "-18px -20px 14px", position: "relative", cursor: "zoom-in", overflow: "hidden" }}
      >
        <img
          src={photos[0]}
          alt={vendor.name}
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, transparent 60%, rgba(20,17,13,0.55) 100%)",
        }} />
        <HeartButton isFavourite={isFavourite} onToggle={() => onToggleFavourite(vendor.id)} />
        <div style={{
          position: "absolute", bottom: 8, right: 10, fontSize: 10, fontWeight: 600,
          color: "#f0ece2", background: "rgba(20,17,13,0.6)", borderRadius: 6,
          padding: "3px 7px", fontFamily: "'DM Sans', sans-serif",
        }}>
          {photos.length > 1 ? `📷 ${photos.length} · View` : "🔍 View"}
        </div>
      </div>
    );
  }
  // Placeholder when no photo is available
  return (
    <div style={{
      height, margin: "-18px -20px 14px", position: "relative",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: `linear-gradient(135deg, ${c.bg}, #14110d)`,
      fontSize: 34,
    }}>
      <span style={{ opacity: 0.55 }}>{cat?.icon || "✦"}</span>
      <HeartButton isFavourite={isFavourite} onToggle={() => onToggleFavourite(vendor.id)} />
    </div>
  );
}

function VendorCard({ vendor, isSelected, onClick, onImageClick, isFavourite, onToggleFavourite, inRoute, onToggleRoute }) {
  const c = CAT_COLORS[vendor.category];
  return (
    <div
      onClick={onClick}
      style={{
        background: isSelected ? c.bg : "#1c1812",
        border: `1.5px solid ${isSelected ? c.border : "#2b261d"}`,
        borderRadius: 14,
        padding: "18px 20px",
        cursor: "pointer",
        transition: "all 0.25s ease",
        marginBottom: 10,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <VendorThumb vendor={vendor} onImageClick={onImageClick} isFavourite={isFavourite} onToggleFavourite={onToggleFavourite} />
      {isSelected && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${c.border}, transparent)`,
          zIndex: 2,
        }} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2,
            color: c.text, fontFamily: "'DM Sans', sans-serif",
          }}>
            {vendor.category}
          </span>
          <h3 style={{
            margin: "4px 0 0", fontSize: 17, fontWeight: 600,
            color: "#f0ece2", fontFamily: "'Cormorant Garamond', serif",
            letterSpacing: 0.5,
          }}>
            {vendor.name}
          </h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          {vendor.priceLevel != null && (
            <span style={{
              background: c.bg, border: `1px solid ${c.border}33`,
              borderRadius: 8, padding: "4px 10px", fontSize: 14, fontWeight: 700,
              color: c.text, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
              letterSpacing: 1,
            }}>
              {priceSymbol(vendor.priceLevel)}
            </span>
          )}
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#9c9385", marginBottom: 2, fontFamily: "'DM Sans', sans-serif" }}>
        📍 {vendor.region}
      </div>
      {vendor.address && (
        <div style={{ fontSize: 11, color: "#7a7165", marginBottom: 6, marginLeft: 16, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4 }}>
          {vendor.address}
        </div>
      )}
      <StarRating rating={vendor.rating} reviewCount={vendor.reviewCount} />
      {isSelected && (
        <div style={{
          marginTop: 14, paddingTop: 14,
          borderTop: `1px solid ${c.border}22`,
          animation: "fadeIn 0.3s ease",
        }}>
          {vendor.hours && vendor.hours.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase",
                color: c.text, marginBottom: 6, fontFamily: "'DM Sans', sans-serif",
              }}>
                Hours
              </div>
              <div style={{ fontSize: 12, color: "#c9c1b3", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
                {vendor.hours.map((h, i) => <div key={i}>{h}</div>)}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            {vendor.phone && (
              <span style={{ fontSize: 12, color: "#ada69a", fontFamily: "'DM Sans', sans-serif" }}>📞 {vendor.phone}</span>
            )}
            {vendor.website && (
              <a
                href={vendor.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{
                  fontSize: 12, color: c.text, textDecoration: "none",
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
                }}
              >
                🔗 Visit Website →
              </a>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vendor.address || `${vendor.name} ${vendor.region}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                fontSize: 12, color: c.text, textDecoration: "none",
                fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
              }}
            >
              🧭 Directions →
            </a>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleRoute(vendor); }}
              style={{
                fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                cursor: "pointer", borderRadius: 8, padding: "4px 10px",
                background: inRoute ? c.border : "transparent",
                color: inRoute ? "#14110d" : c.text,
                border: `1px solid ${c.border}`,
              }}
            >
              {inRoute ? "✓ In route" : "📏 Compare distance"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Lightbox({ vendor, onClose, isFavourite, onToggleFavourite, inRoute, onToggleRoute }) {
  const photos = vendor ? vendorPhotos(vendor) : [];
  const [idx, setIdx] = useState(0);

  useEffect(() => { setIdx(0); }, [vendor]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && photos.length > 1) setIdx(i => (i + 1) % photos.length);
      if (e.key === "ArrowLeft" && photos.length > 1) setIdx(i => (i - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, photos.length]);

  if (!vendor) return null;
  const c = CAT_COLORS[vendor.category];
  const go = (delta) => setIdx(i => (i + delta + photos.length) % photos.length);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(10,8,6,0.85)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1c1812", border: `1px solid ${c.border}55`,
          borderRadius: 16, overflow: "hidden", maxWidth: 640, width: "100%",
          maxHeight: "90vh", display: "flex", flexDirection: "column",
          boxShadow: "0 20px 70px rgba(0,0,0,0.7)",
        }}
      >
        {photos.length ? (
          <div style={{ position: "relative" }}>
            <img src={photos[idx]} alt={vendor.name}
              style={{ width: "100%", maxHeight: "55vh", objectFit: "cover", display: "block" }} />
            {photos.length > 1 && (
              <>
                <button onClick={() => go(-1)} style={navBtnStyle("left")}>‹</button>
                <button onClick={() => go(1)} style={navBtnStyle("right")}>›</button>
                <div style={{
                  position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
                  display: "flex", gap: 6,
                }}>
                  {photos.map((_, i) => (
                    <span key={i} onClick={() => setIdx(i)} style={{
                      width: 8, height: 8, borderRadius: "50%", cursor: "pointer",
                      background: i === idx ? "#f0ece2" : "rgba(240,236,226,0.4)",
                    }} />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{
            height: 200, display: "flex", alignItems: "center", justifyContent: "center",
            background: `linear-gradient(135deg, ${c.bg}, #14110d)`, fontSize: 48, opacity: 0.5,
          }}>
            {CATEGORIES.find(x => x.key === vendor.category)?.icon || "✦"}
          </div>
        )}
        <div style={{ padding: "20px 24px", overflowY: "auto", fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: c.text }}>
                {vendor.category} · {vendor.region}
              </div>
              <h2 style={{
                margin: "4px 0 0", fontSize: 26, fontWeight: 600, color: "#f0ece2",
                fontFamily: "'Cormorant Garamond', serif", letterSpacing: 0.5,
              }}>
                {vendor.name}
              </h2>
            </div>
            <button onClick={onClose} style={{
              background: "transparent", border: "none", color: "#8a8175",
              fontSize: 24, cursor: "pointer", lineHeight: 1, padding: 4,
            }}>×</button>
          </div>

          <div style={{ margin: "10px 0 4px" }}>
            <StarRating rating={vendor.rating} reviewCount={vendor.reviewCount} />
            {vendor.priceLevel != null && (
              <span style={{ marginLeft: 12, color: c.text, fontWeight: 700, letterSpacing: 1 }}>
                {priceSymbol(vendor.priceLevel)}
              </span>
            )}
          </div>

          {vendor.address && (
            <div style={{ fontSize: 13, color: "#c9c1b3", marginTop: 8, lineHeight: 1.5 }}>📍 {vendor.address}</div>
          )}
          {vendor.phone && (
            <div style={{ fontSize: 13, color: "#c9c1b3", marginTop: 6 }}>📞 {vendor.phone}</div>
          )}

          {vendor.hours && vendor.hours.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: c.text, marginBottom: 6 }}>
                Hours
              </div>
              <div style={{ fontSize: 12, color: "#ada69a", lineHeight: 1.6 }}>
                {vendor.hours.map((h, i) => <div key={i}>{h}</div>)}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
            {vendor.website && (
              <a href={vendor.website} target="_blank" rel="noopener noreferrer"
                style={{
                  fontSize: 13, color: "#14110d", background: c.border, textDecoration: "none",
                  fontWeight: 700, padding: "9px 18px", borderRadius: 10,
                }}>
                🔗 Visit Website
              </a>
            )}
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vendor.address || `${vendor.name} ${vendor.region}`)}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                fontSize: 13, color: c.text, border: `1.5px solid ${c.border}`, textDecoration: "none",
                fontWeight: 700, padding: "9px 18px", borderRadius: 10,
              }}>
              🧭 Get Directions
            </a>
            <button onClick={() => onToggleFavourite(vendor.id)}
              style={{
                fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 10, padding: "9px 18px",
                background: "transparent", border: `1.5px solid ${isFavourite ? "#ff6b81" : "#2b261d"}`,
                color: isFavourite ? "#ff6b81" : "#ada69a",
              }}>
              {isFavourite ? "♥ Saved" : "♡ Save"}
            </button>
            <button onClick={() => onToggleRoute(vendor)}
              style={{
                fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 10, padding: "9px 18px",
                background: inRoute ? c.border : "transparent",
                border: `1.5px solid ${c.border}`, color: inRoute ? "#14110d" : c.text,
              }}>
              {inRoute ? "✓ In route" : "📏 Compare distance"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function makePinIcon(color, selected) {
  const size = selected ? 20 : 14;
  return L.divIcon({
    className: "vendor-pin",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};
      border:2.5px solid ${selected ? "#fff" : "#14110d"};
      box-shadow:${selected ? `0 0 16px ${color}cc, 0 0 0 4px ${color}33` : "0 2px 6px rgba(0,0,0,0.5)"};
      transition:all 0.2s ease;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Auto-fits the map to the current vendors, but only re-fits when the
// filter *selection* changes (via fitKey) — not on incidental re-renders
// like toggling a favourite — so the user's pan/zoom is preserved.
function FitBounds({ vendors, fitKey }) {
  const map = useMap();
  const latest = useRef(vendors);
  latest.current = vendors;
  useEffect(() => {
    const vs = latest.current;
    if (!vs.length) return;
    const bounds = L.latLngBounds(vs.map(v => [v.lat, v.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
  }, [fitKey, map]);
  return null;
}

function FlyToSelected({ selectedVendor }) {
  const map = useMap();
  useEffect(() => {
    if (!selectedVendor) return;
    map.flyTo([selectedVendor.lat, selectedVendor.lng], Math.max(map.getZoom(), 14), { duration: 0.8 });
  }, [selectedVendor, map]);
  return null;
}

// Cap how many pins render at once so a zoomed-out view stays smooth.
const MAX_MAP_MARKERS = 140;

function VendorPin({ vendor, isSelected, onSelect, onImageClick, isFavourite, onToggleFavourite, inRoute, onToggleRoute }) {
  const c = CAT_COLORS[vendor.category];
  const thumb = vendorPhotos(vendor)[0];
  return (
    <Marker
      position={[vendor.lat, vendor.lng]}
      icon={makePinIcon(c.border, isSelected)}
      zIndexOffset={isSelected ? 1000 : 0}
      eventHandlers={{ click: () => onSelect(vendor.id) }}
    >
      {/* Hover peek */}
      <Tooltip direction="top" offset={[0, -8]} opacity={1} className="vendor-peek">
        <div style={{ width: 180 }}>
          {thumb && (
            <img src={thumb} alt={vendor.name}
              style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }} />
          )}
          <div style={{ padding: "6px 9px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: c.border }}>
              {vendor.category}
            </div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 14, fontWeight: 600, color: "#f0ece2", lineHeight: 1.2 }}>
              {vendor.name}
            </div>
            <div style={{ fontSize: 11, color: "#c9c1b3", marginTop: 2 }}>
              {vendor.rating ? `★ ${vendor.rating.toFixed(1)}` : ""}
              {vendor.reviewCount ? ` (${vendor.reviewCount.toLocaleString()})` : ""}
              {vendor.priceLevel != null ? ` · ${priceSymbol(vendor.priceLevel)}` : ""}
            </div>
          </div>
        </div>
      </Tooltip>

      {/* Click info card */}
      <Popup>
        <div style={{ fontFamily: "'DM Sans', sans-serif", minWidth: 180 }}>
          {thumb && (
            <img src={thumb} alt={vendor.name} onClick={() => onImageClick(vendor)}
              style={{ width: "100%", height: 96, objectFit: "cover", borderRadius: 8, marginBottom: 8, cursor: "zoom-in", display: "block" }} />
          )}
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: c.text, marginBottom: 4 }}>
            {vendor.category}
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 600, color: "#1a160f", marginBottom: 4 }}>
            {vendor.name}
          </div>
          <div style={{ fontSize: 12, color: "#5b5246", marginBottom: 2 }}>📍 {vendor.region}</div>
          {vendor.address && (
            <div style={{ fontSize: 11, color: "#7a7165", marginBottom: 4, marginLeft: 16, lineHeight: 1.4 }}>{vendor.address}</div>
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: c.text, letterSpacing: 1 }}>
            {vendor.priceLevel != null ? priceSymbol(vendor.priceLevel) : null}
            {vendor.rating ? <span style={{ marginLeft: vendor.priceLevel != null ? 8 : 0, color: "#5b5246", fontWeight: 500 }}>★ {vendor.rating.toFixed(1)}{vendor.reviewCount ? ` (${vendor.reviewCount.toLocaleString()})` : ""}</span> : null}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={() => onToggleFavourite(vendor.id)} style={{
              flex: 1, fontSize: 11, fontWeight: 700, cursor: "pointer", borderRadius: 7, padding: "5px 8px",
              background: "transparent", border: `1px solid ${isFavourite ? "#ff6b81" : "#ccc"}`,
              color: isFavourite ? "#ff6b81" : "#555",
            }}>
              {isFavourite ? "♥ Saved" : "♡ Save"}
            </button>
            <button onClick={() => onToggleRoute(vendor)} style={{
              flex: 1, fontSize: 11, fontWeight: 700, cursor: "pointer", borderRadius: 7, padding: "5px 8px",
              background: inRoute ? c.border : "transparent", border: `1px solid ${c.border}`,
              color: inRoute ? "#14110d" : c.text,
            }}>
              {inRoute ? "✓ Route" : "📏 Route"}
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

// Renders only the markers within the current map viewport (capped),
// re-evaluating as the user pans/zooms. Keeps the map fast with 800+ vendors.
function ViewportMarkers({ vendors, selected, onSelect, onImageClick, favourites, onToggleFavourite, routePoints, onToggleRoute, onCount }) {
  const map = useMap();
  const [bounds, setBounds] = useState(() => map.getBounds());
  useMapEvents({
    moveend: () => setBounds(map.getBounds()),
    zoomend: () => setBounds(map.getBounds()),
  });

  const inView = useMemo(
    () => (bounds ? vendors.filter(v => bounds.contains([v.lat, v.lng])) : []),
    [vendors, bounds]
  );
  const visible = useMemo(() => {
    if (inView.length <= MAX_MAP_MARKERS) return inView;
    return [...inView].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, MAX_MAP_MARKERS);
  }, [inView]);

  useEffect(() => { onCount?.(visible.length, inView.length); }, [visible.length, inView.length, onCount]);

  return (
    <>
      {visible.map(v => (
        <VendorPin
          key={v.id}
          vendor={v}
          isSelected={selected === v.id}
          onSelect={onSelect}
          onImageClick={onImageClick}
          isFavourite={favourites.includes(v.id)}
          onToggleFavourite={onToggleFavourite}
          inRoute={routePoints.some(r => r.id === v.id)}
          onToggleRoute={onToggleRoute}
        />
      ))}
    </>
  );
}

export default function WeddingVendorPortal() {
  const [categories, setCategories] = useState([]); // empty = all categories
  const [regions, setRegions] = useState([]);       // empty = all regions
  const [view, setView] = useState("split");
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("rating");
  const [lightboxVendor, setLightboxVendor] = useState(null);
  const [routePoints, setRoutePoints] = useState([]); // up to 2 vendors
  const [routePath, setRoutePath] = useState(null);   // { coords, km, min } from OSRM
  const [routeLoading, setRouteLoading] = useState(false);
  const [mapCount, setMapCount] = useState({ shown: 0, inView: 0 });

  const handleMapCount = useCallback((shown, inView) => setMapCount({ shown, inView }), []);
  const [favourites, setFavourites] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FAVE_KEY) || "[]"); } catch { return []; }
  });
  const [showFaves, setShowFaves] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    localStorage.setItem(FAVE_KEY, JSON.stringify(favourites));
  }, [favourites]);

  // Fetch a real road-following driving route between the two route points
  // from OSRM (free, no key). Falls back to a straight line if it fails.
  useEffect(() => {
    if (routePoints.length !== 2) { setRoutePath(null); setRouteLoading(false); return; }
    const [a, b] = routePoints;
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    let cancelled = false;
    setRouteLoading(true);
    setRoutePath(null);
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const route = data.routes?.[0];
        if (!route) { setRoutePath(null); return; }
        setRoutePath({
          coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
          km: route.distance / 1000,
          min: Math.round(route.duration / 60),
        });
      })
      .catch(() => { if (!cancelled) setRoutePath(null); })
      .finally(() => { if (!cancelled) setRouteLoading(false); });
    return () => { cancelled = true; };
  }, [routePoints]);

  const toggleCategory = useCallback((key) => {
    setCategories(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }, []);
  const toggleRegion = useCallback((key) => {
    setRegions(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }, []);
  const toggleFavourite = useCallback((id) => {
    setFavourites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);
  const toggleRoute = useCallback((vendor) => {
    setRoutePoints(prev => {
      if (prev.find(v => v.id === vendor.id)) return prev.filter(v => v.id !== vendor.id);
      return [...prev, vendor].slice(-2); // keep the two most recent
    });
  }, []);

  const handleExport = useCallback(async () => {
    const favVendors = VENDORS.filter(v => favourites.includes(v.id));
    if (!favVendors.length) return;
    if (!isSheetsConfigured()) {
      exportToCsv(favVendors, "ggs-favourite-vendors.csv");
      return;
    }
    setExporting(true);
    try {
      const url = await exportToSheet(favVendors, "GGS Favourite Wedding Vendors");
      window.open(url, "_blank");
    } catch (e) {
      alert(
        "Couldn't create a Google Sheet (" + e.message + ").\n\n" +
        "Downloading a CSV instead — you can import it into Google Sheets via File → Import."
      );
      exportToCsv(favVendors, "ggs-favourite-vendors.csv");
    } finally {
      setExporting(false);
    }
  }, [favourites]);

  const filtered = useMemo(() => {
    const list = VENDORS.filter(v => {
      if (categories.length > 0 && !categories.includes(v.category)) return false;
      if (regions.length > 0 && !regions.includes(v.region)) return false;
      if (showFaves && !favourites.includes(v.id)) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${v.name} ${v.address || ""} ${(v.types || []).join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    return list.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "reviews") return (b.reviewCount || 0) - (a.reviewCount || 0);
      // "rating" (default): rating desc, review count as tiebreaker
      const ra = a.rating || 0, rb = b.rating || 0;
      if (rb !== ra) return rb - ra;
      return (b.reviewCount || 0) - (a.reviewCount || 0);
    });
  }, [categories, regions, search, sortBy, showFaves, favourites]);

  // Stable signature of the filter *selection* — the map only auto-fits
  // when this changes, so toggling a favourite doesn't reset the view.
  const fitKey = useMemo(
    () => `${[...categories].sort().join(",")}|${[...regions].sort().join(",")}|${search}|${showFaves}`,
    [categories, regions, search, showFaves]
  );

  const handleSelect = useCallback((id) => {
    setSelected(prev => prev === id ? null : id);
  }, []);

  const selectedVendor = useMemo(
    () => filtered.find(v => v.id === selected) || null,
    [filtered, selected]
  );

  return (
    <div style={{
      minHeight: "100vh", background: "#14110d", color: "#f0ece2",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #1c1812; }
        ::-webkit-scrollbar-thumb { background: #3b342a; border-radius: 3px; }

        /* Leaflet dark-theme overrides */
        .leaflet-container { background: #14110d !important; font-family: 'DM Sans', sans-serif; }
        .leaflet-control-zoom a {
          background: #1c1812 !important; color: #C9A063 !important;
          border: 1px solid #2b261d !important;
        }
        .leaflet-control-zoom a:hover { background: #2b261d !important; }
        .leaflet-control-attribution {
          background: rgba(24,20,16,0.85) !important; color: #8a8175 !important;
          backdrop-filter: blur(6px);
        }
        .leaflet-control-attribution a { color: #C9A063 !important; }
        .leaflet-popup-content-wrapper {
          background: #f0ece2 !important; color: #1a160f !important;
          border-radius: 10px !important;
          box-shadow: 0 6px 24px rgba(0,0,0,0.6) !important;
        }
        .leaflet-popup-tip { background: #f0ece2 !important; }
        .leaflet-popup-close-button { color: #8a8175 !important; }
        .vendor-pin { background: transparent !important; border: none !important; }
        /* Hover peek tooltip — dark themed, image flush to edges */
        .leaflet-tooltip.vendor-peek {
          background: #1c1812 !important; border: 1px solid #C9A06355 !important;
          border-radius: 10px !important; padding: 0 !important; overflow: hidden !important;
          box-shadow: 0 8px 28px rgba(0,0,0,0.6) !important; color: #f0ece2 !important;
          white-space: normal !important;
        }
        .leaflet-tooltip.vendor-peek::before { display: none !important; }
      `}</style>

      {/* HEADER */}
      <header style={{
        padding: "28px 32px 20px",
        borderBottom: "1px solid #221d16",
        background: "linear-gradient(180deg, #181410 0%, #14110d 100%)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{
              fontSize: 10, letterSpacing: 4, textTransform: "uppercase",
              color: "#C9A063", fontWeight: 700, marginBottom: 4,
            }}>
              Golden Glance Studio Presents
            </div>
            <h1 style={{
              fontSize: 32, fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 300, letterSpacing: 1, color: "#f0ece2",
              lineHeight: 1.2,
            }}>
              Ontario Wedding <span style={{ fontStyle: "italic", fontWeight: 600, color: "#C9A063" }}>Vendor Directory</span>
            </h1>
            <p style={{ fontSize: 13, color: "#7a7165", marginTop: 4 }}>
              Venues, Bakeries & Florists across Southern Ontario
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {/* FAVOURITES */}
            <button
              onClick={() => setShowFaves(s => !s)}
              style={{
                background: showFaves ? "#ff6b8122" : "#1c1812",
                border: `1.5px solid ${showFaves ? "#ff6b81" : "#2b261d"}`,
                color: showFaves ? "#ff6b81" : "#8a8175",
                borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}
            >
              ♥ Saved ({favourites.length})
            </button>
            {favourites.length > 0 && (
              <button
                onClick={handleExport}
                disabled={exporting}
                title={isSheetsConfigured() ? "Export favourites to a Google Sheet" : "Download favourites as CSV (opens in Excel & Google Sheets)"}
                style={{
                  background: "#C9A063", color: "#14110d",
                  border: "none", borderRadius: 10, padding: "8px 14px",
                  fontSize: 12, fontWeight: 700, cursor: exporting ? "wait" : "pointer",
                  fontFamily: "'DM Sans', sans-serif", opacity: exporting ? 0.6 : 1,
                }}
              >
                {exporting ? "Exporting…" : (isSheetsConfigured() ? "📊 Export to Sheets" : "📊 Export CSV")}
              </button>
            )}

            {/* VIEW TOGGLE */}
            <div style={{ display: "flex", gap: 4, background: "#1c1812", borderRadius: 10, padding: 3 }}>
              {[
                { key: "split", label: "Split" },
                { key: "map", label: "Map" },
                { key: "list", label: "List" },
              ].map(v => (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  style={{
                    background: view === v.key ? "#C9A063" : "transparent",
                    color: view === v.key ? "#1a160f" : "#8a8175",
                    border: "none", borderRadius: 8, padding: "6px 16px",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                    transition: "all 0.2s ease",
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* FILTERS — categories (multi-select) + search */}
        <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {CATEGORIES.map(cat => {
            const active = categories.includes(cat.key);
            return (
              <button
                key={cat.key}
                onClick={() => toggleCategory(cat.key)}
                style={{
                  background: active ? "#C9A06322" : "#1c1812",
                  border: `1.5px solid ${active ? "#C9A063" : "#2b261d"}`,
                  color: active ? "#C9A063" : "#8a8175",
                  borderRadius: 20, padding: "7px 16px", fontSize: 12,
                  fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  transition: "all 0.2s ease",
                }}
              >
                {active ? "✓ " : ""}{cat.icon} {cat.label}
              </button>
            );
          })}

          {(categories.length > 0 || regions.length > 0) && (
            <button
              onClick={() => { setCategories([]); setRegions([]); }}
              style={{
                background: "transparent", border: "1px solid #3b342a",
                color: "#6a6155", borderRadius: 20, padding: "7px 14px",
                fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}
            >
              ✕ Clear filters
            </button>
          )}

          <input
            type="text"
            placeholder="Search vendors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: "#1c1812", border: "1.5px solid #2b261d",
              color: "#c9c1b3", borderRadius: 20, padding: "7px 16px",
              fontSize: 12, fontFamily: "'DM Sans', sans-serif",
              outline: "none", minWidth: 160, flex: "0 1 auto",
            }}
          />

          <span style={{ fontSize: 12, color: "#6a6155", marginLeft: 4 }}>
            {filtered.length} vendor{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* REGION ROW — multi-select */}
        <div style={{
          marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center",
        }}>
          <span style={{ fontSize: 11, color: "#6a6155", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginRight: 4 }}>
            📍 Region:
          </span>
          {REGIONS.map(r => {
            const active = regions.includes(r);
            return (
              <button
                key={r}
                onClick={() => toggleRegion(r)}
                style={{
                  background: active ? "#C9A06322" : "#1c1812",
                  border: `1.5px solid ${active ? "#C9A063" : "#2b261d"}`,
                  color: active ? "#C9A063" : "#8a8175",
                  borderRadius: 20, padding: "5px 14px", fontSize: 11,
                  fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  transition: "all 0.2s ease",
                }}
              >
                {active ? "✓ " : ""}{r}
              </button>
            );
          })}
        </div>

        {/* SORT ROW */}
        <div style={{
          marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center",
        }}>
          <span style={{ fontSize: 11, color: "#6a6155", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginRight: 4 }}>
            ↕ Sort:
          </span>
          {SORT_OPTIONS.map(opt => {
            const active = sortBy === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                style={{
                  background: active ? "#C9A06322" : "#1c1812",
                  border: `1.5px solid ${active ? "#C9A063" : "#2b261d"}`,
                  color: active ? "#C9A063" : "#8a8175",
                  borderRadius: 20, padding: "5px 14px", fontSize: 12,
                  fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                  transition: "all 0.2s ease",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div style={{
        display: "flex", height: "calc(100vh - 170px)",
        flexDirection: view === "list" ? "column" : "row",
      }}>

        {/* MAP */}
        {view !== "list" && (
          <div style={{
            flex: view === "map" ? 1 : "0 0 55%",
            background: "#14110d",
            position: "relative",
            borderRight: view === "split" ? "1px solid #221d16" : "none",
            overflow: "hidden",
          }}>
            <MapContainer
              center={[43.6, -79.8]}
              zoom={9}
              scrollWheelZoom={true}
              style={{ width: "100%", height: "100%", background: "#14110d" }}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                maxZoom={20}
              />
              <FitBounds vendors={filtered} fitKey={fitKey} />
              <FlyToSelected selectedVendor={selectedVendor} />
              {routePoints.length === 2 && (
                <Polyline
                  positions={routePath ? routePath.coords : routePoints.map(v => [v.lat, v.lng])}
                  pathOptions={routePath
                    ? { color: "#C9A063", weight: 4, opacity: 0.95 }
                    : { color: "#C9A063", weight: 3, dashArray: "8 8", opacity: 0.6 }}
                />
              )}
              <ViewportMarkers
                vendors={filtered}
                selected={selected}
                onSelect={handleSelect}
                onImageClick={setLightboxVendor}
                favourites={favourites}
                onToggleFavourite={toggleFavourite}
                routePoints={routePoints}
                onToggleRoute={toggleRoute}
                onCount={handleMapCount}
              />
            </MapContainer>

            {/* Map count / zoom hint */}
            <div style={{
              position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
              zIndex: 500, background: "rgba(24,20,16,0.92)", backdropFilter: "blur(8px)",
              border: "1px solid #2b261d", borderRadius: 20, padding: "5px 14px",
              fontSize: 11, color: "#c9c1b3", fontFamily: "'DM Sans', sans-serif",
              pointerEvents: "none", whiteSpace: "nowrap",
            }}>
              {mapCount.inView > mapCount.shown
                ? `Showing top ${mapCount.shown} of ${mapCount.inView} here · zoom in for more`
                : `${mapCount.shown} vendor${mapCount.shown !== 1 ? "s" : ""} in view`}
            </div>

            {/* Legend */}
            <div style={{
              position: "absolute", bottom: 16, left: 16,
              background: "rgba(24,20,16,0.92)", backdropFilter: "blur(10px)",
              border: "1px solid #2b261d", borderRadius: 10,
              padding: "10px 14px", display: "flex", gap: 14,
              zIndex: 500,
            }}>
              {Object.entries(CAT_COLORS).map(([key, c]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: c.border }} />
                  <span style={{ fontSize: 11, color: "#8a8175", textTransform: "capitalize" }}>{key}</span>
                </div>
              ))}
            </div>

            {filtered.length === 0 && (
              <div style={{
                position: "absolute", inset: 0, display: "flex",
                alignItems: "center", justifyContent: "center",
                color: "#8a8175", fontSize: 14, fontStyle: "italic",
                background: "rgba(20,17,13,0.5)", pointerEvents: "none",
                zIndex: 600,
              }}>
                No vendors match your filters
              </div>
            )}
          </div>
        )}

        {/* LIST */}
        {view !== "map" && (
          <div style={{
            flex: view === "list" ? 1 : "0 0 45%",
            overflowY: "auto", padding: "16px 20px",
          }}>
            {filtered.length === 0 && (
              <div style={{ color: "#5b5246", fontSize: 14, fontStyle: "italic", textAlign: "center", marginTop: 60 }}>
                No vendors match your filters. Try adjusting the category or region.
              </div>
            )}
            {filtered.map(v => (
              <VendorCard
                key={v.id}
                vendor={v}
                isSelected={selected === v.id}
                onClick={() => handleSelect(v.id)}
                onImageClick={setLightboxVendor}
                isFavourite={favourites.includes(v.id)}
                onToggleFavourite={toggleFavourite}
                inRoute={routePoints.some(r => r.id === v.id)}
                onToggleRoute={toggleRoute}
              />
            ))}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{
        padding: "12px 32px", borderTop: "1px solid #221d16",
        fontSize: 11, color: "#4d4538", textAlign: "center",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        Curated by Golden Glance Studio · Prices are approximate and may vary by season · Always confirm directly with vendors
      </div>

      {routePoints.length > 0 && (
        <div style={{
          position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 800, background: "rgba(28,24,18,0.96)", backdropFilter: "blur(10px)",
          border: "1px solid #C9A06355", borderRadius: 14, padding: "12px 18px",
          display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)", maxWidth: "92vw",
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {routePoints.length === 1 ? (
            <span style={{ fontSize: 13, color: "#c9c1b3" }}>
              📏 <strong style={{ color: "#f0ece2" }}>{routePoints[0].name}</strong> — select a second vendor to compare distance
            </span>
          ) : (
            <>
              <span style={{ fontSize: 13, color: "#c9c1b3" }}>
                <strong style={{ color: "#f0ece2" }}>{routePoints[0].name}</strong>
                <span style={{ color: "#C9A063", margin: "0 8px" }}>→</span>
                <strong style={{ color: "#f0ece2" }}>{routePoints[1].name}</strong>
                {routePath ? (
                  <span style={{ marginLeft: 10, color: "#C9A063", fontWeight: 700 }}>
                    {routePath.km.toFixed(1)} km · {routePath.min} min drive
                  </span>
                ) : (
                  <span style={{ marginLeft: 10, color: "#C9A063", fontWeight: 700 }}>
                    ~{haversineKm(routePoints[0], routePoints[1]).toFixed(1)} km
                    <span style={{ marginLeft: 4, fontSize: 11, color: "#6a6155", fontWeight: 400 }}>
                      {routeLoading ? "(finding route…)" : "(straight line)"}
                    </span>
                  </span>
                )}
              </span>
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${routePoints[0].lat},${routePoints[0].lng}&destination=${routePoints[1].lat},${routePoints[1].lng}&travelmode=driving`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  fontSize: 12, fontWeight: 700, color: "#14110d", background: "#C9A063",
                  textDecoration: "none", padding: "7px 14px", borderRadius: 9, whiteSpace: "nowrap",
                }}
              >
                🧭 Driving route
              </a>
            </>
          )}
          <button
            onClick={() => setRoutePoints([])}
            style={{
              fontSize: 12, color: "#8a8175", background: "transparent",
              border: "1px solid #3b342a", borderRadius: 9, padding: "7px 12px", cursor: "pointer",
            }}
          >
            ✕ Clear
          </button>
        </div>
      )}

      {lightboxVendor && (
        <Lightbox
          vendor={lightboxVendor}
          onClose={() => setLightboxVendor(null)}
          isFavourite={favourites.includes(lightboxVendor.id)}
          onToggleFavourite={toggleFavourite}
          inRoute={routePoints.some(r => r.id === lightboxVendor.id)}
          onToggleRoute={toggleRoute}
        />
      )}
    </div>
  );
}
