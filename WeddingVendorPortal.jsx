import { useState, useMemo, useCallback, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import VENDORS from "./vendor-data.json";

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

function VendorThumb({ vendor, onImageClick, height = 130 }) {
  const c = CAT_COLORS[vendor.category];
  const cat = CATEGORIES.find(x => x.key === vendor.category);
  if (vendor.photo) {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onImageClick(vendor); }}
        style={{ height, margin: "-18px -20px 14px", position: "relative", cursor: "zoom-in", overflow: "hidden" }}
      >
        <img
          src={vendor.photo}
          alt={vendor.name}
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, transparent 60%, rgba(20,17,13,0.55) 100%)",
        }} />
        <div style={{
          position: "absolute", bottom: 8, right: 10, fontSize: 10, fontWeight: 600,
          color: "#f0ece2", background: "rgba(20,17,13,0.6)", borderRadius: 6,
          padding: "3px 7px", fontFamily: "'DM Sans', sans-serif",
        }}>
          🔍 View
        </div>
      </div>
    );
  }
  // Placeholder when no photo is available
  return (
    <div style={{
      height, margin: "-18px -20px 14px",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: `linear-gradient(135deg, ${c.bg}, #14110d)`,
      fontSize: 34, opacity: 0.55,
    }}>
      {cat?.icon || "✦"}
    </div>
  );
}

function VendorCard({ vendor, isSelected, onClick, onImageClick }) {
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
      <VendorThumb vendor={vendor} onImageClick={onImageClick} />
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
          </div>
        </div>
      )}
    </div>
  );
}

function Lightbox({ vendor, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!vendor) return null;
  const c = CAT_COLORS[vendor.category];

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
        {vendor.photo ? (
          <img src={vendor.photo} alt={vendor.name}
            style={{ width: "100%", maxHeight: "55vh", objectFit: "cover", display: "block" }} />
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

function FitBounds({ vendors }) {
  const map = useMap();
  useEffect(() => {
    if (!vendors.length) return;
    const bounds = L.latLngBounds(vendors.map(v => [v.lat, v.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
  }, [vendors, map]);
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

export default function WeddingVendorPortal() {
  const [categories, setCategories] = useState([]); // empty = all categories
  const [regions, setRegions] = useState([]);       // empty = all regions
  const [view, setView] = useState("split");
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("rating");
  const [lightboxVendor, setLightboxVendor] = useState(null);

  const toggleCategory = useCallback((key) => {
    setCategories(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }, []);
  const toggleRegion = useCallback((key) => {
    setRegions(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }, []);

  const filtered = useMemo(() => {
    const list = VENDORS.filter(v => {
      if (categories.length > 0 && !categories.includes(v.category)) return false;
      if (regions.length > 0 && !regions.includes(v.region)) return false;
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
  }, [categories, regions, search, sortBy]);

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
              GTA Wedding <span style={{ fontStyle: "italic", fontWeight: 600, color: "#C9A063" }}>Vendor Directory</span>
            </h1>
            <p style={{ fontSize: 13, color: "#7a7165", marginTop: 4 }}>
              Venues, Bakeries & Florists across the Greater Toronto Area & Ontario
            </p>
          </div>

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
              center={[43.65, -79.4]}
              zoom={10}
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
              <FitBounds vendors={filtered} />
              <FlyToSelected selectedVendor={selectedVendor} />
              {filtered.map(v => {
                const c = CAT_COLORS[v.category];
                const isSel = selected === v.id;
                return (
                  <Marker
                    key={v.id}
                    position={[v.lat, v.lng]}
                    icon={makePinIcon(c.border, isSel)}
                    zIndexOffset={isSel ? 1000 : 0}
                    eventHandlers={{ click: () => handleSelect(v.id) }}
                  >
                    <Popup>
                      <div style={{ fontFamily: "'DM Sans', sans-serif", minWidth: 180 }}>
                        {v.photo && (
                          <img
                            src={v.photo}
                            alt={v.name}
                            onClick={() => setLightboxVendor(v)}
                            style={{
                              width: "100%", height: 96, objectFit: "cover",
                              borderRadius: 8, marginBottom: 8, cursor: "zoom-in", display: "block",
                            }}
                          />
                        )}
                        <div style={{
                          fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                          letterSpacing: 2, color: c.text, marginBottom: 4,
                        }}>
                          {v.category}
                        </div>
                        <div style={{
                          fontFamily: "'Cormorant Garamond', serif",
                          fontSize: 16, fontWeight: 600, color: "#1a160f", marginBottom: 4,
                        }}>
                          {v.name}
                        </div>
                        <div style={{ fontSize: 12, color: "#5b5246", marginBottom: 2 }}>📍 {v.region}</div>
                        {v.address && (
                          <div style={{ fontSize: 11, color: "#7a7165", marginBottom: 4, marginLeft: 16, lineHeight: 1.4 }}>{v.address}</div>
                        )}
                        <div style={{ fontSize: 13, fontWeight: 700, color: c.text, letterSpacing: 1 }}>
                          {v.priceLevel != null ? priceSymbol(v.priceLevel) : null}
                          {v.rating ? <span style={{ marginLeft: v.priceLevel != null ? 8 : 0, color: "#5b5246", fontWeight: 500 }}>★ {v.rating.toFixed(1)}{v.reviewCount ? ` (${v.reviewCount.toLocaleString()})` : ""}</span> : null}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

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

      {lightboxVendor && (
        <Lightbox vendor={lightboxVendor} onClose={() => setLightboxVendor(null)} />
      )}
    </div>
  );
}
