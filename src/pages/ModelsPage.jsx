import { useState } from "react";
import { LineChart, Line, BarChart, Bar, ScatterChart, Scatter, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { AlertTriangle } from "lucide-react";
import GscipCard from "../components/GscipCard";
import { modelVersions, shapFeatures } from "../services/mockData";

export default function ModelsPage() {
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const active = modelVersions.find((m) => m.active);

  const scatterData = Array.from({ length: 30 }, () => {
    const actual = Math.random() * 8;
    return { actual, predicted: actual + (Math.random() - 0.5) * 3 };
  });

  const allFeatures = [
    ...shapFeatures,
    { feature: "500m Decay", value: 0.19, direction: "positive" },
    { feature: "1km Intensity", value: 0.15, direction: "positive" },
    { feature: "2-Hop Density", value: -0.12, direction: "negative" },
    { feature: "Degree Centrality", value: 0.11, direction: "positive" },
    { feature: "Betweenness", value: 0.09, direction: "positive" },
    { feature: "30d Slope", value: -0.07, direction: "negative" },
    { feature: "Day of Week", value: 0.05, direction: "positive" },
    { feature: "Hour Bucket", value: 0.03, direction: "positive" },
  ];

  const displayed = showAllFeatures ? allFeatures : shapFeatures;
  const chartTooltipStyle = { background: "#1A2744", border: "1px solid #2A3F6F", borderRadius: 6, fontSize: 12, color: "#F0F4FF" };

  return (
    <div>
      {/* Drift banner */}
      <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg" style={{ background: "rgba(245,124,0,0.15)", border: "1px solid rgba(245,124,0,0.3)" }}>
        <AlertTriangle size={16} style={{ color: "#F57C00" }} />
        <span className="text-sm" style={{ color: "#F57C00" }}>Model drift detected — consider retraining</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Model Performance</h1>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Active Model: graph_xgb_v2.1</p>
        </div>
        <div className="flex gap-2">
          <button className="h-9 px-4 rounded text-xs font-semibold" style={{ background: "var(--color-cobalt)", color: "#fff" }}>Activate Version</button>
          <button className="h-9 px-4 rounded text-xs font-medium" style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}>View Audit Report</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "RMSE", value: active.rmse, delta: "▼ 18% vs baseline", color: "#2E7D32" },
          { label: "MAE", value: active.mae, delta: "▼ 15% vs baseline", color: "#2E7D32" },
          { label: "Prec@K", value: active.precK, delta: "▲ 24% vs baseline", color: "#2E7D32" },
          { label: "Training Date", value: active.date, delta: `Features: ${active.features}`, color: "var(--color-text-secondary)" },
        ].map((k) => (
          <GscipCard key={k.label} compact>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--color-text-secondary)" }}>{k.label}</p>
            <p className="font-mono text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>{k.value}</p>
            <p className="text-[11px] mt-1" style={{ color: k.color }}>{k.delta}</p>
          </GscipCard>
        ))}
      </div>

      {/* RMSE History */}
      <GscipCard title="RMSE History (All Versions)" className="mb-4">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={modelVersions}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6F" />
            <XAxis dataKey="version" stroke="#4A5880" fontSize={11} fontFamily="IBM Plex Mono" />
            <YAxis stroke="#4A5880" fontSize={11} fontFamily="IBM Plex Mono" />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Line type="monotone" dataKey="rmse" stroke="#1E88E5" strokeWidth={2} dot={(props) => {
              const { cx, cy, payload } = props;
              return <circle cx={cx} cy={cy} r={payload.active ? 6 : 3} fill={payload.active ? "#1E88E5" : "#1565C0"} stroke={payload.active ? "#F0F4FF" : "none"} strokeWidth={2} />;
            }} />
          </LineChart>
        </ResponsiveContainer>
      </GscipCard>

      <div className="grid grid-cols-2 gap-4">
        {/* Feature Importance */}
        <GscipCard title="Feature Importance (SHAP)">
          <div className="space-y-2">
            {displayed.map((f) => (
              <div key={f.feature} className="flex items-center gap-2">
                <span className="text-xs w-28 truncate" style={{ color: "var(--color-text-secondary)" }}>{f.feature}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--color-bg-app)" }}>
                  <div className="h-full rounded-full" style={{
                    width: `${(Math.abs(f.value) / 1.24) * 100}%`,
                    background: f.direction === "positive" ? "#1565C0" : "#C62828",
                  }} />
                </div>
                <span className="font-mono text-[11px] w-10 text-right" style={{ color: f.direction === "positive" ? "#64B5F6" : "#EF5350" }}>
                  {f.value > 0 ? "+" : ""}{f.value}
                </span>
              </div>
            ))}
          </div>
          <button onClick={() => setShowAllFeatures(!showAllFeatures)} className="text-xs mt-3" style={{ color: "var(--color-azure)" }}>
            {showAllFeatures ? "Show top 5" : "Show all 13 features"}
          </button>
        </GscipCard>

        {/* Prediction vs Actual */}
        <GscipCard title="Prediction vs Actual">
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6F" />
              <XAxis dataKey="predicted" name="Predicted" stroke="#4A5880" fontSize={10} fontFamily="IBM Plex Mono" />
              <YAxis dataKey="actual" name="Actual" stroke="#4A5880" fontSize={10} fontFamily="IBM Plex Mono" />
              <Tooltip contentStyle={chartTooltipStyle} />
              <ReferenceLine stroke="#4A5880" strokeDasharray="5 5" segment={[{ x: 0, y: 0 }, { x: 8, y: 8 }]} />
              <Scatter data={scatterData} fill="#1E88E5" fillOpacity={0.6} r={3} />
            </ScatterChart>
          </ResponsiveContainer>
          <p className="text-xs mt-2" style={{ color: "var(--color-text-secondary)" }}>
            R²: <span className="font-mono" style={{ color: "var(--color-text-primary)" }}>0.81</span> &nbsp; Bias: <span className="font-mono" style={{ color: "var(--color-text-primary)" }}>+0.12</span>
          </p>
        </GscipCard>
      </div>
    </div>
  );
}
