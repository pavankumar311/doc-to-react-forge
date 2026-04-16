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
  AUTH_TOKEN
} from "../services/api";

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
  const [boundaries, setBoundaries] = useState({ ward: null, district: null, beat: null });
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
      } catch (err) { console.error("Boundary init failed:", err); }
    }
    init();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const LAG_DAYS = 7;
      const dateToObj = new Date(Date.now() - LAG_DAYS * 86400000);
      const dateTo = dateToObj.toISOString().split("T")[0];
      const intervalDays = filters.dateRange === "Last 30 Days" ? 30 : 90;
      const dateFrom = new Date(dateToObj.getTime() - intervalDays * 86400000).toISOString().split("T")[0];
      
      const q = { dateFrom, dateTo, limit: 1200 };
      const [summary, types, mapPoints] = await Promise.all([
        fetchSummaryKPIs(q), fetchIncidentsByCrimeType(q), fetchMapIncidents(q)
      ]);

      let v = 0, p = 0, o = 0;
      types.forEach(item => {
        const c = (item.category || "").toLowerCase();
        if (c === "violent") v += item.count;
        else if (c === "property") p += item.count;
        else o += item.count;
      });

      setKpis({ total: summary.total_incidents || 0, violent: v, property: p, other: o });
      
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

  useEffect(() => { loadData(); }, [filters.dateRange]);

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
    <div className="space-y-4 pb-8">
      {/* Dashboard Sub-Tabs */}
      <div className="flex gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200 w-fit">
        {["Map Area Crime", "Crime Dashboard"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-6 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {/* Forensic KPI Header */}
        <div className="grid grid-cols-4 gap-4">
          {[{ label: "Total Crimes", val: reactiveKpis.total }, { label: "Violent Crimes", val: reactiveKpis.violent }, { label: "Property Crimes", val: reactiveKpis.property }, { label: "Other Crimes", val: reactiveKpis.other }].map(k => (
            <div key={k.label} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{k.label}</div>
              <div className={`text-3xl font-black tracking-tighter ${k.label.includes('Violent') ? 'text-red-600' : 'text-slate-800'}`}>{k.val.toLocaleString()}</div>
              <div className="text-[8px] text-slate-400 mt-1 uppercase font-bold tracking-tight">Active Filtered View</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-4 h-[650px] relative">
          {loading && <LoadingOverlay />}
          
          {/* Controls Panel */}
          <div className="col-span-3 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-sm">
            <div className="p-4 border-b border-slate-100 bg-slate-50 text-center">
              <span className="text-xs font-black text-blue-900 uppercase">Forensic Filters</span>
              <p className="text-[9px] text-red-500 mt-0.5 font-bold uppercase tracking-tight">Reporting Lag: 7 Days</p>
            </div>
            
            <div className="p-5 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
              <div className="space-y-3">
                 {["Last 30 Days", "Last 90 Days"].map(d => (
                   <label key={d} className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" checked={filters.dateRange === d} onChange={() => setFilters({...filters, dateRange: d})} className="w-4 h-4 accent-blue-600" />
                      <span className="text-xs font-bold text-slate-700">{d}</span>
                   </label>
                 ))}
              </div>

              <div className="pt-6 border-t border-slate-100 space-y-4">
                 {["violent", "property", "other"].map(t => (
                   <label key={t} className="flex items-center justify-between cursor-pointer group">
                      <span className="text-[11px] font-black text-slate-700 uppercase group-hover:text-blue-600 transition-colors">{t} Crime</span>
                      <div onClick={() => setFilters({...filters, crimeToggles: {...filters.crimeToggles, [t]: !filters.crimeToggles[t]}})} className={`w-10 h-5 rounded-full relative transition-all ${filters.crimeToggles[t] ? "bg-blue-600 shadow-lg shadow-blue-200" : "bg-slate-300"}`}>
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${filters.crimeToggles[t] ? "left-6" : "left-1"}`} />
                      </div>
                   </label>
                 ))}
              </div>

              <div className="pt-6 border-t border-slate-100 space-y-2">
                 <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2">Map Overlays</h4>
                 {["district", "beat", "ward"].map(l => (
                   <label key={l} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={filters.layers[l]} onChange={() => setFilters({...filters, layers: {...filters.layers, [l]: !filters.layers[l]}})} className="w-4 h-4 accent-blue-600 rounded" />
                      <span className="text-xs font-bold text-slate-600 capitalize">{l} Boundaries</span>
                   </label>
                 ))}
              </div>
            </div>
          </div>

          {/* Map Section */}
          <div className="col-span-7 bg-white rounded-2xl border border-slate-200 overflow-hidden relative shadow-md">
             <MapContainer center={[41.8781, -87.6298]} zoom={11} className="h-full w-full" zoomControl={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                <ZoomTracker setZoom={setZoom} />
                <MapAutoScaler incidents={incidents} />
                
                {/* Boundaries */}
                {filters.layers.district && boundaries.district && <GeoJSON data={boundaries.district} style={{ color: "black", weight: 3, opacity: 1, fillColor: "transparent" }} />}
                {filters.layers.beat && boundaries.beat && <GeoJSON data={boundaries.beat} style={{ color: "#0ea5e9", weight: 1.5, opacity: 0.6, dashArray: "5, 10", fillColor: "transparent" }} />}
                {filters.layers.ward && boundaries.ward && <GeoJSON data={boundaries.ward} style={{ color: "#7dd3fc", weight: 1.0, opacity: 0.5, fillColor: "transparent" }} />}
                
                {/* INCIDENT CLUSTERS: Using standard Marker but with ultra-high z-index */}
                {spatialClusters.length > 0 && spatialClusters.map((c, idx) => (
                  <Marker 
                    key={`${c.lat}_${c.lng}_${idx}`} 
                    position={[c.lat, c.lng]} 
                    icon={createClusterIcon(c.count, getCategoryColor(c.category).color)}
                    zIndexOffset={2000}
                  >
                    <Popup minWidth={300} className="forensic-popup">
                      <IncidentPopup inc={c.incidents[0]} count={c.count} clusterIncidents={c.incidents} />
                    </Popup>
                  </Marker>
                ))}
             </MapContainer>
          </div>

          {/* Right Legend */}
          <div className="col-span-2 space-y-4">
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col">
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-6">Categorical Keys</h4>
                <div className="space-y-6 flex-1">
                   {Object.entries(CRIME_TYPES).map(([k, g]) => (
                     <div key={k} className="space-y-2">
                        <div className="flex items-center gap-3">
                           <div className="w-4 h-4 rounded-full shadow-inner" style={{ background: g.color }} />
                           <span className="text-[10px] font-black text-slate-700 uppercase">{g.label}</span>
                        </div>
                        <div className="pl-7 space-y-1">
                           {g.items.map(it => <div key={it} className="text-[9px] font-bold text-slate-400 tracking-tight">• {it}</div>)}
                        </div>
                     </div>
                   ))}
                </div>
                <div className="pt-4 border-t border-slate-100 italic text-[8px] text-slate-400 font-bold uppercase text-center">
                   © Chicago Data Portal
                </div>
             </div>
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
    const predominant = types.sort((a,b) =>
      types.filter(v => v===a).length - types.filter(v => v===b).length
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
         <div className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.25em]">CPD Forensic Feed</div>
         <Info size={10} className="text-slate-300" />
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
