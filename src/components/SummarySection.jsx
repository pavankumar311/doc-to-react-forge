import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Filter, MapPin, Home, Copy, SquareStack, ZoomIn, ZoomOut, Maximize, Minimize } from "lucide-react";
import GscipCard from "./GscipCard";
import { MapContainer, TileLayer, GeoJSON, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { AUTH_TOKEN } from "../services/api";

const MOCK_CRIME_TYPES = [
  { name: "Aggravated Battery", count: 7031 },
  { name: "Aggravated Assault", count: 6406 },
  { name: "Robbery", count: 5383 },
  { name: "Criminal Sexual Assault", count: 1761 },
  { name: "Homicide", count: 398 },
];

const MOCK_DISTRICTS = [
  { name: "001", count: 807 },
  { name: "002", count: 950 },
  { name: "003", count: 1531 },
  { name: "004", count: 1524 },
  { name: "005", count: 1100 },
  { name: "006", count: 1540 },
  { name: "007", count: 1285 },
  { name: "008", count: 1241 },
  { name: "009", count: 1164 },
  { name: "010", count: 1031 },
  { name: "011", count: 1537 },
  { name: "012", count: 1122 },
  { name: "014", count: 680 },
  { name: "015", count: 1051 },
  { name: "016", count: 450 },
  { name: "017", count: 530 },
  { name: "018", count: 870 },
  { name: "019", count: 750 },
  { name: "020", count: 490 },
  { name: "022", count: 410 },
  { name: "024", count: 500 },
  { name: "025", count: 890 },
];

const MOCK_BEATS = [
  { name: "0111", count: 312 },
  { name: "0112", count: 278 },
  { name: "0231", count: 431 },
  { name: "0232", count: 395 },
  { name: "0311", count: 520 },
  { name: "0412", count: 488 },
  { name: "0511", count: 370 },
  { name: "0611", count: 560 },
  { name: "0712", count: 415 },
  { name: "0813", count: 339 },
  { name: "0911", count: 402 },
  { name: "1011", count: 295 },
  { name: "1112", count: 511 },
  { name: "1213", count: 348 },
];

const MOCK_WARDS = [
  { name: "Ward 1", count: 620 },
  { name: "Ward 2", count: 710 },
  { name: "Ward 3", count: 540 },
  { name: "Ward 4", count: 890 },
  { name: "Ward 5", count: 960 },
  { name: "Ward 6", count: 1020 },
  { name: "Ward 7", count: 830 },
  { name: "Ward 8", count: 750 },
  { name: "Ward 9", count: 680 },
  { name: "Ward 10", count: 590 },
  { name: "Ward 11", count: 870 },
  { name: "Ward 12", count: 490 },
];

const TAB_DATA = {
  "Police Districts": { data: MOCK_DISTRICTS, chartTitle: "Incidents by District", filterLabel: "District" },
  "Police Beats":    { data: MOCK_BEATS,     chartTitle: "Incidents by Beats",    filterLabel: "Beat" },
  "Wards":           { data: MOCK_WARDS,     chartTitle: "Incidents by Wards",    filterLabel: "Ward" },
  "Community Areas": { data: MOCK_DISTRICTS, chartTitle: "Incidents by District", filterLabel: "Community Area" },
};

const MOCK_DATE_DATA = [
  { date: "2025-04-01", count: 390 },
  { date: "2025-04-08", count: 420 },
  { date: "2025-04-15", count: 435 },
  { date: "2025-04-22", count: 460 },
  { date: "2025-04-29", count: 480 },
  { date: "2025-05-06", count: 520 },
  { date: "2025-05-13", count: 540 },
  { date: "2025-05-20", count: 500 },
  { date: "2025-05-27", count: 470 },
  { date: "2025-06-03", count: 440 },
  { date: "2025-06-10", count: 430 },
  { date: "2025-06-17", count: 405 },
];

const TIME_FRAMES = ["Last 30 days", "Last 90 days", "Last 365 days"];

const BAR_COLOR = "#7A8A9E";

const tooltipStyle = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  fontSize: 12,
  color: "var(--color-text-primary)",
};

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
        <div className="space-y-2">
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

