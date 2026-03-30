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
export const AUTH_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiAidGVzdHVzZXIiLCAicm9sZXMiOiBbIkFkbWluIl0sICJkaXN0cmljdF9zY29wZSI6IFtdLCAiaWF0IjogMTc3NDg2MDQ0NSwgImV4cCI6IDE3NzQ5NDY4NDV9.tnNViOlVeDJuv3Z3Ypf6dOwtkql55VKrUhS1fgjWgZo";

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

// ── Helper: authenticated fetch ────────────────────────────────────────
// async function apiFetch(endpoint, options = {}) {
//   const res = await fetch(`${API_BASE_URL}${endpoint}`, {
//     headers: {
//       "Content-Type": "application/json",
//       "Authorization": `Bearer ${API_KEY}`,
//       ...options.headers,
//     },
//     ...options,
//   });
//   if (!res.ok) {
//     const error = await res.json().catch(() => ({ message: res.statusText }));
//     throw new Error(error.message || `API error ${res.status}`);
//   }
//   return res.json();
// }

// ── Auth / User ────────────────────────────────────────────────────────
export async function fetchCurrentUser() {
  // Real API implementation:
  // try {
  //   const data = await apiFetch("/auth/me");
  //   return data.user;
  // } catch (err) {
  //   console.error("fetchCurrentUser failed:", err);
  //   throw err;
  // }

  // Mock fallback:
  return Promise.resolve(currentUser);
}

