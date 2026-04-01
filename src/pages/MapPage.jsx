import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parse } from "date-fns";
import { Layers, Download, Calendar as CalendarIcon, Filter, ChevronDown } from "lucide-react";

import ThematicMap from "../components/ThematicMap";
import ThematicLegend from "../components/ThematicLegend";
import { HeatmapSkeleton } from "../components/Skeletons";
import { useFilters } from "../contexts/FilterContext";
import { AUTH_TOKEN, fetchPoliceStations } from "../services/api";

const BASE_URL = "http://localhost:9001";
const THEMATIC_COLORS = ["#fde68a", "#fbbf24", "#f59e0b", "#f97316", "#ef4444"];

/* ── Inline Component: DateInput (Styled like Home Page) ──────────────── */
function DateInput({ label, value, onChange }) {
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  const isValid = !Number.isNaN(parsed?.getTime());
  const display = isValid ? format(parsed, "MMM d, yyyy") : "Select";

  const handleSelect = (date) => {
    if (!date) return;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    onChange(`${yyyy}-${mm}-${dd}`);
  };

  return (
    <div className="flex flex-col gap-1.5 text-foreground">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <button className="flex items-center gap-1.5 h-8 px-3 rounded text-[11px] font-medium border border-border bg-background hover:bg-accent/40 transition-colors">
        <CalendarIcon className="h-3.5 w-3.5 opacity-60 text-azure" />
        <span>{display}</span>
      </button>
    </div>
  );
}

const formatDateStr = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const buildPresetRange = (presetDays, maxDate) => {
  const end = maxDate ? new Date(maxDate) : new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - presetDays);
  return {
    from: formatDateStr(start),
    to: formatDateStr(end),
  };
};

const buildBins = (values, count) => {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const lastIdx = sorted.length - 1;
  const bins = [];
  for (let i = 0; i < count; i += 1) {
    const minIdx = Math.floor((i / count) * lastIdx);
    const maxIdx = Math.floor(((i + 1) / count) * lastIdx);
    bins.push({ min: sorted[minIdx] || 0, max: sorted[maxIdx] || 100 });
  }
  return bins;
};

