/** GSCIP API Service Layer v1.5 */
/**
 * GSCIP API Service Layer
 * 
 * This module provides API integration points for all GSCIP platform data.
 * Currently uses mock data. To enable real APIs:
 *   1. Uncomment the fetch calls in each function
 *   2. Set the API_BASE_URL to your backend endpoint
 *   3. Remove or keep mock data as fallback
 */

import {
  kpiData,
  topRiskBlocks,
  trendData,
  weeklyTrend,
  alerts,
  crimeTypes,
  shapFeatures,
  modelVersions,
  biasData,
  biasPerCrimeType,
  chatHistory,
  suggestedPrompts,
  networkNodes,
  networkEdges,
  spikeEvents,
  blockDetail,
  districts,
  auditLogs,
  currentUser,
} from "./mockData";

// ── Configuration ──────────────────────────────────────────────────────
// const API_BASE_URL = "https://api.gscip.gov/v1";
// const API_KEY = process.env.REACT_APP_GSCIP_API_KEY || "";
const DASHBOARD_API_BASE = "http://localhost:9000/api/v1/dashboard";
const REPORTS_API_BASE = "http://localhost:9000/api/v1/reports";
const CHAT_API_BASE = "http://localhost:9000/api/v1/chat";
export const AUTH_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiAidGVzdHVzZXIiLCAicm9sZXMiOiBbIkFkbWluIl0sICJkaXN0cmljdF9zY29wZSI6IFtdLCAiaWF0IjogMTc3NjQxNDUwMSwgImV4cCI6IDE3NzY1MDA5MDF9._b0yFyt695F7RJrzP0Qg8I5X8KnzCjQrEZaYUxGH8A4";

function normalizeDistrictId(value) {
  if (value == null) return "";
  const str = String(value).trim();
  const digits = str.match(/\d+/)?.[0];
  if (!digits) return str;
  return digits.padStart(3, "0");
}

function normalizeCrimeTypeId(value) {
  if (value == null) return "";
  return String(value).trim().toLowerCase().replace(/\s+/g, "_");
}

function buildTopRiskBlocksUrl({ filters, limit, districtIdByName, crimeTypeIdByName }) {
  const params = new URLSearchParams();
  params.set("date_from", filters?.dateFrom);
  params.set("date_to", filters?.dateTo);
  if (limit) params.set("limit", String(limit));

  if (filters?.districts?.length) {
    const ids = filters.districts
      .map((name) => districtIdByName?.[name] ?? normalizeDistrictId(name))
      .filter(Boolean);
    if (ids.length > 0) params.set("district_ids", ids.join(","));
  }

  if (filters?.crimeTypes?.length) {
    const ids = filters.crimeTypes
      .map((name) => crimeTypeIdByName?.[name] ?? normalizeCrimeTypeId(name))
      .filter(Boolean);
    if (ids.length > 0) params.set("crime_type_ids", ids.join(","));
  }

  if (filters?.riskTiers?.length) {
    params.set("risk_tiers", filters.riskTiers.join(","));
  }

  return `${DASHBOARD_API_BASE}/map/blocks?${params.toString()}`;
}

function buildTrendCompareUrl({ filters, windowType, districtIdByName }) {
  const params = new URLSearchParams();
  if (windowType) params.set("window_type", windowType);
  if (filters?.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters?.dateTo) params.set("date_to", filters.dateTo);

  if (filters?.districts?.length) {
    const ids = filters.districts
      .map((name) => districtIdByName?.[name] ?? normalizeDistrictId(name))
      .filter(Boolean);
    if (ids.length > 0) params.set("district_ids", ids.join(","));
  }

  return `${DASHBOARD_API_BASE}/trends/compare?${params.toString()}`;
}

