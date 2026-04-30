import { useState, useMemo, useEffect, useRef } from "react";
// Forced HMR Refresh - v2

import { MapContainer, TileLayer, GeoJSON, Popup, useMap, Marker, useMapEvents, Circle } from "react-leaflet";
import L from "leaflet";
import {
  Search, Calendar, Filter, Layers, Map as MapIcon,
  Loader2, Info, AlertCircle, ChevronLeft, ChevronRight,
  ChevronDown, MapPin, Navigation, Clock, Play, Pause, RotateCcw
} from "lucide-react";
import { Slider } from "./ui/slider";
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
  fetchPoliceStations,
  fetchHospitals,
  fetchSchools,
  fetchFireStations,
  AUTH_TOKEN
} from "../services/api";
import { DownloadCloud, ShieldCheck } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Cell, ResponsiveContainer
} from "recharts";

// ── Constants & Helpers ──────────────────────────────────────────────────
function timeFrameToDates(range, now) {
  const to = new Date(now);
  let from = new Date(now);
  if (range === "Last 7 Days") from.setDate(now.getDate() - 7);
  else if (range === "Last 30 Days") from.setDate(now.getDate() - 30);
  else if (range === "Last 90 Days") from.setDate(now.getDate() - 90);
  return { dateFrom: from.toISOString().split("T")[0], dateTo: to.toISOString().split("T")[0] };
}

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

const CRIME_TYPES = {
  violent: { label: "Violent Crime (Index)", color: "#ef4444", items: ["Homicide", "Robbery", "Assault", "Battery", "Sexual Assault", "Kidnapping"] },
  property: { label: "Property Crime (Index)", color: "#eab308", items: ["Burglary", "Theft", "Arson", "Motor Vehicle Theft", "Vandalism", "Criminal Damage"] },
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

const DASHBOARD_MAP_STYLE = `
  @keyframes pulse-ring {
    0% { transform: scale(0.33); opacity: 1; }
    80%, 100% { opacity: 0; }
  }
  @keyframes pulse-dot {
    0% { transform: scale(0.8); }
    50% { transform: scale(1); }
    100% { transform: scale(0.8); }
  }
  .selected-incident-highlight {
    position: relative;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pulse-ring {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background-color: #ef4444;
    animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
  }
  .center-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background-color: #ef4444;
    border: 2px solid white;
    box-shadow: 0 0 10px rgba(0,0,0,0.3);
    z-index: 1;
    animation: pulse-dot 1.5s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
  }
  .leaflet-popup-content-wrapper {
    background: #ffffff !important;
    color: #1a1a1a !important;
    border-radius: 10px !important;
    padding: 0 !important;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
    border: 1px solid #e2e8f0 !important;
  }
  .leaflet-popup-tip {
    background: #ffffff !important;
  }
  .leaflet-popup-content {
    color: #1a1a1a !important;
  }
  .leaflet-popup-content * {
    color: #1a1a1a !important;
  }
  .forensic-popup .leaflet-popup-content-wrapper {
    background: #ffffff !important;
    color: #1a1a1a !important;
  }
`;

// ── Components ───────────────────────────────────────────────────────────

function LoadingOverlay({ message = "Calibrating Forensic Map..." }) {
  return (
    <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-white/70 backdrop-blur-md">
      <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
      <span className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em]">{message}</span>
    </div>
  );
}

function DashboardFilter({ label, value, options, onChange }) {
  return (
    <div className="flex flex-col min-w-[100px]">
      <span className="text-[8px] text-slate-400 font-bold uppercase mb-1">{label}</span>
      <select value={value} onChange={e => onChange?.(e.target.value)} className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer">
        <option value="All">All {label}s</option>
        {options && options.map(o => <option key={o.id} value={o.id}>{o.name || o.id}</option>)}
      </select>
    </div>
  );
}

function KPIBox({ label, val, colorClass = "text-blue-900" }) {
  return (
    <div className="flex flex-col items-start justify-center p-3 border-r border-slate-100 last:border-r-0">
      <div className={`text-[22px] font-black leading-tight ${colorClass}`}>{val?.toLocaleString() || 0}</div>
      <div className="text-[8px] font-bold uppercase text-slate-400 mt-0.5 tracking-wide leading-tight">{label}</div>
    </div>
  );
}

function IncidentListItem({ inc, active, onClick }) {
  const { color } = getCategoryColor(inc?.category);
  return (
    <div onClick={onClick} className={`border-l-4 p-3 cursor-pointer transition-all group mb-2 border-b border-b-slate-100 ${active ? "bg-slate-50 border-blue-600" : "bg-white border-transparent hover:bg-slate-50"}`}>
      <div className="flex justify-between items-start mb-1">
        <div className="text-[10px] font-black uppercase text-slate-800 group-hover:text-blue-700 truncate pr-2">{inc?.primary_type || "Unknown Crime"}</div>
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      </div>
      <div className="text-[8px] font-bold text-slate-400 uppercase leading-tight truncate">{inc?.block_address || "No Address Provided"}</div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[7px] font-black text-blue-600 uppercase">{inc?.date ? new Date(inc.date).toLocaleDateString() : "No Date"}</span>
        <span className="text-[7px] font-black text-slate-300 uppercase">|</span>
        <span className="text-[7px] font-black text-slate-400 uppercase">RD {inc?.case_number || "N/A"}</span>
      </div>
    </div>
  );
}

