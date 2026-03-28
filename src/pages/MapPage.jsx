import { useCallback, useEffect, useMemo, useState } from "react";
import { Layers, Download } from "lucide-react";
import ThematicMap from "../components/ThematicMap";
import ThematicLegend from "../components/ThematicLegend";
import { HeatmapSkeleton } from "../components/Skeletons";

const BASE_URL = "http://localhost:9000";
const AUTH_PAYLOAD = { username: "admin", password: "password" };

const THEMATIC_COLORS = ["#fde68a", "#fbbf24", "#f59e0b", "#f97316", "#ef4444"];

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
  const [token, setToken] = useState("");
  const [filters, setFilters] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [riskData, setRiskData] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [selectedCrimeTypes, setSelectedCrimeTypes] = useState(new Set());
  const [datePreset, setDatePreset] = useState("30");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [mapZoom, setMapZoom] = useState(11);
  const [showBlocks, setShowBlocks] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMap, setLoadingMap] = useState(false);
  const [error, setError] = useState("");

  const crimeTypes = filters?.crime_types || [];

  const selectedCrimeTypeIds = useMemo(
    () => Array.from(selectedCrimeTypes).join(","),
    [selectedCrimeTypes]
  );

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
        const riskParams = new URLSearchParams({
          date_from: dateFrom,
          date_to: dateTo,
        });

        const blocksParams = new URLSearchParams({
          date_from: dateFrom,
          date_to: dateTo,
          min_count: "1",
          limit: "5000",
        });
        if (selectedCrimeTypeIds) blocksParams.set("crime_type_ids", selectedCrimeTypeIds);
        if (selectedDistrictId) blocksParams.set("district_ids", selectedDistrictId);

        const riskUrl = `${BASE_URL}/api/v1/dashboard/district-risk?${riskParams.toString()}`;
        const blocksUrl = `${BASE_URL}/api/v1/dashboard/map/blocks?${blocksParams.toString()}`;

        const [riskRes, blocksRes] = await Promise.all([
          fetch(riskUrl, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(blocksUrl, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!riskRes.ok) throw new Error("District risk request failed");
        if (!blocksRes.ok) throw new Error("Blocks request failed");

        const riskJson = await riskRes.json();
        const blocksJson = await blocksRes.json();

        setRiskData(riskJson?.districts || []);
        setBlocks(blocksJson?.blocks || []);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load thematic data");
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

  const onZoomChange = useCallback((zoom) => setMapZoom(zoom), []);

  if (loading) {
    return <HeatmapSkeleton />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Thematic Map</h1>
        <div className="flex items-center gap-2">
          <button
            className="h-9 px-3 rounded text-xs font-medium flex items-center gap-2"
            style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}
            onClick={() => setShowBlocks((prev) => !prev)}
          >
            <Layers size={14} /> Layers
          </button>
          <button
            className="h-9 px-3 rounded text-xs font-medium flex items-center gap-2"
            style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}
          >
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
            <label className="text-[11px] uppercase tracking-wide" style={{ color: "var(--color-text-secondary)" }}>Crime type overlay</label>
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
          <label className="text-[11px] uppercase tracking-wide" style={{ color: "var(--color-text-secondary)" }}>Granularity</label>
          <div className="mt-2 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            Zoom in to see block-level hotspots.
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
          <ThematicMap
            districts={districts}
            riskData={riskData}
            bins={bins}
            colors={THEMATIC_COLORS}
            selectedDistrictId={selectedDistrictId}
            onSelectDistrict={(district) => setSelectedDistrictId(district.district_id)}
            onZoomChange={onZoomChange}
            mapZoom={mapZoom}
            blocks={blocks}
            showBlocks={showBlocks}
          />

          <ThematicLegend title="Crimes per 1k" bins={bins} colors={THEMATIC_COLORS} />

          {loadingMap && (
            <div
              className="absolute top-4 left-4 rounded px-3 py-2 text-xs"
              style={{ background: "rgba(26,39,68,0.9)", border: "1px solid var(--color-border)" }}
            >
              Loading thematic data...
            </div>
          )}
        </div>

        {selectedDistrict && selectedDistrictRisk && (
          <div className="w-80 rounded-lg overflow-y-auto" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>District Summary</h2>
                <button onClick={() => setSelectedDistrictId("")} className="text-xs" style={{ color: "var(--color-text-muted)" }}>x</button>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span style={{ color: "var(--color-text-secondary)" }}>District:</span>
                  <span style={{ color: "var(--color-text-primary)" }}>{selectedDistrict.district_name}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--color-text-secondary)" }}>Total incidents:</span>
                  <span style={{ color: "var(--color-text-primary)" }}>{selectedDistrictRisk.crime_count}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--color-text-secondary)" }}>Crimes per 1k:</span>
                  <span style={{ color: "var(--color-text-primary)" }}>{Number(selectedDistrictRisk.crimes_per_1000).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--color-text-secondary)" }}>Safety index:</span>
                  <span style={{ color: "var(--color-text-primary)" }}>{Number(selectedDistrictRisk.safety_index).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--color-text-secondary)" }}>Relative to avg:</span>
                  <span style={{ color: "var(--color-text-primary)" }}>{Number(selectedDistrictRisk.relative_to_average).toFixed(2)}x</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
