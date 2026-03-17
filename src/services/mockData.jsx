export const currentUser = {
  name: "Sarah Chen",
  initials: "SC",
  role: "Admin",
  email: "sarah.chen@gscip.gov",
  districtScope: [7, 8, 11, 14],
};

export const kpiData = {
  totalCrimes: { value: 14231, delta: 8, direction: "up", window: "30d" },
  highRiskBlocks: { value: 47, delta: 3, label: "3 new" },
  spikeAlerts: { value: 12, critical: 5 },
  modelRMSE: { value: 1.84, target: 2.0, met: true },
};

export const topRiskBlocks = [
  { id: "047W", address: "047W Madison St", riskScore: 0.87, tier: "HIGH", district: 8 },
  { id: "063E", address: "063E 79th St", riskScore: 0.74, tier: "HIGH", district: 8 },
  { id: "025N", address: "025N Kedzie Ave", riskScore: 0.71, tier: "HIGH", district: 11 },
  { id: "011W", address: "011W 51st St", riskScore: 0.68, tier: "MED", district: 7 },
  { id: "033S", address: "033S Ashland Ave", riskScore: 0.65, tier: "MED", district: 7 },
];

export const trendData = Array.from({ length: 30 }, (_, i) => ({
  date: `Feb ${i + 1}`,
  crimes: Math.floor(Math.random() * 60 + 40),
  dist7: Math.floor(Math.random() * 20 + 10),
  dist8: Math.floor(Math.random() * 25 + 15),
  dist11: Math.floor(Math.random() * 15 + 8),
}));

export const weeklyTrend = [
  { day: "Mon", count: 82 }, { day: "Tue", count: 74 }, { day: "Wed", count: 91 },
  { day: "Thu", count: 68 }, { day: "Fri", count: 105 }, { day: "Sat", count: 94 },
  { day: "Sun", count: 79 },
];

export const alerts = [
  { id: 1, type: "warning", message: "Drift detected — model performance degraded", time: "2h ago" },
  { id: 2, type: "success", message: "Ingestion complete — 2,341 records processed", time: "4h ago" },
  { id: 3, type: "warning", message: "3 new high-risk blocks identified in District 8", time: "6h ago" },
  { id: 4, type: "info", message: "Weekly summary report generated", time: "1d ago" },
  { id: 5, type: "error", message: "Geocoding service timeout — retry scheduled", time: "1d ago" },
];

export const crimeTypes = [
  { type: "Theft", count: 4820, color: "#1E88E5" },
  { type: "Assault", count: 2910, color: "#F57C00" },
  { type: "Burglary", count: 2180, color: "#2E7D32" },
  { type: "Battery", count: 1890, color: "#AB47BC" },
  { type: "Robbery", count: 1430, color: "#EF5350" },
  { type: "Other", count: 1001, color: "#546E7A" },
];

export const shapFeatures = [
  { feature: "1-Hop Density", value: 1.24, direction: "positive" },
  { feature: "7d Rolling Count", value: 0.87, direction: "positive" },
  { feature: "500m Intensity", value: 0.38, direction: "positive" },
  { feature: "Community ID", value: 0.31, direction: "positive" },
  { feature: "Trend Slope", value: -0.22, direction: "negative" },
];

export const modelVersions = [
  { version: "v1.0", rmse: 3.2, mae: 2.1, precK: 0.52, date: "Jun 2024", features: 8 },
  { version: "v1.1", rmse: 2.9, mae: 1.9, precK: 0.56, date: "Jul 2024", features: 9 },
  { version: "v1.2", rmse: 2.7, mae: 1.8, precK: 0.61, date: "Aug 2024", features: 10 },
  { version: "v1.3", rmse: 2.5, mae: 1.6, precK: 0.65, date: "Sep 2024", features: 11 },
  { version: "v1.4", rmse: 2.3, mae: 1.5, precK: 0.68, date: "Oct 2024", features: 12 },
  { version: "v2.0", rmse: 2.0, mae: 1.3, precK: 0.73, date: "Dec 2024", features: 13 },
  { version: "v2.1", rmse: 1.84, mae: 1.21, precK: 0.78, date: "Feb 2025", features: 13, active: true },
];

export const biasData = [
  { district: "Dist 1", rmse: 2.1, flagged: true, delta: 28 },
  { district: "Dist 7", rmse: 1.6, flagged: false, delta: -3 },
  { district: "Dist 8", rmse: 1.7, flagged: false, delta: 3 },
  { district: "Dist 11", rmse: 2.3, flagged: true, delta: 40 },
  { district: "Dist 14", rmse: 1.5, flagged: false, delta: -9 },
];

export const biasPerCrimeType = [
  { type: "Theft", rmse: 1.7, flagged: false },
  { type: "Assault", rmse: 2.4, flagged: true },
  { type: "Battery", rmse: 1.9, flagged: false },
  { type: "Robbery", rmse: 1.6, flagged: false },
  { type: "Burglary", rmse: 2.1, flagged: true },
];

