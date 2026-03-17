import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MapPin, MessageSquare, Download } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import GscipCard from "../components/GscipCard";
import RiskBadge from "../components/RiskBadge";
import { BlockDetailSkeleton } from "../components/Skeletons";
import { fetchBlockDetail, fetchBlockTimeline, fetchSHAPFeatures } from "../services/api";

export default function BlockDetailPage() {
  const { blockId } = useParams();
  const [block, setBlock] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [shapFeatures, setShapFeatures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [b, tl, shap] = await Promise.all([
          fetchBlockDetail(blockId),
          fetchBlockTimeline(blockId, 30),
          fetchSHAPFeatures("v2.1"),
        ]);
        setBlock(b);
        setTimeline(tl);
        setShapFeatures(shap);
      } catch (err) {
        console.error("BlockDetail load error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [blockId]);

  const chartTooltipStyle = { background: "#1A2744", border: "1px solid #2A3F6F", borderRadius: 6, fontSize: 12, color: "#F0F4FF" };

  if (loading || !block) {
    return <BlockDetailSkeleton />;
  }

  const b = block;

  return (
    <div>
      <Link to="/heatmap" className="flex items-center gap-2 text-sm mb-4" style={{ color: "var(--color-azure)" }}>
        <ArrowLeft size={16} /> Back
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Block Detail: {b.address}</h1>
          <div className="flex items-center gap-3 mt-2">
            <RiskBadge tier={b.tier} />
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Last prediction: {b.lastUpdated}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="h-9 px-4 rounded text-xs font-medium flex items-center gap-2" style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}>
            <MapPin size={14} /> View on Map
          </button>
          <Link to="/chat" className="h-9 px-4 rounded text-xs font-medium flex items-center gap-2" style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}>
            <MessageSquare size={14} /> Ask Chat
          </Link>
          <button className="h-9 px-4 rounded text-xs font-medium flex items-center gap-2" style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <GscipCard>
          <div className="flex items-center gap-6">
            <div aria-label={`Risk score ${b.riskScore}, tier ${b.tier}`}>
              <p className="font-mono text-5xl font-bold" style={{ color: "var(--color-text-primary)" }}>{b.riskScore}</p>
              <div className="h-3 w-40 rounded-full mt-2 overflow-hidden" style={{ background: "var(--color-bg-app)" }}>
                <div className="h-full rounded-full" style={{ width: `${b.riskScore * 100}%`, background: "#C62828" }} />
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex gap-8">
                <span style={{ color: "var(--color-text-secondary)" }}>Predicted</span>
                <span className="font-mono" style={{ color: "var(--color-text-primary)" }}>{b.predictedCrimes} crimes/day</span>
              </div>
              <div className="flex gap-8">
                <span style={{ color: "var(--color-text-secondary)" }}>CI</span>
                <span className="font-mono" style={{ color: "var(--color-text-primary)" }}>[{b.ciLow} — {b.ciHigh}]</span>
              </div>
              {b.spikeActive && (
                <div className="flex items-center gap-2 px-2 py-1 rounded" style={{ background: "rgba(245,124,0,0.15)" }}>
                  <span style={{ color: "#F57C00" }}>⚠ Spike Alert: {b.spikeRatio}x above 30d avg</span>
                </div>
              )}
            </div>
          </div>
        </GscipCard>

        <GscipCard title="30-Day Trend">
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C62828" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#C62828" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#4A5880" fontSize={9} fontFamily="IBM Plex Mono" interval={6} />
              <YAxis stroke="#4A5880" fontSize={9} fontFamily="IBM Plex Mono" />
              <Tooltip contentStyle={chartTooltipStyle} />
              <ReferenceLine y={b.rolling7d / 7} stroke="#1E88E5" strokeDasharray="5 5" label={{ value: "7d", fill: "#1E88E5", fontSize: 9 }} />
              <Area type="monotone" dataKey="crimes" stroke="#C62828" fill="url(#riskGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-6 text-xs mt-2">
            <span style={{ color: "var(--color-text-secondary)" }}>Rolling 7d: <span className="font-mono" style={{ color: "var(--color-text-primary)" }}>{b.rolling7d}</span></span>
            <span style={{ color: "var(--color-text-secondary)" }}>Rolling 30d: <span className="font-mono" style={{ color: "var(--color-text-primary)" }}>{b.rolling30d}</span></span>
            <span style={{ color: "var(--color-text-secondary)" }}>Slope: <span className="font-mono" style={{ color: "#C62828" }}>+{b.slope7d}/day</span></span>
          </div>
        </GscipCard>
      </div>

      <GscipCard title="Feature Breakdown (All 13 Features)" className="mb-6">
        <div className="grid grid-cols-3 gap-6">
          {[
            { label: "Network", items: Object.entries(b.features.network).map(([k, v]) => [k.replace(/([A-Z])/g, " $1"), v]) },
            { label: "Spatial", items: Object.entries(b.features.spatial).map(([k, v]) => [k.replace(/([A-Z])/g, " $1"), v]) },
            { label: "Temporal", items: Object.entries(b.features.temporal).map(([k, v]) => [k.replace(/([A-Z])/g, " $1"), typeof v === "boolean" ? (v ? "⚠ YES" : "No") : v]) },
          ].map((group) => (
            <div key={group.label}>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-secondary)" }}>{group.label}</h4>
              <div className="space-y-2">
                {group.items.map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="capitalize" style={{ color: "var(--color-text-secondary)" }}>{k}</span>
                    <span className="font-mono" style={{ color: String(v).includes("⚠") ? "#F57C00" : "var(--color-text-primary)" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </GscipCard>

      <GscipCard title="SHAP Explanation — Why is this block high risk?">
        <div className="space-y-3">
          {shapFeatures.map((f, i) => (
            <div key={f.feature} className="flex items-center gap-3">
              <span className="text-xs w-32" style={{ color: "var(--color-text-secondary)" }}>{f.feature}</span>
              <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "var(--color-bg-app)" }}>
                <div className="h-full rounded-full" style={{
                  width: `${(Math.abs(f.value) / 1.24) * 100}%`,
                  background: f.direction === "positive" ? "#1565C0" : "#C62828",
                }} />
              </div>
              <span className="font-mono text-xs w-12 text-right" style={{ color: f.direction === "positive" ? "#64B5F6" : "#EF5350" }}>
                {f.value > 0 ? "+" : ""}{f.value}
              </span>
              {i === 0 && <span className="text-[10px] italic" style={{ color: "var(--color-text-muted)" }}>(most influential)</span>}
            </div>
          ))}
        </div>
      </GscipCard>
    </div>
  );
}
