import { useEffect, useMemo, useState } from "react";
import { Layers, Download } from "lucide-react";
import { CircleMarker, GeoJSON, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { HeatmapSkeleton } from "../components/Skeletons";

const BASE_URL = "http://localhost:9000";
const AUTH_PAYLOAD = { username: "admin", password: "password" };

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

const formatDate = (value) => {
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
    from: formatDate(start),
    to: formatDate(end),
  };
};

function MapController({ selectedDistrict }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedDistrict || !selectedDistrict.centroid_lat || !selectedDistrict.centroid_lon) return;
    map.flyTo([selectedDistrict.centroid_lat, selectedDistrict.centroid_lon], 13, {
      animate: true,
      duration: 1.2,
    });
  }, [map, selectedDistrict]);

  return null;
}

export default function Heatmap() {
  const [token, setToken] = useState("");
  const [filters, setFilters] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [selectedCrimeTypes, setSelectedCrimeTypes] = useState(new Set());
  const [viewMode, setViewMode] = useState("incidents");
  const [datePreset, setDatePreset] = useState("30");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMap, setLoadingMap] = useState(false);
  const [error, setError] = useState("");

  const selectedDistrict = useMemo(
    () => districts.find((d) => d.district_id === selectedDistrictId) || null,
    [districts, selectedDistrictId]
  );

  const crimeTypes = filters?.crime_types || [];
  const crimeCategories = filters?.crime_categories || [];

  const selectedCrimeTypeIds = useMemo(
    () => Array.from(selectedCrimeTypes).join(","),
    [selectedCrimeTypes]
  );

  useEffect(() => {
    const loadBootstrap = async () => {
      setLoading(true);
      setError("");
      try {
        const tokenRes = await fetch(`${BASE_URL}/api/v1/auth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(AUTH_PAYLOAD),
        });
        if (!tokenRes.ok) throw new Error("Token request failed");
        const tokenJson = await tokenRes.json();
        const accessToken = tokenJson.access_token || tokenJson.token || tokenJson.accessToken;
        if (!accessToken) throw new Error("Token missing in response");
        setToken(accessToken);

        const [filtersRes, districtsRes] = await Promise.all([
          fetch(`${BASE_URL}/api/v1/dashboard/filters`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch(`${BASE_URL}/api/v1/dashboard/districts?include_boundary=true`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ]);

        if (!filtersRes.ok) throw new Error("Filters request failed");
        if (!districtsRes.ok) throw new Error("Districts request failed");

        const filtersJson = await filtersRes.json();
        const districtsJson = await districtsRes.json();
        setFilters(filtersJson);
        setDistricts(districtsJson || []);

        const maxDate = filtersJson?.date_range?.max_date;
        const presetRange = buildPresetRange(30, maxDate);
        setDateFrom(presetRange.from);
        setDateTo(presetRange.to);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load map data");
      } finally {
        setLoading(false);
      }
    };

    loadBootstrap();
  }, []);

  useEffect(() => {
    if (!filters) return;
    if (datePreset === "custom") return;
    const presetDays = Number(datePreset);
    const maxDate = filters?.date_range?.max_date;
    const presetRange = buildPresetRange(presetDays, maxDate);
    setDateFrom(presetRange.from);
    setDateTo(presetRange.to);
  }, [datePreset, filters]);

  useEffect(() => {
    const loadMapData = async () => {
      if (!token || !dateFrom || !dateTo) return;
      setLoadingMap(true);
      setError("");
      try {
        const baseParams = new URLSearchParams({
          date_from: dateFrom,
          date_to: dateTo,
        });
        if (selectedCrimeTypeIds) baseParams.set("crime_type_ids", selectedCrimeTypeIds);
        if (selectedDistrictId) baseParams.set("district_ids", selectedDistrictId);

        const incidentsParams = new URLSearchParams(baseParams);
        incidentsParams.set("limit", "2000");
        const blocksParams = new URLSearchParams(baseParams);
        blocksParams.set("min_count", "1");
        blocksParams.set("limit", "5000");

        const incidentsUrl = `${BASE_URL}/api/v1/dashboard/map/incidents?${incidentsParams.toString()}`;
        const blocksUrl = `${BASE_URL}/api/v1/dashboard/map/blocks?${blocksParams.toString()}`;

        const [incidentsRes, blocksRes] = await Promise.all([
          fetch(incidentsUrl, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(blocksUrl, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!incidentsRes.ok) throw new Error("Incidents request failed");
        if (!blocksRes.ok) throw new Error("Blocks request failed");

        const incidentsJson = await incidentsRes.json();
        const blocksJson = await blocksRes.json();

        setIncidents(Array.isArray(incidentsJson) ? incidentsJson : []);
        setBlocks(blocksJson?.blocks || []);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load map data");
      } finally {
        setLoadingMap(false);
      }
    };

    loadMapData();
  }, [token, dateFrom, dateTo, selectedCrimeTypeIds, selectedDistrictId]);

  const toggleCrimeType = (crimeTypeId) => {
    setSelectedCrimeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(crimeTypeId)) {
        next.delete(crimeTypeId);
      } else {
        next.add(crimeTypeId);
      }
      return next;
    });
  };

  const incidentMarkers = incidents.filter((incident) =>
    Number.isFinite(Number(incident.latitude)) && Number.isFinite(Number(incident.longitude))
  );

  const heatMarkers = blocks
    .filter((block) => Number.isFinite(Number(block.latitude)) && Number.isFinite(Number(block.longitude)))
    .map((block) => {
    const intensity = Math.min(block.crime_count / 60, 1);
    const radius = 12 + intensity * 24;
    const color = intensity > 0.7 ? HEAT_GRADIENT.high : intensity > 0.4 ? HEAT_GRADIENT.mid : HEAT_GRADIENT.low;
    return {
      ...block,
      radius,
      color,
    };
  });

  if (loading) {
    return <HeatmapSkeleton />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Chicago mapps</h1>
        <div className="flex items-center gap-2">
          <button
            className="h-9 px-3 rounded text-xs font-medium flex items-center gap-2"
            style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}
            onClick={() => setViewMode((v) => (v === "density" ? "incidents" : "density"))}
          >
            <Layers size={14} /> Layers
          </button>
          <button className="h-9 px-3 rounded text-xs font-medium flex items-center gap-2" style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}>
            <Download size={14} /> Export PNG
          </button>
        </div>
      </div>

      <div className="flex items-start gap-4 mb-4">
        <div className="flex flex-wrap gap-3 flex-1">
          <div className="min-w-[220px]">
            <label className="text-[11px] uppercase tracking-wide" style={{ color: "var(--color-text-secondary)" }}>Search by location</label>
            <select
              value={selectedDistrictId}
              onChange={(e) => setSelectedDistrictId(e.target.value)}
              className="mt-1 h-9 w-full rounded px-2 text-xs"
              style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
            >
              <option value="">All districts</option>
              {districts.map((district) => (
                <option key={district.district_id} value={district.district_id}>
                  {district.district_name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[220px]">
            <label className="text-[11px] uppercase tracking-wide" style={{ color: "var(--color-text-secondary)" }}>Date range</label>
            <div className="mt-1 flex gap-2">
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                className="h-9 rounded px-2 text-xs"
                style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="custom">Custom</option>
              </select>
              {datePreset === "custom" && (
                <>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-9 rounded px-2 text-xs"
                    style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
                  />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-9 rounded px-2 text-xs"
                    style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
                  />
                </>
              )}
            </div>
          </div>
          <div className="min-w-[220px]">
            <label className="text-[11px] uppercase tracking-wide" style={{ color: "var(--color-text-secondary)" }}>Crime type filter</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {crimeTypes.map((type) => {
                const active = selectedCrimeTypes.has(type.crime_type_id);
                return (
                  <button
                    key={type.crime_type_id}
                    className="px-2 py-1 rounded-full text-[10px]"
                    style={{
                      border: "1px solid var(--color-border)",
                      color: active ? "#0b1d3a" : "var(--color-text-muted)",
                      background: active ? "rgba(100,181,246,0.7)" : "transparent",
                    }}
                    onClick={() => toggleCrimeType(type.crime_type_id)}
                  >
                    {type.primary_type}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="min-w-[170px]">
          <label className="text-[11px] uppercase tracking-wide" style={{ color: "var(--color-text-secondary)" }}>Heatmap / density</label>
          <div className="mt-2 flex gap-2">
            <button
              className="h-9 px-3 rounded text-xs font-medium"
              style={{ border: "1px solid var(--color-border)", color: viewMode === "incidents" ? "#0b1d3a" : "var(--color-text-muted)", background: viewMode === "incidents" ? "rgba(100,181,246,0.7)" : "transparent" }}
              onClick={() => setViewMode("incidents")}
            >
              Points
            </button>
            <button
              className="h-9 px-3 rounded text-xs font-medium"
              style={{ border: "1px solid var(--color-border)", color: viewMode === "density" ? "#0b1d3a" : "var(--color-text-muted)", background: viewMode === "density" ? "rgba(100,181,246,0.7)" : "transparent" }}
              onClick={() => setViewMode("density")}
            >
              Density
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-xs" style={{ color: "#ef4444" }}>
          {error}
        </div>
      )}

      <div className="flex gap-4" style={{ height: "calc(100vh - 260px)" }}>
        <div className="flex-1 relative rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)", minHeight: "420px" }}>
          <MapContainer center={[41.84, -87.63]} zoom={12} scrollWheelZoom className="h-full w-full" style={{ background: "#0a0e17" }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="(c) OpenStreetMap contributors"
            />

            <MapController selectedDistrict={selectedDistrict} />

            {selectedDistrict?.boundary && (
              <GeoJSON
                key={selectedDistrict.district_id}
                data={selectedDistrict.boundary}
                style={{ color: "#3b82f6", weight: 3, fillOpacity: 0.1 }}
              />
            )}

            {viewMode === "incidents" && incidentMarkers.map((incident) => (
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
                  <div className="text-[10px]">District: {block.district_id}</div>
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>

          <div
            className="absolute bottom-4 right-4 rounded-lg p-3"
            style={{
              background: "rgba(26,39,68,0.9)",
              border: "1px solid var(--color-border)",
              zIndex: 1000,
            }}
          >
            <p className="text-[10px] font-semibold uppercase mb-2" style={{ color: "var(--color-text-secondary)" }}>Legend</p>
            {crimeCategories.length ? (
              crimeCategories.map((category) => (
                <div key={category} className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-sm" style={{ background: CATEGORY_COLORS[category] || CATEGORY_COLORS.other }} />
                  <span className="text-[10px]" style={{ color: "var(--color-text-primary)" }}>{category}</span>
                </div>
              ))
            ) : (
              <div className="text-[10px]" style={{ color: "var(--color-text-primary)" }}>Categories loading...</div>
            )}
          </div>

          {loadingMap && (
            <div
              className="absolute top-4 left-4 rounded px-3 py-2 text-xs"
              style={{ background: "rgba(26,39,68,0.9)", border: "1px solid var(--color-border)" }}
            >
              Loading map data...
            </div>
          )}
        </div>

        {selectedIncident && (
          <div className="w-80 rounded-lg overflow-y-auto" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Incident</h2>
                <button onClick={() => setSelectedIncident(null)} className="text-xs" style={{ color: "var(--color-text-muted)" }}>x</button>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span style={{ color: "var(--color-text-secondary)" }}>Type:</span>
                  <span style={{ color: "var(--color-text-primary)" }}>{selectedIncident.primary_type}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--color-text-secondary)" }}>Description:</span>
                  <span style={{ color: "var(--color-text-primary)" }}>{selectedIncident.description}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--color-text-secondary)" }}>Category:</span>
                  <span style={{ color: "var(--color-text-primary)" }}>{selectedIncident.category}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--color-text-secondary)" }}>Date:</span>
                  <span style={{ color: "var(--color-text-primary)" }}>{selectedIncident.date}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--color-text-secondary)" }}>Block:</span>
                  <span style={{ color: "var(--color-text-primary)" }}>{selectedIncident.block_address}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