// ── Dashboard KPIs ─────────────────────────────────────────────────────
export async function fetchKPIs(filters = {}) {
  // Real API implementation:
  // try {
  //   const params = new URLSearchParams();
  //   if (filters.district) params.append("district", filters.district);
  //   if (filters.dateRange) params.append("range", filters.dateRange);
  //   const data = await apiFetch(`/dashboard/kpis?${params}`);
  //   return data;
  // } catch (err) {
  //   console.error("fetchKPIs failed:", err);
  //   throw err;
  // }

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
  // Real API implementation:
  // try {
  //   const params = new URLSearchParams();
  //   if (filters.type) params.append("type", filters.type);
  //   if (filters.limit) params.append("limit", filters.limit);
  //   const data = await apiFetch(`/alerts?${params}`);
  //   return data.alerts;
  // } catch (err) {
  //   console.error("fetchAlerts failed:", err);
  //   throw err;
  // }

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

export async function fetchWeeklyTrend(filters = {}) {
  // Real API implementation:
  // try {
  //   const params = new URLSearchParams();
  //   if (filters.district) params.append("district", filters.district);
  //   const data = await apiFetch(`/trends/weekly?${params}`);
  //   return data.trend;
  // } catch (err) {
  //   console.error("fetchWeeklyTrend failed:", err);
  //   throw err;
  // }

  return Promise.resolve(weeklyTrend);
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
  // Real API implementation:
  // try {
  //   const params = new URLSearchParams();
  //   if (filters.district) params.append("district", filters.district);
  //   if (filters.dateFrom) params.append("from", filters.dateFrom);
  //   if (filters.dateTo) params.append("to", filters.dateTo);
  //   if (filters.granularity) params.append("granularity", filters.granularity);
  //   const data = await apiFetch(`/trends/timeseries?${params}`);
  //   return data.series;
  // } catch (err) {
  //   console.error("fetchTrendData failed:", err);
  //   throw err;
  // }

  return Promise.resolve(trendData);
}

export async function fetchSpikeEvents(filters = {}) {
  // Real API implementation:
  // try {
  //   const params = new URLSearchParams();
  //   if (filters.district) params.append("district", filters.district);
  //   if (filters.threshold) params.append("threshold", filters.threshold);
  //   const data = await apiFetch(`/trends/spikes?${params}`);
  //   return data.events;
  // } catch (err) {
  //   console.error("fetchSpikeEvents failed:", err);
  //   throw err;
  // }

  return Promise.resolve(spikeEvents);
}

// ── Heatmap ────────────────────────────────────────────────────────────
export async function fetchHeatmapData(filters = {}) {
  // Real API implementation:
  // try {
  //   const params = new URLSearchParams();
  //   if (filters.district) params.append("district", filters.district);
  //   if (filters.crimeType) params.append("crime_type", filters.crimeType);
  //   if (filters.riskTier) params.append("tier", filters.riskTier);
  //   const data = await apiFetch(`/heatmap/blocks?${params}`);
  //   return data; // { blocks: [...], legend: {...} }
  // } catch (err) {
  //   console.error("fetchHeatmapData failed:", err);
  //   throw err;
  // }

  // Mock: returns top risk blocks as heatmap cells
  return Promise.resolve(topRiskBlocks);
}

// ── Network Graph ──────────────────────────────────────────────────────
export async function fetchNetworkGraph(filters = {}) {
  // Real API implementation:
  // try {
  //   const params = new URLSearchParams();
  //   if (filters.district) params.append("district", filters.district);
  //   if (filters.community) params.append("community", filters.community);
  //   if (filters.minWeight) params.append("min_weight", filters.minWeight);
  //   const data = await apiFetch(`/network/graph?${params}`);
  //   return { nodes: data.nodes, edges: data.edges };
  // } catch (err) {
  //   console.error("fetchNetworkGraph failed:", err);
  //   throw err;
  // }

  return Promise.resolve({ nodes: networkNodes, edges: networkEdges });
}

// ── Block Detail ───────────────────────────────────────────────────────
export async function fetchBlockDetail(blockId) {
  // Real API implementation:
  // try {
  //   const data = await apiFetch(`/blocks/${blockId}`);
  //   return data;
  // } catch (err) {
  //   console.error("fetchBlockDetail failed:", err);
  //   throw err;
  // }

  return Promise.resolve(blockDetail);
}

export async function fetchBlockTimeline(blockId, days = 30) {
  // Real API implementation:
  // try {
  //   const data = await apiFetch(`/blocks/${blockId}/timeline?days=${days}`);
  //   return data.timeline;
  // } catch (err) {
  //   console.error("fetchBlockTimeline failed:", err);
  //   throw err;
  // }

  // Mock: generate timeline from trend data
  return Promise.resolve(trendData.slice(0, days));
}

// ── Models ─────────────────────────────────────────────────────────────
export async function fetchModelVersions() {
  // Real API implementation:
  // try {
  //   const data = await apiFetch("/models/versions");
  //   return data.versions;
  // } catch (err) {
  //   console.error("fetchModelVersions failed:", err);
  //   throw err;
  // }

  return Promise.resolve(modelVersions);
}

export async function fetchSHAPFeatures(modelVersion) {
  // Real API implementation:
  // try {
  //   const data = await apiFetch(`/models/${modelVersion}/shap`);
  //   return data.features;
  // } catch (err) {
  //   console.error("fetchSHAPFeatures failed:", err);
  //   throw err;
  // }

  return Promise.resolve(shapFeatures);
}

export async function activateModelVersion(version) {
  // Real API implementation:
  // try {
  //   const data = await apiFetch(`/models/${version}/activate`, { method: "POST" });
  //   return data;
  // } catch (err) {
  //   console.error("activateModelVersion failed:", err);
  //   throw err;
  // }

  return Promise.resolve({ success: true, activatedVersion: version });
}

// ── Fairness / Bias ────────────────────────────────────────────────────
export async function fetchBiasData(filters = {}) {
  // Real API implementation:
  // try {
  //   const params = new URLSearchParams();
  //   if (filters.threshold) params.append("threshold", filters.threshold);
  //   const data = await apiFetch(`/fairness/bias?${params}`);
  //   return { byDistrict: data.byDistrict, byCrimeType: data.byCrimeType };
  // } catch (err) {
  //   console.error("fetchBiasData failed:", err);
  //   throw err;
  // }

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
export async function sendChatMessage(message, context = {}) {
  // Real API implementation:
  // try {
  //   const data = await apiFetch("/chat/query", {
  //     method: "POST",
  //     body: JSON.stringify({
  //       message,
  //       district: context.district,
  //       dateRange: context.dateRange,
  //       conversationId: context.conversationId,
  //     }),
  //   });
  //   return {
  //     role: "assistant",
  //     content: data.response,
  //     source: data.source,
  //     model: data.model,
  //     actions: data.suggestedActions,
  //     aql: data.generatedAQL,
  //   };
  // } catch (err) {
  //   console.error("sendChatMessage failed:", err);
  //   throw err;
  // }

  // Mock: simulated delay + canned response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        role: "assistant",
        content: `Based on the current data for your query about "${message}":\n\nThe analysis shows moderate activity in the selected area with a risk score trending upward over the past 7 days. I recommend monitoring blocks 047W and 063E closely.\n\nWould you like me to drill deeper into any specific metric?`,
        source: "predictions (Feb 2025)",
        model: "graph_xgb_v2.1",
        actions: ["View on Heatmap", "Download CSV"],
      });
    }, 2000);
  });
}

