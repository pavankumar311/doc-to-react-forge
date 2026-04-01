import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parse } from "date-fns";
import { Layers, Download, Calendar as CalendarIcon, Filter, ChevronDown } from "lucide-react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";

import { HeatmapSkeleton } from "../components/Skeletons";
import { useFilters } from "../contexts/FilterContext";
import { AUTH_TOKEN } from "../services/api";

// UI Components
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";

const BASE_URL = "http://localhost:9002";

const CATEGORY_COLORS = {
  violent: "#ef4444",
  property: "#f97316",
  quality: "#eab308",
  other: "#6b7280",
};

const HEAT_GRADIENT = {
  high: "#ef4444",
  mid: "#f97316",
  low: "#2563eb",
};

const RISK_TIER_COLORS = {
  HIGH: "#ef4444",
  MED: "#f97316",
  LOW: "#2563eb",
};

/* ── Inline Component: DateInput (Unified Styled) ─────────────────────── */
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

const CITY_CENTER = [41.84, -87.63];
const CLUSTER_ZOOM_THRESHOLD = 14;

const clusterCellSize = (zoom) => {
  if (zoom >= 13) return 0.012;
  if (zoom >= 12) return 0.02;
  if (zoom >= 11) return 0.03;
  if (zoom >= 10) return 0.05;
  return 0.08;
};

const clusterColor = (count) => {
  if (count >= 200) return "#b91c1c";
  if (count >= 100) return "#ef4444";
  if (count >= 50) return "#f97316";
  if (count >= 20) return "#f59e0b";
  return "#3b82f6";
};

const clusterSize = (count) => {
  if (count >= 200) return 56;
  if (count >= 100) return 48;
  if (count >= 50) return 42;
  if (count >= 20) return 36;
  return 30;
};

const createClusterIcon = (count) => {
  const size = clusterSize(count);
  const color = clusterColor(count);
  return L.divIcon({
    html: `
      <div style="
        width:${size}px;
        height:${size}px;
        line-height:${size}px;
        border-radius:999px;
        background:${color};
        color:#ffffff;
        font-weight:700;
        font-size:12px;
        text-align:center;
        box-shadow:0 6px 14px rgba(0,0,0,0.25);
        border:2px solid rgba(255,255,255,0.8);
      ">${count}</div>
    `,
    className: "cluster-marker",
    iconSize: [size, size],
  });
};

function MapController({ selectedDistrict, onZoomChange }) {
  const map = useMap();

  useEffect(() => {
    if (!onZoomChange) return;
    const handleZoom = () => onZoomChange(map.getZoom());
    handleZoom();
    map.on("zoomend", handleZoom);
    return () => map.off("zoomend", handleZoom);
  }, [map, onZoomChange]);

  useEffect(() => {
    if (!selectedDistrict) {
      map.setView(CITY_CENTER, 11);
      return;
    }

    if (selectedDistrict.boundary) {
      const bounds = L.geoJSON(selectedDistrict.boundary).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 13, animate: true, duration: 1.2 });
        return;
      }
    }

    if (selectedDistrict.centroid_lat && selectedDistrict.centroid_lon) {
      map.flyTo([selectedDistrict.centroid_lat, selectedDistrict.centroid_lon], 13, {
        animate: true,
        duration: 1.2,
      });
    }
  }, [map, selectedDistrict]);

  return null;
}

