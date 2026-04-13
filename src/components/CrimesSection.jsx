import { useState, useMemo, useEffect } from "react";
import GscipCard from "./GscipCard";
import { MapContainer, TileLayer, GeoJSON, Popup, Marker } from "react-leaflet";
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

// Realistic mock crime cluster data matching Chicago police district locations
const MOCK_INCIDENTS = [
  // District 1 – Central
  { id: "1-p", lat: 41.882, lng: -87.628, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 547 },
  { id: "1-v", lat: 41.886, lng: -87.635, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 19 },
  { id: "1-o", lat: 41.879, lng: -87.622, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 169 },
  // District 2 – Wentworth
  { id: "2-p", lat: 41.832, lng: -87.625, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 238 },
  { id: "2-v", lat: 41.828, lng: -87.619, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 97 },
  { id: "2-o", lat: 41.835, lng: -87.632, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 133 },
  // District 3 – Grand Crossing
  { id: "3-p", lat: 41.779, lng: -87.605, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 315 },
  { id: "3-v", lat: 41.775, lng: -87.612, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 151 },
  { id: "3-o", lat: 41.782, lng: -87.598, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 105 },
  // District 4 – South Chicago
  { id: "4-p", lat: 41.744, lng: -87.562, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 289 },
  { id: "4-v", lat: 41.739, lng: -87.555, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 52 },
  { id: "4-o", lat: 41.748, lng: -87.570, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 91 },
  // District 5 – Calumet
  { id: "5-p", lat: 41.715, lng: -87.612, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 105 },
  { id: "5-v", lat: 41.710, lng: -87.618, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 52 },
  { id: "5-o", lat: 41.720, lng: -87.605, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 36 },
  // District 6 – Gresham
  { id: "6-p", lat: 41.762, lng: -87.655, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 282 },
  { id: "6-v", lat: 41.757, lng: -87.662, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 124 },
  { id: "6-o", lat: 41.767, lng: -87.648, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 150 },
  // District 7 – Englewood
  { id: "7-p", lat: 41.780, lng: -87.647, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 199 },
  { id: "7-v", lat: 41.775, lng: -87.654, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 165 },
  { id: "7-o", lat: 41.784, lng: -87.640, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 120 },
  // District 8 – Chicago Lawn
  { id: "8-p", lat: 41.764, lng: -87.695, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 375 },
  { id: "8-v", lat: 41.759, lng: -87.702, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 50 },
  { id: "8-o", lat: 41.769, lng: -87.688, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 398 },
  // District 9 – Deering
  { id: "9-p", lat: 41.808, lng: -87.665, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 97 },
  { id: "9-v", lat: 41.803, lng: -87.672, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 38 },
  { id: "9-o", lat: 41.812, lng: -87.658, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 150 },
  // District 10 – Ogden
  { id: "10-p", lat: 41.856, lng: -87.715, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 288 },
  { id: "10-v", lat: 41.852, lng: -87.722, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 12 },
  { id: "10-o", lat: 41.860, lng: -87.708, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 56 },
  // District 11 – Harrison
  { id: "11-p", lat: 41.873, lng: -87.700, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 200 },
  { id: "11-v", lat: 41.868, lng: -87.707, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 73 },
  { id: "11-o", lat: 41.878, lng: -87.693, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 132 },
  // District 12 – Near West
  { id: "12-p", lat: 41.866, lng: -87.670, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 150 },
  { id: "12-v", lat: 41.862, lng: -87.676, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 115 },
  { id: "12-o", lat: 41.870, lng: -87.663, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 88 },
  // District 14 – Shakespeare
  { id: "14-p", lat: 41.920, lng: -87.690, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 102 },
  { id: "14-v", lat: 41.916, lng: -87.696, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 14 },
  { id: "14-o", lat: 41.924, lng: -87.683, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 64 },
  // District 15 – Austin
  { id: "15-p", lat: 41.896, lng: -87.752, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 132 },
  { id: "15-v", lat: 41.892, lng: -87.758, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 60 },
  { id: "15-o", lat: 41.900, lng: -87.745, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 38 },
  // District 16 – Jefferson Park
  { id: "16-p", lat: 41.970, lng: -87.765, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 41 },
  { id: "16-v", lat: 41.966, lng: -87.772, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 2 },
  { id: "16-o", lat: 41.974, lng: -87.758, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 15 },
  // District 17 – Albany Park
  { id: "17-p", lat: 41.948, lng: -87.720, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 156 },
  { id: "17-v", lat: 41.944, lng: -87.727, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 10 },
  { id: "17-o", lat: 41.952, lng: -87.713, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 128 },
  // District 18 – Near North
  { id: "18-p", lat: 41.902, lng: -87.632, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 303 },
  { id: "18-v", lat: 41.898, lng: -87.639, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 6 },
  { id: "18-o", lat: 41.906, lng: -87.625, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 215 },
  // District 19 – Town Hall
  { id: "19-p", lat: 41.935, lng: -87.655, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 222 },
  { id: "19-v", lat: 41.931, lng: -87.662, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 7 },
  { id: "19-o", lat: 41.939, lng: -87.648, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 176 },
  // District 20 – Lincoln
  { id: "20-p", lat: 41.958, lng: -87.670, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 88 },
  { id: "20-v", lat: 41.954, lng: -87.677, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 5 },
  { id: "20-o", lat: 41.962, lng: -87.663, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 60 },
  // District 22 – Morgan Park
  { id: "22-p", lat: 41.700, lng: -87.665, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 92 },
  { id: "22-v", lat: 41.695, lng: -87.672, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 18 },
  { id: "22-o", lat: 41.705, lng: -87.658, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 335 },
  // District 24 – Rogers Park
  { id: "24-p", lat: 41.995, lng: -87.672, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 159 },
  { id: "24-v", lat: 41.991, lng: -87.679, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 27 },
  { id: "24-o", lat: 41.999, lng: -87.665, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 128 },
  // District 25 – Grand Central
  { id: "25-p", lat: 41.910, lng: -87.740, category: "property", color: "#29b6f6", borderColor: "#0277bd", textColor: "#fff", count: 459 },
  { id: "25-v", lat: 41.906, lng: -87.747, category: "violent", color: "#e53935", borderColor: "#b71c1c", textColor: "#fff", count: 8 },
  { id: "25-o", lat: 41.914, lng: -87.733, category: "other", color: "#fdd835", borderColor: "#f9a825", textColor: "#333", count: 200 },
];

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

