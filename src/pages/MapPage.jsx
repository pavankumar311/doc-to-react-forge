import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parse } from "date-fns";
import { Layers, Download, Calendar as CalendarIcon, Filter, ChevronDown } from "lucide-react";

import ThematicMap from "../components/ThematicMap";
import ThematicLegend from "../components/ThematicLegend";
import { HeatmapSkeleton } from "../components/Skeletons";
import { useFilters } from "../contexts/FilterContext";
import { AUTH_TOKEN } from "../services/api";

// UI Components
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";

const BASE_URL = "http://localhost:9000";
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
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 h-8 px-3 rounded text-[11px] font-medium border border-border bg-background text-foreground hover:bg-accent/40 transition-colors">
            <CalendarIcon className="h-3.5 w-3.5 opacity-60 text-azure" />
            <span>{display}</span>
            <ChevronDown className="h-3 w-3 ml-auto opacity-40" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" style={{ zIndex: 2000 }}>
          <Calendar mode="single" selected={isValid ? parsed : undefined} onSelect={handleSelect} className="p-3 shadow-2xl" />
        </PopoverContent>
      </Popover>
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
    bins.push({ min: sorted[minIdx], max: sorted[maxIdx] });
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
  const [mapZoom, setMapZoom] = useState(11);
  const [viewMode, setViewMode] = useState("density"); // density (grid) vs points (incidents)
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

  // Sync with global
  useEffect(() => {
    if (globalFilters.dateFrom) setLocalDateFrom(globalFilters.dateFrom);
    if (globalFilters.dateTo) setLocalDateTo(globalFilters.dateTo);
  }, [globalFilters.dateFrom, globalFilters.dateTo]);

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
          })
        ]);

        if (!districtsRes.ok) throw new Error("Districts request failed");
        if (!filtersRes.ok) throw new Error("Filters request failed");

        const districtsData = await districtsRes.json();
        const filtersData = await filtersRes.json();

        setDistricts(districtsData || []);
        setFilterOptions(filtersData);

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

  // Preset Logic
  useEffect(() => {
    if (!filterOptions || localDatePreset === "custom") return;
    const maxDate = filterOptions?.date_range?.max_date;
    const range = buildPresetRange(Number(localDatePreset), maxDate);
    setLocalDateFrom(range.from);
    setLocalDateTo(range.to);
  }, [localDatePreset, filterOptions]);

  // Map Data Loading
  useEffect(() => {
    const loadMapData = async () => {
      if (!localDateFrom || !localDateTo) return;
      setLoadingMap(true);
      setError("");
      try {
        const riskParams = new URLSearchParams({
          date_from: localDateFrom,
          date_to: localDateTo,
        });

        const blocksParams = new URLSearchParams({
          date_from: localDateFrom,
          date_to: localDateTo,
          min_count: "1",
          limit: "5000",
        });

        if (localCrimeTypeIds.size > 0) {
          const ids = Array.from(localCrimeTypeIds).join(",");
          riskParams.set("crime_type_ids", ids);
          blocksParams.set("crime_type_ids", ids);
        }

        if (showArrests) {
          riskParams.set("is_arrest", "true");
          blocksParams.set("is_arrest", "true");
        }
        if (showDomestic) {
          riskParams.set("is_domestic", "true");
          blocksParams.set("is_domestic", "true");
        }

        const riskUrl = `${BASE_URL}/api/v1/dashboard/district-risk?${riskParams.toString()}`;
        const blocksUrl = `${BASE_URL}/api/v1/dashboard/map/blocks?${blocksParams.toString()}`;
        const incidentsUrl = `${BASE_URL}/api/v1/dashboard/map/incidents?${riskParams.toString()}&limit=1000`;

        const [riskRes, blocksRes, incidentsRes] = await Promise.all([
          fetch(riskUrl, { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } }),
          fetch(blocksUrl, { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } }),
          fetch(incidentsUrl, { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } }),
        ]);

        if (!riskRes.ok) throw new Error("District risk request failed");
        if (!blocksRes.ok) throw new Error("Blocks request failed");
        if (!incidentsRes.ok) throw new Error("Incidents request failed");

        const riskJson = await riskRes.json();
        const blocksJson = await blocksRes.json();
        const incidentsJson = await incidentsRes.json();

        setRiskData(riskJson?.districts || []);
        setBlocks(blocksJson?.blocks || []);
        setIncidents(incidentsJson || []);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load map data");
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

  if (loading) {
    return <HeatmapSkeleton />;
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Thematic Map</h1>
        <div className="flex items-center gap-2">
          <button
            className="h-8 px-4 rounded text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all hover:bg-accent/10 border border-border"
            style={{ color: "var(--color-azure)" }}
            onClick={() => setViewMode((v) => (v === "density" ? "points" : "density"))}
          >
            <Layers size={14} /> {viewMode === "points" ? "Point Analysis" : "Grid Density"}
          </button>
          <button className="h-8 px-4 rounded text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all hover:bg-accent/10 border border-border" style={{ color: "var(--color-azure)" }}>
            <Download size={14} /> Export Map
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        {/* Filters Top Row */}
        <div className="flex flex-wrap items-center gap-8 p-5 rounded-xl transition-all" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid var(--color-border)", backdropFilter: "blur(8px)" }}>
          <div className="space-y-1.5 min-w-[140px]">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              Preset Period
            </label>
            <select
              value={localDatePreset}
              onChange={e => setLocalDatePreset(e.target.value)}
              className="h-8 w-full rounded bg-background border border-border px-3 text-[11px] font-medium focus:ring-1 focus:ring-azure cursor-pointer"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {localDatePreset === "custom" && (
            <div className="flex items-center gap-4 animate-in slide-in-from-left-2 duration-300">
              <DateInput label="Start Date" value={localDateFrom} onChange={setLocalDateFrom} />
              <div className="h-4 w-px bg-border mt-5" />
              <DateInput label="End Date" value={localDateTo} onChange={setLocalDateTo} />
            </div>
          )}

          <div className="space-y-1.5 min-w-[180px]">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              Focus Area
            </label>
            <select
              value={selectedDistrictId}
              onChange={(e) => setSelectedDistrictId(e.target.value)}
              className="h-8 w-full rounded bg-background border border-border px-3 text-[11px] font-medium focus:ring-1 focus:ring-azure cursor-pointer"
            >
              <option value="">Full City Dashboard</option>
              {districts.map((district) => (
                <option key={district.district_id} value={district.district_id}>
                  {district.district_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 border-l border-border pl-8">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Incident Layers</label>
            <div className="flex items-center gap-5">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={showArrests}
                  onChange={e => setShowArrests(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-transparent text-azure focus:ring-0 transition-all group-hover:border-azure"
                />
                <span className="text-[11px] font-medium group-hover:text-foreground transition-colors" style={{ color: "var(--color-text-muted)" }}>Arrests</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={showDomestic}
                  onChange={e => setShowDomestic(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-transparent text-azure focus:ring-0 transition-all group-hover:border-azure"
                />
                <span className="text-[11px] font-medium group-hover:text-foreground transition-colors" style={{ color: "var(--color-text-muted)" }}>Domestic</span>
              </label>
            </div>
          </div>
        </div>

        {/* Crime Type Chips */}
        <div className="flex flex-wrap gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-accent/5 border border-transparent mr-1">
            <Filter size={12} className="text-azure" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Crime Types</span>
          </div>
          {filterOptions?.crime_types?.map(type => {
            const active = localCrimeTypeIds.has(type.crime_type_id);
            return (
              <button
                key={type.crime_type_id}
                onClick={() => toggleCrimeType(type.crime_type_id)}
                className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold tracking-tight transition-all border ${active
                    ? "bg-azure/10 border-azure text-azure shadow-[0_0_15px_rgba(33,150,243,0.2)] scale-[1.02]"
                    : "border-border text-muted-foreground/80 hover:border-muted-foreground/90 hover:bg-accent/5"
                  }`}
              >
                {type.primary_type}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mb-4 text-xs p-4 rounded-lg bg-red-500/5 border border-red-500/20 flex items-center gap-3 animate-in shake duration-500" style={{ color: "#ef4444" }}>
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span><strong>API Connection Error:</strong> {error}</span>
          <button onClick={() => window.location.reload()} className="ml-auto text-azure underline">Retry</button>
        </div>
      )}

      <div className="flex gap-5" style={{ height: "calc(100vh - 380px)" }}>
        <div className="flex-1 relative rounded-2xl overflow-hidden glass-morphism shadow-2xl" style={{ border: "1px solid var(--color-border)", minHeight: "450px" }}>
          <ThematicMap
            districts={districts}
            riskData={riskData}
            bins={bins}
            colors={THEMATIC_COLORS}
            selectedDistrictId={selectedDistrictId}
            onSelectDistrict={(district) => {
              setSelectedDistrictId(district.district_id);
              setSelectedIncident(null);
            }}
            onZoomChange={onZoomChange}
            mapZoom={mapZoom}
            blocks={blocks}
            showBlocks={viewMode === "density"}
            incidents={incidents}
            showIncidents={viewMode === "points"}
            onSelectIncident={(inc) => {
              setSelectedIncident(inc);
              setSelectedDistrictId("");
            }}
            activeIncidentId={selectedIncident?.incident_id}
            showChoropleth={true}
          />

          <ThematicLegend title="Crimes per 1k" bins={bins} colors={THEMATIC_COLORS} />

          {loadingMap && (
            <div
              className="absolute top-6 left-6 rounded-full px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest shadow-2xl animate-pulse"
              style={{ background: "rgba(10,14,23,0.85)", border: "1px solid var(--color-azure)", color: "var(--color-azure)", zIndex: 1000, backdropFilter: "blur(10px)" }}
            >
              Computing Thematic Layers...
            </div>
          )}
        </div>

        {/* Side Panel: District or Incident Analysis */}
        {(selectedDistrict || selectedIncident) && (
          <div className="w-[340px] rounded-2xl overflow-y-auto glass-morphism animate-in slide-in-from-right-4 duration-500 shadow-2xl" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
            {selectedIncident ? (
              /* Incident Analysis Panel */
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-sm font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Incident Forensics</h2>
                    <span className="text-[10px] text-azure uppercase font-mono tracking-tighter">Case #{selectedIncident.incident_id.slice(-6)}</span>
                  </div>
                  <button onClick={() => setSelectedIncident(null)} className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-muted-foreground">x</button>
                </div>

                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-azure/5 border border-azure/20">
                    <div className="text-[10px] text-azure font-black uppercase tracking-widest mb-1">Primary Classification</div>
                    <div className="text-base font-bold text-foreground leading-tight">{selectedIncident.primary_type}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{selectedIncident.description}</div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                        <CalendarIcon size={14} className="text-muted-foreground" />
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Temporal Log</div>
                        <div className="text-[11px] font-medium text-foreground">{selectedIncident.date}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                        <Filter size={14} className="text-muted-foreground" />
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Spatial Context</div>
                        <div className="text-[11px] font-medium text-foreground">{selectedIncident.block_address}</div>
                        <div className="text-[10px] text-muted-foreground">District {selectedIncident.district_id}</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-5 border-t border-border flex items-center gap-2">
                    <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tight ${selectedIncident.is_arrest ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"}`}>
                      {selectedIncident.is_arrest ? "Arrest Secured" : "Unresolved"}
                    </div>
                    {selectedIncident.is_domestic && (
                      <div className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-[10px] font-black uppercase tracking-tight">
                        Domestic
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* District Analysis Panel */
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex flex-col">
                    <h2 className="text-sm font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>{selectedDistrict.district_name}</h2>
                    <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">Security Profile Analysis</span>
                  </div>
                  <button onClick={() => setSelectedDistrictId("")} className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-accent/20 transition-colors" style={{ color: "var(--color-text-muted)" }}>x</button>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-accent/5 border border-border">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Frequency</div>
                      <div className="text-lg font-bold tracking-tighter">{selectedDistrictRisk?.crime_count} <span className="text-[10px] font-normal text-muted-foreground">pts</span></div>
                    </div>
                    <div className="p-3 rounded-xl bg-accent/5 border border-border">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Density</div>
                      <div className="text-lg font-bold tracking-tighter text-azure">{Number(selectedDistrictRisk?.crimes_per_1000).toFixed(1)} <span className="text-[10px] font-normal text-muted-foreground">/1k</span></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--color-border)" }}>
                    <div className="flex justify-between items-center text-xs">
                      <span style={{ color: "var(--color-text-secondary)" }}>Growth Trend (MoM):</span>
                      <span className={`font-bold ${selectedDistrictRisk?.mom_change_pct > 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {selectedDistrictRisk?.mom_change_pct > 0 ? "↑" : "↓"} {Math.abs(selectedDistrictRisk?.mom_change_pct)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span style={{ color: "var(--color-text-secondary)" }}>Arrest Resolution:</span>
                      <span className="font-bold text-foreground">{selectedDistrictRisk?.arrest_rate}%</span>
                    </div>
                    <div className="pt-3 border-t border-border flex justify-between items-center">
                      <span style={{ color: "var(--color-text-secondary)" }} className="text-[11px] font-bold uppercase tracking-wider">Safety Benchmark Index</span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-black ${selectedDistrictRisk?.relative_to_average > 1.2 ? "bg-red-500/20 text-red-500" : "bg-emerald-500/20 text-emerald-500"}`}>
                        {selectedDistrictRisk?.relative_to_average}x
                      </span>
                    </div>
                  </div>

                  <div className="mt-8">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] mb-4 text-muted-foreground/60 flex items-center gap-2">
                      <div className="h-px flex-1 bg-border" />
                      Top Crime Vectors
                      <div className="h-px flex-1 bg-border" />
                    </h3>
                    <div className="space-y-4">
                      {selectedDistrictRisk?.top_crime_types?.map((type, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex justify-between items-end">
                            <span style={{ color: "var(--color-text-primary)" }} className="text-[11px] font-bold tracking-tight">{type.primary_type}</span>
                            <span style={{ color: "var(--color-text-secondary)" }} className="text-[10px] font-mono">{type.crime_count} cases</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-accent/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary shadow-[0_0_8px_rgba(33,150,243,0.4)]"
                              style={{
                                width: `${(type.crime_count / selectedDistrictRisk.crime_count) * 100}%`
                              }}
                            />
                          </div>
                        </div>
                      ))}
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