export default function Heatmap() {
  const { filters: globalFilters } = useFilters();
  const [districts, setDistricts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [filterOptions, setFilterOptions] = useState(null);

  // Local Filter States
  const [localDateFrom, setLocalDateFrom] = useState(globalFilters.dateFrom);
  const [localDateTo, setLocalDateTo] = useState(globalFilters.dateTo);
  const [localCrimeTypeIds, setLocalCrimeTypeIds] = useState(new Set());
  const [localDatePreset, setLocalDatePreset] = useState("30");

  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [viewMode, setViewMode] = useState("incidents");
  const [mapZoom, setMapZoom] = useState(11);
  const [showArrests, setShowArrests] = useState(false);
  const [showDomestic, setShowDomestic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMap, setLoadingMap] = useState(false);
  const [error, setError] = useState("");

  const selectedDistrict = useMemo(
    () => districts.find((d) => d.district_id === selectedDistrictId) || null,
    [districts, selectedDistrictId]
  );

  useEffect(() => {
    if (globalFilters.dateFrom) setLocalDateFrom(globalFilters.dateFrom);
    if (globalFilters.dateTo) setLocalDateTo(globalFilters.dateTo);
  }, [globalFilters.dateFrom, globalFilters.dateTo]);

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
        setError(err.message || "Failed to load heat data");
      } finally {
        setLoading(false);
      }
    };
    loadBootstrap();
  }, []);

  useEffect(() => {
    if (!filterOptions || localDatePreset === "custom") return;
    const maxDate = filterOptions?.date_range?.max_date;
    const range = buildPresetRange(Number(localDatePreset), maxDate);
    setLocalDateFrom(range.from);
    setLocalDateTo(range.to);
  }, [localDatePreset, filterOptions]);

  useEffect(() => {
    const loadMapData = async () => {
      if (!localDateFrom || !localDateTo) return;
      setLoadingMap(true);
      setError("");
      try {
        const baseParams = new URLSearchParams({
          date_from: localDateFrom,
          date_to: localDateTo,
        });

        if (selectedDistrictId) baseParams.set("district_ids", selectedDistrictId);

        if (localCrimeTypeIds.size > 0) {
          baseParams.set("crime_type_ids", Array.from(localCrimeTypeIds).join(","));
        }

        const incidentsParams = new URLSearchParams(baseParams);
        incidentsParams.set("limit", "2000");
        const blocksParams = new URLSearchParams(baseParams);
        blocksParams.set("min_count", "1");
        blocksParams.set("limit", "5000");

        if (showArrests) {
          incidentsParams.set("is_arrest", "true");
          blocksParams.set("is_arrest", "true");
        }
        if (showDomestic) {
          incidentsParams.set("is_domestic", "true");
          blocksParams.set("is_domestic", "true");
        }

        const incidentsUrl = `${BASE_URL}/api/v1/dashboard/map/incidents?${incidentsParams.toString()}`;
        const blocksUrl = `${BASE_URL}/api/v1/dashboard/map/blocks?${blocksParams.toString()}`;

        const [incidentsRes, blocksRes] = await Promise.all([
          fetch(incidentsUrl, { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } }),
          fetch(blocksUrl, { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } }),
        ]);

        if (!incidentsRes.ok) throw new Error("Incidents request failed");
        if (!blocksRes.ok) throw new Error("Blocks request failed");

        const incidentsJson = await incidentsRes.json();
        const blocksJson = await blocksRes.json();

        setIncidents(Array.isArray(incidentsJson) ? incidentsJson : []);
        setBlocks(blocksJson?.blocks || []);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load heatmap data");
      } finally {
        setLoadingMap(false);
      }
    };

    loadMapData();
  }, [localDateFrom, localDateTo, localCrimeTypeIds, selectedDistrictId, showArrests, showDomestic]);

  const toggleCrimeType = (id) => {
    setLocalCrimeTypeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onZoomChange = useCallback((zoom) => setMapZoom(zoom), []);

  const incidentMarkers = incidents.filter((incident) =>
    Number.isFinite(Number(incident.latitude)) && Number.isFinite(Number(incident.longitude))
  );

  const clusteredIncidents = useMemo(() => {
    if (mapZoom >= CLUSTER_ZOOM_THRESHOLD) return [];
    const cell = clusterCellSize(mapZoom);
    const buckets = new Map();

    incidentMarkers.forEach((incident) => {
      const lat = Number(incident.latitude);
      const lng = Number(incident.longitude);
      const key = `${Math.floor(lat / cell)}:${Math.floor(lng / cell)}`;
      const bucket = buckets.get(key) || { count: 0, latSum: 0, lngSum: 0 };
      bucket.count += 1;
      bucket.latSum += lat;
      bucket.lngSum += lng;
      buckets.set(key, bucket);
    });

    return Array.from(buckets.values()).map((bucket) => ({
      count: bucket.count,
      lat: bucket.latSum / bucket.count,
      lng: bucket.lngSum / bucket.count,
    }));
  }, [incidentMarkers, mapZoom]);

  const heatMarkers = blocks
    .filter((block) => Number.isFinite(Number(block.latitude)) && Number.isFinite(Number(block.longitude)))
    .map((block) => {
      const riskScore = Number(block.risk_score);
      const hasRiskScore = Number.isFinite(riskScore);
      const intensity = hasRiskScore ? Math.min(Math.max(riskScore, 0), 1) : Math.min(block.crime_count / 60, 1);
      const radius = 12 + intensity * 24;
      const tierColor = block.risk_tier && RISK_TIER_COLORS[block.risk_tier]
        ? RISK_TIER_COLORS[block.risk_tier]
        : null;
      const color = tierColor || (intensity > 0.7 ? HEAT_GRADIENT.high : intensity > 0.4 ? HEAT_GRADIENT.mid : HEAT_GRADIENT.low);
      return {
        ...block,
        radius,
        color,
        intensity,
      };
    });

  if (loading) {
    return <HeatmapSkeleton />;
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Density Heatmap</h1>
        <div className="flex items-center gap-2">
          <button
            className="h-8 px-3 rounded text-[11px] font-semibold flex items-center gap-2 transition-all hover:bg-accent/10"
            style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}
            onClick={() => setViewMode((v) => (v === "density" ? "incidents" : "density"))}
          >
            <Layers size={13} /> {viewMode === "incidents" ? "Grid Density" : "Point Analysis"}
          </button>
          <button className="h-8 px-3 rounded text-[11px] font-semibold flex items-center gap-2 transition-all hover:bg-accent/10" style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}>
            <Download size={13} /> Export Map
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 mb-6">
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
              Target District
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
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Incident Filters</label>
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

        <div className="flex flex-wrap gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-accent/5 border border-transparent mr-1">
            <Filter size={12} className="text-azure" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Type Selection</span>
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
          <span><strong>Heat Analysis Error:</strong> {error}</span>
          <button onClick={() => window.location.reload()} className="ml-auto text-azure underline">Retry</button>
        </div>
      )}

      <div className="flex gap-5" style={{ height: "calc(100vh - 380px)" }}>
        <div className="flex-1 relative rounded-2xl overflow-hidden glass-morphism shadow-2xl" style={{ border: "1px solid var(--color-border)", minHeight: "450px" }}>
          <MapContainer center={CITY_CENTER} zoom={11} scrollWheelZoom className="h-full w-full" style={{ background: "#0a0e17" }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="(c) OpenStreetMap contributors"
            />

            <MapController selectedDistrict={selectedDistrict} onZoomChange={onZoomChange} />

            {viewMode === "incidents" && mapZoom < CLUSTER_ZOOM_THRESHOLD && clusteredIncidents.map((cluster, idx) => (
              <Marker
                key={`cluster-${cluster.lat}-${cluster.lng}-${idx}`}
                position={[cluster.lat, cluster.lng]}
                icon={createClusterIcon(cluster.count)}
              >
                <Tooltip direction="top" offset={[0, -12]} opacity={1}>
                  <div className="text-xs font-semibold">{cluster.count} incidents</div>
                </Tooltip>
              </Marker>
            ))}

            {viewMode === "incidents" && mapZoom >= CLUSTER_ZOOM_THRESHOLD && incidentMarkers.map((incident) => (
              <CircleMarker
                key={incident.incident_id}
                center={[Number(incident.latitude), Number(incident.longitude)]}
                radius={6}
                pathOptions={{
                  color: CATEGORY_COLORS[incident.category] || CATEGORY_COLORS.other,
                  fillColor: CATEGORY_COLORS[incident.category] || CATEGORY_COLORS.other,
                  fillOpacity: 0.8,
                  weight: 1,
                }}
                eventHandlers={{ click: () => setSelectedIncident(incident) }}
              >
                <Tooltip direction="top" offset={[0, -12]} opacity={1}>
                  <div className="text-xs font-semibold">
                    {incident.primary_type}
                  </div>
                  <div className="text-[10px]">{incident.description}</div>
                  <div className="text-[10px]">{incident.block_address}</div>
                  <div className="text-[10px]">{incident.date}</div>
                  {incident.district_id && (
                    <div className="text-[10px]">District: {incident.district_id}</div>
                  )}
                  <div className="flex gap-2 mt-1">
                    {incident.is_arrest && <span className="px-1 rounded-[2px] bg-blue-500/20 text-blue-400 text-[9px] uppercase font-bold">Arrest</span>}
                    {incident.is_domestic && <span className="px-1 rounded-[2px] bg-orange-500/20 text-orange-400 text-[9px] uppercase font-bold">Domestic</span>}
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}

            {viewMode === "density" && heatMarkers.map((block) => (
              <CircleMarker
                key={block.block_id}
                center={[Number(block.latitude), Number(block.longitude)]}
                radius={block.radius}
                pathOptions={{
                  color: block.color,
                  fillColor: block.color,
                  fillOpacity: 0.45,
                  weight: 1,
                }}
              >
                <Tooltip direction="top" offset={[0, -12]} opacity={1}>
                  <div className="text-xs font-semibold">{block.block_address}</div>
                  <div className="text-[10px]">Crimes: {block.crime_count}</div>
                  {Number.isFinite(Number(block.risk_score)) && (
                    <div className="text-[10px]">Risk score: {Number(block.risk_score).toFixed(2)}</div>
                  )}
                  {block.risk_tier && (
                    <div className="text-[10px]">Risk tier: {block.risk_tier}</div>
                  )}
                  <div className="text-[10px]">District: {block.district_id}</div>
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>

          <div
            className="absolute bottom-6 right-6 rounded-xl p-4 shadow-2xl animate-in fade-in duration-700 hover:scale-[1.02] transition-transform"
            style={{
              background: "rgba(26,39,68,0.95)",
              border: "1px solid var(--color-border)",
              zIndex: 1000,
              backdropFilter: "blur(10px)"
            }}
          >
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "var(--color-text-secondary)" }}>Legend</p>
            {viewMode === "density" ? (
              Object.entries(RISK_TIER_COLORS).map(([tier, color]) => (
                <div key={tier} className="flex items-center gap-3 mb-2 last:mb-0">
                  <div className="w-3.5 h-3.5 rounded-sm shadow-sm" style={{ background: color, border: "1px solid rgba(255,255,255,0.1)" }} />
                  <span className="text-[10px] font-bold" style={{ color: "var(--color-text-primary)" }}>{tier} RISK</span>
                </div>
              ))
            ) : (
              (filterOptions?.crime_categories || []).length ? (
                filterOptions.crime_categories.map((category) => (
                  <div key={category} className="flex items-center gap-3 mb-2 last:mb-0">
                    <div className="w-3.5 h-3.5 rounded-sm shadow-sm" style={{ background: CATEGORY_COLORS[category] || CATEGORY_COLORS.other, border: "1px solid rgba(255,255,255,0.1)" }} />
                    <span className="text-[10px] font-bold uppercase" style={{ color: "var(--color-text-primary)" }}>{category}</span>
                  </div>
                ))
              ) : (
                <div className="text-[10px]" style={{ color: "var(--color-text-primary)" }}>Initializing...</div>
              )
            )}
          </div>

          {loadingMap && (
            <div
              className="absolute top-6 left-6 rounded-full px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest shadow-2xl animate-pulse"
              style={{ background: "rgba(10,14,23,0.85)", border: "1px solid var(--color-azure)", color: "var(--color-azure)", zIndex: 1000, backdropFilter: "blur(10px)" }}
            >
              Analyzing Spatial Heat...
            </div>
          )}
        </div>

        {selectedIncident && (
          <div className="w-[340px] rounded-2xl overflow-y-auto glass-morphism animate-in slide-in-from-right-4 duration-500" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex flex-col">
                  <h2 className="text-sm font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Incident Analysis</h2>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">Case #{selectedIncident.case_number || "N/A"}</span>
                </div>
                <button onClick={() => setSelectedIncident(null)} className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-accent/20 transition-colors" style={{ color: "var(--color-text-muted)" }}>x</button>
              </div>

              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-accent/5 border border-border space-y-4">
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Primary Offense</div>
                    <div className="text-sm font-bold text-foreground">{selectedIncident.primary_type}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold">Description Details</div>
                    <div className="pl-3 border-l-2 border-azure/40 text-xs italic text-muted-foreground/90 leading-relaxed">
                      {selectedIncident.description}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Temporal Marker</span>
                    <span className="text-xs font-semibold text-foreground/90">{selectedIncident.date}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Security Sector</span>
                    <span className="text-xs font-semibold text-foreground/90">District {selectedIncident.district_id}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Geographic Identifier</span>
                  <span className="text-xs font-semibold text-foreground/90 break-words">{selectedIncident.block_address}</span>
                </div>

                <div className="pt-6 border-t border-border space-y-4">
                  <div className="flex justify-between items-center group">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">Arrest Validated</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${selectedIncident.is_arrest ? "bg-emerald-500/20 text-emerald-400" : "bg-neutral-500/20 text-muted-foreground"}`}>
                      {selectedIncident.is_arrest ? "VERIFIED" : "NONE"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center group">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">Domestic Nexus</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black ${selectedIncident.is_domestic ? "bg-orange-500/20 text-orange-400" : "bg-neutral-500/20 text-muted-foreground"}`}>
                      {selectedIncident.is_domestic ? "AFFIRMED" : "UNREL"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