const MOCK_CRIME_INCIDENTS = [
  { id: 1, type: "LARCENY - THEFT (INDEX)", sub: "THEFT - THEFT FROM MOTOR VEHICLE", date: "4/5/26, 10:29 AM", location: "STREET of 53XX W LELAND AVE", address: "53XX W LELAND AVE", rd: "JK207912", iucr: "0710", beat: "1623", ward: "45", community: "PORTAGE PARK", desc: "THEFT FROM MOTOR VEHICLE", category: "property", color: "#29b6f6" },
  { id: 2, type: "FRAUD", sub: "DECEPTIVE PRACTICE - CREDIT CARD FRAUD", date: "4/5/26, 10:25 AM", location: "OTHER (SPECIFY) of 4XX W MELROSE ST", address: "4XX W MELROSE ST", rd: "JK206858", iucr: "1150", beat: "1925", ward: "44", community: "LAKE VIEW", desc: "CREDIT CARD FRAUD", category: "other", color: "#fdd835" },
  { id: 3, type: "LARCENY - THEFT (INDEX)", sub: "THEFT - OVER $500", date: "4/5/26, 10:20 AM", location: "OTHER (SPECIFY) of 1XX W HUBBARD ST", address: "1XX W HUBBARD ST", rd: "JK206841", iucr: "0820", beat: "1834", ward: "42", community: "NEAR NORTH SIDE", desc: "THEFT OVER $500", category: "property", color: "#29b6f6" },
  { id: 4, type: "AGGRAVATED BATTERY", sub: "BATTERY - AGGRAVATED DOMESTIC", date: "4/5/26, 10:15 AM", location: "APARTMENT of 2XX N PINE AVE", address: "2XX N PINE AVE", rd: "JK206799", iucr: "0486", beat: "1533", ward: "29", community: "AUSTIN", desc: "AGGRAVATED DOMESTIC BATTERY", category: "violent", color: "#e53935" },
  { id: 5, type: "MOTOR VEHICLE THEFT", sub: "MOTOR VEHICLE THEFT - AUTOMOBILE", date: "4/5/26, 10:10 AM", location: "STREET of 67XX S ARTESIAN AVE", address: "67XX S ARTESIAN AVE", rd: "JK206755", iucr: "0910", beat: "0835", ward: "15", community: "CHICAGO LAWN", desc: "AUTOMOBILE", category: "property", color: "#29b6f6" },
  { id: 6, type: "ROBBERY", sub: "ROBBERY - ARMED: HANDGUN", date: "4/5/26, 10:05 AM", location: "SIDEWALK of 79XX S HALSTED ST", address: "79XX S HALSTED ST", rd: "JK206701", iucr: "0312", beat: "0621", ward: "21", community: "AUBURN GRESHAM", desc: "ARMED ROBBERY HANDGUN", category: "violent", color: "#e53935" },
];