function buildRollingTrendUrl({ filters, districtIdByName }) {
  const params = new URLSearchParams();
  if (filters?.dateTo) params.set("date_to", filters.dateTo);

  if (filters?.districts?.length) {
    const ids = filters.districts
      .map((name) => districtIdByName?.[name] ?? normalizeDistrictId(name))
      .filter(Boolean);
    if (ids.length > 0) params.set("district_ids", ids.join(","));
  }

  if (filters?.crimeTypes?.length) {
    const ids = filters.crimeTypes
      .map((name) => normalizeCrimeTypeId(name))
      .filter(Boolean);
    if (ids.length > 0) params.set("crime_type_ids", ids.join(","));
  }

  if (filters?.arrestOnly) params.set("is_arrest", "true");
  if (filters?.domesticOnly) params.set("is_domestic", "true");

  return `${DASHBOARD_API_BASE}/trends/rolling?${params.toString()}`;
}

function districtKey(id) {
  return `district_${normalizeDistrictId(id)}`;
}

// ── Auth / User ────────────────────────────────────────────────────────
export async function fetchCurrentUser() {
  return Promise.resolve(currentUser);
}

// ── Dashboard KPIs ─────────────────────────────────────────────────────
export async function fetchKPIs(filters = {}) {
  return Promise.resolve(kpiData);
}

export async function fetchTopRiskBlocks({ filters, limit = 5, districtIdByName, crimeTypeIdByName } = {}) {
  try {
    const url = buildTopRiskBlocksUrl({ filters, limit, districtIdByName, crimeTypeIdByName });
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });
    if (!res.ok) throw new Error(`Top risk blocks fetch failed: ${res.status}`);
    const data = await res.json();
    const rawBlocks = data?.blocks ?? data ?? [];
    const maxCrimeCount = rawBlocks.reduce((max, block) => {
      const val = Number(block?.crime_count ?? block?.crimeCount ?? 0);
      return Number.isFinite(val) ? Math.max(max, val) : max;
    }, 0);

    return rawBlocks.map((block) => {
      const crimeCount = Number(block?.crime_count ?? block?.crimeCount ?? 0);
      const riskScore = maxCrimeCount > 0 ? Math.max(0.1, crimeCount / maxCrimeCount) : 0.2;
      return {
        ...block,
        id: block?.id ?? block?.block_id ?? block?.blockId,
        address: block?.address ?? block?.block_address ?? block?.blockAddress,
        crimeCount,
        riskScore,
        tier: block?.tier ?? "HIGH",
      };
    });
  } catch (err) {
    console.error("fetchTopRiskBlocks failed:", err);
    return [];
  }
}

export async function fetchAlerts(filters = {}) {
  return Promise.resolve(alerts);
}

function buildCrimeTypesUrl({ filters, districtIdByName }) {
  const params = new URLSearchParams();
  params.set("date_from", filters?.dateFrom);
  params.set("date_to", filters?.dateTo);

  if (filters?.districts?.length) {
    const ids = filters.districts
      .map((name) => districtIdByName?.[name] ?? normalizeDistrictId(name))
      .filter(Boolean);
    if (ids.length > 0) params.set("district_ids", ids.join(","));
  }
  return `${DASHBOARD_API_BASE}/crime-types?${params.toString()}`;
}

