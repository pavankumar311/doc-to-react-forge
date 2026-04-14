import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Filter, MapPin, Home, Copy, SquareStack, ZoomIn, ZoomOut, Maximize, Minimize, CircleDot } from "lucide-react";
import GscipCard from "./GscipCard";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import {
  AUTH_TOKEN,
  fetchGeospatialSummary,
  fetchSummaryKPIs,
  fetchIncidentsByDate,
  fetchIncidentsByCrimeType,
  fetchWardBoundaries,
  fetchDistrictBoundaries,
  fetchPoliceBeats,
} from "../services/api";

// ── Time frame helpers ──────────────────────────────────────────────────
const TIME_FRAMES = ["Last 7 days", "Last 30 days", "Last 90 days", "Last 365 days"];

function timeFrameToDates(tf) {
  const to = new Date();
  const from = new Date();
  if (tf === "Last 7 days") from.setDate(to.getDate() - 7);
  else if (tf === "Last 30 days") from.setDate(to.getDate() - 30);
  else if (tf === "Last 90 days") from.setDate(to.getDate() - 90);
  else from.setFullYear(to.getFullYear() - 1);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { dateFrom: fmt(from), dateTo: fmt(to) };
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

function FiltersPanel({ selectedTimeFrame, onTimeFrameChange, crimeTypes, selectedCrimes, onToggleCrime, onApply, onReset }) {
  return (
    <GscipCard>
      <div className="flex items-center gap-2 mb-4">
        <Filter size={18} style={{ color: "var(--color-text-secondary)" }} />
        <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Filters</h3>
      </div>

      <div className="mb-4">
        <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--color-text-primary)" }}>
          Time Frame
        </label>
        <select
          value={selectedTimeFrame}
          onChange={(e) => onTimeFrameChange(e.target.value)}
          className="w-full px-3 py-2 rounded-md text-sm"
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
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-primary)" }}>
            Crime Type
          </label>
          <button onClick={onReset} className="text-xs font-medium" style={{ color: "var(--color-azure)" }}>
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
        className="w-full py-2 rounded-md text-sm font-medium text-white transition-colors"
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
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">⚙</span>
        <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Incidents by Crime Type</h3>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
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
      <div className="flex items-center gap-2 mb-4">
        <MapPin size={18} style={{ color: "var(--color-text-secondary)" }} />
        <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>{title}</h3>
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
        <ResponsiveContainer width="100%" height={400}>
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
        <button onClick={onReset} className="text-xs font-medium" style={{ color: "var(--color-azure)" }}>Reset</button>
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
        className="w-full py-1.5 rounded-md text-sm font-medium text-white mt-3"
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
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">📅</span>
        <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Incidents by Date</h3>
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

function MapZoomControls({ onZoomIn, onZoomOut, onReset, isFullscreen, onToggleFullscreen }) {
  return (
    <div className="absolute top-4 left-4 z-[500] flex flex-col gap-1.5">
      <button onClick={onReset} className="bg-white p-2 rounded shadow flex items-center justify-center cursor-pointer hover:bg-gray-50 border border-gray-100 text-gray-500" title="Reset view">
        <Home size={18} />
      </button>
      <button onClick={onZoomIn} className="bg-white p-2 rounded shadow flex items-center justify-center cursor-pointer hover:bg-gray-50 border border-gray-100 text-gray-500" title="Zoom in">
        <ZoomIn size={18} />
      </button>
      <button onClick={onZoomOut} className="bg-white p-2 rounded shadow flex items-center justify-center cursor-pointer hover:bg-gray-50 border border-gray-100 text-gray-500" title="Zoom out">
        <ZoomOut size={18} />
      </button>
      <button onClick={onToggleFullscreen} className="bg-white p-2 rounded shadow flex items-center justify-center cursor-pointer hover:bg-gray-50 border border-gray-100 text-gray-500" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
        {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
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

function MapPanel({ activeTab, countsMap, kpiData, bins, selectedIds }) {
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl text-gray-500 tracking-wide font-medium">Map of Incidents</h3>
        <div className="flex items-center gap-3 text-gray-400">
          <Copy size={16} className="cursor-pointer hover:text-gray-600" />
          <SquareStack size={16} className="cursor-pointer hover:text-gray-600" />
        </div>
      </div>
      <div style={{ height: 600 }} className="relative w-full overflow-hidden rounded-lg">
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
        </MapContainer>

        <MapZoomControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onReset={handleReset}
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

const CRIME_SUB_TABS = ["Map Area Crime", "Crime Dashboard"];

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
              <input type="text" placeholder="Enter address or coordinates" className="w-full px-3 py-2 rounded text-sm" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }} />
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
              ].map((item) => (
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

function MapAreaCrime() {
  const [districts, setDistricts] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [last2Weeks, setLast2Weeks] = useState(true);
  const [violentCrime, setViolentCrime] = useState(true);
  const [propertyCrime, setPropertyCrime] = useState(true);
  const [otherCrime, setOtherCrime] = useState(true);
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const DEFAULT_CENTER = [41.83, -87.72];
  const DEFAULT_ZOOM = 10.5;

  const setMapRef = useCallback((map) => { mapRef.current = map; }, []);
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleReset = () => mapRef.current?.setView(DEFAULT_CENTER, DEFAULT_ZOOM);

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

  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const res = await fetch("/chicago_districts.geojson");
        const data = await res.json();
        if (data?.features) {
          const seen = new Set();
          const mapped = [];
          for (const f of data.features) {
            const rawId = f.properties.dist_num || f.properties.district || f.properties.DIST_NUM || f.properties.DISTRICT;
            const id = rawId ? String(rawId).padStart(3, '0') : "000";
            if (seen.has(id)) continue;
            seen.add(id);
            mapped.push({ district_id: id, boundary: { type: "Feature", geometry: f.geometry, properties: {} } });
          }
          setDistricts(mapped);
        }
      } catch (e) { console.error("Failed to load GeoJSON", e); }
    };
    fetchDistricts();
  }, []);

  const countsMap = useMemo(() => {
    const m = new Map();
    MOCK_DISTRICTS.forEach(d => m.set(d.name, d.count));
    return m;
  }, []);

  // Generate crime cluster markers from district centroids
  const crimeMarkers = useMemo(() => {
    if (!districts.length) return [];
    const markers = [];
    const CATEGORIES = [
      { type: "violent", color: "#e53935" },
      { type: "property", color: "#42A5F5" },
      { type: "other", color: "#FDD835" },
    ];
    districts.forEach((d) => {
      if (!d.boundary) return;
      const centroid = getCentroid(d.boundary.geometry || d.boundary);
      const totalCount = countsMap.get(d.district_id) || 450;
      const vCount = Math.round(totalCount * 0.15);
      const pCount = Math.round(totalCount * 0.45);
      const oCount = totalCount - vCount - pCount;
      const counts = [vCount, pCount, oCount];
      CATEGORIES.forEach((cat, i) => {
        const offset = [(i - 1) * 0.012, (i - 1) * 0.008];
        markers.push({
          id: `${d.district_id}-${cat.type}`,
          lat: centroid[0] + offset[1],
          lon: centroid[1] + offset[0],
          count: counts[i],
          color: cat.color,
          type: cat.type,
        });
      });
    });
    return markers;
  }, [districts, countsMap]);

  const totalCrimes = 7790;
  const violentCrimes = 652;
  const propertyCrimes = 2938;
  const otherCrimes = 4200;

  const VIOLENT_LEGEND = [
    { code: "01A", label: "Homicide", color: "#e53935" },
    { code: "02", label: "Sexual Assault", color: "#d81b60" },
    { code: "03", label: "Robbery", color: "#c62828" },
    { code: "04A", label: "Aggravated Assault", color: "#e65100" },
    { code: "04B", label: "Aggravated Battery", color: "#bf360c" },
  ];
  const PROPERTY_LEGEND = [
    { code: "05", label: "Burglary", color: "#1565C0" },
    { code: "06", label: "Larceny/Theft", color: "#42A5F5" },
    { code: "07", label: "Motor Vehicle Theft", color: "#7E57C2" },
    { code: "09", label: "Arson", color: "#EF5350" },
  ];
  const FEATURE_SIZES = [
    { count: "> 447", size: 28, color: "#c62828" },
    { count: "350", size: 24, color: "#e53935" },
    { count: "200", size: 20, color: "#ef5350" },
    { count: "100", size: 16, color: "#ef9a9a" },
    { count: "< 2", size: 10, color: "#ffcdd2" },
  ];

  return (
    <div ref={containerRef} className={isFullscreen ? "fixed inset-0 z-[9999] bg-white" : ""}>
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        {[
          { label: "Total Crimes", value: totalCrimes.toLocaleString(), color: "#1565C0" },
          { label: "Violent Crimes", value: violentCrimes.toLocaleString(), color: "#c62828" },
          { label: "Property Crimes", value: propertyCrimes.toLocaleString(), color: "#1565C0" },
          { label: "Other Crimes", value: otherCrimes.toLocaleString(), color: "#e53935" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg p-4 text-center" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
            <div className="text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>{stat.label}</div>
            <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-[10px] mt-1" style={{ color: "var(--color-text-muted)" }}>In visible map extent</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-3" style={{ height: isFullscreen ? "calc(100vh - 120px)" : 540 }}>
        {/* Left Filter Panel */}
        <div className="col-span-3 overflow-y-auto rounded-lg p-4" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
          <h4 className="text-base font-bold text-center mb-1" style={{ color: "var(--color-text-primary)" }}>Filter Records</h4>
          <p className="text-[10px] text-center mb-4" style={{ color: "var(--color-text-muted)" }}>The most recent data was posted 7 days from yesterday.</p>

          <div className="space-y-3 mb-5">
            {[
              { label: "Last 2 Weeks", checked: last2Weeks, onChange: () => setLast2Weeks(!last2Weeks) },
              { label: "Violent Crime", checked: violentCrime, onChange: () => setViolentCrime(!violentCrime) },
              { label: "Property Crime", checked: propertyCrime, onChange: () => setPropertyCrime(!propertyCrime) },
              { label: "Other Crime", checked: otherCrime, onChange: () => setOtherCrime(!otherCrime) },
            ].map((toggle) => (
              <label key={toggle.label} className="flex items-center justify-between cursor-pointer">
                <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>{toggle.label}</span>
                <div className="relative inline-flex items-center">
                  <input type="checkbox" checked={toggle.checked} onChange={toggle.onChange} className="sr-only peer" />
                  <div className="w-9 h-5 rounded-full peer-checked:bg-blue-600 bg-gray-300 transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                </div>
              </label>
            ))}
          </div>

          <div className="rounded-lg p-3 mb-4" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>
            <div className="flex items-center gap-1 mb-2">
              <span className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>📅 Custom Date Range</span>
            </div>
            <div className="text-[10px] mb-2" style={{ color: "var(--color-text-secondary)" }}>Date of Incident is between</div>
            <div className="flex gap-2">
              <input type="date" className="flex-1 px-2 py-1 text-xs rounded" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }} />
              <span className="text-xs self-center" style={{ color: "var(--color-text-muted)" }}>and</span>
              <input type="date" className="flex-1 px-2 py-1 text-xs rounded" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }} />
            </div>
            <p className="text-[9px] mt-2" style={{ color: "var(--color-text-muted)" }}>Oldest data from 1 year ago.</p>
          </div>

          <div className="border-t pt-4" style={{ borderColor: "var(--color-border)" }}>
            <h5 className="text-sm font-bold text-center mb-1" style={{ color: "#1565C0" }}>Find Crime Near</h5>
            <p className="text-[10px] text-center mb-3" style={{ color: "var(--color-text-muted)" }}>Enter address below to view nearby crime.</p>
            <div className="flex gap-2">
              <input type="text" placeholder="Find address or place" className="flex-1 px-3 py-2 text-sm rounded" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }} />
              <button className="px-3 py-2 rounded text-white" style={{ background: "#1565C0" }}>🔍</button>
            </div>
            <div className="mt-3">
              <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>Location</span>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex gap-1">
                  {["📍", "📐", "🔲"].map((icon, i) => (
                    <button key={i} className="p-1.5 rounded text-sm" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>{icon}</button>
                  ))}
                </div>
                <input type="number" defaultValue={660} className="w-16 px-2 py-1 text-xs rounded" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }} />
                <select className="px-2 py-1 text-xs rounded" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}>
                  <option>Feet</option>
                  <option>Miles</option>
                  <option>Meters</option>
                </select>
              </div>
              <p className="text-[9px] mt-2" style={{ color: "#1565C0" }}>Draw your own point, line or polygon and buffer by a set distance.</p>
            </div>
          </div>
        </div>

        {/* Center Map */}
        <div className="col-span-6 relative rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
          <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom className="w-full h-full" style={{ background: "#eff1f1" }} zoomControl={false}>
            <MapRefSetter mapRefCb={setMapRef} />
            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
            {districts.filter(d => d.boundary).map(d => (
              <GeoJSON
                key={d.district_id}
                data={d.boundary}
                style={{ fillColor: "transparent", fillOpacity: 0, color: "#222", weight: 2 }}
                onEachFeature={(feature, layer) => {
                  const count = countsMap.get(d.district_id) || 450;
                  layer.bindPopup(
                    `<div style="font-size:13px;line-height:1.6;padding:2px 4px;"><b>District:</b> ${d.district_id}<br/><b>Incidents:</b> ${count.toLocaleString()}</div>`
                  );
                  layer.on({
                    mouseover: (e) => e.target.setStyle({ weight: 3, color: "#000" }),
                    mouseout: (e) => e.target.setStyle({ weight: 2, color: "#222" }),
                  });
                }}
              />
            ))}
            {crimeMarkers
              .filter(m => (m.type === "violent" && violentCrime) || (m.type === "property" && propertyCrime) || (m.type === "other" && otherCrime))
              .map(m => {
                const sz = Math.max(24, Math.min(44, 18 + m.count / 30));
                return (
                  <Marker
                    key={m.id}
                    position={[m.lat, m.lon]}
                    icon={L.divIcon({
                      html: `<div style="
                        background:${m.color};
                        width:${sz}px;height:${sz}px;
                        border-radius:50%;
                        display:flex;align-items:center;justify-content:center;
                        color:#fff;font-weight:800;font-size:${Math.max(10, sz * 0.32)}px;
                        border:2px solid rgba(255,255,255,0.7);
                        box-shadow:0 2px 8px rgba(0,0,0,0.35);
                        cursor:pointer;
                      ">${m.count}</div>`,
                      className: "",
                      iconSize: [sz, sz],
                      iconAnchor: [sz / 2, sz / 2],
                    })}
                  />
                );
              })}
          </MapContainer>
          <MapZoomControls onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onReset={handleReset} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />
        </div>

        {/* Right Legend Panel */}
        <div className="col-span-3 overflow-y-auto rounded-lg p-4" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
          <h4 className="text-sm font-bold mb-3" style={{ color: "var(--color-text-primary)" }}>Crime</h4>

          <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>Violent Crime (Index)</p>
          <div className="space-y-1.5 mb-4">
            {VIOLENT_LEGEND.map((item) => (
              <div key={item.code} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: item.color }}>
                  <span className="text-white text-[8px] font-bold">!</span>
                </div>
                <span className="text-xs" style={{ color: "var(--color-text-primary)" }}>{item.code} - {item.label}</span>
              </div>
            ))}
          </div>

          <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>Property Crime (Index)</p>
          <div className="space-y-1.5 mb-4">
            {PROPERTY_LEGEND.map((item) => (
              <div key={item.code} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs" style={{ color: "var(--color-text-primary)" }}>{item.code} - {item.label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-4">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#FDD835" }} />
            <span className="text-xs" style={{ color: "var(--color-text-primary)" }}>Other Crimes (Non-Index)</span>
          </div>

          <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>Number of features</p>
          <div className="space-y-2">
            {FEATURE_SIZES.map((item) => (
              <div key={item.count} className="flex items-center gap-2">
                <div className="rounded-full flex items-center justify-center text-white font-bold" style={{ width: item.size, height: item.size, backgroundColor: item.color, fontSize: Math.max(8, item.size * 0.35) }}></div>
                <span className="text-xs" style={{ color: "var(--color-text-primary)" }}>{item.count}</span>
              </div>
            ))}
          </div>

          <div className="border-t pt-4" style={{ borderColor: "var(--color-border)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-text-secondary)" }}>Police Districts</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CrimeDashboard() {
  const [districts, setDistricts] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const DEFAULT_CENTER = [41.83, -87.72];
  const DEFAULT_ZOOM = 10.5;

  const setMapRef = useCallback((map) => { mapRef.current = map; }, []);
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleReset = () => mapRef.current?.setView(DEFAULT_CENTER, DEFAULT_ZOOM);

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

  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const res = await fetch("/chicago_districts.geojson");
        const data = await res.json();
        if (data?.features) {
          const seen = new Set();
          const mapped = [];
          for (const f of data.features) {
            const rawId = f.properties.dist_num || f.properties.district || f.properties.DIST_NUM || f.properties.DISTRICT;
            const id = rawId ? String(rawId).padStart(3, '0') : "000";
            if (seen.has(id)) continue;
            seen.add(id);
            mapped.push({ district_id: id, boundary: { type: "Feature", geometry: f.geometry, properties: {} } });
          }
          setDistricts(mapped);
        }
      } catch (e) { console.error("Failed to load GeoJSON", e); }
    };
    fetchDistricts();
  }, []);

  const countsMap = useMemo(() => {
    const m = new Map();
    MOCK_DISTRICTS.forEach(d => m.set(d.name, d.count));
    return m;
  }, []);

  const crimeMarkers = useMemo(() => {
    if (!districts.length) return [];
    const markers = [];
    const CATEGORIES = [
      { type: "violent", color: "#e53935" },
      { type: "property", color: "#42A5F5" },
      { type: "other", color: "#FDD835" },
    ];
    districts.forEach((d) => {
      if (!d.boundary) return;
      const centroid = getCentroid(d.boundary.geometry || d.boundary);
      const totalCount = countsMap.get(d.district_id) || 450;
      const vCount = Math.round(totalCount * 0.15);
      const pCount = Math.round(totalCount * 0.45);
      const oCount = totalCount - vCount - pCount;
      const counts = [vCount, pCount, oCount];
      CATEGORIES.forEach((cat, i) => {
        const offset = [(i - 1) * 0.012, (i - 1) * 0.008];
        markers.push({
          id: `${d.district_id}-${cat.type}`,
          lat: centroid[0] + offset[1],
          lon: centroid[1] + offset[0],
          count: counts[i],
          color: cat.color,
          type: cat.type,
        });
      });
    });
    return markers;
  }, [districts, countsMap]);

  const MOCK_INCIDENTS = [
    {
      title: "AGGRAVATED BATTERY (INDEX)",
      subtitle: "BATTERY - AGGRAVATED - OTHER DANGEROUS WEAPON",
      datetime: "4/4/26, 10:25 AM BAR OR TAVERN of 17XX W BALMORAL AVE",
      address: "17XX W BALMORAL AVE",
      occurrence: "4/4/26, 10:25 AM",
      description: "AGGRAVATED - OTHER DANGEROUS WEAPON",
      rd: "JK209062",
      iucr: "0430",
      beat: "2012",
      ward: "40",
      community: "EDGEWATER",
      icon: "🔴",
      iconColor: "#e53935",
    },
    {
      title: "MOTOR VEHICLE THEFT (INDEX)",
      subtitle: "MOTOR VEHICLE THEFT - AUTOMOBILE",
      datetime: "4/4/26, 10:15 AM STREET of 21XX E 91ST ST",
      address: "21XX E 91ST ST",
      occurrence: "4/4/26, 10:15 AM",
      description: "AUTOMOBILE",
      rd: "JK205251",
      iucr: "0910",
      beat: "0413",
      ward: "7",
      community: "CALUMET HEIGHTS",
      icon: "🚗",
      iconColor: "#1565C0",
    },
    {
      title: "LARCENY - THEFT (INDEX)",
      subtitle: "THEFT - FROM BUILDING",
      datetime: "4/4/26, 10:14 AM APARTMENT of 24XX W LEXINGTON ST",
      address: "24XX W LEXINGTON ST",
      occurrence: "4/4/26, 10:14 AM",
      description: "FROM BUILDING",
      rd: "JK208741",
      iucr: "0820",
      beat: "1113",
      ward: "28",
      community: "NEAR WEST SIDE",
      icon: "📦",
      iconColor: "#42A5F5",
    },
    {
      title: "ROBBERY (INDEX)",
      subtitle: "ROBBERY - ARMED: HANDGUN",
      datetime: "4/4/26, 09:50 AM SIDEWALK of 63XX S KING DR",
      address: "63XX S KING DR",
      occurrence: "4/4/26, 09:50 AM",
      description: "ARMED: HANDGUN",
      rd: "JK209105",
      iucr: "0312",
      beat: "0312",
      ward: "20",
      community: "WOODLAWN",
      icon: "⚠️",
      iconColor: "#c62828",
    },
  ];

  const FILTER_ITEMS = [
    { label: "Police District", value: "All" },
    { label: "Police Beat", value: "All" },
    { label: "Ward", value: "All" },
    { label: "Community", value: "All" },
    { label: "Crime Types", value: "All Crimes" },
    { label: "Crime Groups", value: "All" },
    { label: "Date (backdated 7 days)", value: "Last 2 Weeks" },
  ];

  const VIOLENT_LEGEND = [
    { code: "01A", label: "Homicide", color: "#e53935" },
    { code: "02", label: "Sexual Assault", color: "#d81b60" },
    { code: "03", label: "Robbery", color: "#c62828" },
    { code: "04A", label: "Aggravated Assault", color: "#e65100" },
    { code: "04B", label: "Aggravated Battery", color: "#bf360c" },
  ];
  const PROPERTY_LEGEND = [
    { code: "05", label: "Burglary", color: "#1565C0" },
    { code: "06", label: "Larceny/Theft", color: "#42A5F5" },
    { code: "07", label: "Motor Vehicle Theft", color: "#7E57C2" },
    { code: "09", label: "Arson", color: "#EF5350" },
  ];
  const FEATURE_SIZES = [
    { count: "> 783", size: 30, color: "#c62828" },
    { count: "600", size: 26, color: "#e53935" },
    { count: "400", size: 22, color: "#ef5350" },
    { count: "200", size: 18, color: "#ef9a9a" },
    { count: "< 2", size: 12, color: "#ffcdd2" },
  ];

  const [bottomTab, setBottomTab] = useState("Crime Incidents");

  return (
    <div ref={containerRef} className={isFullscreen ? "fixed inset-0 z-[9999] bg-white overflow-auto" : ""}>
      {/* Title + Top Filter Bar */}
      <div className="rounded-lg mb-3 overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-bg-card)" }}>
          <h3 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>Crime and Strategic Plans</h3>
        </div>
        <div className="flex items-center divide-x overflow-x-auto" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)" }}>
          {FILTER_ITEMS.map((f) => (
            <div key={f.label} className="flex-1 px-4 py-2 min-w-[120px]">
              <div className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>{f.label}</div>
              <div className="text-xs" style={{ color: "#c0392b" }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className="grid grid-cols-12 gap-3" style={{ height: isFullscreen ? "calc(100vh - 140px)" : 560 }}>
        {/* Left Panel: Stats + Crime Incidents */}
        <div className="col-span-3 flex flex-col gap-3 overflow-hidden">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Total Crime", value: "12,509", color: "#1565C0" },
              { label: "Violent Crime", value: "1,053", color: "#c62828" },
              { label: "Property Crime", value: "4,701", color: "#1565C0" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg p-3 text-center" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
                <div className="text-[10px] font-medium" style={{ color: "var(--color-text-secondary)" }}>{s.label}</div>
                <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[8px]" style={{ color: "var(--color-text-muted)" }}>In visible map extent</div>
              </div>
            ))}
          </div>

          {/* Crime Incidents List */}
          <div className="flex-1 rounded-lg overflow-hidden flex flex-col" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
            <div className="px-4 pt-3 pb-1 text-center">
              <h4 className="text-base font-bold" style={{ color: "#1565C0" }}>Crime Incidents</h4>
              <p className="text-[10px]" style={{ color: "#c0392b" }}>Most recent data is from 7 days before yesterday</p>
            </div>
            <div className="px-3 py-2">
              <div className="flex items-center rounded px-2 py-1.5" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>
                <span className="text-xs mr-2" style={{ color: "var(--color-text-muted)" }}>🔍</span>
                <input type="text" placeholder="Search..." className="flex-1 text-xs bg-transparent outline-none" style={{ color: "var(--color-text-primary)" }} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-2">
              {MOCK_INCIDENTS.map((inc, idx) => (
                <div key={idx} className="py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <div className="text-xs font-bold" style={{ color: "var(--color-text-primary)" }}>{inc.title}</div>
                  <div className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>{inc.subtitle}</div>
                  <div className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>{inc.datetime}</div>
                  <div className="flex items-start gap-2 mt-2">
                    <div className="w-8 h-8 rounded flex items-center justify-center text-white text-sm flex-shrink-0" style={{ background: inc.iconColor }}>{inc.icon}</div>
                    <div className="flex-1">
                      <div className="text-[10px]" style={{ color: "var(--color-text-primary)" }}>📍 Address: <b>{inc.address}</b></div>
                      <div className="text-[10px]" style={{ color: "var(--color-text-primary)" }}>📅 Date of Occurrence: <b>{inc.occurrence}</b></div>
                      <div className="text-[10px] mt-1" style={{ color: "#c0392b" }}>
                        Description: <b>{inc.description}</b>
                      </div>
                      <div className="text-[10px]" style={{ color: "#c0392b" }}>
                        RD <b>{inc.rd}</b> | IUCR <b>{inc.iucr}</b>
                      </div>
                      <div className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                        Beat {inc.beat} | Ward {inc.ward} | Community <b>{inc.community}</b>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Bottom tabs */}
            <div className="flex" style={{ borderTop: "1px solid var(--color-border)" }}>
              {["Crime Incidents", "Strategic Plans"].map((t) => (
                <button key={t} onClick={() => setBottomTab(t)} className="flex-1 px-3 py-2 text-xs font-medium transition-all" style={{
                  background: bottomTab === t ? "var(--color-bg-card)" : "var(--color-bg-surface)",
                  color: bottomTab === t ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  borderBottom: bottomTab === t ? "2px solid #1565C0" : "2px solid transparent",
                }}>{t}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Center Map */}
        <div className="col-span-6 relative rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
          <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom className="w-full h-full" style={{ background: "#eff1f1" }} zoomControl={false}>
            <MapRefSetter mapRefCb={setMapRef} />
            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
            {districts.filter(d => d.boundary).map(d => (
              <GeoJSON
                key={d.district_id}
                data={d.boundary}
                style={{ fillColor: "transparent", fillOpacity: 0, color: "#222", weight: 2 }}
                onEachFeature={(feature, layer) => {
                  const count = countsMap.get(d.district_id) || 450;
                  layer.bindPopup(
                    `<div style="font-size:13px;line-height:1.6;padding:2px 4px;"><b>District:</b> ${d.district_id}<br/><b>Incidents:</b> ${count.toLocaleString()}</div>`
                  );
                  layer.on({
                    mouseover: (e) => e.target.setStyle({ weight: 3, color: "#000" }),
                    mouseout: (e) => e.target.setStyle({ weight: 2, color: "#222" }),
                  });
                }}
              />
            ))}
            {crimeMarkers.map(m => {
              const sz = Math.max(24, Math.min(44, 18 + m.count / 30));
              return (
                <Marker
                  key={m.id}
                  position={[m.lat, m.lon]}
                  icon={L.divIcon({
                    html: `<div style="
                      background:${m.color};width:${sz}px;height:${sz}px;border-radius:50%;
                      display:flex;align-items:center;justify-content:center;
                      color:#fff;font-weight:800;font-size:${Math.max(10, sz * 0.32)}px;
                      border:2px solid rgba(255,255,255,0.7);
                      box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:pointer;
                    ">${m.count}</div>`,
                    className: "",
                    iconSize: [sz, sz],
                    iconAnchor: [sz / 2, sz / 2],
                  })}
                />
              );
            })}
          </MapContainer>
          <MapZoomControls onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onReset={handleReset} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />
          {/* Bottom map tabs */}
          <div className="absolute bottom-0 left-0 z-[500] flex bg-white rounded-tr-lg shadow" style={{ border: "1px solid var(--color-border)" }}>
            {["Crime Map", "Crime Statistics"].map((t, i) => (
              <button key={t} className="px-4 py-2 text-xs font-medium" style={{
                color: i === 0 ? "#1565C0" : "var(--color-text-muted)",
                borderBottom: i === 0 ? "2px solid #1565C0" : "none",
              }}>{t}</button>
            ))}
          </div>
        </div>

        {/* Right Legend Panel */}
        <div className="col-span-3 overflow-y-auto rounded-lg p-4" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
          <h4 className="text-sm font-bold mb-3" style={{ color: "var(--color-text-primary)" }}>Crime</h4>

          <p className="text-xs font-semibold mb-2" style={{ color: "#c0392b" }}>Violent Crime (Index)</p>
          <div className="space-y-1.5 mb-4">
            {VIOLENT_LEGEND.map((item) => (
              <div key={item.code} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: item.color }}>
                  <span className="text-white text-[8px] font-bold">!</span>
                </div>
                <span className="text-xs" style={{ color: "var(--color-text-primary)" }}>{item.code} - {item.label}</span>
              </div>
            ))}
          </div>

          <p className="text-xs font-semibold mb-2" style={{ color: "#1565C0" }}>Property Crime (Index)</p>
          <div className="space-y-1.5 mb-4">
            {PROPERTY_LEGEND.map((item) => (
              <div key={item.code} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs" style={{ color: "var(--color-text-primary)" }}>{item.code} - {item.label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-4">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "#FDD835" }} />
            <span className="text-xs" style={{ color: "#c0392b" }}>Other Crimes (Non-Index)</span>
          </div>

          <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>Number of features</p>
          <div className="space-y-2 mb-4">
            {FEATURE_SIZES.map((item) => (
              <div key={item.count} className="flex items-center gap-2">
                <div className="rounded-full flex items-center justify-center text-white font-bold" style={{ width: item.size, height: item.size, backgroundColor: item.color, fontSize: Math.max(8, item.size * 0.35) }}></div>
                <span className="text-xs" style={{ color: "var(--color-text-primary)" }}>{item.count}</span>
              </div>
            ))}
          </div>

          <div className="border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
            <p className="text-xs font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>Police Beats</p>
            <div className="w-8 h-8 border-2 border-dashed rounded" style={{ borderColor: "#1565C0" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CrimesSection() {
  const [subTab, setSubTab] = useState("Map Area Crime");

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex items-center gap-0 mb-6 rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
        {CRIME_SUB_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className="flex-1 px-4 py-2.5 text-sm font-medium transition-all duration-200 relative"
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

export default function SummarySection({ activeTab = "Police Districts" }) {
  const [timeFrame, setTimeFrame] = useState("Last 30 days");
  const [selectedCrimes, setSelectedCrimes] = useState([]);   // crime type names

  // Geographic selection states
  const [selectedDistricts, setSelectedDistricts] = useState([]);
  const [selectedWards, setSelectedWards] = useState([]);
  const [selectedBeats, setSelectedBeats] = useState([]);

  const [appliedFilters, setAppliedFilters] = useState({
    timeFrame: "Last 30 days",
    selectedCrimes: [],
    selectedDistricts: [],
    selectedWards: [],
    selectedBeats: [],
  });
  const [lastTab, setLastTab] = useState(activeTab);

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
      setTimeFrame("Last 30 days");

      setAppliedFilters({
        timeFrame: "Last 30 days",
        selectedCrimes: [],
        selectedDistricts: [],
        selectedWards: [],
        selectedBeats: [],
      });

      setGeoSummary({ total_incidents: 0, items: [] });
      setCrimeTypes([]);
      setDateData([]);
      setKpiData(null);

      setLastTab(activeTab);
    }
  }, [activeTab, lastTab]);

  // Derived dates based on applied timeframe
  const { dateFrom, dateTo } = useMemo(() => timeFrameToDates(appliedFilters.timeFrame), [appliedFilters.timeFrame]);

  // ── API data state ──
  const [geoSummary, setGeoSummary] = useState({ total_incidents: 0, items: [] });
  const [crimeTypes, setCrimeTypes] = useState([]);
  const [dateData, setDateData] = useState([]);
  const [kpiData, setKpiData] = useState(null);

  const [loadingGeo, setLoadingGeo] = useState(false);
  const [loadingCrimes, setLoadingCrimes] = useState(false);
  const [loadingDate, setLoadingDate] = useState(false);
  const [loadingKpi, setLoadingKpi] = useState(false);

  // Build filter params for API calls based on applied values
  const geoFilterParams = useMemo(() => {
    if (level === "ward") return { wardIds: appliedFilters.selectedWards };
    if (level === "district") return { districtIds: appliedFilters.selectedDistricts };
    if (level === "beat") return { districtIds: appliedFilters.selectedDistricts, beatIds: appliedFilters.selectedBeats };
    return {};
  }, [level, appliedFilters.selectedDistricts, appliedFilters.selectedWards, appliedFilters.selectedBeats]);

  const crimeTypeIds = useMemo(
    () => appliedFilters.selectedCrimes.map((name) => name.toLowerCase().replace(/\s+/g, "_")),
    [appliedFilters.selectedCrimes]
  );

  // ── Fetching Logic ──

  // 1. Fetch geo summary (the core data for the active tab)
  useEffect(() => {
    setLoadingGeo(true);
    fetchGeospatialSummary({
      level,
      dateFrom,
      dateTo,
      ...geoFilterParams,
      ...(crimeTypeIds.length ? { crimeTypeIds } : {}),
    })
      .then((data) => setGeoSummary(data))
      .finally(() => setLoadingGeo(false));
  }, [level, dateFrom, dateTo, crimeTypeIds, geoFilterParams]);

  // 2. Fetch District list context (used for the District filter in Beats tab)
  const [districtMeta, setDistrictMeta] = useState({ items: [] });
  useEffect(() => {
    fetchGeospatialSummary({ level: "district", dateFrom, dateTo, ...(crimeTypeIds.length ? { crimeTypeIds } : {}) })
      .then(setDistrictMeta);
  }, [dateFrom, dateTo, crimeTypeIds]);

  // 3. Fetch crime type breakdown
  useEffect(() => {
    setLoadingCrimes(true);
    fetchIncidentsByCrimeType({ dateFrom, dateTo, ...geoFilterParams })
      .then((data) => setCrimeTypes(data))
      .finally(() => setLoadingCrimes(false));
  }, [dateFrom, dateTo, geoFilterParams]);

  // 4. Fetch trend data
  useEffect(() => {
    setLoadingDate(true);
    fetchIncidentsByDate({
      dateFrom,
      dateTo,
      ...geoFilterParams,
      ...(crimeTypeIds.length ? { crimeTypeIds } : {}),
    })
      .then((data) => setDateData(data))
      .finally(() => setLoadingDate(false));
  }, [dateFrom, dateTo, geoFilterParams, crimeTypeIds]);

  // 5. Fetch KPIs
  useEffect(() => {
    setLoadingKpi(true);
    fetchSummaryKPIs({
      dateFrom,
      dateTo,
      ...geoFilterParams,
      ...(crimeTypeIds.length ? { crimeTypeIds } : {}),
    })
      .then((data) => setKpiData(data))
      .finally(() => setLoadingKpi(false));
  }, [dateFrom, dateTo, geoFilterParams, crimeTypeIds]);

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
    let list = geoSummary.items;

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

  // Calculate sum for the KPI overlay (Theft vs Total etc)
  const calculatedTotalCount = useMemo(() => {
    // If we have an explicit selection at the current level, sum only those
    if (currentSelectedIds.length > 0) {
      return geoSummary.items
        .filter(i => currentSelectedIds.includes(i.id))
        .reduce((sum, i) => sum + i.crime_count, 0);
    }
    // Otherwise, it's the total returned by the API (which is already filtered by context)
    return geoSummary.total_incidents || 0;
  }, [geoSummary, currentSelectedIds]);

  // Crime chart data
  const filteredCrimeChartData = useMemo(() => {
    if (appliedFilters.selectedCrimes.length === 0) return crimeTypes;
    return crimeTypes.filter((ct) => appliedFilters.selectedCrimes.includes(ct.name));
  }, [crimeTypes, appliedFilters.selectedCrimes]);

  // Map support — build countsMap using the SAME normaliseId so boundary and summary IDs always match
  const countsMap = useMemo(() => {
    const m = new Map();
    geoSummary.items.forEach((item) => {
      // Insert both the raw id AND the normalised id so any format mismatch is absorbed
      const rawId = item.id ?? item.ward_id ?? item.district_id ?? item.beat_num;
      const normId = normaliseId(rawId, level);
      if (rawId != null) m.set(String(rawId).trim(), item.crime_count);
      if (normId) m.set(normId, item.crime_count);
    });
    return m;
  }, [geoSummary.items, level]);

  const choroplethBins = useMemo(() => buildBins(geoSummary.items), [geoSummary.items]);

  // Filter Panel Props
  const mainFilterItems = useMemo(
    () => geoSummary.items.map((item) => ({
      id: item.id,
      name: item.name ?? item.id,
      count: item.crime_count,
    })),
    [geoSummary.items]
  );

  const districtContextItems = useMemo(
    () => districtMeta.items.map((item) => ({
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
    setAppliedFilters({
      timeFrame,
      selectedCrimes,
      selectedDistricts,
      selectedWards,
      selectedBeats,
    });
  };

  const tabConfig = TAB_LABELS[activeTab] || TAB_LABELS["Police Districts"];

  if (activeTab === "Crimes") {
    return <CrimesSection />;
  }

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
        }
        .leaflet-popup-tip {
          background: #2d2d2d !important;
        }
      `}</style>

      {/* Visual Charts Row */}
      <div className="grid grid-cols-12 gap-4 mb-6">
        <div className="col-span-3">
          <FiltersPanel
            selectedTimeFrame={timeFrame}
            onTimeFrameChange={(tf) => {
              setTimeFrame(tf);
              setAppliedFilters(prev => ({ ...prev, timeFrame: tf }));
            }}
            crimeTypes={crimeTypes}
            selectedCrimes={selectedCrimes}
            onToggleCrime={toggleCrime}
            onApply={applyFilters}
            onReset={() => setSelectedCrimes([])}
          />
        </div>
        <div className="col-span-4">
          <CrimeTypeChart data={filteredCrimeChartData} loading={loadingCrimes} />
        </div>
        <div className="col-span-5">
          <GeoChart data={filteredGeoChartData} title={tabConfig.chartTitle} loading={loadingGeo} />
        </div>
      </div>

      {/* Geospatial Filter Panels and Date Trend */}
      <div className="grid grid-cols-12 gap-4 mb-6">
        <div className="col-span-3">
          {isBeatsTab ? (
            <div className="flex flex-col gap-4">
              <GeoFilterPanel
                filterLabel="District"
                items={districtContextItems}
                selectedIds={selectedDistricts}
                onToggle={(id) => setSelectedDistricts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                onApply={applyFilters}
                onReset={() => setSelectedDistricts([])}
                compact
              />
              <GeoFilterPanel
                filterLabel="Beat"
                items={mainFilterItems}
                selectedIds={selectedBeats}
                onToggle={(id) => setSelectedBeats(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                onApply={applyFilters}
                onReset={() => setSelectedBeats([])}
                compact
              />
            </div>
          ) : (
            <GeoFilterPanel
              filterLabel={tabConfig.filterLabel}
              items={mainFilterItems}
              selectedIds={isDistrictsTab ? selectedDistricts : (isWardsTab ? selectedWards : [])}
              onToggle={(id) => {
                if (isDistrictsTab) setSelectedDistricts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                if (isWardsTab) setSelectedWards(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
              }}
              onApply={applyFilters}
              onReset={() => {
                if (isDistrictsTab) setSelectedDistricts([]);
                if (isWardsTab) setSelectedWards([]);
              }}
            />
          )}
        </div>
        <div className="col-span-9">
          <IncidentsByDateChart data={dateData} loading={loadingDate} />
        </div>
      </div>

      {/* Map Content */}
      <div className="grid grid-cols-12 gap-4 mb-6">
        <div className="col-span-12">
          <MapPanel
            activeTab={activeTab}
            countsMap={countsMap}
            kpiData={{ ...kpiData, total_incidents: calculatedTotalCount }}
            bins={choroplethBins}
            selectedIds={currentSelectedIds}
          />
        </div>
      </div>
    </>
  );
}