const DASHBOARD_FILTERS = [
  { label: "Police District", value: "All" },
  { label: "Police Beat", value: "All" },
  { label: "Ward", value: "All" },
  { label: "Community", value: "All" },
  { label: "Crime Types", value: "All Crimes" },
  { label: "Crime Groups", value: "All" },
  { label: "Date (backdated 7 days)", value: "Last 2 Weeks" },
];

function CrimeDashboard() {
  const [bottomTab, setBottomTab] = useState("Crime Incidents");
  const [searchText, setSearchText] = useState("");
  const [geoData, setGeoData] = useState(null);

  useEffect(() => {
    fetch("/chicago_districts.geojson")
      .then(r => r.json())
      .then(data => setGeoData(data))
      .catch(() => {});
  }, []);

  const filteredIncidents = useMemo(() =>
    MOCK_CRIME_INCIDENTS.filter(i =>
      !searchText || i.type.toLowerCase().includes(searchText.toLowerCase()) || i.address.toLowerCase().includes(searchText.toLowerCase())
    ), [searchText]);

  const kpi = { total: 8829, violent: 740, property: 3319 };

  return (
    <div>
      {/* Top filter bar */}
      <div className="flex items-center gap-0 mb-4 rounded-t-lg overflow-hidden" style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-card)" }}>
        {DASHBOARD_FILTERS.map((f, i) => (
          <div key={f.label} className="flex-1 px-3 py-2.5 text-center" style={{ borderRight: i < DASHBOARD_FILTERS.length - 1 ? "1px solid var(--color-border)" : "none" }}>
            <div className="text-[11px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{f.label}</div>
            <div className="text-[11px]" style={{ color: "var(--color-cobalt)" }}>{f.value}</div>
          </div>
        ))}
      </div>

      {/* Three-column layout */}
      <div className="flex gap-0" style={{ minHeight: 600, border: "1px solid var(--color-border)", borderRadius: 8, overflow: "hidden" }}>
        {/* LEFT: Crime & Strategic Plans */}
        <div className="flex flex-col" style={{ width: 340, flexShrink: 0, borderRight: "1px solid var(--color-border)", background: "var(--color-bg-card)" }}>
          {/* Header */}
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Crime and Strategic Plans</h3>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-0 mx-3 mb-3 rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
            {[
              { label: "Total Crime", value: kpi.total },
              { label: "Violent Crime", value: kpi.violent },
              { label: "Property Crime", value: kpi.property },
            ].map((c, i) => (
              <div key={c.label} className="text-center py-3 px-2" style={{ borderRight: i < 2 ? "1px solid var(--color-border)" : "none" }}>
                <div className="text-[10px] font-semibold" style={{ color: "var(--color-text-secondary)" }}>{c.label}</div>
                <div className="text-xl font-light mt-0.5" style={{ color: "var(--color-cobalt)" }}>{c.value.toLocaleString()}</div>
                <div className="text-[9px]" style={{ color: "var(--color-text-muted)" }}>In visible map extent</div>
              </div>
            ))}
          </div>

          {/* Crime Incidents header */}
          <div className="text-center mb-1">
            <span className="text-sm font-bold" style={{ color: "var(--color-cobalt)" }}>Crime Incidents</span>
            <div className="text-[10px]" style={{ color: "#ef4444" }}>Most recent data is from 7 days before yesterday</div>
          </div>

          {/* Search */}
          <div className="px-3 mb-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded" style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-surface)" }}>
              <Search size={13} style={{ color: "var(--color-text-muted)" }} />
              <input type="text" placeholder="Search..." value={searchText} onChange={e => setSearchText(e.target.value)}
                className="flex-1 text-xs bg-transparent outline-none" style={{ color: "var(--color-text-primary)" }} />
            </div>
          </div>

          {/* Incident list */}
          <div className="flex-1 overflow-y-auto px-3 pb-2" style={{ maxHeight: 380 }}>
            {filteredIncidents.map(inc => (
              <div key={inc.id} className="mb-3 pb-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
                <div className="flex items-start gap-2">
                  <div className="mt-1 w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: inc.color }}>
                    <span className="text-white text-[10px] font-bold">{inc.category === "violent" ? "!" : inc.category === "property" ? "—" : "●"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold" style={{ color: "var(--color-text-primary)" }}>{inc.type}</div>
                    <div className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>{inc.sub}</div>
                    <div className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>{inc.date} {inc.location}</div>
                    <div className="mt-1.5 text-[10px]" style={{ color: "var(--color-text-secondary)" }}>
                      <div>📍 Address: <b>{inc.address}</b></div>
                      <div>📅 Date of Occurrence: {inc.date}</div>
                    </div>
                    <div className="mt-1 text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                      Description: {inc.desc}<br />
                      RD <b>{inc.rd}</b> | IUCR {inc.iucr}<br />
                      Beat {inc.beat} | Ward {inc.ward} | Community <b>{inc.community}</b>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom tabs */}
          <div className="flex" style={{ borderTop: "1px solid var(--color-border)" }}>
            {["Crime Incidents", "Strategic Plans"].map(t => (
              <button key={t} onClick={() => setBottomTab(t)}
                className="flex-1 py-2 text-xs font-medium text-center"
                style={{
                  color: bottomTab === t ? "var(--color-cobalt)" : "var(--color-text-secondary)",
                  background: bottomTab === t ? "var(--color-bg-card)" : "var(--color-bg-surface)",
                  borderBottom: bottomTab === t ? "2px solid var(--color-cobalt)" : "2px solid transparent",
                }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* CENTER: Map */}
        <div className="flex-1 relative" style={{ background: "#f0f0f0" }}>
          <MapContainer center={[41.83, -87.68]} zoom={10} style={{ height: "100%", width: "100%", minHeight: 600 }} zoomControl={false}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />

            {/* District boundaries */}
            {geoData && geoData.features && geoData.features.map((feature, idx) => (
              <GeoJSON
                key={`district-boundary-${idx}`}
                data={feature.geometry || feature}
                style={{
                  color: "#222",
                  weight: 2,
                  fillColor: "transparent",
                  fillOpacity: 0,
                  opacity: 0.85,
                }}
              />
            ))}

            {MOCK_INCIDENTS.map(inc => (
              <Marker key={inc.id} position={[inc.lat, inc.lng]}
                icon={createClusterIcon({ count: inc.count, color: inc.color, borderColor: inc.borderColor, textColor: inc.textColor })}>
                <Popup>
                  <div style={{ fontSize: 12, padding: 4 }}>
                    <div style={{ fontWeight: 700 }}>Cluster: {inc.category}</div>
                    <div>Features: {inc.count}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Map bottom tabs */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[500] flex gap-1 rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)", background: "var(--color-bg-card)" }}>
            {["Crime Map", "Crime Statistics"].map(t => (
              <button key={t} className="px-4 py-1.5 text-xs font-medium"
                style={{ color: t === "Crime Map" ? "var(--color-cobalt)" : "var(--color-text-secondary)", background: t === "Crime Map" ? "var(--color-bg-card)" : "var(--color-bg-surface)" }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT: Legend */}
        <div className="flex flex-col overflow-y-auto" style={{ width: 220, flexShrink: 0, borderLeft: "1px solid var(--color-border)", background: "var(--color-bg-card)", padding: 12 }}>
          <div className="text-xs font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>Crime</div>

          {Object.entries(CRIME_TYPES).map(([key, group]) => (
            <div key={key} className="mb-3">
              <div className="text-[11px] font-semibold mb-1" style={{ color: "var(--color-text-secondary)" }}>{group.label}</div>
              <div className="space-y-1">
                {group.items.map(item => (
                  <div key={item.code} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-[11px]" style={{ color: "var(--color-text-primary)" }}>{item.code} - {item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
            <div className="text-[11px] font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>Number of features</div>
            <div className="space-y-1.5">
              {[
                { label: "> 14,012", size: 28 },
                { label: "10,000", size: 24 },
                { label: "7,000", size: 20 },
                { label: "3,000", size: 14 },
                { label: "< 2", size: 8 },
              ].map(b => (
                <div key={b.label} className="flex items-center gap-2">
                  <div className="rounded-full flex-shrink-0" style={{ width: b.size, height: b.size, backgroundColor: "#C62828", opacity: 0.8 }} />
                  <span className="text-[11px]" style={{ color: "var(--color-text-primary)" }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
            <div className="text-xs font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>Police Beats</div>
            <div className="flex items-center gap-2">
              <Layers size={14} style={{ color: "var(--color-text-muted)" }} />
              <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>Overlay</span>
            </div>
          </div>
        </div>
      </div>
    </div>
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
