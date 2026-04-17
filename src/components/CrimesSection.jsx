import { useState, useMemo, useEffect } from "react";
import { MapContainer, TileLayer, GeoJSON, Popup, useMap, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import {
  Search, Calendar, Filter, Layers, Map as MapIcon,
  Loader2, Info, AlertCircle, ChevronLeft, ChevronRight,
  ChevronDown
} from "lucide-react";
import {
  fetchSummaryKPIs,
  fetchMapIncidents,
  fetchWardBoundaries,
  fetchDistrictBoundaries,
  fetchPoliceBeats,
  fetchIncidentsByCrimeType,
  fetchFilterOptions,
  fetchGeospatialSummary,
  fetchIncidentsByDate,
  fetchHourlyTrends,
  fetchPlatformTrend,
  AUTH_TOKEN
} from "../services/api";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Cell, ResponsiveContainer
} from "recharts";

// ── Constants & Helpers ──────────────────────────────────────────────────

const CRIME_TYPES = {
  violent: { label: "Violent Crime (Index)", color: "#ef4444", items: ["Homicide", "Robbery", "Assault"] },
  property: { label: "Property Crime (Index)", color: "#eab308", items: ["Burglary", "Theft", "Arson"] },
  other: { label: "Other Crimes (Non-Index)", color: "#3b82f6", items: ["All Other Crimes"] },
};

function getCategoryColor(type = "") {
  const t = (type || "").toLowerCase();
  if (t === "violent") return { color: "#ef4444", border: "#7f1d1d" };
  if (t === "property") return { color: "#eab308", border: "#78350f" };
  return { color: "#3b82f6", border: "#1e3a8a" };
}