export async function fetchCrimeTypes({ filters, districtIdByName } = {}) {
  try {
    const url = buildCrimeTypesUrl({ filters, districtIdByName });
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Crime types fetch failed: ${res.status}`);
    const data = await res.json();
    const CATEGORY_COLORS = {
      violent: "#ef4444",
      property: "#f97316",
      quality: "#eab308",
      other: "#6b7280",
    };
    return (data?.items || []).map((item) => ({
      type: item.primary_type,
      count: item.crime_count,
      color: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other,
    }));
  } catch (err) {
    console.error("fetchCrimeTypes failed:", err);
    return [];
  }
}

export async function fetchWeeklyTrend({ filters, districtIdByName } = {}) {
  try {
    const url = buildRollingTrendUrl({ filters, districtIdByName });
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });
    if (!res.ok) throw new Error(`Weekly trend fetch failed: ${res.status}`);
    const payload = await res.json();
    const chart = payload?.chart_data ?? [];

    // Map backend series to { day, count } expected by the Dashboard widget
    return chart.slice(-7).map((row) => ({
      day: row?.label ?? row?.date?.slice?.(0, 10) ?? "",
      count: Number(row?.crime_count ?? row?.crimeCount ?? 0),
    }));
  } catch (err) {
    console.error("fetchWeeklyTrend failed:", err);
    return [];
  }
}

// ── Trends ─────────────────────────────────────────────────────────────
export async function fetchTrendCompare({ filters, windowType = "month", districtIdByName } = {}) {
  try {
    const url = buildTrendCompareUrl({ filters, windowType, districtIdByName });
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });
    if (!res.ok) throw new Error(`Trend compare fetch failed: ${res.status}`);
    const payload = await res.json();
    const rows = payload?.data ?? payload ?? [];

    const districtsMap = {};
    rows.forEach((row) => {
      const id = normalizeDistrictId(row?.district_id ?? row?.districtId ?? row?.district);
      if (!id) return;
      const name = row?.district_name ?? row?.districtName ?? `District ${id}`;
      districtsMap[id] = name;
    });

    const byLabel = new Map();
    rows.forEach((row) => {
      const label = row?.label ?? row?.date?.slice?.(0, 10) ?? "";
      if (!label) return;
      const id = normalizeDistrictId(row?.district_id ?? row?.districtId ?? row?.district);
      const key = districtKey(id || "unknown");
      const crimeCount = Number(row?.crime_count ?? row?.crimeCount ?? 0);
      const existing = byLabel.get(label) || { label, date: row?.date ?? null };
      existing[key] = Number.isFinite(crimeCount) ? crimeCount : 0;
      byLabel.set(label, existing);
    });

    const series = Array.from(byLabel.values()).sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return da - db;
    });

    const districts = Object.entries(districtsMap).map(([id, name]) => ({
      id,
      name,
      key: districtKey(id),
    }));

    return { series, districts, window_type: payload?.window_type ?? windowType };
  } catch (err) {
    console.error("fetchTrendCompare failed:", err);
    return { series: [], districts: [], window_type: windowType };
  }
}

export async function fetchRollingTrend({ filters, districtIdByName } = {}) {
  try {
    const url = buildRollingTrendUrl({ filters, districtIdByName });
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });
    if (!res.ok) throw new Error(`Rolling trend fetch failed: ${res.status}`);
    const payload = await res.json();
    const chart = payload?.chart_data ?? [];
    const series = chart.map((row) => ({
      date: row?.date ?? null,
      label: row?.label ?? row?.date?.slice?.(0, 10) ?? "",
      crime_count: Number(row?.crime_count ?? row?.crimeCount ?? 0),
    }));

    return {
      avg_7d: Number(payload?.avg_7d ?? 0),
      avg_30d: Number(payload?.avg_30d ?? 0),
      trend_slope: Number(payload?.trend_slope ?? 0),
      series,
    };
  } catch (err) {
    console.error("fetchRollingTrend failed:", err);
    return { avg_7d: 0, avg_30d: 0, trend_slope: 0, series: [] };
  }
}
export async function fetchTrendData(filters = {}) {
  return Promise.resolve(trendData);
}

export async function fetchSpikeEvents(filters = {}) {
  return Promise.resolve(spikeEvents);
}

// ── Heatmap ────────────────────────────────────────────────────────────
export async function fetchHeatmapData(filters = {}) {
  return Promise.resolve(topRiskBlocks);
}

// ── Network Graph ──────────────────────────────────────────────────────
export async function fetchNetworkGraph(filters = {}) {
  return Promise.resolve({ nodes: networkNodes, edges: networkEdges });
}

// ── Block Detail ───────────────────────────────────────────────────────
export async function fetchBlockDetail(blockId) {
  return Promise.resolve(blockDetail);
}

export async function fetchBlockTimeline(blockId, days = 30) {
  return Promise.resolve(trendData.slice(0, days));
}

// ── Models ─────────────────────────────────────────────────────────────
export async function fetchModelVersions() {
  return Promise.resolve(modelVersions);
}

export async function fetchSHAPFeatures(modelVersion) {
  return Promise.resolve(shapFeatures);
}

export async function activateModelVersion(version) {
  return Promise.resolve({ success: true, activatedVersion: version });
}

// ── Fairness / Bias ────────────────────────────────────────────────────
export async function fetchBiasData(filters = {}) {
  return Promise.resolve({ byDistrict: biasData, byCrimeType: biasPerCrimeType });
}

// ── Reports ────────────────────────────────────────────────────────────
export async function fetchReports() {
  try {
    const res = await fetch(REPORTS_API_BASE, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });
    if (!res.ok) throw new Error(`Reports fetch failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("fetchReports failed:", err);
    return [];
  }
}