export default function MapPage() {
  const { filters: globalFilters } = useFilters();
  const [districts, setDistricts] = useState([]);
  const [riskData, setRiskData] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [filterOptions, setFilterOptions] = useState(null);

  // Local Filter States
  const [localDateFrom, setLocalDateFrom] = useState(globalFilters.dateFrom);
  const [localDateTo, setLocalDateTo] = useState(globalFilters.dateTo);
  const [localCrimeTypeIds, setLocalCrimeTypeIds] = useState(new Set());
  const [localDatePreset, setLocalDatePreset] = useState("30");

  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [stations, setStations] = useState([]);

  const [mapZoom, setMapZoom] = useState(11);
  const [viewMode, setViewMode] = useState("density"); // density vs points
  const [showArrests, setShowArrests] = useState(false);
  const [showDomestic, setShowDomestic] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingMap, setLoadingMap] = useState(false);
  const [error, setError] = useState("");

  const selectedDistrict = useMemo(
    () => districts.find((d) => d.district_id === selectedDistrictId) || null,
    [districts, selectedDistrictId]
  );

  const riskValues = useMemo(
    () => riskData
      .map((item) => Number(item.crimes_per_1000))
      .filter((value) => Number.isFinite(value)),
    [riskData]
  );

  const bins = useMemo(
    () => buildBins(riskValues, THEMATIC_COLORS.length),
    [riskValues]
  );

  const selectedDistrictRisk = useMemo(
    () => riskData.find((item) => item.district_id === selectedDistrictId) || null,
    [riskData, selectedDistrictId]
  );

  // Initial load
  useEffect(() => {
    const loadBootstrap = async () => {
      setLoading(true);
      try {
        const [districtsRes, filtersRes] = await Promise.all([
          fetch(`${BASE_URL}/api/v1/dashboard/districts?include_boundary=true`, {
            headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
          }),
          fetch(`${BASE_URL}/api/v1/dashboard/filters`, {
            headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
          }),
        ]);

        if (!districtsRes.ok) throw new Error("Districts request failed");
        const districtsData = await districtsRes.json();
        const filtersData = await filtersRes.ok ? await filtersRes.json() : null;

        setDistricts(districtsData || []);
        setFilterOptions(filtersData);

        // Fetch stations separately so it doesn't block critical map data
        try {
          const stationsRes = await fetch(`${BASE_URL}/api/v1/dashboard/map/police-stations`, {
            headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
          });
          const stationsData = await stationsRes.json();
          // Extract array even if wrapped in { stations: [] } or { data: [] }
          const stationList = Array.isArray(stationsData) 
            ? stationsData 
            : (stationsData?.stations || stationsData?.data || []);
          setStations(stationList);
        } catch (sErr) {
          console.warn("Station markers failed to load, continuing map render:", sErr);
          setStations([]);
        }

        if (!localDateFrom || !localDateTo) {
          const maxDate = filtersData?.date_range?.max_date;
          const range = buildPresetRange(30, maxDate);
          setLocalDateFrom(range.from);
          setLocalDateTo(range.to);
        }
      } catch (err) {
        setError(err.message || "Failed to load initial data");
      } finally {
        setLoading(false);
      }
    };
    loadBootstrap();
  }, []);

  // Map Data Loading
  useEffect(() => {
    const loadMapData = async () => {
      if (!localDateFrom || !localDateTo) return;
      setLoadingMap(true);
      setError("");
      try {
        const commonParams = new URLSearchParams({
          date_from: localDateFrom,
          date_to: localDateTo,
        });

        if (localCrimeTypeIds.size > 0) {
          commonParams.set("crime_type_ids", Array.from(localCrimeTypeIds).join(","));
        }
        if (showArrests) commonParams.set("is_arrest", "true");
        if (showDomestic) commonParams.set("is_domestic", "true");

        const riskUrl = `${BASE_URL}/api/v1/dashboard/district-risk?${commonParams.toString()}`;
        const blocksUrl = `${BASE_URL}/api/v1/dashboard/map/blocks?${commonParams.toString()}&limit=5000`;
        const incidentsUrl = `${BASE_URL}/api/v1/dashboard/map/incidents?${commonParams.toString()}&limit=1000`;

        const [riskRes, blocksRes, incidentsRes] = await Promise.all([
          fetch(riskUrl, { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } }),
          fetch(blocksUrl, { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } }),
          fetch(incidentsUrl, { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } }),
        ]);

        const riskJson = await riskRes.json();
        const blocksJson = await blocksRes.json();
        const incidentsJson = await incidentsRes.json();

        setRiskData(riskJson?.districts || []);
        setBlocks(blocksJson?.blocks || []);
        setIncidents(incidentsJson || []);
      } catch (err) {
        console.error(err);
        setError("Failed to sync map forensics");
      } finally {
        setLoadingMap(false);
      }
    };

    loadMapData();
  }, [localDateFrom, localDateTo, localCrimeTypeIds, showArrests, showDomestic]);

  const toggleCrimeType = (id) => {
    setLocalCrimeTypeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onZoomChange = useCallback((zoom) => setMapZoom(zoom), []);

  if (loading) return <HeatmapSkeleton />;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Thematic Map Analysis</h1>
          <p className="text-xs text-muted-foreground mt-1">Cross-sectional analysis of crime density and risk distribution</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`h-8 px-4 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border ${viewMode === "points" ? "bg-azure text-white border-azure" : "border-border text-azure"}`}
            onClick={() => setViewMode((v) => (v === "density" ? "points" : "density"))}
          >
            <Layers size={14} /> {viewMode === "points" ? "Incident View" : "Density View"}
          </button>
          <button className="h-8 px-4 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-border text-muted-foreground hover:text-foreground">
            <Download size={14} /> Snapshot
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-6 p-5 rounded-xl border border-border bg-accent/5 backdrop-blur-md">
          <div className="space-y-1.5 min-w-[140px]">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Time Window</label>
            <select
              value={localDatePreset}
              onChange={e => setLocalDatePreset(e.target.value)}
              className="h-8 w-full rounded bg-background border border-border px-3 text-[11px] font-bold"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
          </div>

          <div className="space-y-1.5 min-w-[180px]">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Focus District</label>
            <select
              value={selectedDistrictId || ""}
              onChange={(e) => setSelectedDistrictId(e.target.value)}
              className="h-8 w-full rounded bg-background border border-border px-3 text-[11px] font-bold text-azure"
            >
              <option value="">Full City Oversight</option>
              {districts.map((d) => (
                <option key={d.district_id} value={d.district_id}>{d.district_name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 border-l border-border pl-6 ml-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Quick Filters</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={showArrests} onChange={e => setShowArrests(e.target.checked)} className="w-4 h-4 rounded border-border" />
                <span className="text-[11px] font-bold text-muted-foreground group-hover:text-foreground">Arrests Only</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={showDomestic} onChange={e => setShowDomestic(e.target.checked)} className="w-4 h-4 rounded border-border" />
                <span className="text-[11px] font-bold text-muted-foreground group-hover:text-foreground">Domestic Incidents</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {filterOptions?.crime_types?.map(type => {
            const active = localCrimeTypeIds.has(type.crime_type_id);
            return (
              <button
                key={type.crime_type_id}
                onClick={() => toggleCrimeType(type.crime_type_id)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${active ? "bg-azure/20 border-azure text-azure shadow-lg shadow-azure/10 scale-105" : "border-border text-muted-foreground hover:border-gray-500"}`}
              >
                {type.primary_type}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-5" style={{ height: "calc(100vh - 360px)" }}>
        <div className="flex-1 relative rounded-2xl overflow-hidden border border-border shadow-2xl bg-black">
          <ThematicMap
            districts={districts}
            riskData={riskData}
            bins={bins}
            colors={THEMATIC_COLORS}
            selectedDistrictId={selectedDistrictId}
            onSelectDistrict={(d) => setSelectedDistrictId(d.district_id)}
            onZoomChange={onZoomChange}
            mapZoom={mapZoom}
            blocks={blocks}
            showBlocks={viewMode === "density"}
            incidents={incidents}
            showIncidents={viewMode === "points"}
            onSelectIncident={setSelectedIncident}
            activeIncidentId={selectedIncident?.incident_id}
            stations={stations}
          />

          <ThematicLegend title="Incidents per 1k" bins={bins} colors={THEMATIC_COLORS} />

          {loadingMap && (
            <div className="absolute top-6 left-6 rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-black/80 border border-azure text-azure backdrop-blur-xl animate-pulse z-[1000]">
              Syncing Forensics...
            </div>
          )}
        </div>

        {/* Dynamic Side Panel */}
        {(selectedDistrict || selectedIncident) && (
          <div className="w-[340px] rounded-2xl overflow-y-auto bg-card border border-border shadow-2xl animate-in slide-in-from-right-4 duration-500">
            {selectedIncident ? (
              <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-sm font-black uppercase tracking-tight text-white">Incident Forensics</h2>
                  <button onClick={() => setSelectedIncident(null)} className="h-6 w-6 text-muted-foreground">×</button>
                </div>
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-azure/10 border border-azure/30">
                    <div className="text-[10px] font-black text-azure uppercase tracking-wider mb-2">Classification</div>
                    <div className="text-base font-bold text-white leading-tight">{selectedIncident.primary_type}</div>
                    <div className="text-[11px] text-gray-400 mt-2">{selectedIncident.description}</div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="text-[9px] font-bold text-gray-500 uppercase">Location</div>
                      <div className="text-[11px] font-medium mt-1">{selectedIncident.block_address}</div>
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <div className="text-[9px] font-bold text-gray-500 uppercase">Date</div>
                        <div className="text-[11px] font-medium mt-1">{selectedIncident.date}</div>
                      </div>
                      <div>
                        <div className="text-[9px] font-bold text-gray-500 uppercase">Arrest</div>
                        <div className={`text-[11px] font-black mt-1 ${selectedIncident.is_arrest ? "text-green-500" : "text-red-500"}`}>
                          {selectedIncident.is_arrest ? "YES" : "NO"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-sm font-black uppercase tracking-tight text-white">{selectedDistrict.district_name}</h2>
                  <button onClick={() => setSelectedDistrictId("")} className="h-6 w-6 text-muted-foreground">×</button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
                      <div className="text-[9px] font-bold text-gray-500 uppercase mb-1">Incident Count</div>
                      <div className="text-xl font-black">{selectedDistrictRisk?.crime_count || 0}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
                      <div className="text-[9px] font-bold text-gray-500 uppercase mb-1">Density/1k</div>
                      <div className="text-xl font-black text-azure">{Number(selectedDistrictRisk?.crimes_per_1000 || 0).toFixed(1)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
                      <div className="text-[9px] font-bold text-gray-500 uppercase mb-1">Arrest Rate</div>
                      <div className="text-xl font-black text-green-500">{selectedDistrictRisk?.arrest_rate || 0}%</div>
                    </div>
                    <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
                      <div className="text-[9px] font-bold text-gray-500 uppercase mb-1">Domestic Rate</div>
                      <div className="text-xl font-black text-purple-500">{selectedDistrictRisk?.domestic_rate || 0}%</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