// Premium ArcGIS-style wide incident card for the Crime Dashboard panel
function IncidentListItemWide({ inc, active, onClick }) {
  const { color } = getCategoryColor(inc?.category);
  const formattedDate = inc?.date
    ? new Date(inc.date).toLocaleString("en-US", { month: "numeric", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "No Date";

  return (
    <div
      onClick={onClick}
      className={`border-b border-slate-100 cursor-pointer transition-all group ${active ? "bg-blue-50 border-l-4 border-l-blue-600" : "bg-white border-l-4 border-l-transparent hover:bg-slate-50 hover:border-l-blue-300"
        }`}
      style={{ minHeight: "20%" }}
    >
      {/* Header row */}
      <div className="px-4 pt-3 pb-1 flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-black uppercase text-slate-900 group-hover:text-blue-700 leading-tight">
            {inc?.primary_type || "Unknown Crime"}
          </div>
          <div className="text-[9px] font-semibold text-slate-400 uppercase leading-tight mt-0.5 truncate max-w-[180px]">
            {inc?.description || "—"}
          </div>
          <div className="text-[8px] font-bold text-blue-500 mt-1 truncate max-w-[200px]">
            {formattedDate} &nbsp;
            {inc?.location_description ? <span className="text-slate-400 uppercase">{inc.location_description}</span> : null}
            {inc?.block_address ? <span className="text-blue-400"> of {inc.block_address}</span> : null}
          </div>
        </div>
        <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-1 border border-white shadow-sm" style={{ background: color }} />
      </div>

      {/* Detail rows */}
      <div className="px-4 pb-3 space-y-0.5 mt-1">
        <div className="flex items-center gap-1.5 text-[9px] text-slate-600">
          <MapPin size={9} className="text-slate-400 shrink-0" />
          <span className="font-semibold">Address</span>
          <span className="text-slate-500 truncate">{inc?.block_address || "N/A"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-slate-600">
          <Calendar size={9} className="text-blue-400 shrink-0" />
          <span className="font-semibold">Date of Occurrence</span>
          <span className="text-blue-600 font-bold">{formattedDate}</span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1 text-[8px] text-slate-400 font-bold uppercase tracking-wide">
          <span>RD {inc?.case_number || "N/A"}</span>
          {inc?.iucr && <span>| IUCR {inc.iucr}</span>}
          {inc?.beat_num && <span>| Beat {inc.beat_num}</span>}
          {inc?.ward && <span>| Ward {inc.ward}</span>}
          {(inc?.community_area_name || inc?.community_area) && (
            <span>| Community <span className="text-slate-600 uppercase">{inc.community_area_name || inc.community_area}</span></span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page Logic ──────────────────────────────────────────────────────

export default function CrimesSection() {
  const [activeTab, setActiveTab] = useState("Map Area Crime");
  const [zoom, setZoom] = useState(11);
  const [addressSearch, setAddressSearch] = useState("");
  const [dashboardMode, setDashboardMode] = useState("Crime Statistics");
  const [dashboardSubTab, setDashboardSubTab] = useState("Crime Incidents");
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [incidentSearchTerm, setIncidentSearchTerm] = useState("");

  // Filters
  const [filters, setFilters] = useState({
    district: "All", beat: "All", ward: "All", community: "All", crimeType: "All",
    crimeToggles: { violent: true, property: true, other: true },
    layers: { ward: true, district: true, beat: true },
    dateRange: "Last 7 Days",
    customFrom: "",
    customTo: ""
  });

  // Find Crime Near state
  const [findNear, setFindNear] = useState({
    active: false,
    address: "",
    lat: null,
    lng: null,
    radius: 500,
    searchFilters: { all: true, districts: true, beats: true, wards: true },
    searchResults: [],
    selectedResult: null // { type, id, name, geometry }
  });
  const geocodeRef = useRef(null);

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
  const [showPolice, setShowPolice] = useState(false);
  const [policeStations, setPoliceStations] = useState([]);
  const [showHospitals, setShowHospitals] = useState(false);
  const [hospitalLocations, setHospitalLocations] = useState([]);
  const [showSchools, setShowSchools] = useState(false);
  const [schoolLocations, setSchoolLocations] = useState([]);
  const [showFireStations, setShowFireStations] = useState(false);
  const [fireStationLocations, setFireStationLocations] = useState([]);
  const [scrubValue, setScrubValue] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dbMaxDate, setDbMaxDate] = useState(new Date());

  // Derive scrubbed DateTo
  const scrubbedDateTo = useMemo(() => {
    // Sync with database max date to avoid empty timeline scrubbing
    const { dateFrom, dateTo } = timeFrameToDates(filters.dateRange, dbMaxDate);
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const totalDays = Math.max(1, Math.round((to - from) / 86400000));
    const currentDays = Math.round((scrubValue / 100) * totalDays);
    const scrubbed = new Date(from.getTime() + currentDays * 86400000);
    return scrubbed.toISOString().split("T")[0];
  }, [filters.dateRange, scrubValue, dbMaxDate]);

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
          setDistricts(districtRes.map(d => ({ id: d.district_id, name: d.district_name || `District ${d.district_id}` })).sort((a, b) => a.id - b.id));
        }
      } catch (err) { console.error("Boundary init failed:", err); }
    }
    init();
  }, []);

  useEffect(() => {
    if (showPolice && policeStations.length === 0) {
      fetchPoliceStations().then(data => {
        setPoliceStations(Array.isArray(data) ? data : (data.features || []));
      }).catch(e => console.error("Failed to load police stations", e));
    }
  }, [showPolice]);

  useEffect(() => {
    if (showHospitals && hospitalLocations.length === 0) {
      fetchHospitals().then(data => {
        setHospitalLocations(data);
      }).catch(e => console.error("CrimesSection: Failed to load hospitals", e));
    }
  }, [showHospitals]);

  useEffect(() => {
    if (showSchools && schoolLocations.length === 0) {
      fetchSchools().then(data => {
        setSchoolLocations(data);
      }).catch(e => console.error("CrimesSection: Failed to load schools", e));
    }
  }, [showSchools]);

  useEffect(() => {
    if (showFireStations && fireStationLocations.length === 0) {
      fetchFireStations().then(data => {
        setFireStationLocations(data);
      }).catch(e => console.error("CrimesSection: Failed to load fire stations", e));
    }
  }, [showFireStations]);

  // Sync with backend calendar to avoid "empty future" data discrepancy
  useEffect(() => {
    async function sync() {
      try {
        const meta = await fetchFilterOptions();
        if (meta?.date_range?.max_date) {
          setDbMaxDate(new Date(meta.date_range.max_date));
        }
      } catch (e) {
        console.warn("CrimesSection: Calendar sync failed:", e);
      }
    }
    sync();
  }, []);

  // Search Handler for Find Crime Near
  const handleFindNear = async () => {
    const query = findNear.address.trim().toLowerCase();
    if (!query) return;

    let results = [];

    // 1. Search Districts
    if (findNear.searchFilters.all || findNear.searchFilters.districts) {
      const match = boundaries.district?.features.filter(f =>
        String(f.properties.district_id).toLowerCase().includes(query) ||
        String(f.properties.district_name).toLowerCase().includes(query)
      );
      if (match) results.push(...match.map(m => ({ type: 'district', id: m.properties.district_id, name: m.properties.district_name || `District ${m.properties.district_id}`, geometry: m.geometry })));
    }

    // 2. Search Wards
    if (findNear.searchFilters.all || findNear.searchFilters.wards) {
      const match = boundaries.ward?.features.filter(f =>
        String(f.properties.ward_id).toLowerCase().includes(query)
      );
      if (match) results.push(...match.map(m => ({ type: 'ward', id: m.properties.ward_id, name: `Ward ${m.properties.ward_id}`, geometry: m.geometry })));
    }

    // 3. Search Beats
    if (findNear.searchFilters.all || findNear.searchFilters.beats) {
      const match = boundaries.beat?.features.filter(f =>
        String(f.properties.beat_id).toLowerCase().includes(query)
      );
      if (match) results.push(...match.map(m => ({ type: 'beat', id: m.properties.beat_id, name: `Beat ${m.properties.beat_id}`, geometry: m.geometry })));
    }

    // 4. Geocode as fallback or if specifically requested (ChicagoLocator concept)
    if (results.length === 0 || findNear.searchFilters.all) {
      try {
        const geoQuery = encodeURIComponent(findNear.address + ", Chicago, IL");
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${geoQuery}&format=json&limit=3`);
        const data = await res.json();
        results.push(...data.map(d => ({
          type: 'address',
          id: d.place_id,
          name: d.display_name,
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
          geometry: { type: "Point", coordinates: [parseFloat(d.lon), parseFloat(d.lat)] }
        })));
      } catch (e) { console.error("Geocode failed:", e); }
    }

    setFindNear(prev => ({ ...prev, searchResults: results }));
  };

  const selectSearchResult = (res) => {
    if (res.type === 'address') {
      setFindNear(prev => ({
        ...prev,
        active: true,
        lat: res.lat,
        lng: res.lng,
        selectedResult: res,
        searchResults: []
      }));
    } else {
      // Calculate centroid for geometry
      const bounds = L.geoJSON(res.geometry).getBounds();
      const center = bounds.getCenter();
      setFindNear(prev => ({
        ...prev,
        active: true,
        lat: center.lat,
        lng: center.lng,
        selectedResult: res,
        searchResults: []
      }));
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Sync with backend calendar to avoid "empty future" data
      let dateToObj = new Date();
      let dateTo, dateFrom;

      if (filters.dateRange === "Custom" && filters.customFrom && filters.customTo) {
        dateFrom = filters.customFrom;
        dateTo = filters.customTo;
      } else {
        dateTo = scrubbedDateTo;
        const intervalDays = filters.dateRange === "Last 7 Days" ? 7 : filters.dateRange === "Last 30 Days" ? 30 : 90;
        dateFrom = new Date(new Date(dateTo).getTime() - intervalDays * 86400000).toISOString().split("T")[0];
      }

      // Context Filtering Logic
      const selectedArea = findNear.selectedResult;
      const q = {
        dateFrom,
        dateTo,
        limit: 1200,
        districtIds: selectedArea?.type === 'district' ? [selectedArea.id] : (filters.district !== "All" ? [filters.district] : undefined),
        wardIds: selectedArea?.type === 'ward' ? [selectedArea.id] : undefined,
        beatIds: selectedArea?.type === 'beat' ? [selectedArea.id] : undefined,
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

      // Sort and slice rankings to ensure forensic focus
      const sortedBeats = (beatSummary.items || []).sort((a, b) => (b.crime_count || 0) - (a.crime_count || 0));
      const sortedWards = (wardSummary.items || []).sort((a, b) => (b.crime_count || 0) - (a.crime_count || 0));

      setBeatRanking(sortedBeats.slice(0, 10));
      setWardRanking(sortedWards.slice(0, 10));
      setTrendSeries(platformTrend);

      // Build Hourly (Time of Day) data from real API
      const hours = Array.from({ length: 24 }, (_, i) => ({
        label: i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`,
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

  useEffect(() => { loadData(); }, [filters.dateRange, filters.district, filters.customFrom, filters.customTo, findNear.selectedResult, scrubbedDateTo]);

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
    <div className="space-y-6 font-sans text-slate-800">
      {/* Top Tabs */}
      <div className="flex items-center gap-2">
        {["Map Area Crime", "Crime Dashboard"].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t
              ? "bg-blue-600 text-white shadow-md shadow-blue-200"
              : "bg-white text-slate-400 border border-slate-200 hover:border-blue-400"
              }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && <LoadingOverlay />}

      {activeTab === "Map Area Crime" ? (
        <>
          {/* Map Area Crime Top Headers */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total Crimes", val: kpis?.total, color: "text-blue-900", bg: "bg-white" },
              { label: "Violent Crimes", val: kpis?.violent, color: "text-red-500", bg: "bg-white" },
              { label: "Property Crimes", val: kpis?.property, color: "text-amber-500", bg: "bg-white" },
              { label: "Other Crimes", val: kpis?.other, color: "text-slate-800", bg: "bg-white" }
            ].map((k, i) => (
              <div key={i} className={`${k.bg} border border-slate-200 p-6 rounded-2xl shadow-sm text-center flex flex-col justify-center min-h-[140px]`}>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">{k.label}</div>
                <div className={`text-3xl font-black ${k.color}`}>{k.val?.toLocaleString() || 0}</div>
                <div className="text-[7px] text-slate-300 font-black uppercase mt-2 tracking-tighter">Active Forensic View</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-12 gap-6 min-h-[600px] relative">
            <div className="col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5 overflow-y-auto">
              <div>
                <div className="flex flex-col items-center gap-1 mb-5">
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Forensic Filters</span>
                  <span className="text-[7px] font-black text-slate-300 uppercase tracking-tighter">Live CPD Data</span>
                </div>

                <div className="space-y-2">
                  <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Date Range</div>
                  {["Last 7 Days", "Last 30 Days", "Last 90 Days"].map(d => (
                    <label key={d} className="flex items-center gap-3 cursor-pointer group">
                      <div
                        onClick={() => setFilters({ ...filters, dateRange: d, customFrom: "", customTo: "" })}
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${filters.dateRange === d ? 'border-blue-500' : 'border-slate-200 group-hover:border-blue-300'}`}
                      >
                        {filters.dateRange === d && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                      </div>
                      <span className={`text-[10px] font-black uppercase ${filters.dateRange === d ? 'text-slate-800' : 'text-slate-400'}`}>{d}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div
                      onClick={() => setFilters({ ...filters, dateRange: "Custom" })}
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${filters.dateRange === "Custom" ? 'border-blue-500' : 'border-slate-200 group-hover:border-blue-300'}`}
                    >
                      {filters.dateRange === "Custom" && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    <span className={`text-[10px] font-black uppercase ${filters.dateRange === "Custom" ? 'text-slate-800' : 'text-slate-400'}`}>Custom Range</span>
                  </label>
                  {filters.dateRange === "Custom" && (
                    <div className="ml-7 space-y-2 pt-1">
                      <div>
                        <div className="text-[8px] font-black text-slate-300 uppercase mb-1">From</div>
                        <input type="date" value={filters.customFrom}
                          onChange={e => setFilters({ ...filters, customFrom: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-bold text-slate-600 px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                      <div>
                        <div className="text-[8px] font-black text-slate-300 uppercase mb-1">To</div>
                        <input type="date" value={filters.customTo}
                          onChange={e => setFilters({ ...filters, customTo: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-bold text-slate-600 px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-slate-50" />
              <div className="h-px bg-slate-50" />

              <div className="space-y-4">
                {Object.entries(filters.crimeToggles).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase ${v ? 'text-slate-800' : 'text-slate-400'}`}>{k} crime</span>
                    <div
                      onClick={() => setFilters({ ...filters, crimeToggles: { ...filters.crimeToggles, [k]: !v } })}
                      className={`w-10 h-5 rounded-full relative transition-all cursor-pointer ${v ? 'bg-blue-600 shadow-inner' : 'bg-slate-200'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${v ? 'left-6' : 'left-1'}`} />
                    </div>
                  </div>
                ))}

                <div className="h-px bg-slate-50 my-2" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <ShieldCheck size={10} className="text-blue-500" />
                    <span className={`text-[10px] font-black uppercase ${showPolice ? 'text-slate-800' : 'text-slate-400'}`}>Police Stations</span>
                  </div>
                  <div
                    onClick={() => setShowPolice(!showPolice)}
                    className={`w-10 h-5 rounded-full relative transition-all cursor-pointer ${showPolice ? 'bg-blue-600 shadow-inner' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${showPolice ? 'left-6' : 'left-1'}`} />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px]">🏥</span>
                    <span className={`text-[10px] font-black uppercase ${showHospitals ? 'text-slate-800' : 'text-slate-400'}`}>Hospitals</span>
                  </div>
                  <div
                    onClick={() => setShowHospitals(!showHospitals)}
                    className={`w-10 h-5 rounded-full relative transition-all cursor-pointer ${showHospitals ? 'bg-emerald-600 shadow-inner' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${showHospitals ? 'left-6' : 'left-1'}`} />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px]">🏫</span>
                    <span className={`text-[10px] font-black uppercase ${showSchools ? 'text-slate-800' : 'text-slate-400'}`}>Schools</span>
                  </div>
                  <div
                    onClick={() => setShowSchools(!showSchools)}
                    className={`w-10 h-5 rounded-full relative transition-all cursor-pointer ${showSchools ? 'bg-indigo-600 shadow-inner' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${showSchools ? 'left-6' : 'left-1'}`} />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px]">🚒</span>
                    <span className={`text-[10px] font-black uppercase ${showFireStations ? 'text-slate-800' : 'text-slate-400'}`}>Fire Stations</span>
                  </div>
                  <div
                    onClick={() => setShowFireStations(!showFireStations)}
                    className={`w-10 h-5 rounded-full relative transition-all cursor-pointer ${showFireStations ? 'bg-red-600 shadow-inner' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${showFireStations ? 'left-6' : 'left-1'}`} />
                  </div>
                </div>

              </div>

              <div className="h-px bg-slate-50" />

              <div className="space-y-3">
                <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2">Map Overlays</div>
                {Object.entries(filters.layers).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${v ? 'bg-blue-600 border-blue-600' : 'border-slate-200 group-hover:border-blue-300'}`}>
                      {v && <div className="text-white text-[8px] font-black">✓</div>}
                    </div>
                    <input type="checkbox" className="hidden" checked={v} onChange={() => setFilters({ ...filters, layers: { ...filters.layers, [k]: !v } })} />
                    <span className={`text-[10px] font-black uppercase ${v ? 'text-slate-800' : 'text-slate-400'}`}>{k} boundaries</span>
                  </label>
                ))}
              </div>

              <div className="h-px bg-slate-50" />

              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Navigation size={9} className="text-red-400" />
                  <div className="text-[8px] font-black text-red-400 uppercase tracking-widest">Find Crime Near</div>
                </div>

                <div className="flex items-stretch gap-0 relative">
                  <div className="relative group">
                    <button className="h-full px-2 bg-white border border-slate-200 border-r-0 rounded-l-lg flex items-center gap-1 hover:bg-slate-50 transition-colors">
                      <ChevronDown size={12} className="text-slate-400" />
                      <Filter size={10} className="text-slate-600" />
                    </button>
                    <div className="absolute top-full left-0 mt-1 w-[180px] bg-white border border-slate-200 rounded-lg shadow-xl z-[3000] hidden group-hover:block p-3 space-y-2 animate-in fade-in slide-in-from-top-2">
                      {['all', 'districts', 'beats', 'wards'].map(cat => (
                        <label key={cat} className="flex items-center gap-3 cursor-pointer group/item">
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-400 cursor-pointer border-slate-300"
                            checked={findNear.searchFilters[cat]}
                            onChange={(e) => {
                              const val = e.target.checked;
                              if (cat === 'all') {
                                setFindNear(p => ({ ...p, searchFilters: { all: val, districts: val, beats: val, wards: val } }));
                              } else {
                                setFindNear(p => ({ ...p, searchFilters: { ...p.searchFilters, [cat]: val, all: false } }));
                              }
                            }}
                          />
                          <span className="text-[10px] font-bold text-slate-600 uppercase group-hover/item:text-blue-600 transition-colors capitalize">{cat}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={findNear.address}
                      onChange={e => setFindNear(p => ({ ...p, address: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleFindNear()}
                      placeholder="Find address or place"
                      className="w-full bg-white border border-slate-200 rounded-r-lg text-[10px] font-bold text-slate-600 px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-slate-300 pr-10"
                    />
                    <button onClick={handleFindNear} className="absolute right-2 top-2.5 p-1 text-slate-400 hover:text-blue-600 transition-colors">
                      <Search size={14} />
                    </button>
                  </div>
                </div>

                {findNear.searchResults.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-h-[180px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    {findNear.searchResults.map((res, i) => (
                      <div
                        key={i}
                        onClick={() => selectSearchResult(res)}
                        className="px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                      >
                        <div className="text-[9px] font-black text-slate-700 uppercase">{res.name}</div>
                        <div className="text-[7px] text-slate-400 font-bold uppercase tracking-tighter">{res.type} context</div>
                      </div>
                    ))}
                  </div>
                )}

                {findNear.selectedResult && (
                  <div className="p-3 border border-red-100 bg-red-50/30 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[9px] font-black text-red-500 uppercase">{findNear.selectedResult.name}</div>
                      <button onClick={() => setFindNear(p => ({ ...p, selectedResult: null, active: false, lat: null, lng: null, address: "", searchResults: [] }))} className="text-slate-400 hover:text-red-500 transition-colors">✕</button>
                    </div>

                    {findNear.selectedResult.type === 'address' && (
                      <div>
                        <div className="text-[8px] font-black text-slate-400 uppercase mb-1">Search Buffer</div>
                        <select
                          value={findNear.radius}
                          onChange={e => setFindNear(p => ({ ...p, radius: Number(e.target.value) }))}
                          className="w-full bg-white border border-slate-100 rounded-lg text-[9px] font-bold text-slate-600 px-2 py-1.5 outline-none focus:ring-2 focus:ring-red-300"
                        >
                          {[250, 500, 1000, 1500, 2000].map(r => <option key={r} value={r}>{r}m Buffer</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-7 bg-white rounded-2xl border border-slate-200 overflow-hidden relative shadow-sm h-[600px]">
              <div className="absolute top-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-sm border-b border-slate-100 z-[1000] flex flex-row items-center justify-between px-6">
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-xl font-bold tracking-tight text-slate-800">Forensic Map View</h3>
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <Clock size={10} className="text-blue-500" />
                    <span>Anchored to latest record: <span className="text-blue-600 underline decoration-blue-200">{dbMaxDate.toISOString().split("T")[0]}</span></span>
                  </div>
                </div>
              </div>
              <MapContainer center={[41.8781, -87.6298]} zoom={11} className="h-full w-full" zoomControl={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                <ZoomTracker setZoom={setZoom} />
                <MapAutoScaler incidents={incidents} />

                {(!findNear.selectedResult || findNear.selectedResult.type === 'address') && (
                  <>
                    {filters.layers.district && boundaries.district && <GeoJSON data={boundaries.district} style={{ color: "black", weight: 2.5, opacity: 0.8, fillColor: "transparent" }} />}
                    {filters.layers.beat && boundaries.beat && <GeoJSON data={boundaries.beat} style={{ color: "#0ea5e9", weight: 1.2, opacity: 0.5, dashArray: "5, 10", fillColor: "transparent" }} />}
                    {filters.layers.ward && boundaries.ward && <GeoJSON data={boundaries.ward} style={{ color: "#7dd3fc", weight: 1.0, opacity: 0.4, fillColor: "transparent" }} />}
                  </>
                )}

                {findNear.selectedResult && findNear.selectedResult.type !== 'address' && (
                  <>
                    <GeoJSON
                      key={findNear.selectedResult.id}
                      data={findNear.selectedResult.geometry}
                      style={{ color: "#ef4444", weight: 4, opacity: 1, fillColor: "#ef4444", fillOpacity: 0.05 }}
                    />
                    <FindNearFlyTo lat={findNear.lat} lng={findNear.lng} />
                  </>
                )}

                {findNear.active && findNear.lat && findNear.selectedResult?.type === 'address' && (
                  <>
                    <Circle
                      center={[findNear.lat, findNear.lng]}
                      radius={findNear.radius}
                      pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.08, weight: 2, dashArray: '6 4' }}
                    />
                    <Marker position={[findNear.lat, findNear.lng]} icon={L.divIcon({ className: '', html: `<div style="width:12px;height:12px;background:#ef4444;border:2px solid white;border-radius:50%;box-shadow:0 0 8px #ef4444"></div>`, iconSize: [12, 12], iconAnchor: [6, 6] })} />
                    <FindNearFlyTo lat={findNear.lat} lng={findNear.lng} />
                  </>
                )}

                {(findNear.active && findNear.lat && findNear.selectedResult?.type === 'address' ? spatialClusters.filter(c => {
                  const d = L.latLng(c.lat, c.lng).distanceTo(L.latLng(findNear.lat, findNear.lng));
                  return d <= findNear.radius;
                }) : spatialClusters).map((c, idx) => (
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

                {showPolice && policeStations?.map((p, idx) => {
                  const lat = parseFloat(p.latitude);
                  const lng = parseFloat(p.longitude);
                  if (isNaN(lat) || isNaN(lng)) return null;
                  return (
                    <Marker
                      key={`police-${idx}`}
                      position={[lat, lng]}
                      icon={L.divIcon({
                        html: `<div style="font-size: 18px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));" title="Police Station">👮</div>`,
                        className: "police-emoji-marker",
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                      })}
                    >
                      <Popup>
                        <div className="p-1">
                          <h4 className="font-black text-[10px] border-b pb-1 mb-2 uppercase tracking-widest text-blue-800">Station {p.district_id}</h4>
                          <p className="text-[9px] font-black uppercase"><b>District:</b> {p.district_name || p.district}</p>
                          <p className="text-[9px] font-bold text-slate-500 uppercase"><b>Address:</b> {p.address}</p>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {showHospitals && hospitalLocations?.map((h, idx) => {
                  if (!h.latitude || !h.longitude) return null;
                  return (
                    <Marker
                      key={`hospital-${idx}`}
                      position={[h.latitude, h.longitude]}
                      icon={L.divIcon({
                        html: `
                          <svg width="24" height="28" viewBox="0 0 40 46" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 0 C9 0 0 9 0 20 C0 30 20 46 20 46 C20 46 40 30 40 20 C40 9 31 0 20 0 Z" fill="#E15554"/>
                            <circle cx="20" cy="19" r="13" fill="white" opacity="0.95"/>
                            <rect x="18" y="11" width="4" height="16" fill="#E15554"/>
                            <rect x="12" y="17" width="16" height="4" fill="#E15554"/>
                          </svg>`,
                        className: "hospital-marker",
                        iconSize: [24, 28],
                        iconAnchor: [12, 28]
                      })}
                    >
                      <Popup>
                        <div className="p-1">
                          <h4 className="font-black text-[10px] border-b pb-1 mb-2 uppercase tracking-widest text-red-600">Medical Facility</h4>
                          <p className="text-[9px] font-black uppercase"><b>Name:</b> {h.hospital_name || h.name}</p>
                          <p className="text-[9px] font-bold text-slate-500 uppercase"><b>Address:</b> {h.address}</p>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {showSchools && schoolLocations?.map((s, idx) => {
                  if (!s.latitude || !s.longitude) return null;
                  return (
                    <Marker
                      key={`school-${idx}`}
                      position={[s.latitude, s.longitude]}
                      icon={L.divIcon({
                        html: `
                          <svg width="24" height="28" viewBox="0 0 40 46" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 0 C9 0 0 9 0 20 C0 30 20 46 20 46 C20 46 40 30 40 20 C40 9 31 0 20 0 Z" fill="#4A90D9"/>
                            <circle cx="20" cy="19" r="13" fill="white" opacity="0.95"/>
                            <polygon points="20,10 28,15 20,20 12,15" fill="#4A90D9"/>
                            <rect x="17" y="20" width="6" height="5" rx="1" fill="#4A90D9"/>
                            <line x1="27" y1="15" x2="27" y2="21" stroke="#4A90D9" stroke-width="1.5"/>
                            <circle cx="27" cy="22" r="1.5" fill="#4A90D9"/>
                          </svg>`,
                        className: "school-marker",
                        iconSize: [24, 28],
                        iconAnchor: [12, 28]
                      })}
                    >
                      <Popup>
                        <div className="p-1">
                          <h4 className="font-black text-[10px] border-b pb-1 mb-2 uppercase tracking-widest text-blue-600">Education Center</h4>
                          <p className="text-[9px] font-black uppercase"><b>Name:</b> {s.school_name || s.name}</p>
                          <p className="text-[9px] font-bold text-slate-500 uppercase"><b>Type:</b> {s.school_type || "Public/Charter"}</p>
                          <p className="text-[9px] font-bold text-slate-500 uppercase"><b>Address:</b> {s.address}</p>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {showFireStations && fireStationLocations?.map((f, idx) => {
                  if (!f.latitude || !f.longitude) return null;
                  return (
                    <Marker
                      key={`fire-${idx}`}
                      position={[f.latitude, f.longitude]}
                      icon={L.divIcon({
                        html: `
                          <svg width="24" height="28" viewBox="0 0 40 46" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 0 C9 0 0 9 0 20 C0 30 20 46 20 46 C20 46 40 30 40 20 C40 9 31 0 20 0 Z" fill="#F2994A"/>
                            <circle cx="20" cy="19" r="13" fill="white" opacity="0.95"/>
                            <path d="M20 12 C17 18 24 20 20 28 C28 22 24 18 20 12 Z" fill="#F2994A"/>
                          </svg>`,
                        className: "fire-marker",
                        iconSize: [24, 28],
                        iconAnchor: [12, 28]
                      })}
                    >
                      <Popup>
                        <div className="p-1">
                          <h4 className="font-black text-[10px] border-b pb-1 mb-2 uppercase tracking-widest text-orange-600">CFD Station</h4>
                          <p className="text-[9px] font-black uppercase"><b>Station:</b> {f.station_name || f.name}</p>
                          <p className="text-[9px] font-bold text-slate-500 uppercase"><b>Address:</b> {f.address}</p>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>

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
            </div>
          </div>
        </>
      ) : (
        /* CRIME DASHBOARD LAYOUT */
        <div className="flex flex-col gap-3 animate-in fade-in duration-500" style={{ height: 'calc(100vh - 220px)', minHeight: 700 }}>
          <style>{DASHBOARD_MAP_STYLE}</style>

          {/* Top filter bar */}
          <div className="bg-white border border-slate-200 rounded-xl flex items-center justify-between px-6 py-3 shadow-sm z-10 w-full overflow-x-auto shrink-0">
            <div className="text-[15px] font-extrabold text-slate-800 tracking-tight shrink-0 mr-8">Crime and Strategic Plans</div>
            <div className="flex items-center gap-6 shrink-0">
              <DashboardFilter label="Police District" value={filters.district} options={districts} onChange={v => setFilters({ ...filters, district: v })} />
              <DashboardFilter label="Police Beat" value={filters.beat} options={[]} onChange={v => setFilters({ ...filters, beat: v })} />
              <DashboardFilter label="Ward" value={filters.ward} options={[]} onChange={v => setFilters({ ...filters, ward: v })} />
              <DashboardFilter label="Community" value={filters.community} options={[]} onChange={v => setFilters({ ...filters, community: v })} />
              <DashboardFilter label="Crime Types" value={filters.crimeType} options={[]} onChange={v => setFilters({ ...filters, crimeType: v })} />
              <div className="flex flex-col min-w-[100px]">
                <span className="text-[8px] text-slate-400 font-bold uppercase mb-1">Date</span>
                <select value={filters.dateRange} onChange={e => setFilters({ ...filters, dateRange: e.target.value })} className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer">
                  <option value="Last 7 Days">Last 7 Days</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                  <option value="Last 90 Days">Last 90 Days</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main body */}
          <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm min-h-0">

            {/* ── LEFT PANEL ── */}
            <div className="col-span-3 border-r border-slate-200 flex flex-col h-full min-h-0">

              {/* Large KPI row */}
              <div className="px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
                <div className="grid grid-cols-3 gap-0">
                  <KPIBox label="Total Crime" val={kpis?.total} colorClass="text-blue-900" />
                  <KPIBox label="Violent Crime" val={kpis?.violent} colorClass="text-red-500" />
                  <KPIBox label="Property Crime" val={kpis?.property} colorClass="text-amber-500" />
                </div>
              </div>

              {/* Crime Incidents heading + subtitle */}
              <div className="px-5 pt-4 pb-2 shrink-0">
                <div className="text-[13px] font-black text-slate-800 tracking-tight">Crime Incidents</div>
                <div className="text-[9px] font-semibold text-red-500 mt-0.5 italic">Most recent data of incidents occured</div>
              </div>

              {/* Search */}
              <div className="px-4 pb-2 shrink-0">
                <div className="relative">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    type="text"
                    placeholder="Search incidents..."
                    value={incidentSearchTerm}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-600 pl-8 pr-3 py-2 outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-slate-300 transition"
                    onChange={e => setIncidentSearchTerm(e.target.value)}
                    id="incident-search-input"
                  />
                </div>
              </div>

              {/* Scrollable incident list — 5 items visible */}
              <div
                className="flex-1 overflow-y-auto min-h-0"
                style={{ scrollSnapType: 'y mandatory' }}
              >
                {dashboardSubTab === "Crime Incidents" ? (
                  (() => {
                    const filtered = incidents.filter(inc =>
                      !incidentSearchTerm ||
                      (inc.primary_type || "").toLowerCase().includes(incidentSearchTerm.toLowerCase()) ||
                      (inc.block_address || "").toLowerCase().includes(incidentSearchTerm.toLowerCase()) ||
                      (inc.case_number || "").toLowerCase().includes(incidentSearchTerm.toLowerCase())
                    );

                    return filtered.length > 0 ? (
                      filtered.slice(0, 100).map((inc, i) => (
                        <div key={i} style={{ scrollSnapAlign: 'start' }}>
                          <IncidentListItemWide
                            inc={inc}
                            active={selectedIncident?.id === inc.id}
                            onClick={() => setSelectedIncident(inc)}
                          />
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center py-10">
                        <div className="text-[9px] font-black text-slate-400 uppercase">No crimes match search</div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-12 opacity-40 text-center">
                    <Loader2 className="animate-spin text-blue-600 mb-2" size={18} />
                    <span className="text-[9px] font-black text-slate-800 uppercase">Strategic Planning Module Offline</span>
                  </div>
                )}
              </div>

              {/* Sub-tabs pinned to bottom */}
              <div className="flex border-t border-slate-200 bg-white shrink-0">
                {["Crime Incidents", "Strategic Plans"].map(sub => (
                  <button
                    key={sub}
                    onClick={() => setDashboardSubTab(sub)}
                    className={`flex-1 text-center py-3 text-[9px] font-black uppercase cursor-pointer transition-all border-t-2 ${dashboardSubTab === sub
                      ? "border-blue-600 text-blue-600 bg-blue-50/50"
                      : "border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                      }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {/* ── RIGHT PANEL ── */}
            <div className="col-span-9 flex flex-col h-full min-h-0 bg-slate-50">
              {/* Content area — map or statistics */}
              <div className="flex-1 relative overflow-hidden min-h-0">
                {dashboardMode === "Crime Statistics" ? (
                  <div className="h-full overflow-y-auto p-6" style={{ scrollbarWidth: 'thin' }}>
                    <CrimeDashboard
                      data={crimeTypeData}
                      highlights={kpis}
                      districtName={filters.district === "All" ? "Citywide" : districts.find(d => d.id === filters.district)?.name || "Selected District"}
                      beatRanking={beatRanking}
                      wardRanking={wardRanking}
                      hourlyData={hourlyData}
                      dowData={dowData}
                      trendData={trendSeries}
                      filters={filters}
                    />
                  </div>
                ) : (
                  <>
                    <MapContainer
                      center={selectedIncident ? [selectedIncident.lat, selectedIncident.lng] : [41.8781, -87.6298]}
                      zoom={selectedIncident ? 16 : 11}
                      className="h-full w-full z-0"
                      zoomControl={true}
                    >
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                      <ZoomTracker setZoom={setZoom} />
                      <MapAutoScaler incidents={incidents} selectedIncident={selectedIncident} />

                      {/* Display All Boundaries by Default */}
                      {boundaries.district && (
                        <GeoJSON
                          data={boundaries.district}
                          style={{ color: "#272727", weight: 2, opacity: 0.6, fillColor: "transparent" }}
                        />
                      )}
                      {boundaries.beat && (
                        <GeoJSON
                          data={boundaries.beat}
                          style={{ color: "#0ea5e9", weight: 1, opacity: 0.4, dashArray: "5, 10", fillColor: "transparent" }}
                        />
                      )}
                      {boundaries.ward && (
                        <GeoJSON
                          data={boundaries.ward}
                          style={{ color: "#7dd3fc", weight: 0.8, opacity: 0.3, fillColor: "transparent" }}
                        />
                      )}

                      {/* Display All Incidents (Clusters) */}
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



                      {/* Highlight Selected Incident */}
                      {selectedIncident && (
                        <>
                          <Marker
                            position={[selectedIncident.lat, selectedIncident.lng]}
                            icon={L.divIcon({
                              html: `
                                <div class="selected-incident-highlight">
                                  <div class="pulse-ring"></div>
                                  <div class="center-dot" style="background: ${getCategoryColor(selectedIncident.category).color}"></div>
                                </div>
                              `,
                              className: "selected-marker",
                              iconSize: [40, 40],
                              iconAnchor: [20, 20]
                            })}
                            zIndexOffset={1000}
                          >
                            <Popup minWidth={300} className="forensic-popup">
                              <IncidentPopup inc={selectedIncident} count={1} />
                            </Popup>
                          </Marker>
                          <Circle
                            center={[selectedIncident.lat, selectedIncident.lng]}
                            radius={150}
                            pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.1, dashArray: '5,5' }}
                          />
                          <FindNearFlyTo lat={selectedIncident.lat} lng={selectedIncident.lng} />
                        </>
                      )}
                    </MapContainer>


                  </>
                )}
              </div>

              {/* Bottom toggle: Crime Map / Crime Statistics */}
              <div className="h-14 bg-white border-t border-slate-200 flex items-center justify-center gap-4 px-6 shrink-0">
                {["Crime Map", "Crime Statistics"].map(m => (
                  <button
                    key={m}
                    onClick={() => setDashboardMode(m)}
                    className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${dashboardMode === m
                      ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                      : "bg-white text-slate-400 border border-slate-200 hover:border-blue-400 hover:text-slate-700"
                      }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons — outside and below the panel */}
          <div className="flex items-center justify-end gap-4 shrink-0">
            <button className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-blue-600 border border-transparent hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition-all shadow-md shadow-blue-200 flex items-center gap-2">
              <Navigation size={14} /> Launch Strategic Planner
            </button>
          </div>
        </div>
      )}
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
              <span className="text-[10px] font-black text-slate-800 truncate max-w-[80px] uppercase">{currentInc.community_area_name || currentInc.community_area || 'N/A'}</span>
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

function CrimeDashboard({ data, highlights, districtName = "Citywide", beatRanking = [], wardRanking = [], hourlyData = [], dowData = [], trendData = [], filters }) {
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
          <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-2">
            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
              {filters.crimeType !== "All" ? "" : "Top 10 "}Crimes ({districtName})
            </h4>
            <button onClick={() => downloadCSV(barData, `top_crimes_${districtName}.csv`)} className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors" title="Export CSV">
              <DownloadCloud size={14} />
            </button>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  fontSize={8}
                  fontWeight="bold"
                  axisLine={false}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                  height={50}
                  tickFormatter={(v) => v.length > 10 ? v.substring(0, 9) + '..' : v}
                />
                <YAxis fontSize={8} fontWeight="bold" axisLine={false} tickLine={false} tickFormatter={(v) => v.toLocaleString()} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '9px' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={16}>
                  {barData.map((d, i) => <Cell key={i} fill={getCategoryColor(d.category).color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[280px]">
          <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-2">
            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Crime by Day of Week</h4>
            <button onClick={() => downloadCSV(dowData, "crime_by_dow.csv")} className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors" title="Export CSV">
              <DownloadCloud size={14} />
            </button>
          </div>
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
          <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-2">
            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
              {filters.beat !== "All" || filters.district !== "All" ? "" : "Top 10 "}Incidents by Beat
            </h4>
            <button onClick={() => downloadCSV(beatRanking.slice(0, 10), "crime_by_beat.csv")} className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors" title="Export CSV">
              <DownloadCloud size={14} />
            </button>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={beatRanking.slice(0, 10)} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="id" fontSize={8} fontWeight="bold" axisLine={false} tickLine={false} interval={0} height={30} />
                <YAxis fontSize={8} fontWeight="bold" axisLine={false} tickLine={false} tickFormatter={(v) => v.toLocaleString()} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '9px' }} />
                <Bar dataKey="crime_count" fill="#0369a1" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-[280px] flex flex-col">
          <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-2">
            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Crime by Time of Day</h4>
            <button onClick={() => downloadCSV(hourlyData, "crime_by_hour.csv")} className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors" title="Export CSV">
              <DownloadCloud size={14} />
            </button>
          </div>
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
          <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-2">
            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
              {filters.ward !== "All" ? "" : "Top 10 "}Incidents by Ward
            </h4>
            <button onClick={() => downloadCSV(wardRanking.slice(0, 10), "crime_by_ward.csv")} className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors" title="Export CSV">
              <DownloadCloud size={14} />
            </button>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wardRanking.slice(0, 10)} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="id" fontSize={8} fontWeight="bold" axisLine={false} tickLine={false} interval={0} height={30} />
                <YAxis fontSize={8} fontWeight="bold" axisLine={false} tickLine={false} tickFormatter={(v) => v.toLocaleString()} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '9px' }} />
                <Bar dataKey="crime_count" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[280px]">
          <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-2">
            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Categorical Split</h4>
            <button onClick={() => downloadCSV(pieData, "crime_categories.csv")} className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors" title="Export CSV">
              <DownloadCloud size={14} />
            </button>
          </div>
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
        <div className="flex items-center justify-between mb-6 border-b border-slate-50 pb-2">
          <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Crime over Time (Trend Analytics)</h4>
          <button onClick={() => downloadCSV(trendData, "crime_trends.csv")} className="p-1 hover:bg-slate-100 rounded text-slate-400 transition-colors" title="Export CSV">
            <DownloadCloud size={14} />
          </button>
        </div>
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

function FindNearFlyTo({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], 15, { duration: 1.5 });
    }
  }, [lat, lng, map]);
  return null;
}

function ZoomTracker({ setZoom }) {
  const map = useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });
  return null;
}

function MapAutoScaler({ incidents, selectedIncident }) {
  const map = useMap();
  useEffect(() => {
    if (selectedIncident) {
      map.flyTo([selectedIncident.lat, selectedIncident.lng], 16, { duration: 1.5 });
    } else if (incidents && incidents.length > 0) {
      const valid = incidents.filter(i => i.lat > 41.6 && i.lat < 42.1 && i.lng < -87.5 && i.lng > -87.9);
      if (valid.length > 0) map.fitBounds(L.latLngBounds(valid.map(i => [i.lat, i.lng])), { padding: [50, 50], maxZoom: 13 });
    }
  }, [incidents, selectedIncident, map]);
  return null;
}