export async function generateReport(config) {
  try {
    const res = await fetch(`${REPORTS_API_BASE}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error(`Generate report failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("generateReport failed:", err);
    throw err;
  }
}

export async function fetchReportStatus(reportId) {
  try {
    const res = await fetch(`${REPORTS_API_BASE}/${reportId}`, {
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
    });
    if (!res.ok) throw new Error(`Report status failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("fetchReportStatus failed:", err);
    throw err;
  }
}

export async function downloadReport(reportId) {
  try {
    const res = await fetch(`${REPORTS_API_BASE}/${reportId}/download`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${reportId}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    return { success: true };
  } catch (err) {
    console.error("downloadReport failed:", err);
    throw err;
  }
}

// ── Chat / NL Query ────────────────────────────────────────────────────
/**
 * Sends a natural language message to the LLM-powered chatbot.
 * @param {string} message 
 * @param {string|null} conversationId 
 */
export async function sendChatMessage(message, conversationId = null) {
  try {
    const res = await fetch(CHAT_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({ message, conversation_id: conversationId }),
    });
    if (!res.ok) throw new Error(`Chat API failed: ${res.status}`);
    const data = await res.json();

    // Transform backend schema to frontend message object
    return {
      role: "assistant",
      content: data.response,
      meta: {
        intentId: data.intent_id,
        aqlExecuted: data.aql_executed,
        resultCount: data.result_count,
        aql: data.aql
      }
    };
  } catch (err) {
    console.error("sendChatMessage failed:", err);
    return {
      role: "assistant",
      content: "I'm sorry, I'm having trouble connecting to the crime intelligence engine right now.",
      error: true
    };
  }
}

export async function fetchSuggestedPrompts(context = {}) {
  return Promise.resolve(suggestedPrompts);
}

// ── Audit Logs ─────────────────────────────────────────────────────────
export async function fetchAuditLogs(filters = {}) {
  return Promise.resolve(auditLogs);
}

// ── Districts ──────────────────────────────────────────────────────────
export async function fetchDistricts() {
  const res = await fetch(`${DASHBOARD_API_BASE}/districts`, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
  });
  if (!res.ok) throw new Error("Districts fetch failed");
  return await res.json();
}

// ── Settings ───────────────────────────────────────────────────────────
export async function updateSettings(settings) {
  return Promise.resolve({ success: true, ...settings });
}

// ── Data Ingestion (Admin) ─────────────────────────────────────────────
export async function triggerIngestion(source = "cpd_api") {
  return Promise.resolve({ jobId: Date.now(), status: "queued", recordsQueued: 2341 });
}

export async function fetchIngestionStatus(jobId) {
  return Promise.resolve({ jobId, status: "complete", recordsProcessed: 2341 });
}

export async function fetchPoliceStations() {
  const res = await fetch(`${DASHBOARD_API_BASE}/map/police-stations`, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
  });
  if (!res.ok) throw new Error("Police stations fetch failed");
  return await res.json();
}

export async function fetchPoliceBeats() {
  try {
    const res = await fetch(`${DASHBOARD_API_BASE}/geospatial/boundaries?level=beat`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Police beats fetch failed: ${res.status}`);
    const data = await res.json();
    // Backend returns: { level, features: [{ id, label, boundary }] }
    return (data.features ?? data).map((f) => ({
      beat_num: f.id ?? f.properties?.id ?? f.beat_num,
      boundary: f.boundary ?? f.geometry,
    }));
  } catch (err) {
    console.error("fetchPoliceBeats failed:", err);
    return [];
  }
}

export async function fetchPrecincts() {
  const res = await fetch(`${DASHBOARD_API_BASE}/map/precincts`, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
  });
  if (!res.ok) throw new Error("Precincts fetch failed");
  return await res.json();
}

// ── Summary Maps ───────────────────────────────────────────────────────

