import { useState, useEffect, useMemo, useRef, useCallback } from "react";
// Forced HMR Refresh - v2

import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Filter, MapPin, Home, Copy, SquareStack, ZoomIn, ZoomOut, Maximize, Minimize, CircleDot, ShieldCheck, DownloadCloud, Layers, Play, Pause, RotateCcw, Clock } from "lucide-react";
import GscipCard from "./GscipCard";
import { Slider } from "./ui/slider";
import CrimesSectionView from "./CrimesSection";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup, useMap, Marker } from "react-leaflet";
import L from "leaflet";
import {
  AUTH_TOKEN,
  fetchGeospatialSummary,
  fetchSummaryKPIs,
  fetchIncidentsByDate,
  fetchIncidentsByCrimeType,
  fetchPlatformTrend,
  fetchFilterOptions,
  fetchWardBoundaries,
  fetchDistrictBoundaries,
  fetchPoliceBeats,
  fetchPoliceStations,
} from "../services/api";

// ── CSV Helpers ─────────────────────────────────────────────────────────
function downloadCSV(data, filename) {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) => headers.map((field) => `"${row[field] || ""}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const TIME_FRAMES = ["Last 7 Days", "Last 30 Days", "Last 90 Days", "Last 365 Days", "Custom Range"];

const MOCK_DISTRICTS = [
  { name: "001", count: 450 }, { name: "002", count: 320 }, { name: "003", count: 210 },
  { name: "004", count: 560 }, { name: "005", count: 180 }, { name: "006", count: 440 }
];

function getCentroid(geometry) {
  try {
    if (!geometry) return [41.8781, -87.6298];
    let coords = geometry.coordinates || geometry;
    if (geometry.type === "MultiPolygon") coords = coords[0][0];
    else if (geometry.type === "Polygon") coords = coords[0];
    else if (Array.isArray(coords) && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) coords = coords[0][0];

    let lat = 0, lng = 0;
    const pts = Array.isArray(coords) ? coords : [];
    if (pts.length === 0) return [41.8781, -87.6298];

    pts.forEach(p => {
      lng += p[0];
      lat += p[1];
    });
    return [lat / pts.length, lng / pts.length];
  } catch (e) {
    return [41.8781, -87.6298];
  }
}

// ── Time frame helpers ──────────────────────────────────────────────────
function timeFrameToDates(tf, anchorDate, customRange = null) {
  const timeframe = (tf || "").toLowerCase();

  if (timeframe === "custom range" && customRange) {
    return {
      dateFrom: customRange.dateFrom || new Date().toISOString().split("T")[0],
      dateTo: customRange.dateTo || new Date().toISOString().split("T")[0]
    };
  }

  let baseDate = anchorDate instanceof Date && !isNaN(anchorDate) ? anchorDate : new Date();
  let intervalDays = 30;
  if (timeframe.includes("7 day")) intervalDays = 7;
  else if (timeframe.includes("90 day")) intervalDays = 90;
  else if (timeframe.includes("365 day")) intervalDays = 365;

  const dateTo = baseDate.toISOString().split("T")[0];
  const dateFrom = new Date(baseDate.getTime() - intervalDays * 86400000).toISOString().split("T")[0];

  return { dateFrom, dateTo };
}

// Tab → API level mapping
const TAB_LEVEL = {
  "Police Districts": "district",
  "Police Beats": "beat",
  Wards: "ward",
  "Community Areas": "district", // fallback to district
};

const TAB_LABELS = {
  "Police Districts": { chartTitle: "Incidents by District", filterLabel: "District" },
  "Police Beats": { chartTitle: "Incidents by Beat", filterLabel: "Beat" },
  Wards: { chartTitle: "Incidents by Ward", filterLabel: "Ward" },
  "Community Areas": { chartTitle: "Incidents by District", filterLabel: "Community Area" },
};

// ── Choropleth bins ─────────────────────────────────────────────────────
function buildBins(items) {
  if (!items || items.length === 0) return [];
  const counts = items.map((i) => i.crime_count).sort((a, b) => a - b);
  const max = counts[counts.length - 1];
  const min = counts[0];
  const range = max - min || 1;
  const step = range / 5;
  const COLORS = ["#faf1d2", "#b9d4c6", "#77a9be", "#547e9b", "#2d4464"];
  return COLORS.map((color, i) => ({
    min: min + step * i,
    max: i === 4 ? Infinity : min + step * (i + 1),
    color,
  }));
}

function getBinColor(count, bins) {
  if (!bins || bins.length === 0) return "#b9d4c6";
  for (const bin of [...bins].reverse()) {
    if (count >= bin.min) return bin.color;
  }
  return bins[0].color;
}

// ── Category colors ─────────────────────────────────────────────────────
const CATEGORY_COLORS = {
  violent: "#ef4444",
  property: "#f97316",
  quality: "#eab308",
  other: "#6b7280",
};

const BAR_COLOR = "#7A8A9E";

const tooltipStyle = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  fontSize: 12,
  color: "var(--color-text-primary)",
};

// ── Sub-components ──────────────────────────────────────────────────────

function FiltersPanel({
  selectedTimeFrame, onTimeFrameChange,
  customRange, onCustomRangeChange,
  crimeTypes, selectedCrimes, onToggleCrime,
  onApply, onReset,
  showPolice, onTogglePolice,
  showHeatmap, onToggleHeatmap
}) {
  return (
    <GscipCard>
      <div className="flex items-center gap-2 mb-4">
        <Filter size={18} style={{ color: "var(--color-text-secondary)" }} />
        <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Filters</h3>
      </div>

      <div className="space-y-3 mb-6">
        <label className="flex items-center justify-between cursor-pointer p-2 rounded-md hover:bg-gray-50 transition-colors" style={{ border: "1px solid var(--color-border)" }}>
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-orange-500" />
            <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>Density Heatmap</span>
          </div>
          <div className="relative inline-flex items-center">
            <input type="checkbox" checked={showHeatmap} onChange={onToggleHeatmap} className="sr-only peer" />
            <div className="w-9 h-5 rounded-full peer-checked:bg-orange-500 bg-gray-300 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
          </div>
        </label>

        <label className="flex items-center justify-between cursor-pointer p-2 rounded-md hover:bg-gray-50 transition-colors" style={{ border: "1px solid var(--color-border)" }}>
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-blue-500" />
            <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>Police Stations</span>
          </div>
          <div className="relative inline-flex items-center">
            <input type="checkbox" checked={showPolice} onChange={onTogglePolice} className="sr-only peer" />
            <div className="w-9 h-5 rounded-full peer-checked:bg-blue-600 bg-gray-300 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
          </div>
        </label>
      </div>

      <div className="mb-4">
        <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--color-text-primary)" }}>
          Time Frame
        </label>
        <select
          value={selectedTimeFrame}
          onChange={(e) => onTimeFrameChange(e.target.value)}
          className="w-full px-3 py-2 rounded-md text-sm mb-3"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-primary)",
          }}
        >
          {TIME_FRAMES.map((tf) => (
            <option key={tf} value={tf}>{tf}</option>
          ))}
        </select>

        {selectedTimeFrame === "Custom Range" && (
          <div className="animate-in fade-in slide-in-from-top-1 bg-blue-50/50 p-3 rounded-lg border border-blue-100 my-3">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] text-blue-600 uppercase font-black mb-1.5 block tracking-widest">Start Date</label>
                <input
                  type="date"
                  value={customRange?.dateFrom || ""}
                  onChange={(e) => onCustomRangeChange({ ...customRange, dateFrom: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm font-medium"
                />
              </div>
              <div>
                <label className="text-[10px] text-blue-600 uppercase font-black mb-1.5 block tracking-widest">End Date</label>
                <input
                  type="date"
                  value={customRange?.dateTo || ""}
                  onChange={(e) => onCustomRangeChange({ ...customRange, dateTo: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm font-medium"
                />
              </div>
            </div>
            <button
              onClick={onApply}
              className="w-full py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-md hover:bg-blue-700 transition-all shadow-md active:scale-95"
            >
              Done & Apply Range
            </button>
          </div>
        )}
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-primary)" }}>
            Crime Type
          </label>
          <button
            onClick={onReset}
            disabled={selectedCrimes.length === 0}
            className="text-xs font-medium transition-all"
            style={{
              color: selectedCrimes.length > 0 ? "var(--color-azure)" : "var(--color-text-muted)",
              opacity: selectedCrimes.length > 0 ? 1 : 0.4,
              cursor: selectedCrimes.length > 0 ? "pointer" : "default"
            }}
          >
            Reset
          </button>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {crimeTypes.map((ct) => (
            <label key={ct.name} className="flex items-center justify-between cursor-pointer group">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedCrimes.includes(ct.name)}
                  onChange={() => onToggleCrime(ct.name)}
                  className="rounded"
                  style={{ accentColor: "var(--color-cobalt)" }}
                />
                <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>{ct.name}</span>
              </div>
              <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
                {ct.count.toLocaleString()}
              </span>
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={onApply}
        disabled={selectedCrimes.length === 0}
        className={`w-full py-2 rounded-md text-sm font-medium text-white transition-colors ${selectedCrimes.length === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90'}`}
        style={{ background: "var(--color-cobalt)" }}
      >
        Apply
      </button>
    </GscipCard>
  );
}