function CrimeTypeChart({ data }) {
  return (
    <GscipCard>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">⚙</span>
        <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Incidents by Crime Type</h3>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 50, top: 5, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => v.length > 15 ? v.slice(0, 14) + "…" : v}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={28} label={{ position: "right", fontSize: 11, fill: "var(--color-text-primary)", formatter: (v) => v.toLocaleString() }}>
            {data.map((_, i) => (
              <Cell key={i} fill={BAR_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-center text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Reported Incidents</p>
    </GscipCard>
  );
}

function DistrictChart({ data, title }) {
  return (
    <GscipCard>
      <div className="flex items-center gap-2 mb-4">
        <MapPin size={18} style={{ color: "var(--color-text-secondary)" }} />
        <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>{title}</h3>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 50, top: 5, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={40}
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={22} label={{ position: "right", fontSize: 11, fill: "var(--color-text-primary)", formatter: (v) => v.toLocaleString() }}>
            {data.map((_, i) => (
              <Cell key={i} fill={BAR_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-center text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Reported Incidents</p>
    </GscipCard>
  );
}

function DistrictFilterPanel({ districts, selectedDistricts, onToggleDistrict, onApply, onReset, filterLabel, compact }) {
  return (
    <GscipCard style={compact ? { paddingTop: 12, paddingBottom: 12 } : {}}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>{filterLabel || "District"}</h3>
        <button onClick={onReset} className="text-xs font-medium" style={{ color: "var(--color-azure)" }}>Reset</button>
      </div>
      <div className={`space-y-2 overflow-y-auto pr-2 ${compact ? "max-h-36" : "max-h-80"}`}>
        {districts.map((district) => (
          <label key={district.name} className="flex items-center justify-between cursor-pointer group">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedDistricts.includes(district.name)}
                onChange={() => onToggleDistrict(district.name)}
                className="rounded"
                style={{ accentColor: "var(--color-cobalt)" }}
              />
              <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>{district.name}</span>
            </div>
            <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>{district.count.toLocaleString()}</span>
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
      {/* {!compact && (
        <p className="text-[11px] mt-3" style={{ color: "var(--color-text-muted)" }}>
          Counts do not update with filtering; are for past 365 days.
        </p>
      )} */}
    </GscipCard>
  );
}

function IncidentsByDateChart({ data, chartHeight = 360 }) {
  return (
    <GscipCard style={{ height: "100%" }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">📅</span>
        <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Incidents by Date</h3>
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <LineChart data={data} margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "rgba(0,0,0,0.12)", strokeWidth: 2 }} />
          <Line type="monotone" dataKey="count" stroke="#1F2937" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </GscipCard>
  );
}

// Thematic Legend colors from the image
const BINS = [
  { min: 1284, max: Infinity, label: "> 1,284 - 1,537", color: "#2d4464" }, // dark blue
  { min: 1049, max: 1284, label: "> 1,049 - 1,284", color: "#547e9b" }, // darker teal
  { min: 807, max: 1049, label: "> 807 - 1,049", color: "#77a9be" }, // medium teal
  { min: 587, max: 807, label: "> 587 - 807", color: "#b9d4c6" }, // light teal
  { min: 0, max: 587, label: "307 - 587", color: "#faf1d2" }, // pale yellow
];

function getCentroid(boundary) {
  if (!boundary) return [41.84, -87.63];
  try {
    const coords = boundary.type === "Polygon" ? boundary.coordinates[0] : boundary.coordinates[0][0];
    const lats = coords.map(c => c[1]);
    const lons = coords.map(c => c[0]);
    return [lats.reduce((a, b) => a + b, 0) / lats.length, lons.reduce((a, b) => a + b, 0) / lons.length];
  } catch (e) {
    return [41.84, -87.63];
  }
}

function DropShadowPainter() {
  const map = useMap();
  useEffect(() => {
    const pane = map.getPane("overlayPane");
    if (pane) {
      pane.style.filter = "drop-shadow(6px 10px 8px rgba(0,0,0,0.5))";
    }
  }, [map]);
  return null;
}

function MapZoomControls({ onZoomIn, onZoomOut, onReset, isFullscreen, onToggleFullscreen }) {
  return (
    <div className="absolute top-4 left-4 z-[500] flex flex-col gap-1.5">
      <button
        onClick={onReset}
        className="bg-white p-2 rounded shadow flex items-center justify-center cursor-pointer hover:bg-gray-50 border border-gray-100 text-gray-500"
        title="Reset view"
      >
        <Home size={18} />
      </button>
      <button
        onClick={onZoomIn}
        className="bg-white p-2 rounded shadow flex items-center justify-center cursor-pointer hover:bg-gray-50 border border-gray-100 text-gray-500"
        title="Zoom in"
      >
        <ZoomIn size={18} />
      </button>
      <button
        onClick={onZoomOut}
        className="bg-white p-2 rounded shadow flex items-center justify-center cursor-pointer hover:bg-gray-50 border border-gray-100 text-gray-500"
        title="Zoom out"
      >
        <ZoomOut size={18} />
      </button>
      <button
        onClick={onToggleFullscreen}
        className="bg-white p-2 rounded shadow flex items-center justify-center cursor-pointer hover:bg-gray-50 border border-gray-100 text-gray-500"
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
      >
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

function MapPanel({ totalIncidents }) {
  const [districts, setDistricts] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const DEFAULT_CENTER = [41.83, -87.72];
  const DEFAULT_ZOOM = 10.5;

  const setMapRef = useCallback((map) => { mapRef.current = map; }, []);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleReset = () => {
    if (mapRef.current) {
      mapRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
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
        if (data && data.features) {
          // Deduplicate by dist_num (keep first occurrence)
          const seen = new Set();
          const mappedDistricts = [];
          for (const f of data.features) {
            const rawId = f.properties.dist_num || f.properties.district || f.properties.DIST_NUM || f.properties.DISTRICT;
            const id = rawId ? String(rawId).padStart(3, '0') : "000";
            if (seen.has(id)) continue;
            seen.add(id);
            mappedDistricts.push({
              district_id: id,
              boundary: { type: "Feature", geometry: f.geometry, properties: {} }
            });
          }
          setDistricts(mappedDistricts);
        }
      } catch (e) {
        console.error("Failed to load local districts GeoJSON", e);
      }
    };
    fetchDistricts();
  }, []);

  const countsMap = useMemo(() => {
    const map = new Map();
    MOCK_DISTRICTS.forEach(d => map.set(d.name, d.count));
    return map;
  }, []);

  return (
    <GscipCard className="relative bg-[#e8e9ea]">
      {/* Header spanning above Map */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl text-gray-500 tracking-wide font-medium">Map of Incidents</h3>
        <div className="flex items-center gap-3 text-gray-400">
          <Copy size={16} className="cursor-pointer hover:text-gray-600" />
          <SquareStack size={16} className="cursor-pointer hover:text-gray-600" />
        </div>
      </div>

      <div ref={containerRef} className={`relative rounded bg-[#eff1f1] border border-gray-200 overflow-hidden ${isFullscreen ? '' : ''}`} style={{ height: isFullscreen ? '100vh' : 620 }}>
        <MapContainer 
          center={DEFAULT_CENTER} 
          zoom={DEFAULT_ZOOM} 
          scrollWheelZoom={true} 
          className="w-full h-full bg-[#eff1f1]"
          zoomControl={false}
        >
          <MapRefSetter mapRefCb={setMapRef} />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          />
          <DropShadowPainter />
          
          {districts.filter(d => d.boundary).map(d => {
            const count = countsMap.get(d.district_id) || 450; 
            const bin = BINS.find(b => count >= b.min && count <= b.max) || BINS[4];
            
            return (
              <GeoJSON
                  key={d.district_id}
                  data={d.boundary}
                  style={{
                    fillColor: bin.color,
                    fillOpacity: 1,
                    color: "#4f504f", 
                    weight: 1,
                  }}
                  onEachFeature={(feature, layer) => {
                     const numStr = d.district_id.replace(/^0+/, '');
                     layer.bindTooltip(numStr, {
                       permanent: true,
                       direction: "center",
                       className: "bg-transparent border-0 shadow-none text-gray-700 font-semibold text-xs text-shadow-sm",
                     });
                     layer.bindPopup(
                       `<div style="font-size:13px;line-height:1.6;padding:2px 4px;">
                         <b>Police District:</b> ${d.district_id}<br/>
                         <b>Count of Incidents:</b> ${count.toLocaleString()}
                       </div>`,
                       { className: "leaflet-popup-custom" }
                     );
                     layer.on({
                       mouseover: (e) => {
                         e.target.setStyle({ weight: 3, color: "#333", fillOpacity: 0.85 });
                       },
                       mouseout: (e) => {
                         e.target.setStyle({ weight: 1, color: "#4f504f", fillOpacity: 1 });
                       },
                       click: (e) => {
                         e.target.openPopup();
                       }
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

        {/* KPI Card Overlay */}
        <div className="absolute top-8 right-8 z-[500] bg-[#e8e9eb] px-10 py-6 rounded-xl shadow-lg border border-gray-200 min-w-[240px] text-center">
          <div className="text-5xl font-extralight text-black tracking-tight">
            20,956
          </div>
          <div className="text-[13px] text-gray-500 mt-4">
            Reported Incidents
          </div>
        </div>
        <div className="absolute top-44 right-8 z-[500] text-[11px] italic text-gray-500">
          Hold Ctrl to select many
        </div>

        {/* Legend Overlay */}
        <div className="absolute bottom-6 left-6 z-[500] bg-[#e6e8ea] px-3 py-3 rounded-lg shadow-md border border-gray-200">
          <div className="space-y-1.5 min-w-[140px]">
            {BINS.map((bin, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 border border-gray-500" style={{ backgroundColor: bin.color }} />
                <span className="text-[13px] text-gray-600 font-medium">{bin.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GscipCard>
  );
}

const CRIME_SUB_TABS = ["Crime Site Information", "Map Area Crime", "Crime Dashboard"];

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
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
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

          <div className="border-t mt-4 pt-3" style={{ borderColor: "var(--color-border)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-text-secondary)" }}>Police Districts</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CrimeDashboard() {
  return (
    <GscipCard>
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>Crime Dashboard</h3>
        <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
          Use this application to view crime by geographies like CPD District, CPD Beat, Ward and Community Area. Visualize how those polygons overlap. Includes interactive graphs like time of day & day of week.
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
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs" style={{ color: "var(--color-text-primary)" }}>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>Number of Features</p>
              {[55, 40, 30].map((n) => (
                <div key={n} className="flex items-center gap-2">
                  <div className="rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ width: 12 + n * 0.3, height: 12 + n * 0.3, backgroundColor: "#C62828" }}>{n}</div>
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

function CrimesSection() {
  const [subTab, setSubTab] = useState("Crime Site Information");

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

      {subTab === "Crime Site Information" && <CrimeSiteInformation />}
      {subTab === "Map Area Crime" && <MapAreaCrime />}
      {subTab === "Crime Dashboard" && <CrimeDashboard />}
    </div>
  );
}

export default function SummarySection({ activeTab = "Police Districts" }) {
  const [timeFrame, setTimeFrame] = useState("Last 365 days");
  const [selectedCrimes, setSelectedCrimes] = useState([]);
  const [selectedDistricts, setSelectedDistricts] = useState([]);

  const toggleCrime = (name) => {
    setSelectedCrimes((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };

  const toggleDistrict = (name) => {
    setSelectedDistricts((prev) =>
      prev.includes(name) ? prev.filter((d) => d !== name) : [...prev, name]
    );
  };

  const resetCrimes = () => setSelectedCrimes([]);
  const resetDistricts = () => setSelectedDistricts([]);
  const applyCrimes = () => {};
  const applyDistricts = () => {};

  const [selectedBeats, setSelectedBeats] = useState([]);
  const toggleBeat = (name) =>
    setSelectedBeats((prev) =>
      prev.includes(name) ? prev.filter((b) => b !== name) : [...prev, name]
    );
  const resetBeats = () => setSelectedBeats([]);

  const totalIncidents = MOCK_CRIME_TYPES.reduce((sum, c) => sum + c.count, 0);

  const tabConfig = TAB_DATA[activeTab] || TAB_DATA["Police Districts"];
  const isBeatsTab = activeTab === "Police Beats";

  if (activeTab === "Crimes") {
    return <CrimesSection />;
  }

  return (
    <>
      <div className="grid grid-cols-12 gap-4 mb-6">
        <div className="col-span-3">
          <FiltersPanel
            selectedTimeFrame={timeFrame}
            onTimeFrameChange={setTimeFrame}
            crimeTypes={MOCK_CRIME_TYPES}
            selectedCrimes={selectedCrimes}
            onToggleCrime={toggleCrime}
            onApply={applyCrimes}
            onReset={resetCrimes}
          />
        </div>
        <div className="col-span-3">
          <CrimeTypeChart data={MOCK_CRIME_TYPES} />
        </div>
        <div className="col-span-6">
          <DistrictChart data={tabConfig.data} title={tabConfig.chartTitle} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 mb-6">
        {isBeatsTab ? (
          <>
            <div className="col-span-3 flex flex-col gap-4">
              <DistrictFilterPanel
                districts={MOCK_DISTRICTS}
                selectedDistricts={selectedDistricts}
                onToggleDistrict={toggleDistrict}
                onApply={applyDistricts}
                onReset={resetDistricts}
                filterLabel="District"
                compact
              />
              <DistrictFilterPanel
                districts={MOCK_BEATS}
                selectedDistricts={selectedBeats}
                onToggleDistrict={toggleBeat}
                onApply={() => {}}
                onReset={resetBeats}
                filterLabel="Beat"
                compact
              />
            </div>
            <div className="col-span-9">
              <IncidentsByDateChart data={MOCK_DATE_DATA} chartHeight={500} />
            </div>
          </>
        ) : (
          <>
            <div className="col-span-3">
              <DistrictFilterPanel
                districts={tabConfig.data}
                selectedDistricts={selectedDistricts}
                onToggleDistrict={toggleDistrict}
                onApply={applyDistricts}
                onReset={resetDistricts}
                filterLabel={tabConfig.filterLabel}
              />
            </div>
            <div className="col-span-9">
              <IncidentsByDateChart data={MOCK_DATE_DATA} />
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4 mb-6">
        <div className="col-span-12">
          <MapPanel totalIncidents={totalIncidents} />
        </div>
      </div>
    </>
  );
}
