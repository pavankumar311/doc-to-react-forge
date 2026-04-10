import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Filter, MapPin, Home, Copy, SquareStack, ZoomIn, ZoomOut, Maximize, Minimize } from "lucide-react";
import GscipCard from "./GscipCard";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
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

function DistrictChart({ data }) {
  return (
    <GscipCard>
      <div className="flex items-center gap-2 mb-4">
        <MapPin size={18} style={{ color: "var(--color-text-secondary)" }} />
        <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Incidents by District</h3>
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

function DistrictFilterPanel({ districts, selectedDistricts, onToggleDistrict, onApply, onReset }) {
  return (
    <GscipCard>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>District</h3>
        <button onClick={onReset} className="text-xs font-medium" style={{ color: "var(--color-azure)" }}>Reset</button>
      </div>
      <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
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
        className="w-full py-2 rounded-md text-sm font-medium text-white mt-4"
        style={{ background: "var(--color-cobalt)" }}
      >
        Apply
      </button>
      <p className="text-[11px] mt-3" style={{ color: "var(--color-text-muted)" }}>
        Counts do not update with filtering; are for past 365 days.
      </p>
    </GscipCard>
  );
}

function IncidentsByDateChart({ data }) {
  return (
    <GscipCard>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">📅</span>
        <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Incidents by Date</h3>
      </div>
      <ResponsiveContainer width="100%" height={360}>
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

function MapPanel({ totalIncidents }) {
  const [districts, setDistricts] = useState([]);

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

      <div className="relative rounded bg-[#eff1f1] border border-gray-200 overflow-hidden" style={{ height: 620 }}>
        <MapContainer 
          center={[41.83, -87.72]} 
          zoom={10.5} 
          scrollWheelZoom={false} 
          className="w-full h-full bg-[#eff1f1]"
          zoomControl={false}
        >
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

        {/* Home Button Overlay */}
        <div className="absolute top-4 left-4 z-[500] bg-white p-2 rounded shadow flex items-center justify-center cursor-pointer hover:bg-gray-50 border border-gray-100 text-gray-500">
          <Home size={20} />
        </div>

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

export default function SummarySection() {
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

  const totalIncidents = MOCK_CRIME_TYPES.reduce((sum, c) => sum + c.count, 0);

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
          <DistrictChart data={MOCK_DISTRICTS} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 mb-6">
        <div className="col-span-3">
          <DistrictFilterPanel
            districts={MOCK_DISTRICTS}
            selectedDistricts={selectedDistricts}
            onToggleDistrict={toggleDistrict}
            onApply={applyDistricts}
            onReset={resetDistricts}
          />
        </div>
        <div className="col-span-9">
          <IncidentsByDateChart data={MOCK_DATE_DATA} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 mb-6">
        <div className="col-span-12">
          <MapPanel totalIncidents={totalIncidents} />
        </div>
      </div>
    </>
  );
}