function CrimeTypeChart({ data, loading }) {
  return (
    <GscipCard>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚙</span>
          <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Incidents by Crime Type</h3>
        </div>
        <button onClick={() => downloadCSV(data, "crime_types.csv")} className="p-1.5 rounded hover:bg-gray-100 text-gray-400" title="Export CSV">
          <DownloadCloud size={16} />
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 50, top: 5, bottom: 5 }}>
            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v.length > 18 ? v.slice(0, 17) + "…" : v}
            />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={22} label={{ position: "right", fontSize: 11, fill: "var(--color-text-primary)", formatter: (v) => v.toLocaleString() }}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color || BAR_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      <p className="text-center text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Reported Incidents</p>
    </GscipCard>
  );
}

function GeoChart({ data, title, loading }) {
  return (
    <GscipCard>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin size={18} style={{ color: "var(--color-text-secondary)" }} />
          <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>{title}</h3>
        </div>
        <button onClick={() => downloadCSV(data, "geospatial_ranking.csv")} className="p-1.5 rounded hover:bg-gray-100 text-gray-400" title="Export CSV">
          <DownloadCloud size={16} />
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
        </div>
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>No data</div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 60, top: 5, bottom: 5 }}>
            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={44}
              tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v, n) => [v.toLocaleString(), "Incidents"]} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18} label={{ position: "right", fontSize: 11, fill: "var(--color-text-primary)", formatter: (v) => v.toLocaleString() }}>
              {data.map((_, i) => (
                <Cell key={i} fill={BAR_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      <p className="text-center text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Reported Incidents</p>
    </GscipCard>
  );
}

function GeoFilterPanel({ items, selectedIds, onToggle, onApply, onReset, filterLabel, compact }) {
  return (
    <GscipCard style={compact ? { paddingTop: 12, paddingBottom: 12 } : {}}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>{filterLabel || "Area"}</h3>
        <button
          onClick={onReset}
          disabled={selectedIds.length === 0}
          className="text-xs font-medium transition-all"
          style={{
            color: selectedIds.length > 0 ? "var(--color-azure)" : "var(--color-text-muted)",
            opacity: selectedIds.length > 0 ? 1 : 0.4,
            cursor: selectedIds.length > 0 ? "pointer" : "default"
          }}
        >
          Reset
        </button>
      </div>
      <div className={`space-y-2 overflow-y-auto pr-2 ${compact ? "max-h-36" : "max-h-80"}`}>
        {items.map((item) => (
          <label key={item.id} className="flex items-center justify-between cursor-pointer group">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={() => onToggle(item.id)}
                className="rounded"
                style={{ accentColor: "var(--color-cobalt)" }}
              />
              <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>{item.name}</span>
            </div>
            <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
              {item.count.toLocaleString()}
            </span>
          </label>
        ))}
      </div>
      <button
        onClick={onApply}
        disabled={selectedIds.length === 0}
        className={`w-full py-1.5 rounded-md text-sm font-medium text-white mt-3 transition-colors ${selectedIds.length === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90'}`}
        style={{ background: "var(--color-cobalt)" }}
      >
        Apply
      </button>
    </GscipCard>
  );
}

function IncidentsByDateChart({ data, loading, chartHeight = 360 }) {
  return (
    <GscipCard style={{ height: "100%" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">📅</span>
          <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Incidents by Date</h3>
        </div>
        <button onClick={() => downloadCSV(data, "incidents_by_date.csv")} className="p-1.5 rounded hover:bg-gray-100 text-gray-400" title="Export CSV">
          <DownloadCloud size={16} />
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center" style={{ height: chartHeight }}>
          <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <LineChart data={data} margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "rgba(0,0,0,0.12)", strokeWidth: 2 }} formatter={(v) => [v, "Incidents"]} />
            <Line type="monotone" dataKey="count" stroke="#1F2937" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </GscipCard>
  );
}

// ── Map helpers ─────────────────────────────────────────────────────────

function DropShadowPainter() {
  const map = useMap();
  useEffect(() => {
    const pane = map.getPane("overlayPane");
    if (pane) pane.style.filter = "drop-shadow(6px 10px 8px rgba(0,0,0,0.5))";
  }, [map]);
  return null;
}

function MapZoomControls({ onZoomIn, onZoomOut, onReset, onFit, isFullscreen, onToggleFullscreen }) {
  return (
    <div className="absolute top-4 left-4 z-[500] flex flex-col gap-1.5">
      <button onClick={onReset} className="bg-white p-2 rounded shadow flex items-center justify-center cursor-pointer hover:bg-gray-50 border border-gray-100 text-gray-500" title="Reset view">
        <Home size={18} />
      </button>
      <button onClick={onFit} className="bg-white p-2 rounded shadow flex items-center justify-center cursor-pointer hover:bg-gray-50 border border-gray-100 text-gray-500" title="Zoom full map">
        <Maximize size={18} />
      </button>
      <button onClick={onZoomIn} className="bg-white p-2 rounded shadow flex items-center justify-center cursor-pointer hover:bg-gray-50 border border-gray-100 text-gray-500" title="Zoom in">
        <ZoomIn size={18} />
      </button>
      <button onClick={onZoomOut} className="bg-white p-2 rounded shadow flex items-center justify-center cursor-pointer hover:bg-gray-50 border border-gray-100 text-gray-500" title="Zoom out">
        <ZoomOut size={18} />
      </button>
      <button onClick={onToggleFullscreen} className="bg-white p-2 rounded shadow flex items-center justify-center cursor-pointer hover:bg-gray-50 border border-gray-100 text-gray-500" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
        {isFullscreen ? <Minimize size={18} /> : <SquareStack size={18} />}
      </button>
    </div>
  );
}

function MapRefSetter({ mapRefCb }) {
  const map = useMap();
  useEffect(() => { mapRefCb(map); }, [map, mapRefCb]);
  return null;
}

// Normalise a ward_id like "2.0" → "2"
// Unified normaliser — ensures boundary IDs and summary item IDs use the same key
function normaliseId(rawId, level) {
  if (rawId == null || rawId === "") return "";
  const s = String(rawId).trim();
  if (level === "ward") {
    const n = parseFloat(s);
    return Number.isFinite(n) ? String(Math.round(n)) : s;
  }
  if (level === "district") {
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? String(n).padStart(3, "0") : s;
  }
  // beat — keep as-is
  return s;
}

// Keep individual helpers as thin wrappers for readability
const normaliseWardId = (id) => normaliseId(id, "ward");
const normaliseDistrictId = (id) => normaliseId(id, "district");
const normaliseBeatId = (id) => normaliseId(id, "beat");

// Depth sanitiser to fix extraneous array wrappers from API payloads
function sanitizeCoordinates(type, coords) {
  if (!coords || !coords.length) return coords;
  // MultiPolygon requires strictly 4 levels of depth: [ [ [ [lng, lat] ] ] ]
  // Polygon requires strictly 3 levels of depth: [ [ [lng, lat] ] ]
  const getDepth = (arr) => Array.isArray(arr) ? 1 + getDepth(arr[0]) : 0;
  let currentDepth = getDepth(coords);
  const targetDepth = type === "MultiPolygon" ? 4 : type === "Polygon" ? 3 : currentDepth;

  let safeCoords = coords;
  while (currentDepth > targetDepth) {
    safeCoords = safeCoords.flat(1);
    currentDepth--;
  }
  return safeCoords;
}

// Build a GeoJSON Feature from a boundary object (already has type + coordinates)
function toGeoJSONFeature(boundary) {
  if (!boundary) return null;
  if (boundary.type === "Feature") {
    if (boundary.geometry && boundary.geometry.coordinates) {
      boundary.geometry.coordinates = sanitizeCoordinates(boundary.geometry.type, boundary.geometry.coordinates);
    }
    return boundary;
  }

  return {
    type: "Feature",
    geometry: {
      type: boundary.type,
      coordinates: sanitizeCoordinates(boundary.type, boundary.coordinates)
    },
    properties: {}
  };
}

// ── MapPanel ────────────────────────────────────────────────────────────

function MapPanel({
  activeTab, countsMap, kpiData, bins, selectedIds, showPolice, policeStations, showHeatmap,
  scrubValue, setScrubValue, isPlaying, setIsPlaying, scrubbedDateTo
}) {
  const [boundaries, setBoundaries] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const DEFAULT_CENTER = [41.83, -87.72];
  const DEFAULT_ZOOM = 10.5;

  const setMapRef = useCallback((map) => {
    mapRef.current = map;
    setMapReady(true);
  }, []);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleReset = () => mapRef.current?.setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  const handleFit = () => {
    if (!mapRef.current || !boundaries.length) return;
    const features = boundaries.map(b => toGeoJSONFeature(b.boundary)).filter(f => !!f);
    if (!features.length) return;
    const bounds = L.geoJSON(features).getBounds();
    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds, { padding: [30, 30] });
    }
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { });
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => mapRef.current?.invalidateSize(), 200);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Re-fetch boundaries when tab changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let raw = [];
        if (activeTab === "Police Districts" || activeTab === "Community Areas") {
          raw = await fetchDistrictBoundaries();
          // raw: [{ district_id, district_name, boundary, ... }]
          setBoundaries(raw.map((d, i) => ({
            id: normaliseDistrictId(d.district_id),
            label: d.district_id,
            boundary: d.boundary,
            uid: `dist-${d.district_id}-${i}`
          })));
        } else if (activeTab === "Wards") {
          raw = await fetchWardBoundaries();
          // raw items may use ward_id, WARD, ward, or ward_num — try all
          // Do NOT deduplicate because wards are aggregated from precincts (multiple polygons per ward)
          const deduped = [];
          for (let i = 0; i < raw.length; i++) {
            const w = raw[i];
            const rawWardId = w.ward_id ?? w.ward ?? w.WARD ?? w.ward_num;
            const wid = normaliseWardId(rawWardId);
            if (!wid) continue;
            deduped.push({ id: wid, label: wid, boundary: w.boundary, uid: `ward-${wid}-${i}` });
          }
          if (!cancelled) setBoundaries(deduped);
        } else if (activeTab === "Police Beats") {
          raw = await fetchPoliceBeats();
          // raw: [{ beat_num, district, sector, beat, boundary }]
          if (!cancelled) setBoundaries(raw.map((b, i) => ({
            id: b.beat_num,
            label: b.beat_num,
            boundary: b.boundary,
            uid: `beat-${b.beat_num}-${i}`
          })));
        }
      } catch (e) {
        console.error("MapPanel boundary load error:", e);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [activeTab]);

  // Legend bins from live data
  const legendBins = bins && bins.length > 0 ? bins : [
    { min: 0, max: Infinity, color: "#b9d4c6" },
  ];

  return (
    <GscipCard className="relative bg-[#e8e9ea]">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-xl text-gray-500 tracking-wide font-medium">Map of Incidents</h3>
          <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
            <Clock size={10} className="text-blue-500" />
            <span>Forensic Data Loop until <span className="text-blue-600 underline underline-offset-2 decoration-blue-200">{scrubbedDateTo}</span></span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Timeline Playback Controls */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-slate-200 shadow-sm min-w-[280px]">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-1.5 rounded-lg transition-all ${isPlaying ? 'bg-orange-100 text-orange-600 animate-pulse' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
              title={isPlaying ? "Pause Playback" : "Play Timeline"}
            >
              {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
            </button>
            <div className="flex-1 px-3">
              <Slider
                value={[scrubValue]}
                onValueChange={([v]) => setScrubValue(v)}
                max={100}
                step={1}
                className="cursor-pointer"
              />
            </div>
            <button
              onClick={() => { setScrubValue(100); setIsPlaying(false); }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-colors"
              title="Reset Timeline to End"
            >
              <RotateCcw size={12} />
            </button>
          </div>

          <div className="flex items-center gap-3 text-gray-300 ml-2">
            <Copy size={16} className="cursor-pointer hover:text-gray-600 transition-colors" />
            <SquareStack size={16} className="cursor-pointer hover:text-gray-600 transition-colors" />
          </div>
        </div>
      </div>
      <div
        ref={containerRef}
        style={{ height: isFullscreen ? "100vh" : 600 }}
        className={`relative w-full overflow-hidden rounded-lg transition-all ${isFullscreen ? 'z-[9999] bg-white' : ''}`}
      >
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom={true}
          className="w-full h-full bg-[#eff1f1]"
          zoomControl={false}
        >
          <MapRefSetter mapRefCb={setMapRef} />
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png" />
          <DropShadowPainter />

          {boundaries.map((b) => {
            if (!b.boundary) return null;

            // Filter features: 
            // 1. Get the count from the current data result (countsMap), defaulting to 0 if missing.
            const count = countsMap.get(b.id) || 0;

            // 2. Further filter to only show selected ones if an explicit selection is active at this level
            if (selectedIds && selectedIds.length > 0 && !selectedIds.includes(b.id)) return null;

            const feature = toGeoJSONFeature(b.boundary);
            if (!feature) return null;
            const fillColor = getBinColor(count, legendBins);
            return (
              <GeoJSON
                key={`${b.uid}-${count}`}
                data={feature}
                style={{
                  fillColor,
                  fillOpacity: 0.85,
                  color: "#272727",
                  weight: 1.5,
                }}
                onEachFeature={(feature, layer) => {
                  const typeLabel = activeTab === "Police Districts" ? "Police District" :
                    activeTab === "Police Beats" ? "Police Beat" :
                      activeTab === "Wards" ? "Ward" : "Area";

                  // Dark popup that shows on click
                  layer.bindPopup(
                    `<div style="color: white; min-width: 140px; margin: -4px;">
                      <p style="font-weight: 700; font-size: 14px; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 4px;">${typeLabel}: ${b.id}</p>
                      <p style="font-size: 12px; margin: 0; opacity: 0.9;">Count of Incidents: <span style="font-weight: 600;">${count.toLocaleString()}</span></p>
                    </div>`,
                    { offset: [0, -10] }
                  );

                  layer.on({
                    mouseover: (e) => {
                      e.target.setStyle({ weight: 3, color: "#000", fillOpacity: 1 });
                      e.target.bringToFront();
                    },
                    mouseout: (e) => {
                      e.target.setStyle({ weight: 1.5, color: "#272727", fillOpacity: 0.85 });
                    },
                  });
                }}
              />
            );
          })}

          {/* Task 2: Density Heatmap (Blurred bubbles at centroids) */}
          {showHeatmap && boundaries?.map((b) => {
            const count = countsMap.get(b.id) || 0;
            if (count === 0) return null;

            // Calculate max count for density relative scaling
            const maxCount = Math.max(...Array.from(countsMap.values()), 1);
            const intensity = count / maxCount;
            const centroid = getCentroid(typeof b.boundary === 'string' ? JSON.parse(b.boundary) : b.boundary);

            return (
              <CircleMarker
                key={`heat-${b.uid}`}
                center={centroid}
                radius={10 + intensity * 40}
                pathOptions={{
                  fillColor: intensity > 0.8 ? "#ef4444" : intensity > 0.5 ? "#f97316" : "#eab308",
                  fillOpacity: 0.2 + intensity * 0.4,
                  color: "transparent",
                  weight: 0
                }}
              />
            );
          })}

          {showPolice && policeStations?.map((ps, idx) => {
            if (!ps.latitude || !ps.longitude) return null;
            const distNum = ps.district || ps.district_id || ps.dist || ps.id || "N/A";
            return (
              <Marker
                key={`police-${idx}`}
                position={[ps.latitude, ps.longitude]}
                icon={L.divIcon({
                  html: `<div style="font-size: 24px; cursor: pointer;" title="Police Station">👮</div>`,
                  className: "police-emoji-marker",
                  iconSize: [30, 30],
                  iconAnchor: [15, 15],
                })}
              >
                <Popup>
                  <div className="p-1">
                    <h4 className="font-bold text-[10px] border-b mb-2 pb-1 text-slate-800 uppercase tracking-widest">CPD Precinct Details</h4>
                    <p className="text-[9px] uppercase font-black"><b>District:</b> {distNum}</p>
                    <p className="text-[9px] uppercase font-bold text-slate-500"><b>Address:</b> {ps.address || ps.address_text || "N/A"}</p>
                    <p className="text-[9px] uppercase font-bold text-slate-500"><b>Name:</b> {ps.station_name || ps.name || (distNum !== "N/A" ? `District ${distNum}` : "Unknown Station")}</p>
                    {ps.phone && <p className="text-[9px] uppercase font-bold text-slate-500"><b>Phone:</b> {ps.phone}</p>}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Task 2: Heatmap Legend Overlay */}
        {showHeatmap && (
          <div className="absolute bottom-24 right-8 z-[1000] bg-white/95 backdrop-blur-md border border-slate-200 p-4 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 min-w-[200px]">
            <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
              <Layers size={14} className="text-orange-500" />
              <h5 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Density Intensity</h5>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="w-3.5 h-3.5 rounded-full bg-[#ef4444] shadow-md border border-white" />
                <span className="text-[9px] font-black text-slate-600 uppercase">Extreme (&gt;80%)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3.5 h-3.5 rounded-full bg-[#f97316] shadow-md border border-white" />
                <span className="text-[9px] font-black text-slate-600 uppercase">High (50-80%)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3.5 h-3.5 rounded-full bg-[#eab308] shadow-md border border-white" />
                <span className="text-[9px] font-black text-slate-600 uppercase">Moderate (20-50%)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3.5 h-3.5 rounded-full bg-[#3b82f6] shadow-md border border-white" />
                <span className="text-[9px] font-black text-slate-600 uppercase">Baseline (&lt;20%)</span>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100">
              <div className="text-[7px] text-slate-400 font-black uppercase leading-tight italic">
                Formula: Local Incident density<br />relative to citywide max concentration
              </div>
            </div>
          </div>
        )}

        <MapZoomControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onReset={handleReset}
          onFit={handleFit}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />

        {/* KPI Overlay */}
        <div className="absolute top-8 right-8 z-[500] bg-[#e8e9eb] px-10 py-6 rounded-xl shadow-lg border border-gray-200 min-w-[240px] text-center">
          <div className="text-5xl font-extralight text-black tracking-tight">
            {kpiData?.total_incidents?.toLocaleString() ?? "—"}
          </div>
          <div className="text-[13px] text-gray-500 mt-2">Reported Incidents</div>
          {kpiData?.arrest_rate_pct != null && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-left">
              <div>
                <div className="text-[11px] text-gray-400">Arrest Rate</div>
                <div className="text-sm font-semibold text-gray-700">{kpiData.arrest_rate_pct.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400">Domestic Rate</div>
                <div className="text-sm font-semibold text-gray-700">{kpiData.domestic_rate_pct?.toFixed(1) ?? "—"}%</div>
              </div>
            </div>
          )}
        </div>
        <div className="absolute top-52 right-8 z-[500] text-[11px] italic text-gray-500">
          Hold Ctrl to select many
        </div>

        {/* Legend Overlay */}
        {legendBins.length > 1 && (
          <div className="absolute bottom-6 left-6 z-[500] bg-[#e6e8ea] px-3 py-3 rounded-lg shadow-md border border-gray-200">
            <div className="text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Incidents</div>
            <div className="space-y-1.5 min-w-[150px]">
              {[...legendBins].reverse().map((bin, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 border border-gray-400" style={{ backgroundColor: bin.color }} />
                  <span className="text-[12px] text-gray-600 font-medium">
                    {bin.max === Infinity
                      ? `≥ ${Math.round(bin.min).toLocaleString()}`
                      : `${Math.round(bin.min).toLocaleString()} – ${Math.round(bin.max).toLocaleString()}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </GscipCard>
  );
}

// ── Summary Dashboard Main Component ──────────────────────────────────

export default function SummarySection({ activeTab = "Police Districts" }) {
  const [timeFrame, setTimeFrame] = useState("Last 30 Days");
  const [customRange, setCustomRange] = useState({
    dateFrom: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
    dateTo: new Date().toISOString().split("T")[0]
  });
  const [selectedCrimes, setSelectedCrimes] = useState([]);   // crime type names

  // Geographic selection states
  const [selectedDistricts, setSelectedDistricts] = useState([]);
  const [selectedWards, setSelectedWards] = useState([]);
  const [selectedBeats, setSelectedBeats] = useState([]);
  const [dbMaxDate, setDbMaxDate] = useState(new Date());
  const [showPolice, setShowPolice] = useState(false);
  const [policeStations, setPoliceStations] = useState([]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [scrubValue, setScrubValue] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [allIncidents, setAllIncidents] = useState([]);

  const [appliedFilters, setAppliedFilters] = useState({
    timeFrame: "Last 30 Days",
    customRange: {
      dateFrom: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
      dateTo: new Date().toISOString().split("T")[0]
    },
    selectedCrimes: [],
    selectedDistricts: [],
    selectedWards: [],
    selectedBeats: [],
  });
  const [lastTab, setLastTab] = useState(activeTab);

  // Derive scrubbed DateTo
  const scrubbedDateTo = useMemo(() => {
    const { dateFrom, dateTo } = timeFrameToDates(appliedFilters.timeFrame, dbMaxDate, appliedFilters.customRange);
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const totalDays = Math.max(1, Math.round((to - from) / 86400000));
    const currentDays = Math.round((scrubValue / 100) * totalDays);
    const scrubbed = new Date(from.getTime() + currentDays * 86400000);
    return scrubbed.toISOString().split("T")[0];
  }, [appliedFilters.timeFrame, appliedFilters.customRange, dbMaxDate, scrubValue]);

  // Client-Side Replay Engine
  const visibleIncidents = useMemo(() => {
    if (!allIncidents.length) return [];
    return allIncidents.filter(inc => inc.date && inc.date.split("T")[0] <= scrubbedDateTo);
  }, [allIncidents, scrubbedDateTo]);

  // Playback timer
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setScrubValue(v => (v >= 100 ? 0 : v + 1));
      }, 400);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Sync with backend calendar to avoid "empty future" data discrepancy
  useEffect(() => {
    async function sync() {
      try {
        const meta = await fetchFilterOptions();
        if (meta?.date_range?.max_date) {
          setDbMaxDate(new Date(meta.date_range.max_date));
        }
      } catch (e) {
        console.warn("SummarySection: Calendar sync failed, using system clock:", e);
      }
    }
    sync();
  }, []);

  useEffect(() => {
    if (showPolice && policeStations.length === 0) {
      fetchPoliceStations().then(data => {
        setPoliceStations(Array.isArray(data) ? data : (data.features || []));
      }).catch(e => console.error("SummarySection: Failed to load police stations", e));
    }
  }, [showPolice]);

  // Sync helpers
  const isDistrictsTab = activeTab === "Police Districts";
  const isWardsTab = activeTab === "Wards";
  const isBeatsTab = activeTab === "Police Beats";
  const level = TAB_LEVEL[activeTab] ?? "district";

  // Reset geographic and other filters when tab changes to avoid cross-pollination
  useEffect(() => {
    if (activeTab !== lastTab) {
      setSelectedDistricts([]);
      setSelectedWards([]);
      setSelectedBeats([]);
      setSelectedCrimes([]);
      setTimeFrame("Last 30 Days");

      setAppliedFilters({
        timeFrame: "Last 30 Days",
        customRange: {
          dateFrom: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
          dateTo: new Date().toISOString().split("T")[0]
        },
        selectedCrimes: [],
        selectedDistricts: [],
        selectedWards: [],
        selectedBeats: [],
      });

      setGeoSummary({ total_incidents: 0, items: [] });
      setCrimeTypes([]);
      setDateData([]);
      setKpiData({ total_incidents: 0, arrest_count: 0, arrest_rate_pct: 0, domestic_count: 0, domestic_rate_pct: 0 });

      setLastTab(activeTab);
    }
  }, [activeTab, lastTab]);

  // Derived dates based on applied timeframe
  const { dateFrom, dateTo } = useMemo(() =>
    timeFrameToDates(appliedFilters.timeFrame, dbMaxDate, appliedFilters.customRange),
    [appliedFilters.timeFrame, dbMaxDate, appliedFilters.customRange]
  );

  // ── API data state ──
  const [geoSummary, setGeoSummary] = useState({ total_incidents: 0, items: [] });
  const [crimeTypes, setCrimeTypes] = useState([]);
  const [dateData, setDateData] = useState([]);
  const [kpiData, setKpiData] = useState(null);

  const [loadingGeo, setLoadingGeo] = useState(false);
  const [loadingCrimes, setLoadingCrimes] = useState(false);
  const [loadingDate, setLoadingDate] = useState(false);
  const [loadingKpi, setLoadingKpi] = useState(false);
  const [baselineGeoSummary, setBaselineGeoSummary] = useState({ total_incidents: 0, items: [] });

  // Build filter params for API calls based on applied values
  const geoFilterParams = useMemo(() => {
    const f = appliedFilters || {};
    if (level === "ward") return { wardIds: f.selectedWards || [] };
    if (level === "district") return { districtIds: f.selectedDistricts || [] };
    if (level === "beat") return { districtIds: f.selectedDistricts || [], beatIds: f.selectedBeats || [] };
    return {};
  }, [level, appliedFilters?.selectedDistricts, appliedFilters?.selectedWards, appliedFilters?.selectedBeats]);

  const crimeTypeIds = useMemo(
    () => (appliedFilters?.selectedCrimes || []).map((name) => {
      // Support both naming conventions
      const norm = (name || "").toLowerCase().replace(/\s+/g, "_");
      if (norm === "others") return "other";
      return norm;
    }),
    [appliedFilters?.selectedCrimes]
  );

  const [districtMeta, setDistrictMeta] = useState({ items: [] });

  const loadAllData = useCallback(async () => {
    setLoadingGeo(true);
    setLoadingCrimes(true);
    setLoadingDate(true);
    setLoadingKpi(true);

    try {
      const { dateFrom } = timeFrameToDates(appliedFilters.timeFrame, dbMaxDate, appliedFilters.customRange);
      const dt = dbMaxDate.toISOString().split("T")[0]; // Fetch full range for client-side replay

      const q = {
        dateFrom,
        dateTo: dt,
        limit: 50000,
        districtIds: (geoFilterParams.districtIds?.length) ? geoFilterParams.districtIds : undefined,
        wardIds: (geoFilterParams.wardIds?.length) ? geoFilterParams.wardIds : undefined,
        beatIds: (geoFilterParams.beatIds?.length) ? geoFilterParams.beatIds : undefined,
        crimeTypeIds: (crimeTypeIds?.length) ? crimeTypeIds : undefined
      };

      const [gs, ct, trends, kpi, baseline, rawIncidents] = await Promise.all([
        fetchGeospatialSummary({ ...q, level }),
        fetchIncidentsByCrimeType(q),
        fetchPlatformTrend({ dateFrom, dateTo: dt }),
        fetchSummaryKPIs(q),
        fetchGeospatialSummary({ dateFrom, dateTo: dt, crimeTypeIds: q.crimeTypeIds, level }),
        fetchMapIncidents(q)
      ]);

      setGeoSummary(gs || { total_incidents: 0, items: [] });
      setCrimeTypes(ct || []);
      setDateData(trends || []);
      setKpiData(kpi || { total_incidents: 0, arrest_count: 0, arrest_rate_pct: 0, domestic_count: 0, domestic_rate_pct: 0 });
      setBaselineGeoSummary(baseline || { total_incidents: 0, items: [] });
      setAllIncidents(rawIncidents || []);

      if (isBeatsTab) {
        const dm = await fetchGeospatialSummary({ level: "district", dateFrom, dateTo: dt, ...(crimeTypeIds.length ? { crimeTypeIds } : {}) });
        setDistrictMeta(dm);
      }
    } catch (e) {
      console.warn("Dashboard sync failed:", e);
    } finally {
      setLoadingGeo(false);
      setLoadingCrimes(false);
      setLoadingDate(false);
      setLoadingKpi(false);
    }
  }, [level, appliedFilters.timeFrame, geoFilterParams, crimeTypeIds, isBeatsTab, dbMaxDate]);

  useEffect(() => {
    // Explicitly check for ready state to avoid race conditions on mount
    if (appliedFilters && activeTab) {
      loadAllData();
    }
  }, [loadAllData, appliedFilters.timeFrame, activeTab, scrubbedDateTo]);


  // ── Derived View-Model Data ──

  // Selected Geo IDs for the Map and KPI calculations
  const currentSelectedIds = useMemo(() => {
    if (isDistrictsTab) return appliedFilters.selectedDistricts;
    if (isWardsTab) return appliedFilters.selectedWards;
    if (isBeatsTab) return appliedFilters.selectedBeats;
    return [];
  }, [isDistrictsTab, isWardsTab, isBeatsTab, appliedFilters.selectedDistricts, appliedFilters.selectedWards, appliedFilters.selectedBeats]);

  // Filtered items for the Bar Chart (Top 10 sorted or filtered selection)
  const filteredGeoChartData = useMemo(() => {
    const isFiltered = currentSelectedIds.length > 0;
    let list = geoSummary?.items || [];

    if (isFiltered) {
      // Filter mode: show only selected items, no slice
      list = list.filter((item) => currentSelectedIds.includes(item.id));
      const data = list.map((item) => ({
        name: item.id,
        count: item.crime_count,
      }));
      return data.sort((a, b) => b.count - a.count);
    } else {
      // Ranking mode: show Top 10 of available items
      const data = list.map((item) => ({
        name: item.id,
        count: item.crime_count,
      }));
      return data.sort((a, b) => b.count - a.count).slice(0, 10);
    }
  }, [geoSummary.items, currentSelectedIds]);

  // Detailed Category KPI derived from crimeTypes (to match CrimesSection logic)
  const categoryKpis = useMemo(() => {
    let v = 0, p = 0, o = 0;
    (crimeTypes || []).forEach(item => {
      const c = (item.category || "").toLowerCase();
      if (c === "violent") v += item.count;
      else if (c === "property") p += item.count;
      else o += item.count;
    });
    return { total: v + p + o, violent: v, property: p, other: o };
  }, [crimeTypes]);

  // Calculate the total incident count for the KPI overlay
  const calculatedTotalCount = useMemo(() => {
    // If we have an explicit selection at the current level, sum only those specific items
    if (currentSelectedIds.length > 0) {
      return geoSummary.items
        .filter((item) => {
          const normId = normaliseId(item.id ?? item.ward_id ?? item.district_id ?? item.beat_num, level);
          return currentSelectedIds.includes(normId || item.id);
        })
        .reduce((sum, i) => sum + i.crime_count, 0);
    }
    // Otherwise, use the category-derived total (which matches CrimesSection's 49k+)
    return categoryKpis.total || kpiData?.total_incidents || geoSummary.total_incidents || 0;
  }, [geoSummary.items, geoSummary.total_incidents, kpiData?.total_incidents, categoryKpis.total, currentSelectedIds, level]);

  // Crime chart data
  const filteredCrimeChartData = useMemo(() => {
    let list = crimeTypes || [];
    if (appliedFilters.selectedCrimes.length > 0) {
      list = list.filter((ct) => appliedFilters.selectedCrimes.includes(ct.name));
    }
    // Limit to top 10 to avoid excessive scroll in high-density view
    return list.slice(0, 10);
  }, [crimeTypes, appliedFilters.selectedCrimes]);

  // Map support — build countsMap using the SAME normaliseId so boundary and summary IDs always match
  // Derived from visibleIncidents for smooth temporal animation
  const countsMap = useMemo(() => {
    const m = new Map();
    visibleIncidents.forEach((inc) => {
      const rawId = level === "ward" ? inc.ward : level === "district" ? inc.district : inc.beat_num;
      if (rawId == null) return;
      const normId = normaliseId(rawId, level);
      m.set(normId, (m.get(normId) || 0) + 1);
    });
    return m;
  }, [visibleIncidents, level]);

  const choroplethBins = useMemo(() => buildBins(baselineGeoSummary.items), [baselineGeoSummary.items]);

  // Filter Panel Props
  const mainFilterItems = useMemo(
    () => (geoSummary?.items || []).map((item) => ({
      id: item.id,
      name: item.name ?? item.id,
      count: item.crime_count,
    })),
    [geoSummary.items]
  );

  const districtContextItems = useMemo(
    () => (districtMeta?.items || []).map((item) => ({
      id: item.id,
      name: `District ${item.id}`,
      count: item.crime_count,
    })),
    [districtMeta.items]
  );

  // ── Handlers ──

  const toggleCrime = (name) =>
    setSelectedCrimes((prev) => prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]);

  const applyFilters = () => {
    setScrubValue(100);
    setIsPlaying(false);
    setAppliedFilters({
      timeFrame,
      customRange,
      selectedCrimes,
      selectedDistricts,
      selectedWards,
      selectedBeats,
    });
  };

  const tabConfig = TAB_LABELS[activeTab] || TAB_LABELS["Police Districts"];

  if (activeTab === "Crimes") {
    return <CrimesSectionView />;
  }

  try {
    return (
      <>
        <style>{`
        .custom-tooltip {
          background: #2d2d2d !important;
          color: white !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 4px !important;
          padding: 8px 12px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
          font-family: inherit !important;
          opacity: 1 !important;
        }
        .custom-tooltip:before {
          display: none !important;
        }
        .leaflet-tooltip-top:before, .leaflet-tooltip-bottom:before {
          display: none !important;
        }
        .leaflet-popup-content-wrapper {
          background: #2d2d2d !important;
          color: white !important;
          border-radius: 6px !important;
          padding: 0 !important;
        }
        .leaflet-popup-tip {
          background: #2d2d2d !important;
        }
      `}</style>

        {/* Platform Level KPI Cards (Synced with Crimes Page) */}
        <div className="grid grid-cols-4 gap-0 mb-4 border border-slate-200 rounded-2xl overflow-hidden shadow-lg">
          {[
            { label: "Total Crimes", val: categoryKpis.total, color: "text-blue-900", bg: "bg-white", border: "border-r" },
            { label: "Violent Crimes", val: categoryKpis.violent, color: "text-red-600", bg: "bg-white", border: "border-r" },
            { label: "Property Crimes", val: categoryKpis.property, color: "text-orange-500", bg: "bg-white", border: "border-r" },
            { label: "Other Crimes", val: categoryKpis.other, color: "text-slate-800", bg: "bg-white", border: "" }
          ].map((k, i) => (
            <div key={i} className={`${k.bg} ${k.border} border-slate-100 p-12 text-center flex flex-col justify-center min-h-[220px] transition-all hover:bg-slate-50/50`}>
              <div className="text-[14px] font-black text-slate-400 uppercase tracking-[0.25em] mb-4">{k.label}</div>
              <div className={`text-6xl font-black ${k.color} tracking-tighter`}>{k.val?.toLocaleString() || 0}</div>
              <div className="text-[10px] text-slate-300 font-black uppercase mt-4 tracking-widest opacity-60">Forensic Intelligence Unit</div>
            </div>
          ))}
        </div>

        {/* Visual Charts Row */}
        <div className="grid grid-cols-12 gap-3 mb-1">
          <div className="col-span-3">
            <FiltersPanel
              selectedTimeFrame={timeFrame}
              onTimeFrameChange={(tf) => {
                setTimeFrame(tf);
                setAppliedFilters(prev => ({ ...prev, timeFrame: tf }));
              }}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
              crimeTypes={crimeTypes || []}
              selectedCrimes={selectedCrimes || []}
              onToggleCrime={toggleCrime}
              onApply={applyFilters}
              onReset={() => {
                setSelectedCrimes([]);
                setAppliedFilters(prev => ({ ...prev, selectedCrimes: [] }));
              }}
              showPolice={showPolice}
              onTogglePolice={() => setShowPolice(!showPolice)}
              showHeatmap={showHeatmap}
              onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
            />
          </div>
          <div className="col-span-4">
            <CrimeTypeChart data={filteredCrimeChartData || []} loading={loadingCrimes} />
          </div>
          <div className="col-span-5">
            <GeoChart data={filteredGeoChartData || []} title={tabConfig?.chartTitle || "Incidents"} loading={loadingGeo} />
          </div>
        </div>

        {/* Geospatial Filter Panels and Date Trend */}
        <div className="grid grid-cols-12 gap-3 mb-3">
          <div className="col-span-3">
            {isBeatsTab ? (
              <div className="flex flex-col gap-4">
                <GeoFilterPanel
                  filterLabel="District"
                  items={districtContextItems || []}
                  selectedIds={selectedDistricts || []}
                  onToggle={(id) => setSelectedDistricts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                  onApply={applyFilters}
                  onReset={() => {
                    setSelectedDistricts([]);
                    setAppliedFilters(prev => ({ ...prev, selectedDistricts: [] }));
                  }}
                  compact
                />
                <GeoFilterPanel
                  filterLabel="Beat"
                  items={mainFilterItems || []}
                  selectedIds={selectedBeats || []}
                  onToggle={(id) => setSelectedBeats(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                  onApply={applyFilters}
                  onReset={() => {
                    setSelectedBeats([]);
                    setAppliedFilters(prev => ({ ...prev, selectedBeats: [] }));
                  }}
                  compact
                />
              </div>
            ) : (
              <GeoFilterPanel
                filterLabel={tabConfig?.filterLabel || "Filter"}
                items={mainFilterItems || []}
                selectedIds={isDistrictsTab ? (selectedDistricts || []) : (isWardsTab ? (selectedWards || []) : [])}
                onToggle={(id) => {
                  if (isDistrictsTab) setSelectedDistricts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                  if (isWardsTab) setSelectedWards(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                }}
                onApply={applyFilters}
                onReset={() => {
                  if (isDistrictsTab) {
                    setSelectedDistricts([]);
                    setAppliedFilters(prev => ({ ...prev, selectedDistricts: [] }));
                  }
                  if (isWardsTab) {
                    setSelectedWards([]);
                    setAppliedFilters(prev => ({ ...prev, selectedWards: [] }));
                  }
                }}
              />
            )}
          </div>
          <div className="col-span-9">
            <IncidentsByDateChart data={dateData || []} loading={loadingDate} />
          </div>
        </div>

        {/* Map Content */}
        <div className="grid grid-cols-12 gap-4 mb-6">
          <div className="col-span-12">
            <MapPanel
              activeTab={activeTab}
              countsMap={countsMap || new Map()}
              kpiData={{ ...(kpiData || {}), total_incidents: calculatedTotalCount }}
              bins={choroplethBins || []}
              selectedIds={currentSelectedIds || []}
              showPolice={showPolice}
              policeStations={policeStations}
              showHeatmap={showHeatmap}
              scrubValue={scrubValue}
              setScrubValue={setScrubValue}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              scrubbedDateTo={scrubbedDateTo}
            />
          </div>
        </div>
      </>
    );
  } catch (err) {
    console.error("Dashboard render crash:", err);
    return (
      <div className="p-20 text-center bg-gray-100 rounded-xl border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Dashboard Error</h2>
        <p className="text-sm text-gray-500">The Summary Maps view encountered a problem. Please try refreshing the page or switching tabs.</p>
        <div className="mt-4 text-[10px] text-gray-400 font-mono">{err.message}</div>
      </div>
    );
  }
}

