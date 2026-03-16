import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, RefreshCw, ArrowRight } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { Link } from "react-router-dom";
import GscipCard from "../components/GscipCard";
import RiskBadge from "../components/RiskBadge";
import { kpiData, topRiskBlocks, weeklyTrend, alerts } from "../services/mockData";

function KpiCard({ label, value, trend, icon }) {
  return (
    <GscipCard compact interactive>
      <div role="region" aria-label={`${label}: ${value}`}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-secondary)" }}>{label}</p>
        <div className="flex items-end justify-between">
          <span className="font-mono text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>{value}</span>
          <span className="flex items-center gap-1 text-xs font-medium" style={{ color: trend?.color || "var(--color-text-muted)" }}>
            {icon}
            {trend?.label}
          </span>
        </div>
      </div>
    </GscipCard>
  );
}

export default function Dashboard() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Dashboard Overview</h1>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Last updated: 2h ago</p>
        </div>
        <button className="flex items-center gap-2 h-9 px-4 rounded text-xs font-medium transition-colors" style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Crimes (30d)"
          value={kpiData.totalCrimes.value.toLocaleString()}
          trend={{ label: `▲ ${kpiData.totalCrimes.delta}% vs 30d`, color: "#C62828" }}
          icon={<TrendingUp size={14} />}
        />
        <KpiCard
          label="High Risk Blocks"
          value={kpiData.highRiskBlocks.value}
          trend={{ label: `▲ ${kpiData.highRiskBlocks.label}`, color: "#F57C00" }}
          icon={<TrendingUp size={14} />}
        />
        <KpiCard
          label="Active Spike Alerts"
          value={kpiData.spikeAlerts.value}
          trend={{ label: `${kpiData.spikeAlerts.critical} critical`, color: "#C62828" }}
          icon={<AlertTriangle size={14} />}
        />
        <KpiCard
          label="Model RMSE"
          value={kpiData.modelRMSE.value}
          trend={{ label: "✓ Target met", color: "#2E7D32" }}
          icon={<CheckCircle size={14} />}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Mini Heatmap placeholder */}
        <Link to="/heatmap">
          <GscipCard title="Risk Heatmap" subtitle="Click to explore full map" interactive>
            <div className="relative rounded overflow-hidden" style={{ height: 240, background: "linear-gradient(135deg, #0D1117 0%, #1A2744 50%, #0F1F3D 100%)" }}>
              {/* Simulated heatmap */}
              {topRiskBlocks.map((b, i) => (
                <div
                  key={b.id}
                  className="absolute rounded-full"
                  style={{
                    width: 40 + b.riskScore * 40,
                    height: 40 + b.riskScore * 40,
                    background: b.tier === "HIGH" ? "rgba(198,40,40,0.4)" : "rgba(245,124,0,0.3)",
                    left: `${15 + i * 18}%`,
                    top: `${20 + (i % 3) * 25}%`,
                    filter: "blur(8px)",
                  }}
                />
              ))}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-medium px-3 py-1.5 rounded" style={{ background: "rgba(21,101,192,0.8)", color: "#fff" }}>
                  View Full Heatmap <ArrowRight size={12} className="inline ml-1" />
                </span>
              </div>
            </div>
          </GscipCard>
        </Link>

        {/* Top 5 Risk Blocks */}
        <GscipCard title="Top 5 High-Risk Blocks">
          <div className="space-y-3">
            {topRiskBlocks.map((block, i) => (
              <Link to={`/blocks/${block.id}`} key={block.id} className="flex items-center gap-3 group">
                <span className="text-xs font-mono w-4" style={{ color: "var(--color-text-muted)" }}>{i + 1}.</span>
                <span className="text-sm flex-1 font-medium group-hover:text-gscip-azure transition-colors" style={{ color: "var(--color-text-primary)" }}>
                  {block.address}
                </span>
                <div className="flex items-center gap-2">
                  <div className="h-2 rounded-full" style={{
                    width: block.riskScore * 80,
                    background: block.tier === "HIGH" ? "#C62828" : "#F57C00",
                  }} />
                  <span className="font-mono text-xs w-8 text-right" style={{ color: "var(--color-text-primary)" }}>{block.riskScore}</span>
                  <RiskBadge tier={block.tier} size="small" />
                </div>
              </Link>
            ))}
          </div>
        </GscipCard>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 7-Day Trend */}
        <GscipCard title="7-Day Crime Trend">
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={weeklyTrend}>
              <Tooltip
                contentStyle={{ background: "#1A2744", border: "1px solid #2A3F6F", borderRadius: 6, fontSize: 12, color: "#F0F4FF" }}
                labelStyle={{ color: "#8899BB" }}
              />
              <Line type="monotone" dataKey="count" stroke="#1E88E5" strokeWidth={2} dot={{ fill: "#1E88E5", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <Link to="/trends" className="flex items-center gap-1 text-xs mt-3 font-medium" style={{ color: "var(--color-azure)" }}>
            View Full Trends <ArrowRight size={12} />
          </Link>
        </GscipCard>

        {/* Recent Alerts */}
        <GscipCard title="Recent Alerts">
          <div className="space-y-3">
            {alerts.slice(0, 4).map((a) => (
              <div key={a.id} className="flex items-start gap-2">
                {a.type === "warning" && <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: "#F57C00" }} />}
                {a.type === "success" && <CheckCircle size={14} className="mt-0.5 shrink-0" style={{ color: "#2E7D32" }} />}
                {a.type === "error" && <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: "#C62828" }} />}
                {a.type === "info" && <CheckCircle size={14} className="mt-0.5 shrink-0" style={{ color: "#1E88E5" }} />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs" style={{ color: "var(--color-text-primary)" }}>{a.message}</p>
                  <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </GscipCard>
      </div>
    </div>
  );
}
