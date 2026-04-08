import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Filter, MapPin } from "lucide-react";
import GscipCard from "./GscipCard";

const MOCK_CRIME_TYPES = [
  { name: "Aggravated Battery", count: 7031 },
  { name: "Aggravated Assault", count: 6406 },
  { name: "Robbery", count: 5383 },
  { name: "Criminal Sexual Assault", count: 1761 },
  { name: "Homicide", count: 398 },
];

const MOCK_DISTRICTS = [
  { name: "006", count: 1540 },
  { name: "011", count: 1537 },
  { name: "003", count: 1531 },
  { name: "004", count: 1524 },
  { name: "007", count: 1285 },
  { name: "008", count: 1241 },
  { name: "009", count: 1164 },
  { name: "012", count: 1122 },
  { name: "015", count: 1051 },
  { name: "010", count: 1031 },
];

const TIME_FRAMES = ["Last 30 days", "Last 90 days", "Last 365 days"];

const BAR_COLOR = "#7A8A9E";

const tooltipStyle = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  fontSize: 12,
  color: "var(--color-text-primary)",
};

function FiltersPanel({ selectedTimeFrame, onTimeFrameChange, crimeTypes, selectedCrimes, onToggleCrime, onApply, onReset }) {
  return (
    <GscipCard>
      <div className="flex items-center gap-2 mb-4">
        <Filter size={18} style={{ color: "var(--color-text-secondary)" }} />
        <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Filters</h3>
      </div>

      <div className="mb-4">
        <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "var(--color-text-primary)" }}>
          Time Frame
        </label>
        <select
          value={selectedTimeFrame}
          onChange={(e) => onTimeFrameChange(e.target.value)}
          className="w-full px-3 py-2 rounded-md text-sm"
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-primary)",
          }}
        >
          {TIME_FRAMES.map((tf) => (
            <option key={tf} value={tf}>{tf}</option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-primary)" }}>
            Crime Type
          </label>
          <button onClick={onReset} className="text-xs font-medium" style={{ color: "var(--color-azure)" }}>
            Reset
          </button>
        </div>
        <div className="space-y-2">
          {crimeTypes.map((ct) => (
            <label key={ct.name} className="flex items-center justify-between cursor-pointer group">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedCrimes.includes(ct.name)}
                  onChange={() => onToggleCrime(ct.name)}
                  className="rounded"
                  style={{ accentColor: "var(--color-cobalt)" }}
                />
                <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>{ct.name}</span>
              </div>
              <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
                {ct.count.toLocaleString()}
              </span>
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={onApply}
        className="w-full py-2 rounded-md text-sm font-medium text-white transition-colors"
        style={{ background: "var(--color-cobalt)" }}
      >
        Apply
      </button>
    </GscipCard>
  );
}

function CrimeTypeChart({ data }) {
  return (
    <GscipCard>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">⚙</span>
        <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Incidents by Crime Type</h3>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 50, top: 5, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => v.length > 15 ? v.slice(0, 14) + "…" : v}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={28} label={{ position: "right", fontSize: 11, fill: "var(--color-text-primary)", formatter: (v) => v.toLocaleString() }}>
            {data.map((_, i) => (
              <Cell key={i} fill={BAR_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-center text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Reported Incidents</p>
    </GscipCard>
  );
}

function DistrictChart({ data }) {
  return (
    <GscipCard>
      <div className="flex items-center gap-2 mb-4">
        <MapPin size={18} style={{ color: "var(--color-text-secondary)" }} />
        <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Incidents by District</h3>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 50, top: 5, bottom: 5 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={40}
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={22} label={{ position: "right", fontSize: 11, fill: "var(--color-text-primary)", formatter: (v) => v.toLocaleString() }}>
            {data.map((_, i) => (
              <Cell key={i} fill={BAR_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-center text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Reported Incidents</p>
    </GscipCard>
  );
}

function MapPanel({ totalIncidents }) {
  return (
    <GscipCard>
      <div className="flex items-center gap-2 mb-4">
        <MapPin size={18} style={{ color: "var(--color-text-secondary)" }} />
        <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Map of Incidents</h3>
      </div>
      <div className="relative rounded-lg overflow-hidden" style={{ height: 260, background: "var(--color-bg-surface)" }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="font-mono text-3xl font-bold" style={{ color: "var(--color-cobalt)" }}>
              {totalIncidents.toLocaleString()}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>Reported Incidents</p>
          </div>
        </div>
      </div>
      <p className="text-right text-[11px] mt-2 italic" style={{ color: "var(--color-text-muted)" }}>
        Hold Ctrl to select many
      </p>
    </GscipCard>
  );
}

export default function SummarySection() {
  const [timeFrame, setTimeFrame] = useState("Last 365 days");
  const [selectedCrimes, setSelectedCrimes] = useState([]);

  const toggleCrime = (name) => {
    setSelectedCrimes((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };

  const resetCrimes = () => setSelectedCrimes([]);
  const applyCrimes = () => {};

  const totalIncidents = MOCK_CRIME_TYPES.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="grid grid-cols-12 gap-4 mb-6">
      <div className="col-span-3">
        <FiltersPanel
          selectedTimeFrame={timeFrame}
          onTimeFrameChange={setTimeFrame}
          crimeTypes={MOCK_CRIME_TYPES}
          selectedCrimes={selectedCrimes}
          onToggleCrime={toggleCrime}
          onApply={applyCrimes}
          onReset={resetCrimes}
        />
      </div>
      <div className="col-span-3">
        <CrimeTypeChart data={MOCK_CRIME_TYPES} />
      </div>
      <div className="col-span-3">
        <DistrictChart data={MOCK_DISTRICTS} />
      </div>
      <div className="col-span-3">
        <MapPanel totalIncidents={totalIncidents} />
      </div>
    </div>
  );
}
