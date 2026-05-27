import { useState, useMemo, useCallback, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const VENDORS = [
  // === VENUES ===
  { id: 1, name: "Casa Loma", category: "venue", region: "Toronto", address: "1 Austin Terrace, Toronto, ON M5R 1X8", lat: 43.6780, lng: -79.4094, priceRange: "$5,000–$15,000", budgetMin: 5000, budgetMax: 15000, packages: "Venue rental, ceremony & reception spaces, bridal suite, garden access", phone: "(416) 923-1171", website: "https://casaloma.ca", rating: 4.7 },
  { id: 2, name: "The Fairmont Royal York", category: "venue", region: "Toronto", address: "100 Front St W, Toronto, ON M5J 1E3", lat: 43.6477, lng: -79.3806, priceRange: "$8,000–$20,000+", budgetMin: 8000, budgetMax: 20000, packages: "Ballroom rental, catering, bridal suite, valet parking, wedding coordinator", phone: "(416) 368-2511", website: "https://fairmont.com/royal-york-toronto", rating: 4.6 },
  { id: 3, name: "Candle Banquet Hall", category: "venue", region: "Mississauga", address: "1500 Royal Windsor Dr, Mississauga, ON L5J 1K7", lat: 43.5890, lng: -79.6441, priceRange: "$3,500–$8,000", budgetMin: 3500, budgetMax: 8000, packages: "Hall rental, in-house catering, décor packages, DJ setup", phone: "(905) 564-9461", website: "https://candlebanquethall.com", rating: 4.3 },
  { id: 4, name: "The Great Hall", category: "venue", region: "Toronto", address: "1087 Queen St W, Toronto, ON M6J 1H3", lat: 43.6484, lng: -79.4197, priceRange: "$3,000–$8,000 (est. 100 guests)", budgetMin: 3000, budgetMax: 8000, packages: "Victorian venue, catering packages, ceremony + reception, bar service", phone: "(416) 792-1268", website: "https://thegreathall.ca", rating: 4.5 },
  { id: 5, name: "Palais Royale", category: "venue", region: "Toronto", address: "1601 Lake Shore Blvd W, Toronto, ON M6K 3C1", lat: 43.6362, lng: -79.4340, priceRange: "$4,000–$10,000", budgetMin: 4000, budgetMax: 10000, packages: "Lakefront venue, cocktail hour, reception, bridal suite, AV included", phone: "(416) 533-3553", website: "https://palaisroyale.ca", rating: 4.5 },
  { id: 6, name: "Hazelton Manor", category: "venue", region: "Vaughan", address: "99 Peelar Rd, Concord, ON L4K 1A7", lat: 43.8170, lng: -79.5350, priceRange: "$5,000–$12,000", budgetMin: 5000, budgetMax: 12000, packages: "All-inclusive catering, open bar, ceremony décor, bridal suite, valet", phone: "(905) 695-0635", website: "https://hazeltonmanor.com", rating: 4.4 },
  { id: 7, name: "The Old Mill Toronto", category: "venue", region: "Toronto", address: "21 Old Mill Rd, Toronto, ON M8X 1G5", lat: 43.6501, lng: -79.4938, priceRange: "$6,000–$15,000", budgetMin: 6000, budgetMax: 15000, packages: "Historic venue, catering, spa access, overnight suites, garden ceremony", phone: "(416) 236-2641", website: "https://oldmilltoronto.com", rating: 4.6 },
  { id: 8, name: "Liuna Station", category: "venue", region: "Hamilton", address: "360 James St N, Hamilton, ON L8L 1H5", lat: 43.2557, lng: -79.8711, priceRange: "$4,000–$10,000", budgetMin: 4000, budgetMax: 10000, packages: "Grand hall rental, catering, bar packages, ceremony space, AV", phone: "(905) 529-2566", website: "https://liunastation.com", rating: 4.7 },
  { id: 9, name: "Spencer's at the Waterfront", category: "venue", region: "Burlington", address: "1340 Lakeshore Rd, Burlington, ON L7S 1B1", lat: 43.3255, lng: -79.7990, priceRange: "$3,500–$9,000", budgetMin: 3500, budgetMax: 9000, packages: "Lakefront patio, in-house catering, ceremony + reception, bar service", phone: "(905) 633-7494", website: "https://spencers.ca", rating: 4.5 },
  { id: 10, name: "Evergreen Brick Works", category: "venue", region: "Toronto", address: "550 Bayview Ave, Toronto, ON M4W 3X8", lat: 43.6846, lng: -79.3654, priceRange: "$4,500–$11,000", budgetMin: 4500, budgetMax: 11000, packages: "Industrial-chic venue, outdoor garden, catering kitchen, event coordinator", phone: "(416) 596-7670", website: "https://evergreen.ca", rating: 4.6 },
  { id: 11, name: "Liberty Grand", category: "venue", region: "Toronto", address: "25 British Columbia Rd, Toronto, ON M6K 3C3", lat: 43.6336, lng: -79.4153, priceRange: "$7,000–$18,000", budgetMin: 7000, budgetMax: 18000, packages: "Grand ballrooms, waterfront terrace, in-house catering, full AV, valet", phone: "(416) 260-1818", website: "https://libertygrand.com", rating: 4.5 },
  { id: 12, name: "Bellvue Manor", category: "venue", region: "Vaughan", address: "8083 Jane St, Concord, ON L4K 5N9", lat: 43.8097, lng: -79.5293, priceRange: "$4,500–$10,000", budgetMin: 4500, budgetMax: 10000, packages: "Banquet hall, catering, décor, ceremony setup, bridal suite", phone: "(905) 605-9000", website: "https://bellvuemanor.com", rating: 4.3 },

  // === BAKERIES ===
  { id: 20, name: "Finespun Cakes & Pastries", category: "bakery", region: "Toronto", address: "750 Pape Ave, Toronto, ON M4K 3T2", lat: 43.6629, lng: -79.3370, priceRange: "$800–$3,000+", budgetMin: 800, budgetMax: 3000, packages: "Custom tiered wedding cakes, dessert tables, cupcake towers, tasting sessions", phone: "(416) 792-0311", website: "https://finespuncakes.com", rating: 4.9 },
  { id: 21, name: "Olivia Yang Cake Studio", category: "bakery", region: "Toronto", address: "Toronto, ON (studio — by appointment)", lat: 43.6590, lng: -79.3480, priceRange: "$600–$2,500", budgetMin: 600, budgetMax: 2500, packages: "Custom wedding cakes, fondant & buttercream, floral sugar art, delivery", phone: "(647) 808-0373", website: "https://oliviayangcakes.com", rating: 4.9 },
  { id: 22, name: "Serano Bakery", category: "bakery", region: "Toronto", address: "6685 Kingston Rd, Scarborough, ON M1B 1G3", lat: 43.6773, lng: -79.3504, priceRange: "$400–$1,500", budgetMin: 400, budgetMax: 1500, packages: "Wedding cakes, custom designs, Greek pastries, tiered cakes, sheet cakes", phone: "(416) 962-3874", website: "https://seranobakery.com", rating: 4.7 },
  { id: 23, name: "The Rolling Pin", category: "bakery", region: "Toronto", address: "3429 Yonge St, Toronto, ON M4N 2N1", lat: 43.6900, lng: -79.3000, priceRange: "$500–$2,000", budgetMin: 500, budgetMax: 2000, packages: "Wedding cakes, cupcake bouquets, pastry tables, custom colour matching", phone: "(416) 291-3737", website: "https://rollingpin.ca", rating: 4.6 },
  { id: 24, name: "Daan Go Cake Lab", category: "bakery", region: "Markham", address: "5051 Highway 7, Unit 5A, Markham, ON L3R 1N3", lat: 43.8561, lng: -79.3370, priceRange: "$500–$2,500", budgetMin: 500, budgetMax: 2500, packages: "Custom wedding cakes, macarons, East-meets-West designs, dessert bars", phone: "(905) 604-2866", website: "https://daango.com", rating: 4.7 },
  { id: 25, name: "Patisserie Fleur", category: "bakery", region: "Markham", address: "8788 Woodbine Ave, Markham, ON L3R 8C5", lat: 43.8515, lng: -79.3370, priceRange: "$400–$1,800", budgetMin: 400, budgetMax: 1800, packages: "French-inspired wedding cakes, mini cakes, afternoon tea, custom designs", phone: "(905) 415-8818", website: "https://patisseriefleur.ca", rating: 4.6 },
  { id: 26, name: "La Rocca Creative Cakes", category: "bakery", region: "Toronto", address: "5125 Steeles Ave W, Toronto, ON M9L 1R5", lat: 43.7065, lng: -79.3540, priceRange: "$500–$2,500", budgetMin: 500, budgetMax: 2500, packages: "Custom tiered cakes, European pastry, gelato cakes, sheet cakes", phone: "(416) 962-4858", website: "https://laroccacakes.com", rating: 4.5 },
  { id: 27, name: "Duo Pâtisserie & Café", category: "bakery", region: "Vaughan", address: "9981 Keele St, Vaughan, ON L6A 1R7", lat: 43.8250, lng: -79.4720, priceRange: "$450–$2,000", budgetMin: 450, budgetMax: 2000, packages: "French-Japanese wedding cakes, viennoiseries, custom designs, chocolate", phone: "(905) 771-0881", website: "https://duopatisserie.com", rating: 4.6 },

  // === FLORISTS ===
  { id: 40, name: "Wild North Flowers", category: "florist", region: "Toronto", address: "712 Pape Ave, Toronto, ON M4K 3S5", lat: 43.6620, lng: -79.3390, priceRange: "$350–$5,000+", budgetMin: 350, budgetMax: 5000, packages: "À la carte: bridal bouquet $300, bridesmaid $185, centerpieces $100–$300, GTA delivery", phone: "(416) 859-6853", website: "https://wildnorthflowers.com", rating: 4.8 },
  { id: 41, name: "The Dulce Dwelling", category: "florist", region: "Toronto", address: "Toronto, ON (studio — by appointment)", lat: 43.6511, lng: -79.3610, priceRange: "$2,500–$10,000+", budgetMin: 2500, budgetMax: 10000, packages: "Full-service: bouquets, installations, ceremony arches, centerpieces, teardown", phone: "(647) 490-2210", website: "https://thedulcedwelling.com", rating: 4.9 },
  { id: 42, name: "Dynasty Events & Florals", category: "florist", region: "Toronto", address: "Toronto, ON (studio — by appointment)", lat: 43.6470, lng: -79.3750, priceRange: "$4,000–$12,000+", budgetMin: 4000, budgetMax: 12000, packages: "Luxury full-service: custom bouquets, arches, ceiling installations, delivery + setup", phone: "(647) 995-9555", website: "https://dynastyfloral.com", rating: 4.8 },
  { id: 43, name: "Bushel & Bloom", category: "florist", region: "Toronto", address: "Toronto, ON (online + delivery)", lat: 43.6700, lng: -79.3850, priceRange: "$50–$1,500", budgetMin: 50, budgetMax: 1500, packages: "Faux-flower rentals: bridal bouquet $50+, bridesmaid, centerpieces, budget-friendly", phone: "N/A", website: "https://bushelandbloom.com", rating: 4.7 },
  { id: 44, name: "Harvest Hill Flowers", category: "florist", region: "Toronto Area", address: "Greater Toronto Area (delivery only)", lat: 43.7200, lng: -79.4100, priceRange: "$80–$1,200", budgetMin: 80, budgetMax: 1200, packages: "Dried flower bouquets: bridal $80, bridesmaid $60, boutonniere $15, centerpieces $60–$100", phone: "N/A", website: "https://harvesthillflowers.com", rating: 4.8 },
  { id: 45, name: "Floravue", category: "florist", region: "Vaughan", address: "Vaughan, ON (studio — by appointment)", lat: 43.8100, lng: -79.5200, priceRange: "$2,000–$8,000", budgetMin: 2000, budgetMax: 8000, packages: "Full-service wedding florals: bouquets, décor, archways, table arrangements, delivery", phone: "(416) 305-5656", website: "https://floravue.ca", rating: 4.5 },
  { id: 46, name: "Petals & Oak", category: "florist", region: "Toronto", address: "Toronto, ON (studio — by appointment)", lat: 43.6550, lng: -79.3650, priceRange: "$1,500–$6,000", budgetMin: 1500, budgetMax: 6000, packages: "Garden-style arrangements, bridal bouquets, ceremony décor, seasonal blooms", phone: "(647) 370-8970", website: "https://petalsandoak.com", rating: 5.0 },
  { id: 47, name: "Bana Florist", category: "florist", region: "Toronto", address: "874 Eglinton Ave W, Toronto, ON M6C 2B6", lat: 43.6920, lng: -79.3980, priceRange: "$1,000–$5,000", budgetMin: 1000, budgetMax: 5000, packages: "Wedding packages, bridal bouquets, centerpieces, ceremony arches, delivery", phone: "(416) 625-2262", website: "https://banaflorist.com", rating: 4.4 },
];

const BUDGET_PRESETS = [
  { label: "Any Budget", min: 0, max: 999999 },
  { label: "Under $1K", min: 0, max: 1000 },
  { label: "$1K–$3K", min: 1000, max: 3000 },
  { label: "$3K–$5K", min: 3000, max: 5000 },
  { label: "$5K–$10K", min: 5000, max: 10000 },
  { label: "$10K–$15K", min: 10000, max: 15000 },
  { label: "$15K+", min: 15000, max: 999999 },
];

const REGIONS = ["All Regions", "Toronto", "Mississauga", "Vaughan", "Markham", "Hamilton", "Burlington", "Toronto Area"];
const CATEGORIES = [
  { key: "all", label: "All Vendors", icon: "✦" },
  { key: "venue", label: "Venues", icon: "🏛" },
  { key: "bakery", label: "Bakeries", icon: "🎂" },
  { key: "florist", label: "Florists", icon: "💐" },
];

const CAT_COLORS = {
  venue: { bg: "#2D2926", text: "#C9A063", border: "#C9A063" },
  bakery: { bg: "#3E2723", text: "#FFAB91", border: "#FFAB91" },
  florist: { bg: "#1B3A2D", text: "#A8E6CF", border: "#A8E6CF" },
};

function StarRating({ rating }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.3;
  return (
    <span style={{ color: "#C9A063", fontSize: 13, letterSpacing: 1 }}>
      {"★".repeat(full)}{half ? "½" : ""}
      <span style={{ color: "#5b5246", marginLeft: 4, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>{rating}</span>
    </span>
  );
}

function VendorCard({ vendor, isSelected, onClick, activeBudget }) {
  const c = CAT_COLORS[vendor.category];
  const bp = BUDGET_PRESETS[activeBudget];
  const fitsEntirely = activeBudget > 0 && vendor.budgetMin >= bp.min && vendor.budgetMax <= bp.max;
  const startsInBudget = activeBudget > 0 && vendor.budgetMin >= bp.min && vendor.budgetMin <= bp.max && !fitsEntirely;
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
      {isSelected && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${c.border}, transparent)`,
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
          <span style={{
            background: c.bg, border: `1px solid ${c.border}33`,
            borderRadius: 8, padding: "4px 10px", fontSize: 13, fontWeight: 700,
            color: c.text, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
          }}>
            {vendor.priceRange}
          </span>
          {fitsEntirely && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
              color: "#4CAF50", fontFamily: "'DM Sans', sans-serif",
            }}>
              ✓ Within budget
            </span>
          )}
          {startsInBudget && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
              color: "#FFA726", fontFamily: "'DM Sans', sans-serif",
            }}>
              ~ Starts in budget
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
      <StarRating rating={vendor.rating} />
      {isSelected && (
        <div style={{
          marginTop: 14, paddingTop: 14,
          borderTop: `1px solid ${c.border}22`,
          animation: "fadeIn 0.3s ease",
        }}>
          <p style={{ fontSize: 13, color: "#c9c1b3", lineHeight: 1.6, margin: "0 0 12px", fontFamily: "'DM Sans', sans-serif" }}>
            <strong style={{ color: c.text }}>Packages:</strong> {vendor.packages}
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            {vendor.phone !== "N/A" && (
              <span style={{ fontSize: 12, color: "#ada69a", fontFamily: "'DM Sans', sans-serif" }}>📞 {vendor.phone}</span>
            )}
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
  const [category, setCategory] = useState("all");
  const [region, setRegion] = useState("All Regions");
  const [view, setView] = useState("split");
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [budget, setBudget] = useState(0); // index into BUDGET_PRESETS

  const filtered = useMemo(() => {
    const bp = BUDGET_PRESETS[budget];
    return VENDORS.filter(v => {
      if (category !== "all" && v.category !== category) return false;
      if (region !== "All Regions" && v.region !== region) return false;
      if (search && !v.name.toLowerCase().includes(search.toLowerCase()) && !v.packages.toLowerCase().includes(search.toLowerCase())) return false;
      // Budget overlap: vendor's range must overlap the selected budget range
      if (budget > 0 && (v.budgetMax < bp.min || v.budgetMin > bp.max)) return false;
      return true;
    });
  }, [category, region, search, budget]);

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

        {/* FILTERS */}
        <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              style={{
                background: category === cat.key ? "#C9A06322" : "#1c1812",
                border: `1.5px solid ${category === cat.key ? "#C9A063" : "#2b261d"}`,
                color: category === cat.key ? "#C9A063" : "#8a8175",
                borderRadius: 20, padding: "7px 16px", fontSize: 12,
                fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                transition: "all 0.2s ease",
              }}
            >
              {cat.icon} {cat.label}
            </button>
          ))}

          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            style={{
              background: "#1c1812", border: "1.5px solid #2b261d",
              color: "#c9c1b3", borderRadius: 20, padding: "7px 16px",
              fontSize: 12, fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer", outline: "none",
            }}
          >
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

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

        {/* BUDGET FILTER ROW */}
        <div style={{
          marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center",
        }}>
          <span style={{ fontSize: 11, color: "#6a6155", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginRight: 4 }}>
            💰 Budget:
          </span>
          {BUDGET_PRESETS.map((bp, i) => (
            <button
              key={i}
              onClick={() => setBudget(i)}
              style={{
                background: budget === i ? "#C9A06322" : "#1c1812",
                border: `1.5px solid ${budget === i ? "#C9A063" : "#2b261d"}`,
                color: budget === i ? "#C9A063" : "#8a8175",
                borderRadius: 20, padding: "5px 14px", fontSize: 11,
                fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                transition: "all 0.2s ease",
              }}
            >
              {bp.label}
            </button>
          ))}
          {budget > 0 && (
            <button
              onClick={() => setBudget(0)}
              style={{
                background: "transparent", border: "1px solid #3b342a",
                color: "#6a6155", borderRadius: 20, padding: "5px 12px",
                fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}
            >
              ✕ Clear
            </button>
          )}
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
                      <div style={{ fontFamily: "'DM Sans', sans-serif", minWidth: 160 }}>
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
                        <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{v.priceRange}</div>
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
                activeBudget={budget}
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
    </div>
  );
}
