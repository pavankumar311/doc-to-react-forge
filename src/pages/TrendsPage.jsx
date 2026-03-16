import { useState } from "react";
import { LineChart, Line, BarChart, Bar, ComposedChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine } from "recharts";
import { Download } from "lucide-react";
import GscipCard from "../components/GscipCard";
import { trendData, crimeTypes, spikeEvents } from "../services/mockData";

export default function TrendsPage() {
  const [granularity, setGranularity] = useState("Daily");

  const chartTooltipStyle = { background: "#1A2744", border: "1px solid #2A3F6F", borderRadius: 6, fontSize: 12, color: "#F0F4FF" };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Trend Analysis</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {["Daily", "Weekly", "Monthly"].map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className="h-8 px-3 rounded text-xs font-medium transition-colors"
                style={{
                  background: granularity === g ? "var(--color-cobalt)" : "transparent",
                  color: granularity === g ? "#fff" : "var(--color-text-secondary)",
                  border: `1px solid ${granularity === g ? "var(--color-cobalt)" : "var(--color-border)"}`,
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* District Trend Chart */}
      <GscipCard title="District Crime Trend" className="mb-4">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6F" />
            <XAxis dataKey="date" stroke="#4A5880" fontSize={11} fontFamily="IBM Plex Mono" />
            <YAxis stroke="#4A5880" fontSize={11} fontFamily="IBM Plex Mono" />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: "IBM Plex Sans" }} />
            <Line type="monotone" dataKey="dist7" name="District 7" stroke="#1E88E5" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="dist8" name="District 8" stroke="#F57C00" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="dist11" name="District 11" stroke="#2E7D32" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </GscipCard>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Rolling 7d/30d */}
        <GscipCard title="Rolling 7D vs 30D">
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={trendData.slice(0, 14)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6F" />
              <XAxis dataKey="date" stroke="#4A5880" fontSize={10} fontFamily="IBM Plex Mono" />
              <YAxis stroke="#4A5880" fontSize={10} fontFamily="IBM Plex Mono" />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="crimes" fill="#1565C0" fillOpacity={0.6} radius={[2, 2, 0, 0]} />
              <ReferenceLine y={82} stroke="#F57C00" strokeDasharray="5 5" label={{ value: "30d avg", fill: "#F57C00", fontSize: 10 }} />
              <ReferenceLine y={94} stroke="#1E88E5" strokeDasharray="5 5" label={{ value: "7d avg", fill: "#1E88E5", fontSize: 10 }} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="text-xs mt-2" style={{ color: "var(--color-text-secondary)" }}>
            Trend slope: <span style={{ color: "#C62828" }}>▲ +2.1/day</span>
          </p>
        </GscipCard>

        {/* Spike Detection Timeline */}
        <GscipCard title="Spike Detection Timeline">
          <div className="relative" style={{ height: 200 }}>
            <div className="absolute left-8 right-8 top-1/2 h-0.5" style={{ background: "var(--color-border)" }} />
            {spikeEvents.map((s, i) => (
              <div
                key={s.blockId}
                className="absolute flex flex-col items-center group"
                style={{ left: `${15 + i * 35}%`, top: "30%" }}
              >
                <div className="w-4 h-4 rounded-full border-2 cursor-pointer" style={{ background: "#C62828", borderColor: "#F0F4FF" }} />
                <div className="mt-2 text-center">
                  <p className="text-[10px] font-mono" style={{ color: "var(--color-text-primary)" }}>{s.date}</p>
                  <p className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>{s.blockLabel}</p>
                  <p className="text-[10px] font-mono" style={{ color: "#C62828" }}>{s.ratio}x avg</p>
                </div>
              </div>
            ))}
          </div>
        </GscipCard>
      </div>

      {/* Crime Type Breakdown */}
      <GscipCard title="Crime Type Breakdown (Last 30 Days)">
        <div className="flex items-end gap-1 justify-between">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={crimeTypes} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6F" horizontal={false} />
              <XAxis type="number" stroke="#4A5880" fontSize={10} fontFamily="IBM Plex Mono" />
              <YAxis type="category" dataKey="type" stroke="#4A5880" fontSize={11} fontFamily="IBM Plex Sans" width={70} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {crimeTypes.map((c, i) => (
                  <rect key={i} fill={c.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button className="h-8 px-3 rounded text-xs font-medium flex items-center gap-2" style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}>
            <Download size={14} /> Download CSV
          </button>
        </div>
      </GscipCard>
    </div>
  );
}
