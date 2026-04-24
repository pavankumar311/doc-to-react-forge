import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, ComposedChart,
  ResponsiveContainer, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ReferenceLine, Cell,
} from "recharts";
import { Download } from "lucide-react";
import GscipCard from "../components/GscipCard";
import { TrendsSkeleton } from "../components/Skeletons";
import { useFilters } from "../contexts/FilterContext";
import { fetchTrendCompare, fetchRollingTrend, fetchCrimeTypes } from "../services/api";

export default function TrendsPage() {
  const [granularity, setGranularity] = useState("Daily");
  const [trendData, setTrendData] = useState([]);
  const [trendDistricts, setTrendDistricts] = useState([]);
  const [hoveredLine, setHoveredLine] = useState(null);
  const [rollingTrend, setRollingTrend] = useState({ avg_7d: 0, avg_30d: 0, trend_slope: 0, series: [] });
  const [crimeTypes, setCrimeTypes] = useState([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const { filters, districtIdByName, crimeTypeIdByName } = useFilters();

  const windowType = granularity === "Daily" ? "day" : granularity === "Weekly" ? "week" : "month";
  const lineColors = ["#1E88E5", "#F57C00", "#2E7D32", "#8E24AA", "#00897B", "#C62828"];

  const handleMouseMove = (e) => {
    if (e && e.activePayload && e.chartY) {
      let closestLine = null;
      let minDistance = Infinity;
      e.activePayload.forEach((item) => {
        const dist = Math.abs(item.cy - e.chartY);
        if (dist < minDistance) {
          minDistance = dist;
          closestLine = item.dataKey;
        }
      });
      if (minDistance < 100) setHoveredLine(closestLine);
      else setHoveredLine(null);
    }
  };

  useEffect(() => {
    const loadTrend = async () => {
      setTrendLoading(true);
      try {
        const [trendCompare, rolling, types] = await Promise.all([
          fetchTrendCompare({ filters, windowType, districtIdByName, crimeTypeIdByName }),
          fetchRollingTrend({ filters, districtIdByName, crimeTypeIdByName }),
          fetchCrimeTypes({ filters, districtIdByName, crimeTypeIdByName }),
        ]);
        setTrendData(trendCompare.series);
        setTrendDistricts(trendCompare.districts);
        setRollingTrend(rolling);
        setCrimeTypes(types);
      } catch (err) {
        console.error("TrendsPage load error:", err);
      } finally {
        setTrendLoading(false);
      }
    };
    loadTrend();
  }, [granularity, filters, districtIdByName, crimeTypeIdByName, windowType]);

  const chartTooltipStyle = {
    background: "#1A2744", border: "1px solid #2A3F6F",
    borderRadius: 6, fontSize: 12, color: "#F0F4FF",
  };

  if (trendLoading) return <TrendsSkeleton />;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Trend Analysis</h1>
        <div className="flex items-center gap-2">
          {["Daily", "Weekly", "Monthly"].map((g) => (
            <button
              key={g} onClick={() => setGranularity(g)}
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

      <GscipCard title="District Crime Trend" className="mb-4">
        <ResponsiveContainer width="100%" height={450}>
          <LineChart
            data={trendData}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredLine(null)}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6F" />
            <XAxis dataKey="label" stroke="#4A5880" fontSize={11} fontFamily="IBM Plex Mono" />
            <YAxis stroke="#4A5880" fontSize={11} fontFamily="IBM Plex Mono" />
            <Tooltip
              contentStyle={chartTooltipStyle}
              shared={true}
              formatter={(value, name, entry) => {
                if (hoveredLine && entry.dataKey !== hoveredLine) return [null, null];
                return [value, name];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, fontFamily: "IBM Plex Sans" }}
              onMouseEnter={(e) => setHoveredLine(e.dataKey)}
              onMouseLeave={() => setHoveredLine(null)}
            />
            {trendDistricts.map((district, index) => (
              <Line
                key={district.key}
                type="monotone"
                dataKey={district.key}
                name={district.name}
                stroke={lineColors[index % lineColors.length]}
                strokeWidth={hoveredLine === district.key ? 3 : 2}
                strokeOpacity={hoveredLine === null || hoveredLine === district.key ? 1 : 0.25}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 0 }}
                onMouseEnter={() => setHoveredLine(district.key)}
                onMouseLeave={() => setHoveredLine(null)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </GscipCard>

      <div className="grid grid-cols-1 gap-4 mb-4">
        <GscipCard title="Rolling 7-Day vs 30-Day Average">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={rollingTrend.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6F" />
              <XAxis dataKey="label" stroke="#4A5880" fontSize={10} fontFamily="IBM Plex Mono" />
              <YAxis stroke="#4A5880" fontSize={10} fontFamily="IBM Plex Mono" />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="crime_count" fill="#1565C0" fillOpacity={0.6} radius={[2, 2, 0, 0]} />
              {rollingTrend.avg_30d > 0 && (
                <ReferenceLine y={rollingTrend.avg_30d} stroke="#F57C00" strokeDasharray="5 5" label={{ value: "30d avg", fill: "#F57C00", fontSize: 10 }} />
              )}
              {rollingTrend.avg_7d > 0 && (
                <ReferenceLine y={rollingTrend.avg_7d} stroke="#1E88E5" strokeDasharray="5 5" label={{ value: "7d avg", fill: "#1E88E5", fontSize: 10 }} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-between mt-3 px-1">
            <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              Analysis of daily fluctuations versus moving averages.
            </p>
            <p className="text-xs font-mono font-bold" style={{ color: rollingTrend.trend_slope >= 0 ? "#2E7D32" : "#C62828" }}>
              Trend Impact: {rollingTrend.trend_slope >= 0 ? "↑" : "↓"} {Math.abs(rollingTrend.trend_slope).toFixed(1)} incidents/day
            </p>
          </div>
        </GscipCard>
      </div>

      <GscipCard title="Crime Type Breakdown">
        <div className="flex items-end gap-1 justify-between">
          {(() => {
            const yAxisWidth = crimeTypes.length > 0
              ? Math.min(240, Math.max(120, Math.max(...crimeTypes.map((d) => (d.type || "").length)) * 7))
              : 140;
            const chartHeight = Math.max(280, crimeTypes.length * 36 + 40);
            return (
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={crimeTypes} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A3F6F" horizontal={false} />
                  <XAxis type="number" stroke="#4A5880" fontSize={10} fontFamily="IBM Plex Mono" />
                  <YAxis
                    type="category" dataKey="type" stroke="#4A5880" fontSize={11} fontFamily="IBM Plex Sans"
                    width={yAxisWidth} tick={{ fill: "#8899BB", fontSize: 11, fontFamily: "IBM Plex Sans" }}
                  />
                  <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {crimeTypes.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            );
          })()}
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