function createClusterIcon(count, color) {
  const isCluster = count > 1;
  const size = isCluster
    ? Math.max(34, Math.min(52, 30 + Math.sqrt(count) * 1.5))
    : 14;

  const html = isCluster ? `
    <div style="
      width: ${size}px; height: ${size}px;
      border-radius: 50%; background: ${color};
      border: 2px solid white;
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: ${size < 40 ? '11px' : '13px'};
      font-weight: 900; box-shadow: 0 0 10px ${color}88, 0 2px 6px rgba(0,0,0,0.4);
    ">
      ${count.toLocaleString()}
    </div>
  ` : `
    <div style="
      width: ${size}px; height: ${size}px;
      border-radius: 50%; background: ${color};
      border: 1.5px solid white;
      box-shadow: 0 0 8px ${color}aa, 0 1px 4px rgba(0,0,0,0.3);
    "></div>
  `;

  return L.divIcon({
    html,
    className: "forensic-point",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

// ── Components ───────────────────────────────────────────────────────────

function LoadingOverlay({ message = "Calibrating Forensic Map..." }) {
  return (
    <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-white/70 backdrop-blur-md">
      <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
      <span className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em]">{message}</span>
    </div>
  );
}

// ── Main Page Logic ──────────────────────────────────────────────────────

export default function CrimesSection() {
  const [activeTab, setActiveTab] = useState("Map Area Crime");
  const [zoom, setZoom] = useState(11);
  const [addressSearch, setAddressSearch] = useState("");

  // Filters
  const [filters, setFilters] = useState({
    district: "All",
    crimeToggles: { violent: true, property: true, other: true },
    layers: { ward: true, district: true, beat: true },
    dateRange: "Last 30 Days"
  });

  // Data State
  const [kpis, setKpis] = useState({ total: 0, violent: 0, property: 0, other: 0 });
  const [incidents, setIncidents] = useState([]);
  const [crimeTypeData, setCrimeTypeData] = useState([]);
  const [beatRanking, setBeatRanking] = useState([]);
  const [wardRanking, setWardRanking] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [dowData, setDowData] = useState([]);
  const [trendSeries, setTrendSeries] = useState([]);
  const [boundaries, setBoundaries] = useState({ ward: null, district: null, beat: null });
  const [districts, setDistricts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Initial Data Load
  useEffect(() => {
    async function init() {
      try {
        const [wardRes, districtRes, beatRes] = await Promise.all([
          fetchWardBoundaries(), fetchDistrictBoundaries(), fetchPoliceBeats()
        ]);

        const toFC = (arr, idKey) => {
          if (!arr || !Array.isArray(arr)) return null;
          return {
            type: "FeatureCollection",
            features: arr.map(f => ({
              type: "Feature",
              id: f[idKey] || f.id,
              geometry: typeof f.boundary === 'string' ? JSON.parse(f.boundary) : f.boundary,
              properties: { ...f }
            }))
          };
        };

        setBoundaries({
          ward: toFC(wardRes, "ward_id"),
          district: toFC(districtRes, "district_id"),
          beat: toFC(beatRes, "beat_id")
        });

        if (districtRes && Array.isArray(districtRes)) {
          setDistricts(districtRes.map(d => ({ id: d.district_id, name: d.district_name || `District ${d.district_id}` })).sort((a,b) => a.id - b.id));
        }
      } catch (err) { console.error("Boundary init failed:", err); }
    }
    init();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Sync with backend calendar to avoid "empty future" data
      let dateToObj = new Date();
      try {
        const filterMeta = await fetchFilterOptions();
        if (filterMeta?.date_range?.max_date) {
          dateToObj = new Date(filterMeta.date_range.max_date);
        }
      } catch (e) { console.warn("Calendar sync failed, using system clock:", e); }

      const dateTo = dateToObj.toISOString().split("T")[0];
      const intervalDays = filters.dateRange === "Last 30 Days" ? 30 : 90;
      const dateFrom = new Date(dateToObj.getTime() - intervalDays * 86400000).toISOString().split("T")[0];

      const q = { 
        dateFrom, 
        dateTo, 
        limit: 1200,
        districtIds: filters.district !== "All" ? [filters.district] : undefined
      };
      const [summary, types, mapPoints, beatSummary, wardSummary, trends, hourlyRes, platformTrend] = await Promise.all([
        fetchSummaryKPIs(q), 
        fetchIncidentsByCrimeType(q), 
        fetchMapIncidents(q),
        fetchGeospatialSummary({ ...q, level: "beat" }),
        fetchGeospatialSummary({ ...q, level: "ward" }),
        fetchIncidentsByDate(q),
        fetchHourlyTrends({ dateFrom: q.dateFrom, dateTo: q.dateTo, districtIds: q.districtIds }),
        fetchPlatformTrend({ dateFrom: q.dateFrom, dateTo: q.dateTo })
      ]);

      let v = 0, p = 0, o = 0;
      types.forEach(item => {
        const c = (item.category || "").toLowerCase();
        if (c === "violent") v += item.count;
        else if (c === "property") p += item.count;
        else o += item.count;
      });

      setKpis({ total: summary.total_incidents || 0, violent: v, property: p, other: o });
      setCrimeTypeData(types);
      setBeatRanking((beatSummary.items || []).slice(0, 10));
      setWardRanking((wardSummary.items || []).slice(0, 10));
      setTrendSeries(platformTrend);

      // Build Hourly (Time of Day) data from real API
      const hours = Array.from({ length: 24 }, (_, i) => ({ 
        label: i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i-12} PM`,
        count: 0 
      }));
      (hourlyRes.data || []).forEach(cell => {
        if (cell.hour_of_day >= 0 && cell.hour_of_day < 24) {
          hours[cell.hour_of_day].count += cell.crime_count;
        }
      });
      setHourlyData(hours);

      // Build Day-of-Week data from real API (0=Sun…6=Sat)
      const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dowCounts = Array(7).fill(0);
      (hourlyRes.data || []).forEach(cell => {
        if (cell.day_of_week >= 0 && cell.day_of_week < 7) {
          dowCounts[cell.day_of_week] += cell.crime_count;
        }
      });
      setDowData(DOW_LABELS.map((name, i) => ({ name, count: dowCounts[i] })));

      // Explicit float casting and Chicago bounds safety
      const points = (mapPoints || []).map(i => ({
        ...i,
        lat: parseFloat(i.latitude),
        lng: parseFloat(i.longitude)
      })).filter(i => i.lat > 41.6 && i.lat < 42.1 && i.lng < -87.5 && i.lng > -87.9);

      setIncidents(points);
    } catch (err) { console.error("Data load failed:", err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [filters.dateRange, filters.district]);

  const reactiveKpis = useMemo(() => {
    const v = filters.crimeToggles.violent ? kpis.violent : 0;
    const p = filters.crimeToggles.property ? kpis.property : 0;
    const o = filters.crimeToggles.other ? kpis.other : 0;
    return { total: v + p + o, violent: v, property: p, other: o };
  }, [kpis, filters.crimeToggles]);


  // Precision mapping: Higher zoom = Smaller grid (0.01 at z11, 0.0002 at z17)
  // Precision mapping: Higher zoom = Larger cells (Clustered) 
  // Zoom 10 (City) -> Large cells (High Counts e.g. 50+)
  // Zoom 16 (Street) -> Individual points
  const gridSize = useMemo(() => {
    if (zoom <= 10) return 0.025;
    if (zoom <= 11) return 0.012;
    if (zoom <= 13) return 0.005;
    if (zoom <= 15) return 0.0015;
    return 0.0002;
  }, [zoom]);

  const spatialClusters = useMemo(() => {
    const raw = incidents.filter(i => {
      const c = (i.category || "").toLowerCase();
      if (c === "violent") return filters.crimeToggles.violent;
      if (c === "property") return filters.crimeToggles.property;
      return filters.crimeToggles.other;
    });

    if (raw.length === 0) return [];

    const clusters = {};
    raw.forEach(inc => {
      const glat = Math.floor(inc.lat / gridSize) * gridSize + gridSize / 2;
      const glng = Math.floor(inc.lng / gridSize) * gridSize + gridSize / 2;
      const key = `${glat.toFixed(4)}|${glng.toFixed(4)}`;
      if (!clusters[key]) clusters[key] = { lat: glat, lng: glng, count: 0, category: inc.category, incidents: [] };
      clusters[key].count++;
      clusters[key].incidents.push(inc);
    });
    return Object.values(clusters);
  }, [incidents, filters.crimeToggles, gridSize]);

  return (
    <div className="space-y-6">
      {/* Top Header with KPIs and View Switcher */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          {["Map Area Crime", "Crime Dashboard"].map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === t 
                  ? "bg-blue-600 text-white shadow-md shadow-blue-200" 
                  : "bg-white text-slate-400 border border-slate-200 hover:border-blue-400"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Crimes", val: reactiveKpis.total, color: "text-blue-900", bg: "bg-white" },
            { label: "Violent Crimes", val: reactiveKpis.violent, color: "text-red-500", bg: "bg-white" },
            { label: "Property Crimes", val: reactiveKpis.property, color: "text-amber-500", bg: "bg-white" },
            { label: "Other Crimes", val: reactiveKpis.other, color: "text-slate-800", bg: "bg-white" }
          ].map((k, i) => (
            <div key={i} className={`${k.bg} border border-slate-200 p-6 rounded-2xl shadow-sm text-center flex flex-col justify-center min-h-[140px]`}>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">{k.label}</div>
              <div className={`text-3xl font-black ${k.color}`}>{k.val.toLocaleString()}</div>
              <div className="text-[7px] text-slate-300 font-black uppercase mt-2 tracking-tighter">Active Forensic View</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 min-h-[600px]">
        {loading && <LoadingOverlay />}

        {/* Left Sidebar: Forensic Filters */}
        <div className="col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-8">
          <div>
             <div className="flex flex-col items-center gap-1 mb-8">
               <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Forensic Filters</span>
               <span className="text-[7px] font-black text-slate-300 uppercase tracking-tighter">Reporting Lab: 7-DAY</span>
             </div>

             <div className="space-y-3">
                {["Last 30 Days", "Last 90 Days"].map(d => (
                  <label key={d} className="flex items-center gap-3 cursor-pointer group">
                    <div 
                      onClick={() => setFilters({...filters, dateRange: d})}
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${filters.dateRange === d ? 'border-blue-500' : 'border-slate-200 group-hover:border-blue-300'}`}
                    >
                      {filters.dateRange === d && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    <span className={`text-[10px] font-black uppercase ${filters.dateRange === d ? 'text-slate-800' : 'text-slate-400'}`}>{d}</span>
                  </label>
                ))}
            </div>
          </div>

          <div className="h-px bg-slate-50" />

          {/* Jurisdiction Selector */}
          <div className="space-y-3">
             <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1 leading-none">Jurisdiction</div>
             <select 
              value={filters.district} 
              onChange={e => setFilters({...filters, district: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black text-slate-600 uppercase tracking-tighter px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all cursor-pointer"
            >
              <option value="All">All Districts</option>
              {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="h-px bg-slate-50" />

          {/* Crime Toggles */}
          <div className="space-y-4">
            {Object.entries(filters.crimeToggles).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase ${v ? 'text-slate-800' : 'text-slate-400'}`}>{k} crime</span>
                <div 
                  onClick={() => setFilters({...filters, crimeToggles: {...filters.crimeToggles, [k]: !v}})}
                  className={`w-10 h-5 rounded-full relative transition-all cursor-pointer ${v ? 'bg-blue-600 shadow-inner' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${v ? 'left-6' : 'left-1'}`} />
                </div>
              </div>
            ))}
          </div>

          <div className="h-px bg-slate-50" />

          {/* Map Overlays */}
          <div className="space-y-3">
             <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2">Map Overlays</div>
             {Object.entries(filters.layers).map(([k, v]) => (
               <label key={k} className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${v ? 'bg-blue-600 border-blue-600' : 'border-slate-200 group-hover:border-blue-300'}`}>
                    {v && <div className="text-white text-[8px] font-black">✓</div>}
                  </div>
                  <input type="checkbox" className="hidden" checked={v} onChange={() => setFilters({...filters, layers: {...filters.layers, [k]: !v}})} />
                  <span className={`text-[10px] font-black uppercase ${v ? 'text-slate-800' : 'text-slate-400'}`}>{k} boundaries</span>
               </label>
             ))}
          </div>
        </div>

        {/* Center Canvas */}
        <div className="col-span-7 bg-white rounded-2xl border border-slate-200 overflow-hidden relative shadow-sm">
          {activeTab === "Map Area Crime" ? (
             <MapContainer center={[41.8781, -87.6298]} zoom={11} className="h-full w-full" zoomControl={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                <ZoomTracker setZoom={setZoom} />
                <MapAutoScaler incidents={incidents} />
                
                {filters.layers.district && boundaries.district && <GeoJSON data={boundaries.district} style={{ color: "black", weight: 2.5, opacity: 0.8, fillColor: "transparent" }} />}
                {filters.layers.beat && boundaries.beat && <GeoJSON data={boundaries.beat} style={{ color: "#0ea5e9", weight: 1.2, opacity: 0.5, dashArray: "5, 10", fillColor: "transparent" }} />}
                {filters.layers.ward && boundaries.ward && <GeoJSON data={boundaries.ward} style={{ color: "#7dd3fc", weight: 1.0, opacity: 0.4, fillColor: "transparent" }} />}
                
                {spatialClusters.map((c, idx) => (
                  <Marker 
                    key={`${idx}`} 
                    position={[c.lat, c.lng]} 
                    icon={createClusterIcon(c.count, getCategoryColor(c.category).color)}
                  >
                    <Popup minWidth={300} className="forensic-popup">
                      <IncidentPopup inc={c.incidents[0]} count={c.count} clusterIncidents={c.incidents} />
                    </Popup>
                  </Marker>
                ))}
             </MapContainer>
          ) : (
            <div className="h-full overflow-y-auto custom-scrollbar p-6 bg-slate-50/30">
               <CrimeDashboard 
                data={crimeTypeData} 
                highlights={reactiveKpis} 
                districtName={filters.district === "All" ? "Citywide" : districts.find(d => d.id === filters.district)?.name || "Selected District"}
                beatRanking={beatRanking}
                wardRanking={wardRanking}
                hourlyData={hourlyData}
                dowData={dowData}
                trendData={trendSeries}
              />
            </div>
          )}
        </div>

        {/* Right Sidebar: Legend */}
        <div className="col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-8 border-b border-slate-50 pb-3">Categorical Keys</h4>
            <div className="flex-1 space-y-10">
               {Object.entries(CRIME_TYPES).map(([k, g]) => (
                 <div key={k} className="space-y-4">
                    <div className="flex items-center gap-3">
                       <div className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm" style={{ background: g.color }} />
                       <span className="text-[10px] font-black text-slate-700 uppercase">{g.label}</span>
                    </div>
                    <div className="pl-6.5 space-y-1.5 opacity-60">
                       {g.items.map(it => <div key={it} className="text-[9px] font-bold text-slate-400 tracking-tight leading-tight uppercase tracking-widest">• {it}</div>)}
                    </div>
                 </div>
               ))}
            </div>
            
            <div className="pt-8 border-t border-slate-50 flex flex-col items-center gap-1 opacity-20">
               <div className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Chicago CPD Portal</div>
            </div>
        </div>
      </div>
    </div>
  );
}



function IncidentPopup({ inc, count, clusterIncidents = [] }) {
  const map = useMap();
  const [viewMode, setViewMode] = useState(count > 1 ? 'summary' : 'detail');
  const [selectedIdx, setSelectedIdx] = useState(0);

  const currentInc = count > 1 ? clusterIncidents[selectedIdx] : inc;
  const { color } = getCategoryColor(currentInc.category);

  const handleZoom = () => {
    map.flyTo([currentInc.lat, currentInc.lng], 17, { duration: 1.5 });
  };

  // --------------------------------------------------------------------------
  // MODE: LIST SELECTION (ArcGIS Style)
  // --------------------------------------------------------------------------
  if (viewMode === 'list') {
    return (
      <div className="p-0 min-w-[280px] shadow-2xl rounded-lg overflow-hidden border border-slate-200 bg-white">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setViewMode('summary')} className="p-1 hover:bg-slate-200 rounded transition-colors">
              <ChevronLeft size={14} className="text-slate-600" />
            </button>
            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Select feature</h3>
          </div>
          <span className="text-[9px] font-black text-slate-400">1 of {count}</span>
        </div>

        <div className="p-4 max-h-[250px] overflow-y-auto custom-scrollbar">
          <div className="mb-4 text-[9px] font-black text-slate-400 uppercase tracking-wider">Crime</div>
          <div className="space-y-1">
            <div
              onClick={() => setViewMode('summary')}
              className="flex items-center gap-3 p-2 hover:bg-blue-50 cursor-pointer rounded-md transition-all group"
            >
              <div className="w-3 h-3 rounded-full border-2 border-slate-300 group-hover:border-blue-500" />
              <span className="text-[10px] font-bold text-slate-600 uppercase">Cluster summary</span>
            </div>
            {clusterIncidents.map((item, idx) => (
              <div
                key={idx}
                onClick={() => { setSelectedIdx(idx); setViewMode('detail'); }}
                className="flex items-center gap-3 p-2 hover:bg-blue-50 cursor-pointer rounded-md transition-all group"
              >
                <div className={`w-3 h-3 rounded-full border-2 ${selectedIdx === idx ? 'bg-blue-600 border-blue-600' : 'border-slate-300 group-hover:border-blue-500'}`} />
                <span className="text-[10px] font-bold text-slate-800 uppercase line-clamp-1">{item.primary_type}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-center">
          <button onClick={() => setViewMode('summary')} className="text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-800">Back</button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // MODE: CLUSTER SUMMARY
  // --------------------------------------------------------------------------
  if (viewMode === 'summary') {
    const types = clusterIncidents.map(i => i.primary_type);
    const predominant = types.sort((a, b) =>
      types.filter(v => v === a).length - types.filter(v => v === b).length
    ).pop() || "Mixed";

    return (
      <div className="p-0 min-w-[280px] shadow-2xl rounded-lg overflow-hidden border border-slate-200 bg-white">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Cluster summary</h3>
          <Layers size={12} className="text-slate-400" />
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4 text-[9px] text-blue-600 font-black uppercase tracking-tighter">
            <div onClick={handleZoom} className="flex items-center gap-1.5 cursor-pointer hover:text-blue-800 transition-colors">
              <Search size={10} className="text-slate-300" />
              <span>Zoom to</span>
            </div>
            <span className="text-slate-200">|</span>
            <div onClick={() => setViewMode('list')} className="flex items-center gap-1.5 cursor-pointer hover:text-blue-800 transition-colors">
              <Layers size={10} className="text-slate-300" />
              <span>Browse features</span>
            </div>
          </div>
          <div className="space-y-3 py-2">
            <p className="text-[11px] text-slate-600 font-medium">This cluster represents <span className="font-black text-slate-900">{count} features</span>.</p>
            <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
              The predominant crime type within this cluster is <span className="font-black text-slate-900">{predominant}</span>.
            </p>
          </div>
        </div>
        <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 text-[8px] text-slate-400 font-black uppercase tracking-widest text-center">
          Forensic Multi-Point Summary
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // MODE: DETAIL VIEW
  // --------------------------------------------------------------------------
  const formattedDate = currentInc.date ? new Date(currentInc.date).toLocaleString('en-US', {
    month: 'numeric', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).replace(',', '') : 'N/A';

  return (
    <div className="p-0 min-w-[280px] shadow-2xl rounded-lg overflow-hidden border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {count > 1 && (
            <button onClick={() => setViewMode('list')} className="p-1 hover:bg-slate-200 rounded transition-colors">
              <ChevronLeft size={14} className="text-slate-600" />
            </button>
          )}
          <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{currentInc.primary_type}</h3>
        </div>
        <div className="w-3 h-3 rounded-full shadow-sm" style={{ background: color }} />
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-4 text-[9px] text-blue-600 font-bold uppercase tracking-tighter">
          <div onClick={handleZoom} className="flex items-center gap-1.5 cursor-pointer hover:text-blue-800 transition-colors">
            <Search size={10} className="text-slate-400" />
            <span>Zoom to</span>
          </div>
          {count > 1 && (
            <div onClick={() => setViewMode('list')} className="flex items-center gap-1.5 cursor-pointer hover:text-blue-800 transition-colors">
              <Layers size={10} className="text-slate-300" />
              <span>Browse features</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-0.5">
            <div className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em]">Address</div>
            <div className="text-[11px] font-bold text-slate-800 leading-tight">{currentInc.block_address || "Locating..."}</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em]">Date of Occurrence</div>
            <div className="text-[11px] font-bold text-slate-700">{formattedDate}</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em]">Crime</div>
            <div className="text-[10px] font-bold text-slate-800 leading-relaxed uppercase">
              {currentInc.primary_type} <span className="text-slate-400 font-medium">• {currentInc.description || "No detail"}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-4">
            <div>
              <div className="text-[7.5px] font-black text-slate-400 uppercase tracking-[0.1em]">RD Number</div>
              <div className="text-[10px] font-mono font-bold text-blue-700">{currentInc.case_number || "N/A"}</div>
            </div>
            <div>
              <div className="text-[7.5px] font-black text-slate-400 uppercase tracking-[0.1em]">IUCR</div>
              <div className="text-[10px] font-mono font-bold text-slate-900">{currentInc.iucr || "N/A"}</div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-black text-slate-400 uppercase">Beat</span>
              <span className="text-[11px] font-black text-slate-800">{currentInc.beat_num || '--'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-black text-slate-400 uppercase">Ward</span>
              <span className="text-[11px] font-black text-slate-800">{currentInc.ward || '--'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-black text-slate-400 uppercase">Community</span>
              <span className="text-[10px] font-black text-slate-800 truncate max-w-[80px]">AUSTIN</span>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-t border-slate-100">
        <div className="text-[8px] text-slate-400 font-black uppercase tracking-[0.25em]">CPD Forensic Feed</div>
        <Info size={10} className="text-slate-300" />
      </div>
    </div>
  );
}

function CrimeDashboard({ data, highlights, districtName = "Citywide", beatRanking = [], wardRanking = [], hourlyData = [], dowData = [], trendData = [] }) {
  const pieData = [
    { name: 'Violent', value: highlights.violent, color: '#ef4444' },
    { name: 'Property', value: highlights.property, color: '#f59e0b' },
    { name: 'Other', value: highlights.other, color: '#3b82f6' },
  ];

  const sortedData = [...(data || [])].filter(d => d && d.name).sort((a, b) => (b.count || 0) - (a.count || 0));
  const barData = sortedData.slice(0, 10).map(d => ({
    name: (d.name || "Unknown").length > 12 ? (d.name || "Unknown").substring(0, 12) + '..' : (d.name || "Unknown"),
    count: d.count || 0,
    category: d.category || "other"
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="grid grid-cols-3 gap-6">
        {/* Row 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[280px]">
          <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-50 pb-2">Top 10 Crimes ({districtName})</h4>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} fontSize={8} fontWeight="bold" axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '9px' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {barData.map((d, i) => <Cell key={i} fill={getCategoryColor(d.category).color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[280px]">
          <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-50 pb-2">Crime by Day of Week</h4>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dowData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={8} fontWeight="bold" axisLine={false} tickLine={false} />
                <YAxis fontSize={8} fontWeight="bold" axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '9px' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[280px]">
          <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-50 pb-2">Crime by Beat (Top 10)</h4>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={beatRanking.slice(0, 10)} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="id" type="category" width={40} fontSize={8} fontWeight="bold" axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '9px' }} />
                <Bar dataKey="crime_count" fill="#0369a1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-[280px] flex flex-col">
          <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-50 pb-2">Crime by Time of Day</h4>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" fontSize={6} fontWeight="bold" axisLine={false} tickLine={false} interval={2} />
                <YAxis fontSize={8} fontWeight="bold" axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '9px' }} />
                <Bar dataKey="count" fill="#075985" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-[280px] flex flex-col">
          <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-50 pb-2">Crime by Ward (Top 10)</h4>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wardRanking.slice(0, 10)} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="id" type="category" width={40} fontSize={8} fontWeight="bold" axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '9px' }} />
                <Bar dataKey="crime_count" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[280px]">
          <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-50 pb-2">Categorical Split</h4>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '9px' }} />
                <Legend iconType="circle" verticalAlign="bottom" wrapperStyle={{ fontSize: '8px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-[300px] flex flex-col">
        <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-50 pb-2">Crime over Time (Trend Analytics)</h4>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" fontSize={8} fontWeight="bold" axisLine={false} tickLine={false} />
              <YAxis fontSize={8} fontWeight="bold" axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '9px' }} />
              <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ZoomTracker({ setZoom }) {
  const map = useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });
  return null;
}

function MapAutoScaler({ incidents }) {
  const map = useMap();
  useEffect(() => {
    if (incidents && incidents.length > 0) {
      const valid = incidents.filter(i => i.lat > 41.6 && i.lat < 42.1 && i.lng < -87.5 && i.lng > -87.9);
      if (valid.length > 0) map.fitBounds(L.latLngBounds(valid.map(i => [i.lat, i.lng])), { padding: [50, 50], maxZoom: 13 });
    }
  }, [incidents, map]);
  return null;
}