/**
 * Fetches choropleth ranking data for a specific geographic level.
 * @param {"ward"|"district"|"beat"} level
 * @param {string} dateFrom  ISO date string, e.g. "2024-01-01"
 * @param {string} dateTo    ISO date string, e.g. "2024-12-31"
 */
export async function fetchGeospatialSummary({ level, dateFrom, dateTo, wardIds, districtIds, beatIds, crimeTypeIds } = {}) {
  try {
    const params = new URLSearchParams({ level });
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (wardIds?.length) params.set("ward_ids", wardIds.join(","));
    if (districtIds?.length) params.set("district_ids", districtIds.join(","));
    if (beatIds?.length) params.set("beat_ids", beatIds.join(","));
    if (crimeTypeIds?.length) params.set("crime_type_ids", crimeTypeIds.join(","));

    const res = await fetch(`${DASHBOARD_API_BASE}/geospatial/summary?${params}`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Geospatial summary fetch failed: ${res.status}`);
    return await res.json(); // { level, date_from, date_to, total_incidents, items: [...] }
  } catch (err) {
    console.error("fetchGeospatialSummary failed:", err);
    return { level, total_incidents: 0, items: [] };
  }
}

/**
 * Fetches summary KPI metrics (total incidents, arrest rate, etc.).
 * @param {{ dateFrom, dateTo, wardIds?, districtIds?, crimeTypeIds? }} params
 */
export async function fetchSummaryKPIs({ dateFrom, dateTo, wardIds, districtIds, beatIds, crimeTypeIds } = {}) {
  try {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (wardIds?.length) params.set("ward_ids", wardIds.join(","));
    if (districtIds?.length) params.set("district_ids", districtIds.join(","));
    if (beatIds?.length) params.set("beat_ids", beatIds.join(","));
    if (crimeTypeIds?.length) params.set("crime_type_ids", crimeTypeIds.join(","));
    const res = await fetch(`${DASHBOARD_API_BASE}/summary?${params}`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Summary KPI fetch failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("fetchSummaryKPIs failed:", err);
    return { total_incidents: 0, arrest_count: 0, arrest_rate_pct: 0, domestic_count: 0, domestic_rate_pct: 0 };
  }
}

/**
 * Fetches incidents grouped by date for the trend line chart.
 * @param {{ dateFrom, dateTo, wardIds?, districtIds?, crimeTypeIds? }} params
 */
export async function fetchIncidentsByDate({ dateFrom, dateTo, wardIds, districtIds, beatIds, crimeTypeIds } = {}) {
  try {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (wardIds?.length) params.set("ward_ids", wardIds.join(","));
    if (districtIds?.length) params.set("district_ids", districtIds.join(","));
    if (beatIds?.length) params.set("beat_ids", beatIds.join(","));
    if (crimeTypeIds?.length) params.set("crime_type_ids", crimeTypeIds.join(","));
    const res = await fetch(`${DASHBOARD_API_BASE}/incidents/by-date?${params}`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Incidents by-date fetch failed: ${res.status}`);
    const payload = await res.json(); // { window_type, data: [{ label, date, crime_count }] }
    return (payload.data ?? []).map((row) => ({ date: row.label, count: row.crime_count }));
  } catch (err) {
    console.error("fetchIncidentsByDate failed:", err);
    return [];
  }
}

/**
 * Fetches incidents broken down by crime type.
 * @param {{ dateFrom, dateTo, wardIds?, districtIds?, crimeTypeIds? }} params
 */
