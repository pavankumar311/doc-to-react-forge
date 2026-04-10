import { useState, useMemo } from "react";
import GscipCard from "./GscipCard";
import { MapContainer, TileLayer, Popup, Marker } from "react-leaflet";
import L from "leaflet";
import { Search, Calendar, Filter, Layers, Map as MapIcon, ChevronDown, ChevronUp } from "lucide-react";

// ── Cluster Marker Icon Factory ───────────────────────────────────────────

function createClusterIcon({ count, color, borderColor, textColor = "#fff" }) {
  // Size scales with count, capped between 32px and 64px
  const size = Math.max(32, Math.min(64, 28 + Math.sqrt(count) * 1.6));
  const fontSize = size < 40 ? 10 : size < 52 ? 12 : 14;

  const html = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${color};
      border: 2.5px solid ${borderColor};
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${textColor};
      font-size: ${fontSize}px;
      font-weight: 700;
      font-family: Arial, sans-serif;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      cursor: pointer;
      transition: transform 0.15s;
    ">${count}</div>
  `;

  return L.divIcon({
    html,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  });
}

const CRIME_SUB_TABS = [ "Map Area Crime", "Crime Dashboard"];

// ── Mock Data ─────────────────────────────────────────────────────────────

const MOCK_KPI = {
  total: 8353,
  violent: 701,
  property: 3121,
  other: 3347,
};

// Crime type definitions with colors matching the screenshot
const CRIME_TYPES = {
  violent: {
    label: "Violent Crime (Index)",
    color: "#ef4444",
    items: [
      { code: "01A", label: "Homicide", color: "#c62828" },
      { code: "02", label: "Sexual Assault", color: "#d32f2f" },
      { code: "03", label: "Robbery", color: "#e53935" },
      { code: "04A", label: "Aggravated Assault", color: "#ef5350" },
      { code: "04B", label: "Aggravated Battery", color: "#f44336" },
    ],
  },
  property: {
    label: "Property Crime (Index)",
    color: "#3b82f6",
    items: [
      { code: "05", label: "Burglary", color: "#1565c0" },
      { code: "06", label: "Larceny/Theft", color: "#1976d2" },
      { code: "07", label: "Motor Vehicle Theft", color: "#1e88e5" },
      { code: "09", label: "Arson", color: "#42a5f5" },
    ],
  },
  other: {
    label: "Other Crimes (Non-Index)",
    color: "#eab308",
    items: [{ code: "XX", label: "All Other Crimes", color: "#ca8a04" }],
  },
};

const BUBBLE_SIZES = [
  { label: "> 500", size: 28, color: "#c62828" },
  { label: "830", size: 24, color: "#C62828" },
  { label: "290", size: 18, color: "#C62828" },
  { label: "150", size: 13, color: "#C62828" },
  { label: "< 2", size: 8, color: "#C62828" },
];

// Mock crime incident clusters for the map (Chicago area)
function generateMockIncidents() {
  const chicagoCenter = [41.83, -87.68];
  const incidents = [];
  // color / borderColor / textColor match the reference image:
  // yellow clusters (larceny/property-heavy)  blue teal (general) red (violent)
  const types = [
    { category: "violent",  color: "#e53935", borderColor: "#b71c1c", textColor: "#fff" },
    { category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff" },
    { category: "other",    color: "#fdd835", borderColor: "#f9a825", textColor: "#333" },
  ];

  // Chicago district cluster centers
  const clusterCenters = [
    [41.78, -87.62], [41.80, -87.66], [41.82, -87.70], [41.84, -87.68],
    [41.86, -87.64], [41.88, -87.62], [41.90, -87.66], [41.85, -87.72],
    [41.79, -87.74], [41.77, -87.68], [41.92, -87.70], [41.87, -87.60],
    [41.83, -87.63], [41.75, -87.65], [41.73, -87.63], [41.71, -87.65],
    [41.69, -87.65], [41.94, -87.69], [41.96, -87.67], [41.74, -87.70],
  ];

  clusterCenters.forEach((center, ci) => {
    types.forEach(({ category, color, borderColor, textColor }) => {
      const count = Math.floor(Math.random() * 490) + 2;
      incidents.push({
        id: `${ci}-${category}`,
        lat: center[0] + (Math.random() - 0.5) * 0.012,
        lng: center[1] + (Math.random() - 0.5) * 0.012,
        category,
        color,
        borderColor,
        textColor,
        count,
      });
    });
  });

  return incidents;
}

const MOCK_INCIDENTS = generateMockIncidents();

// ── KPI Bar ──────────────────────────────────────────────────────────────

function KpiBar({ kpi }) {
  const cards = [
    { label: "Total Crimes", value: kpi.total, note: "in visible map extent" },
    { label: "Violent Crimes", value: kpi.violent, note: "in visible map extent" },
    { label: "Property Crimes", value: kpi.property, note: "in visible map extent" },
    { label: "Other Crimes", value: kpi.other, note: "in visible map extent" },
  ];

  return (
    <div className="grid grid-cols-4 gap-0 mb-4 rounded-lg overflow-hidden"
      style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-card)" }}>
      {cards.map((card, i) => (
        <div
          key={card.label}
          className="px-6 py-5 text-center"
          style={{
            borderRight: i < 3 ? "1px solid var(--color-border)" : "none",
          }}
        >
          <div className="text-xs font-semibold mb-1" style={{ color: "var(--color-text-secondary)" }}>
            {card.label}
          </div>
          <div className="text-4xl font-light my-1" style={{ color: "var(--color-text-primary)", letterSpacing: "-1px" }}>
            {card.value.toLocaleString()}
          </div>
          <div className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{card.note}</div>
        </div>
      ))}
    </div>
  );
}

// ── Filter Panel ─────────────────────────────────────────────────────────

function FilterPanel({ dateRange, onDateRangeChange, crimeToggles, onToggleCrime, onSearch, address, onAddressChange }) {
  const [dateOpen, setDateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 h-full" style={{ minWidth: 260 }}>
      {/* Filter Records header */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-card)" }}>
        <div className="px-4 py-3 text-center" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="flex items-center justify-center gap-2">
            <Filter size={14} style={{ color: "var(--color-cobalt)" }} />
            <span className="text-sm font-bold" style={{ color: "var(--color-cobalt)" }}>Filter Records</span>
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: "#ef4444" }}>
            The most recent data was posted 7 days from yesterday.
          </p>
        </div>

        <div className="p-3 space-y-2.5">
          {/* Quick date presets */}
          {["Last 2 Weeks", "Last 30 Days", "Last 90 Days", "Last 365 Days"].map((preset) => (
            <label key={preset} className="flex items-center justify-between cursor-pointer group">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="datePreset"
                  checked={dateRange.preset === preset}
                  onChange={() => onDateRangeChange({ preset, custom: false })}
                  style={{ accentColor: "var(--color-cobalt)" }}
                />
                <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>{preset}</span>
              </div>
              <div
                className="w-8 h-4 rounded-full cursor-pointer transition-all"
                style={{
                  background: dateRange.preset === preset ? "var(--color-cobalt)" : "var(--color-border)",
                  position: "relative",
                }}
                onClick={() => onDateRangeChange({ preset, custom: false })}
              >
                <div
                  className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                  style={{ left: dateRange.preset === preset ? "calc(100% - 14px)" : "2px" }}
                />
              </div>
            </label>
          ))}

          {/* Custom date range */}
          <div>
            <button
              className="flex items-center justify-between w-full text-sm mb-2"
              style={{ color: "var(--color-cobalt)" }}
              onClick={() => setDateOpen(!dateOpen)}
            >
              <span className="flex items-center gap-1">
                <Calendar size={13} /> Custom Date Range
              </span>
              {dateOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {dateOpen && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold block mb-1" style={{ color: "var(--color-text-secondary)" }}>From</label>
                  <input type="date" className="w-full px-2 py-1.5 rounded text-xs"
                    style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
                    value={dateRange.from} onChange={e => onDateRangeChange({ ...dateRange, from: e.target.value, preset: "Custom" })} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold block mb-1" style={{ color: "var(--color-text-secondary)" }}>To</label>
                  <input type="date" className="w-full px-2 py-1.5 rounded text-xs"
                    style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
                    value={dateRange.to} onChange={e => onDateRangeChange({ ...dateRange, to: e.target.value, preset: "Custom" })} />
                </div>
              </div>
            )}
          </div>

          {/* Crime type toggles */}
          <div className="pt-1 space-y-2">
            {Object.entries(crimeToggles).map(([key, on]) => (
              <label key={key} className="flex items-center justify-between cursor-pointer">
                <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>
                  {key === "violent" ? "Violent Crime" : key === "property" ? "Property Crime" : "Other Crime"}
                </span>
                <div
                  className="w-8 h-4 rounded-full cursor-pointer transition-all"
                  style={{ background: on ? "var(--color-cobalt)" : "var(--color-border)", position: "relative" }}
                  onClick={() => onToggleCrime(key)}
                >
                  <div
                    className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                    style={{ left: on ? "calc(100% - 14px)" : "2px" }}
                  />
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Find Crime Near */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-card)" }}>
        <div className="px-4 py-2 text-center" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <span className="text-sm font-bold" style={{ color: "var(--color-cobalt)" }}>Find Crime Near</span>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>Enter address below to view nearby crimes.</p>
        </div>
        <div className="p-3">
          <div className="flex gap-2 mb-3">
            <select className="flex-1 px-2 py-1.5 rounded text-xs"
              style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}>
              <option>Find address or place</option>
            </select>
            <button
              onClick={onSearch}
              className="px-3 py-1.5 rounded text-white text-sm font-medium"
              style={{ background: "var(--color-cobalt)" }}
            >
              <Search size={14} />
            </button>
          </div>
          <input
            type="text"
            placeholder="Find address or place"
            value={address}
            onChange={e => onAddressChange(e.target.value)}
            className="w-full px-3 py-2 rounded text-sm mb-3"
            style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
          />
          <div className="text-xs mb-1" style={{ color: "var(--color-text-secondary)" }}>Location</div>
          <div className="flex gap-2 items-center">
            <div className="flex gap-1">
              {["0", "M", "↗"].map(b => (
                <button key={b} className="w-7 h-7 rounded text-xs font-medium flex items-center justify-center"
                  style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}>
                  {b}
                </button>
              ))}
            </div>
            <input type="number" defaultValue={440} className="w-16 px-2 py-1 rounded text-xs"
              style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }} />
            <select className="flex-1 px-2 py-1 rounded text-xs"
              style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}>
              <option>Feet</option>
              <option>Meters</option>
              <option>Miles</option>
            </select>
          </div>
          <p className="text-[11px] mt-2" style={{ color: "var(--color-text-muted)" }}>
            Once you press Enter, draw a polygon and buffer by clicking on screen.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Legend Panel ─────────────────────────────────────────────────────────

function LegendPanel({ crimeToggles, onToggleCrime }) {
  return (
    <div className="flex flex-col gap-3" style={{ minWidth: 200, maxWidth: 220 }}>
      {/* Crime Legend */}
      <div className="rounded-lg p-3" style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-card)" }}>
        <div className="text-xs font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>Crime</div>

        {Object.entries(CRIME_TYPES).map(([key, group]) => (
          <div key={key} className="mb-3">
            <div className="text-[11px] font-semibold mb-1.5" style={{ color: "var(--color-text-secondary)" }}>{group.label}</div>
            <div className="space-y-1">
              {group.items.map(item => (
                <div key={item.code} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-[11px]" style={{ color: "var(--color-text-primary)" }}>
                    {item.code} - {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Bubble size legend */}
        <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
          <div className="text-[11px] font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>Number of Features</div>
          <div className="space-y-1.5">
            {BUBBLE_SIZES.map(b => (
              <div key={b.label} className="flex items-center gap-2">
                <div
                  className="rounded-full flex-shrink-0"
                  style={{
                    width: b.size,
                    height: b.size,
                    backgroundColor: "#C62828",
                    opacity: 0.75,
                  }}
                />
                <span className="text-[11px]" style={{ color: "var(--color-text-primary)" }}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Layer toggles */}
      <div className="rounded-lg p-3" style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-card)" }}>
        <div className="text-xs font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>Police Districts</div>
        <div className="flex items-center gap-2 mb-3">
          <Layers size={16} style={{ color: "var(--color-text-secondary)" }} />
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Show boundaries</span>
        </div>

        <div className="text-xs font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>Police Beats</div>
        <div className="flex items-center gap-2">
          <MapIcon size={16} style={{ color: "var(--color-text-secondary)" }} />
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Show beats</span>
        </div>
      </div>
    </div>
  );
}

// ── Map Area Crime (main component) ──────────────────────────────────────

function MapAreaCrime() {
  const today = new Date().toISOString().slice(0, 10);
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

  const [dateRange, setDateRange] = useState({ preset: "Last 2 Weeks", from: twoWeeksAgo, to: today, custom: false });
  const [crimeToggles, setCrimeToggles] = useState({ violent: true, property: true, other: true });
  const [address, setAddress] = useState("");

  const visibleIncidents = useMemo(() =>
    MOCK_INCIDENTS.filter(inc => crimeToggles[inc.category]),
    [crimeToggles]
  );

  const kpi = useMemo(() => {
    const violent = visibleIncidents.filter(i => i.category === "violent").reduce((s, i) => s + i.count, 0);
    const property = visibleIncidents.filter(i => i.category === "property").reduce((s, i) => s + i.count, 0);
    const other = visibleIncidents.filter(i => i.category === "other").reduce((s, i) => s + i.count, 0);
    return { total: violent + property + other, violent, property, other };
  }, [visibleIncidents]);

  const toggleCrime = (key) => setCrimeToggles(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div>
      {/* KPI Bar */}
      <KpiBar kpi={kpi} />

      {/* Main layout: Filter | Map | Legend */}
      <div className="flex gap-4" style={{ minHeight: 640 }}>
        {/* Left: Filter Panel */}
        <div style={{ width: 260, flexShrink: 0 }}>
          <FilterPanel
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            crimeToggles={crimeToggles}
            onToggleCrime={toggleCrime}
            onSearch={() => { }}
            address={address}
            onAddressChange={setAddress}
          />
        </div>

        {/* Center: Map */}
        <div className="flex-1 rounded-lg overflow-hidden relative" style={{ border: "1px solid var(--color-border)", minHeight: 600 }}>
          <MapContainer
            center={[41.83, -87.68]}
            zoom={11}
            style={{ height: "100%", width: "100%", minHeight: 600 }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />

            {visibleIncidents.map(inc => (
              <Marker
                key={inc.id}
                position={[inc.lat, inc.lng]}
                icon={createClusterIcon({
                  count: inc.count,
                  color: inc.color,
                  borderColor: inc.borderColor,
                  textColor: inc.textColor,
                })}
              >
                <Popup>
                  <div style={{ fontSize: 13, lineHeight: 1.7, padding: "4px 6px", minWidth: 160 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>
                      Cluster Summary
                    </div>
                    <div><b>Category:</b> {inc.category.charAt(0).toUpperCase() + inc.category.slice(1)} Crime</div>
                    <div><b>Features:</b> {inc.count.toLocaleString()}</div>
                    <div style={{ marginTop: 6, fontSize: 11, color: "#666" }}>
                      The predominant value within this cluster.
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Map zoom overlay hint */}
          <div
            className="absolute bottom-3 left-3 z-[500] px-2 py-1 rounded text-[11px]"
            style={{ background: "rgba(255,255,255,0.9)", border: "1px solid #ccc", color: "#555" }}
          >
            5 mi
          </div>
        </div>

        {/* Right: Legend Panel */}
        <div style={{ width: 210, flexShrink: 0 }}>
          <LegendPanel crimeToggles={crimeToggles} onToggleCrime={toggleCrime} />
        </div>
      </div>
    </div>
  );
}

// ── Crime Site Information ────────────────────────────────────────────────

function CrimeSiteInformation() {
  return (
    <GscipCard>
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>Crime Site Information</h3>
        <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
          Use this application to view crime near a specific location / address or draw your own polygon of interest. Shows crime counts within the visible map area.
        </p>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="rounded-lg p-4 mb-4" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: "var(--color-text-secondary)" }}>Location</label>
              <input type="text" placeholder="Enter address or coordinates" className="w-full px-3 py-2 rounded text-sm"
                style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }} />
            </div>
            <div className="rounded-lg p-4" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Nearby Crimes</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: "var(--color-bg-card)", color: "var(--color-text-secondary)" }}>28</span>
              </div>
              {[
                { type: "VANDALISM", count: 6 },
                { type: "MOTOR VEHICLE THEFT (INDEX)", count: 5 },
                { type: "SIMPLE BATTERY", count: 5 },
                { type: "FRAUD", count: 3 },
                { type: "LARCENY - THEFT (INDEX)", count: 3 },
                { type: "AGGRAVATED ASSAULT (INDEX)", count: 1 },
              ].map(item => (
                <div key={item.type} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <span className="text-xs" style={{ color: "var(--color-text-primary)" }}>{item.type}</span>
                  <span className="text-xs font-mono" style={{ color: "var(--color-text-secondary)" }}>{item.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg overflow-hidden" style={{ height: 380, border: "1px solid var(--color-border)" }}>
            <MapContainer center={[41.88, -87.63]} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
            </MapContainer>
          </div>
        </div>
      </div>
    </GscipCard>
  );
}

// ── Crime Dashboard ───────────────────────────────────────────────────────

function CrimeDashboard() {
  return (
    <GscipCard>
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>Crime Dashboard</h3>
        <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
          Use this application to view crime by geographies like CPD District, CPD Beat, Ward and Community Area. Visualize how those polygons overlap. Includes interactive graphs like time of day &amp; day of week.
        </p>
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-lg overflow-hidden" style={{ height: 360, border: "1px solid var(--color-border)" }}>
            <MapContainer center={[41.83, -87.72]} zoom={10} style={{ height: "100%", width: "100%" }} zoomControl={false}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
            </MapContainer>
          </div>
          <div className="rounded-lg p-4" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>
            <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>Legend</h4>
            <div className="space-y-2 mb-4">
              <p className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>Property Crime (Index)</p>
              {[
                { label: "05 - Burglary", color: "#1565C0" },
                { label: "06 - Larceny/Theft", color: "#42A5F5" },
                { label: "07 - Motor Vehicle Theft", color: "#7E57C2" },
                { label: "09 - Arson", color: "#EF5350" },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs" style={{ color: "var(--color-text-primary)" }}>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>Number of Features</p>
              {[55, 40, 30].map(n => (
                <div key={n} className="flex items-center gap-2">
                  <div className="rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ width: 12 + n * 0.3, height: 12 + n * 0.3, backgroundColor: "#C62828" }}>{n}</div>
                  <span className="text-xs" style={{ color: "var(--color-text-primary)" }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </GscipCard>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────

export default function CrimesSection() {
  const [subTab, setSubTab] = useState("Map Area Crime");

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex items-center gap-0 mb-6 rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
        {CRIME_SUB_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className="flex-1 px-4 py-2.5 text-sm font-medium transition-all duration-200"
            style={{
              background: subTab === tab ? "var(--color-bg-card)" : "var(--color-bg-surface)",
              color: subTab === tab ? "var(--color-cobalt)" : "var(--color-text-secondary)",
              borderBottom: subTab === tab ? "2px solid var(--color-cobalt)" : "2px solid transparent",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* {subTab === "Crime Site Information" && <CrimeSiteInformation />} */}
      {subTab === "Map Area Crime" && <MapAreaCrime />}
      {subTab === "Crime Dashboard" && <CrimeDashboard />}
    </div>
  );
}
