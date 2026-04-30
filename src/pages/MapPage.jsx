/** GSCIP Map Page v1.5 */
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { format, parse } from "date-fns";
import { Layers, Download, Calendar as CalendarIcon, Filter, ChevronDown, Check, Maximize2, Minimize2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import ThematicMap from "../components/ThematicMap";
import ThematicLegend from "../components/ThematicLegend";
import { HeatmapSkeleton } from "../components/Skeletons";
import { useFilters } from "../contexts/FilterContext";
import { AUTH_TOKEN, fetchPoliceStations, fetchPoliceBeats, fetchPrecincts } from "../services/api";
import { shiftIsoDateStringUtc, toIsoDateStringUtc } from "../utils/isoDate";

const BASE_URL = "";
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

const buildPresetRange = (presetDays, maxDate) => {
  const endIso = maxDate ? toIsoDateStringUtc(maxDate) : toIsoDateStringUtc(new Date());
  const startIso = shiftIsoDateStringUtc(endIso, -presetDays) || endIso;
  return {
    from: startIso,
    to: endIso,
  };
};

function haversineDistanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getPrecinctCentroid(precinct) {
  if (!precinct?.boundary) return [41.84, -87.63];
  try {
    const coords = precinct.boundary.type === "Polygon"
      ? precinct.boundary.coordinates[0]
      : precinct.boundary.coordinates[0][0];
    const lats = coords.map(c => c[1]);
    const lons = coords.map(c => c[0]);
    const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const avgLon = lons.reduce((a, b) => a + b, 0) / lons.length;
    return [avgLat, avgLon];
  } catch (e) {
    return [41.84, -87.63];
  }
}

const buildBins = (values, count) => {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  // Handle all values being the same (e.g., all zeros)
  if (min === max) {
    if (max === 0) return []; // Hide legend if all are zero
    return [{ min: 0, max: max }]; // Single bin if all identical non-zero
  }

  const lastIdx = sorted.length - 1;
  const bins = [];
  for (let i = 0; i < count; i += 1) {
    const minIdx = Math.floor((i / count) * lastIdx);
    const maxIdx = Math.floor(((i + 1) / count) * lastIdx);
    bins.push({
      min: sorted[minIdx] || 0,
      max: sorted[maxIdx] || (sorted[minIdx] + 1)
    });
  }
  return bins;
};

/* ── Inline Component: MultiSelect for Crime Types ──────────────────── */
function CrimeTypeMultiSelect({ options, selectedIds, onToggle, onClearAll }) {
  const selectedCount = selectedIds?.size || 0;
  const display = selectedCount === 0
    ? "All Crimes Types"
    : selectedCount === 1
      ? options.find(o => selectedIds.has(o.crime_type_id))?.primary_type
      : `${selectedCount} Types Selection`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center justify-between w-full h-8 px-3 rounded bg-background border border-border text-[11px] font-bold text-foreground transition-all shadow-sm hover:bg-accent/40">
          <span className="truncate mr-2">{display}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 bg-white border border-border shadow-xl z-[2000]" align="start">
        <div className="p-3 border-b border-border flex items-center justify-between bg-muted/20">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Crime Classification</span>
          {selectedCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearAll();
              }}
              className="px-2 py-1 rounded bg-primary text-[9px] font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/90 transition-all shadow-md"
            >
              Reset
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
          {options?.map((type) => {
            const active = selectedIds.has(type.crime_type_id);
            return (
              <div
                key={type.crime_type_id}
                onClick={() => onToggle(type.crime_type_id)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 group hover:bg-accent/40"
              >
                <div className={`flex-shrink-0 w-4 h-4 rounded-sm border flex items-center justify-center transition-all duration-300 ${active ? 'bg-primary border-primary shadow-sm' : 'border-input group-hover:border-primary/50'}`}>
                  {active && <Check className="h-2.5 w-2.5 text-primary-foreground stroke-[4]" />}
                </div>
                <span className={`text-[10px] font-bold tracking-wide transition-colors ${active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                  {type.primary_type}
                </span>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function MapPage() {
  const { filters: globalFilters } = useFilters();
  const [districts, setDistricts] = useState([]);
  const [riskData, setRiskData] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [filterOptions, setFilterOptions] = useState(null);

  // Map Container Ref for Fullscreen
  const mapContainerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Local Filter States
  const [localDateFrom, setLocalDateFrom] = useState(globalFilters.dateFrom);
  const [localDateTo, setLocalDateTo] = useState(globalFilters.dateTo);
  const [localCrimeTypeIds, setLocalCrimeTypeIds] = useState(new Set());
  const [localDatePreset, setLocalDatePreset] = useState("30");

  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [stations, setStations] = useState([]);
  const [beats, setBeats] = useState([]);
  const [precincts, setPrecincts] = useState([]);
  const [selectedPrecinct, setSelectedPrecinct] = useState(null);
  const [beatRiskData, setBeatRiskData] = useState([]);
  const [showPoliticalWards, setShowPoliticalWards] = useState(false);

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
    const handleFsChange = () => setIsFullscreen(document.fullscreenElement === mapContainerRef.current);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mapContainerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const loadBootstrap = async () => {
      setLoading(true);
      try {
        const [districtsRes, filtersRes] = await Promise.all([
          fetch(`${BASE_URL}/api/v1/dashboard/districts?include_boundary=true`, {
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${AUTH_TOKEN}`,
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          }),
          fetch(`${BASE_URL}/api/v1/dashboard/filters`, {
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${AUTH_TOKEN}`,
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          }),
        ]);

        if (!districtsRes.ok) throw new Error("Districts request failed");
        const districtsData = await districtsRes.json();
        const filtersData = await filtersRes.ok ? await filtersRes.json() : null;

        setDistricts(districtsData || []);
        setFilterOptions(filtersData);
        setBeatRiskData([]); // Initialize beat risk

        // Fetch infra & boundaries
        try {
          const [sData, bData, pData] = await Promise.all([
            fetchPoliceStations(),
            fetchPoliceBeats(),
            fetchPrecincts()
          ]);
          setStations(Array.isArray(sData) ? sData : (sData?.stations || sData?.data || []));
          setBeats(bData || []);
          setPrecincts(pData || []);
        } catch (sErr) {
          console.warn("Extra layers failed to load:", sErr);
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

  // ── Time Window Preset → actual dates (THE FIX) ──────────────────────
  useEffect(() => {
    if (localDatePreset === "custom") return; // custom mode: user controls dates directly
    const maxDate = filterOptions?.date_range?.max_date || null;
    const range = buildPresetRange(Number(localDatePreset), maxDate);
    setLocalDateFrom(range.from);
    setLocalDateTo(range.to);
  }, [localDatePreset, filterOptions]);

  // Map Data Loading
  useEffect(() => {
    const controller = new AbortController();
    const loadMapData = async () => {
      // Wait for bootstrap (filters/districts) to be ready
      if (!localDateFrom || !localDateTo || districts.length === 0) return;
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

        const headers = { Authorization: `Bearer ${AUTH_TOKEN}` };
        const signal = controller.signal;

        const riskUrl = `${BASE_URL}/api/v1/dashboard/district-risk?${commonParams.toString()}`;
        const beatRiskUrl = `${BASE_URL}/api/v1/dashboard/map/beat-risk?${commonParams.toString()}`;
        const blocksUrl = `${BASE_URL}/api/v1/dashboard/map/blocks?${commonParams.toString()}&limit=5000`;
        const incidentsUrl = `${BASE_URL}/api/v1/dashboard/map/incidents?${commonParams.toString()}&limit=1000`;

        const [riskRes, beatRiskRes, blocksRes, incidentsRes] = await Promise.all([
          fetch(riskUrl, { headers, signal }),
          fetch(beatRiskUrl, { headers, signal }),
          fetch(blocksUrl, { headers, signal }),
          fetch(incidentsUrl, { headers, signal }),
        ]);

        const riskJson = await riskRes.json();
        const beatRiskJson = await beatRiskRes.json();
        const blocksJson = await blocksRes.json();
        const incidentsJson = await incidentsRes.json();

        setRiskData(riskJson?.districts || []);
        setBeatRiskData(beatRiskJson?.beats || []);
        setBlocks(blocksJson?.blocks || []);
        setIncidents(incidentsJson || []);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error(err);
        setError("Failed to sync map forensics");
      } finally {
        setLoadingMap(false);
      }
    };

    loadMapData();
    return () => controller.abort();
  }, [localDateFrom, localDateTo, localCrimeTypeIds, showArrests, showDomestic]);

  const toggleCrimeType = (id) => {
    setLocalCrimeTypeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearCrimeTypes = () => {
    setLocalCrimeTypeIds(new Set());
    setRiskData([]);
    setIncidents([]);
    setBlocks([]);
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
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Time Window</label>
            <select
              value={localDatePreset}
              onChange={e => setLocalDatePreset(e.target.value)}
              className="h-8 w-full rounded bg-background border border-border px-3 text-[11px] font-bold min-w-[140px]"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="custom">📅 Custom Range</option>
            </select>

            {/* ── Custom date range picker — Popover+Calendar (matches FilterBar) ── */}
            {localDatePreset === "custom" && (
              <div className="flex items-center gap-3 mt-2 p-3 rounded-xl border border-azure/30 bg-azure/5 backdrop-blur-sm">
                {/* FROM */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">From</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1.5 h-8 px-3 rounded text-xs font-medium border border-input bg-background text-foreground hover:bg-accent/40 transition-colors">
                        <CalendarIcon className="h-3.5 w-3.5 opacity-60 text-azure" />
                        <span>{localDateFrom ? format(parse(localDateFrom, "yyyy-MM-dd", new Date()), "MMM d, yyyy") : "Select"}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={localDateFrom ? parse(localDateFrom, "yyyy-MM-dd", new Date()) : undefined}
                        onSelect={(date) => date && setLocalDateFrom(format(date, "yyyy-MM-dd"))}
                        disabled={(date) => localDateTo ? date > parse(localDateTo, "yyyy-MM-dd", new Date()) : false}
                        className="p-3"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="text-muted-foreground font-bold text-sm">→</div>

                {/* TO */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">To</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1.5 h-8 px-3 rounded text-xs font-medium border border-input bg-background text-foreground hover:bg-accent/40 transition-colors">
                        <CalendarIcon className="h-3.5 w-3.5 opacity-60 text-azure" />
                        <span>{localDateTo ? format(parse(localDateTo, "yyyy-MM-dd", new Date()), "MMM d, yyyy") : "Select"}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={localDateTo ? parse(localDateTo, "yyyy-MM-dd", new Date()) : undefined}
                        onSelect={(date) => date && setLocalDateTo(format(date, "yyyy-MM-dd"))}
                        disabled={(date) => localDateFrom ? date < parse(localDateFrom, "yyyy-MM-dd", new Date()) : false}
                        className="p-3"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Day count badge */}
                {localDateFrom && localDateTo && (
                  <div className="h-7 px-3 rounded-lg bg-azure/20 border border-azure/30 text-azure text-[10px] font-black flex items-center gap-1">
                    <span className="text-[9px]">✓</span>
                    {Math.round((new Date(localDateTo) - new Date(localDateFrom)) / 86400000 + 1)}d
                  </div>
                )}
              </div>
            )}
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

          <div className="space-y-1.5 min-w-[200px]">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Crimes Types</label>
            <CrimeTypeMultiSelect
              options={filterOptions?.crime_types}
              selectedIds={localCrimeTypeIds}
              onToggle={toggleCrimeType}
              onClearAll={clearCrimeTypes}
            />
          </div>

          <div className="flex flex-col gap-2 border-l border-border pl-6 ml-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Quick Filters</label>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={showArrests} onChange={e => setShowArrests(e.target.checked)} className="w-4 h-4 rounded border-border accent-azure" />
                <span className="text-[11px] font-bold text-azure group-hover:brightness-125 transition-all">Arrests Only</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group border-l border-border pl-6">
                <input type="checkbox" checked={showDomestic} onChange={e => setShowDomestic(e.target.checked)} className="w-4 h-4 rounded border-border accent-azure" />
                <span className="text-[11px] font-bold text-azure group-hover:brightness-125 transition-all">Domestic Incidents</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group border-l border-border pl-6">
                <input type="checkbox" checked={showPoliticalWards} onChange={e => setShowPoliticalWards(e.target.checked)} className="w-4 h-4 rounded border-border accent-azure" />
                <span className="text-[11px] font-bold text-azure group-hover:brightness-125 transition-all">Show Political Wards</span>
              </label>
            </div>
          </div>
        </div>

        {/* Removed individual chips and integrated into dropdown above */}
      </div>

      <div className="flex gap-5" style={{ height: isFullscreen ? "100vh" : "calc(100vh - 360px)" }}>
        <div ref={mapContainerRef} className="flex-1 relative rounded-2xl overflow-hidden border border-border shadow-2xl bg-black">
          {/* Fullscreen Toggle Button */}
          <button
            onClick={toggleFullscreen}
            className="absolute top-6 right-6 z-[2000] w-10 h-10 rounded-xl bg-black/60 border border-white/20 text-white hover:bg-black/80 hover:scale-110 transition-all backdrop-blur-md flex items-center justify-center shadow-2xl group"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            <span className="absolute right-full mr-3 px-2 py-1 rounded bg-black/80 text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/10 whitespace-nowrap">
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </span>
          </button>
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
            beats={beats}
            beatRiskData={beatRiskData}
            precincts={precincts}
            showPrecincts={showPoliticalWards}
            selectedPrecinctId={selectedPrecinct?.ward_precinct}
            onSelectPrecinct={setSelectedPrecinct}
          />

          <ThematicLegend title="Incidents per 1k" bins={bins} colors={THEMATIC_COLORS} />

        </div>

        {/* Dynamic Side Panel */}
        {(selectedDistrict || selectedIncident || selectedPrecinct) && (
          <div className="w-[340px] rounded-2xl overflow-y-auto bg-slate-950 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in slide-in-from-right-4 duration-500">
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
            ) : selectedPrecinct ? (
              <div className="p-6">
                <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                  <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Tactical Forensics</h2>
                  <button onClick={() => setSelectedPrecinct(null)} className="h-6 w-6 text-slate-500 hover:text-white transition-colors text-lg font-bold">×</button>
                </div>

                <div className="p-5 rounded-2xl bg-gradient-to-br from-[#f0c040]/30 to-black/40 border border-[#f0c040]/50 mb-8 shadow-xl">
                  <div className="text-[9px] font-black text-[#f0c040] uppercase tracking-[0.25em] mb-2 opacity-90">Political Accountability</div>
                  <div className="text-3xl font-black text-white tracking-tight">Precinct {selectedPrecinct.precinct}</div>
                  <div className="text-[11px] text-slate-200 mt-1.5 font-bold tracking-wide italic underline decoration-[#f0c040]/30 underline-offset-4">Ward Accountability: {selectedPrecinct.ward}</div>
                </div>

                {(() => {
                  // Find nearest station here
                  const [pLat, pLon] = getPrecinctCentroid(selectedPrecinct);
                  let nearest = null;
                  let minDistance = Infinity;

                  stations.forEach(s => {
                    const lat = parseFloat(s.latitude);
                    const lon = parseFloat(s.longitude);
                    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
                    const d = haversineDistanceMiles(pLat, pLon, lat, lon);
                    if (d < minDistance) {
                      minDistance = d;
                      nearest = { ...s, distance: d };
                    }
                  });

                  if (!nearest) return <div className="text-[10px] text-azure font-bold uppercase tracking-widest animate-pulse p-4">Syncing Tactical Grid...</div>;

                  // Find district info for the summary card
                  const dId = String(nearest.district_id || "").padStart(3, "0");
                  const dRisk = riskData.find(item => item.district_id === dId);

                  return (
                    <div className="space-y-6">
                      {/* District Summary Card Integration */}
                      {dRisk && (
                        <div className="space-y-4 p-5 rounded-2xl bg-slate-900/60 border border-white/10 mb-4 shadow-inner">
                          <div className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] pl-1">Response Performance</div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 shadow-lg">
                              <div className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1.5">Arrest Rate</div>
                              <div className="text-2xl font-black text-white">{dRisk.arrest_rate}%</div>
                            </div>
                            <div className="p-4 rounded-xl bg-blue-500/15 border border-blue-500/40 shadow-lg">
                              <div className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1.5">Domestic</div>
                              <div className="text-2xl font-black text-white">{dRisk.domestic_rate}%</div>
                            </div>
                          </div>
                          <div className="flex justify-between items-center px-2 pt-2 border-t border-white/5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tactical Intensity</span>
                            <span className="text-sm font-black text-[#facc15]">{Number(dRisk.crimes_per_1000).toFixed(1)}<span className="text-[9px] ml-1 opacity-50">/1K</span></span>
                          </div>
                        </div>
                      )}

                      <div className="p-6 rounded-2xl bg-azure/10 border-2 border-azure/30 group hover:border-azure transition-all shadow-[0_10px_30px_-10px_rgba(59,130,246,0.3)]">
                        <div className="text-[10px] font-black text-azure uppercase tracking-[0.2em] flex items-center gap-3 mb-5">
                          <span className="w-2 h-2 rounded-full bg-azure animate-ping"></span>
                          Operational Proximity
                        </div>

                        <div className="space-y-5">
                          <div>
                            <div className="text-base font-black text-white mb-1.5 leading-tight tracking-tight">
                              {nearest.district_name} District Station
                            </div>
                            <div className="text-[11px] text-slate-300 leading-relaxed font-bold tracking-wide italic">
                              {nearest.address}
                            </div>
                          </div>

                          <div className="pt-5 border-t border-white/10 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Vector Distance</span>
                              <span className="text-sm font-black text-white tracking-tight">
                                <span className="text-azure">{nearest.distance.toFixed(2)}</span> MILES
                              </span>
                            </div>
                            {nearest.phone && (
                              <div className="pt-4 border-t border-white/5 border-dashed">
                                <a
                                  href={`tel:${nearest.phone}`}
                                  className="w-full h-11 flex items-center justify-center gap-3 rounded-xl bg-azure/10 border border-azure/40 hover:bg-azure/20 hover:border-azure transition-all group overflow-hidden relative shadow-lg shadow-azure/10"
                                >
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full duration-700 transition-transform"></div>
                                  <span className="text-lg">📞</span>
                                  <div className="flex flex-col items-start leading-tight">
                                    <span className="text-[11px] font-black uppercase tracking-widest text-azure">Engage Tactical Unit</span>
                                    <span className="text-sm font-black text-white tabular-nums">{nearest.phone}</span>
                                  </div>
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40 flex items-center gap-4 mt-6">
                        <div className="w-10 h-10 rounded-lg bg-azure/5 flex items-center justify-center text-azure font-black text-xl border border-azure/20 shadow-inner">⚡</div>
                        <p className="text-[10px] text-slate-500 font-bold leading-relaxed tracking-wide italic">
                          Tactical vector visualization active. Operational performance synchronized for nearest response hub.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : selectedDistrict ? (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Selected District</div>
                    <h2 className="text-base font-black uppercase tracking-tight" style={{ color: "#38bdf8" }}>{selectedDistrict.district_name}</h2>
                  </div>
                  <button onClick={() => setSelectedDistrictId("")} className="h-7 w-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex items-center justify-center font-bold text-sm">×</button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/5 shadow-xl transition-all hover:border-azure/30 group">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 group-hover:text-slate-400">Incident Count</div>
                      <div className="text-2xl font-black text-white">{selectedDistrictRisk?.crime_count || 0}</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/5 shadow-xl transition-all hover:border-yellow-400/30 group">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 group-hover:text-yellow-400">Density/1k</div>
                      <div className="text-2xl font-black text-yellow-400">{Number(selectedDistrictRisk?.crimes_per_1000 || 0).toFixed(1)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 shadow-xl transition-all hover:bg-emerald-500/10">
                      <div className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest mb-2">Arrest Rate</div>
                      <div className="text-2xl font-black text-emerald-400">{selectedDistrictRisk?.arrest_rate || 0}%</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-violet-500/5 border border-violet-500/20 shadow-xl transition-all hover:bg-violet-500/10">
                      <div className="text-[10px] font-black text-violet-500/70 uppercase tracking-widest mb-2">Domestic Rate</div>
                      <div className="text-2xl font-black text-violet-400">{selectedDistrictRisk?.domestic_rate || 0}%</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