export async function fetchIncidentsByCrimeType({ dateFrom, dateTo, wardIds, districtIds, beatIds, crimeTypeIds } = {}) {
  try {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (wardIds?.length) params.set("ward_ids", wardIds.join(","));
    if (districtIds?.length) params.set("district_ids", districtIds.join(","));
    if (beatIds?.length) params.set("beat_ids", beatIds.join(","));
    if (crimeTypeIds?.length) params.set("crime_type_ids", crimeTypeIds.join(","));
    const res = await fetch(`${DASHBOARD_API_BASE}/incidents/by-crime-type?${params}`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Incidents by-crime-type fetch failed: ${res.status}`);
    const payload = await res.json(); // { total, items: [{ crime_type_id, primary_type, category, crime_count, pct_of_total }] }
    const CATEGORY_COLORS = {
      violent: "#ef4444",
      property: "#f97316",
      quality: "#eab308",
      other: "#6b7280",
    };
    return (payload.items ?? []).map((item) => ({
      name: item.primary_type,
      count: item.crime_count,
      category: item.category,
      color: CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.other,
      pct: item.pct_of_total,
    }));
  } catch (err) {
    console.error("fetchIncidentsByCrimeType failed:", err);
    return [];
  }
}

/**
 * Fetches available filter options, including the global date range.
 */
export async function fetchFilterOptions() {
  const res = await fetch(`${DASHBOARD_API_BASE}/filters`, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
  });
  if (!res.ok) throw new Error("Filters fetch failed");
  return await res.json();
}

/**
 * Fetches crime counts by day-of-week × hour-of-day from the real backend.
 */
export async function fetchHourlyTrends({ dateFrom, dateTo, districtIds } = {}) {
  try {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (districtIds?.length) params.set("district_ids", districtIds.join(","));
    const res = await fetch(`${DASHBOARD_API_BASE}/trends/hourly?${params}`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Hourly trends fetch failed: ${res.status}`);
    return await res.json(); // { data: [{ day_of_week, hour_of_day, crime_count }], total }
  } catch (err) {
    console.error("fetchHourlyTrends failed:", err);
    return { data: [], total: 0 };
  }
}

/**
 * Fetches the platform-wide crime trend time series.
 */
export async function fetchPlatformTrend({ dateFrom, dateTo, windowType = "day" } = {}) {
  try {
    const params = new URLSearchParams({ window_type: windowType });
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const res = await fetch(`${DASHBOARD_API_BASE}/trends/platform?${params}`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Platform trend fetch failed: ${res.status}`);
    const payload = await res.json();
    return (payload.data ?? []).map(row => ({ date: row.label, count: row.crime_count }));
  } catch (err) {
    console.error("fetchPlatformTrend failed:", err);
    return [];
  }
}
export async function fetchMapIncidents({ dateFrom, dateTo, wardIds, districtIds, beatIds, crimeTypeIds, limit = 500 } = {}) {
  try {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (wardIds?.length) params.set("ward_ids", wardIds.join(","));
    if (districtIds?.length) params.set("district_ids", districtIds.join(","));
    if (beatIds?.length) params.set("beat_ids", beatIds.join(","));
    if (crimeTypeIds?.length) params.set("crime_type_ids", crimeTypeIds.join(","));
    params.set("limit", String(limit));
    const res = await fetch(`${DASHBOARD_API_BASE}/map/incidents?${params}`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Map incidents fetch failed: ${res.status}`);
    return await res.json(); // array of incident objects
  } catch (err) {
    console.error("fetchMapIncidents failed:", err);
    return [];
  }
}

/**
 * Fetches ward boundary GeoJSON polygons.
 */
export async function fetchWardBoundaries() {
  try {
    // Uses /geospatial/boundaries?level=ward which aggregates from precincts collection
    const res = await fetch(`${DASHBOARD_API_BASE}/geospatial/boundaries?level=ward`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Ward boundaries fetch failed: ${res.status}`);
    const data = await res.json();
    // Backend returns: { level, features: [{ id, label, boundary }] }
    return (data.features ?? data).map((f) => ({
      ward_id: f.id ?? f.properties?.id ?? f.ward_id,
      boundary: f.boundary ?? f.geometry,
    }));
  } catch (err) {
    console.error("fetchWardBoundaries failed:", err);
    return [];
  }
}

/**
 * Fetches district boundary GeoJSON polygons (with include_boundary=true).
 */
export async function fetchDistrictBoundaries() {
  try {
    const res = await fetch(`${DASHBOARD_API_BASE}/districts?include_boundary=true`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
    if (!res.ok) throw new Error(`District boundaries fetch failed: ${res.status}`);
    return await res.json(); // array of { district_id, district_name, boundary, ... }
  } catch (err) {
    console.error("fetchDistrictBoundaries failed:", err);
    return [];
  }
}