export async function fetchSuggestedPrompts(context = {}) {
  // Real API implementation:
  // try {
  //   const data = await apiFetch("/chat/suggestions", {
  //     method: "POST",
  //     body: JSON.stringify({ district: context.district }),
  //   });
  //   return data.prompts;
  // } catch (err) {
  //   console.error("fetchSuggestedPrompts failed:", err);
  //   throw err;
  // }

  return Promise.resolve(suggestedPrompts);
}

// ── Audit Logs ─────────────────────────────────────────────────────────
export async function fetchAuditLogs(filters = {}) {
  // Real API implementation:
  // try {
  //   const params = new URLSearchParams();
  //   if (filters.action) params.append("action", filters.action);
  //   if (filters.user) params.append("user", filters.user);
  //   if (filters.from) params.append("from", filters.from);
  //   if (filters.to) params.append("to", filters.to);
  //   if (filters.page) params.append("page", filters.page);
  //   if (filters.limit) params.append("limit", filters.limit);
  //   const data = await apiFetch(`/audit/logs?${params}`);
  //   return data.logs;
  // } catch (err) {
  //   console.error("fetchAuditLogs failed:", err);
  //   throw err;
  // }

  return Promise.resolve(auditLogs);
}

// ── Districts ──────────────────────────────────────────────────────────
export async function fetchDistricts() {
  // Real API implementation:
  // try {
  //   const data = await apiFetch("/districts");
  //   return data.districts;
  // } catch (err) {
  //   console.error("fetchDistricts failed:", err);
  //   throw err;
  // }

  return Promise.resolve(districts);
}

// ── Settings ───────────────────────────────────────────────────────────
export async function updateSettings(settings) {
  // Real API implementation:
  // try {
  //   const data = await apiFetch("/settings", {
  //     method: "PUT",
  //     body: JSON.stringify(settings),
  //   });
  //   return data;
  // } catch (err) {
  //   console.error("updateSettings failed:", err);
  //   throw err;
  // }

  return Promise.resolve({ success: true, ...settings });
}

// ── Data Ingestion (Admin) ─────────────────────────────────────────────
export async function triggerIngestion(source = "cpd_api") {
  // Real API implementation:
  // try {
  //   const data = await apiFetch("/admin/ingest", {
  //     method: "POST",
  //     body: JSON.stringify({ source }),
  //   });
  //   return data; // { jobId, status, recordsQueued }
  // } catch (err) {
  //   console.error("triggerIngestion failed:", err);
  //   throw err;
  // }

  return Promise.resolve({ jobId: Date.now(), status: "queued", recordsQueued: 2341 });
}

export async function fetchIngestionStatus(jobId) {
  // Real API implementation:
  // try {
  //   const data = await apiFetch(`/admin/ingest/${jobId}/status`);
  //   return data;
  // } catch (err) {
  //   console.error("fetchIngestionStatus failed:", err);
  //   throw err;
  // }

  return Promise.resolve({ jobId, status: "complete", recordsProcessed: 2341 });
}