export const reports = [
  { id: 1, type: "Weekly Summary", name: "Weekly Summary — Feb 24, 2025", districts: "7, 8, 11", auto: true, date: "Feb 24, 2025", by: "system" },
  { id: 2, type: "Crime Risk PDF", name: "Crime Risk Report — District 8", districts: "8", auto: false, date: "Feb 22, 2025", by: "analyst@gov" },
  { id: 3, type: "District Compare", name: "District Comparison — Dist 7 vs 8", districts: "7, 8", auto: false, date: "Feb 20, 2025", by: "analyst@gov" },
  { id: 4, type: "Model Audit", name: "Model Audit — v2.1", districts: "All", auto: true, date: "Feb 18, 2025", by: "system" },
];

export const chatHistory = [
  { role: "system", content: "Platform scoped to District 8 — Feb 1–27, 2025" },
  { role: "user", content: "What are the top 5 high-risk blocks in District 8 this month?" },
  {
    role: "assistant",
    content: "Based on predictions for Feb 1–27, 2025:\n\n1. **047W Madison St** — Risk: 0.87 (HIGH)\n2. **063E 79th St** — Risk: 0.74 (HIGH)\n3. **025N Kedzie Ave** — Risk: 0.71 (HIGH)\n4. **011W 51st St** — Risk: 0.68 (MED)\n5. **033S Ashland Ave** — Risk: 0.65 (MED)",
    source: "predictions (Feb 2025)",
    model: "graph_xgb_v2.1",
    actions: ["View on Heatmap", "Explain Top Block"],
  },
];

export const suggestedPrompts = ["Show spike alerts for this month", "Compare District 7 vs 8", "Why is 047W Madison high risk?"];

export const networkNodes = [
  { id: "047W", label: "047W Madison", risk: 0.87, tier: "HIGH", degree: 0.82, community: 3, lat: 17.361431, lng: 78.474533 },
];

export const networkEdges = [
  { source: "047W", target: "049W", weight: 3.2, sameCommunity: true },
  { source: "047W", target: "045W", weight: 2.8, sameCommunity: true },
  { source: "047W", target: "047E", weight: 4.1, sameCommunity: true },
  { source: "063E", target: "061E", weight: 2.5, sameCommunity: true },
  { source: "025N", target: "023N", weight: 1.9, sameCommunity: true },
  { source: "047W", target: "063E", weight: 1.2, sameCommunity: false },
  { source: "025N", target: "011W", weight: 0.8, sameCommunity: false },
  { source: "011W", target: "033S", weight: 2.1, sameCommunity: true },
  { source: "049W", target: "063E", weight: 0.6, sameCommunity: false },
];

export const spikeEvents = [
  { date: "Feb 5", blockId: "047W", blockLabel: "047W Madison", ratio: 3.2 },
  { date: "Feb 12", blockId: "063E", blockLabel: "063E 79th St", ratio: 2.8 },
  { date: "Feb 19", blockId: "025N", blockLabel: "025N Kedzie", ratio: 2.1 },
];

export const blockDetail = {
  id: "047W",
  address: "047W Madison Street, District 8",
  riskScore: 0.87,
  tier: "HIGH",
  predictedCrimes: 4.2,
  ciLow: 2.8,
  ciHigh: 5.6,
  lastUpdated: "2h ago",
  spikeActive: true,
  spikeRatio: 3.0,
  rolling7d: 36,
  rolling30d: 94,
  slope7d: 1.2,
  slope30d: 0.4,
  features: {
    network: { degree: 0.82, hop1Density: 12, hop2Density: 34, clustering: 0.71, community: 3 },
    spatial: { intensity500m: 24, intensity1km: 61, decayScore: 0.73 },
    temporal: { count7d: 36, count30d: 94, slope7d: 1.2, slope30d: 0.4, spikeFlag: true },
  },
};

export const districts = [
  { id: 1, name: "District 1" }, { id: 7, name: "District 7" },
  { id: 8, name: "District 8" }, { id: 11, name: "District 11" },
  { id: 14, name: "District 14" },
];

export const auditLogs = [
  { id: 1, action: "Model Activated", user: "admin@gscip.gov", details: "graph_xgb_v2.1 set as active", timestamp: "Feb 1, 2025 09:15" },
  { id: 2, action: "Report Generated", user: "analyst@gscip.gov", details: "Crime Risk PDF — District 8", timestamp: "Feb 22, 2025 14:30" },
  { id: 3, action: "Threshold Changed", user: "admin@gscip.gov", details: "Bias threshold: 15% → 20%", timestamp: "Feb 18, 2025 11:00" },
  { id: 4, action: "User Role Updated", user: "admin@gscip.gov", details: "john@gscip.gov → Analyst", timestamp: "Feb 15, 2025 10:00" },
  { id: 5, action: "Data Ingestion", user: "system", details: "2,341 records ingested from CPD API", timestamp: "Feb 27, 2025 06:00" },
];
