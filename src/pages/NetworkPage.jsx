import { useState, useEffect, useRef } from "react";
import GscipCard from "../components/GscipCard";
import RiskBadge from "../components/RiskBadge";
import { networkNodes, networkEdges } from "../services/mockData";

export default function NetworkPage() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [kHops, setKHops] = useState(2);
  const [colorBy, setColorBy] = useState("Risk");
  const [sizeBy, setSizeBy] = useState("Degree");
  const svgRef = useRef(null);

  const tierColor = (tier) => tier === "HIGH" ? "#C62828" : tier === "MED" ? "#F57C00" : tier === "LOW" ? "#2E7D32" : "#546E7A";

  // Arrange nodes in a force-like layout (static positions for demo)
  const positions = {};
  networkNodes.forEach((n, i) => {
    const angle = (i / networkNodes.length) * Math.PI * 2;
    const r = 120 + Math.sin(i * 1.5) * 40;
    positions[n.id] = { x: 250 + Math.cos(angle) * r, y: 220 + Math.sin(angle) * r };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Network Graph</h1>
        <div className="flex items-center gap-3">
          {[
            { label: "K-Hops", value: kHops, options: [1, 2, 3], setter: setKHops },
            { label: "Color By", value: colorBy, options: ["Risk", "Community", "Centrality"], setter: setColorBy },
            { label: "Size By", value: sizeBy, options: ["Degree", "Betweenness", "Crime Count"], setter: setSizeBy },
          ].map(({ label, value, options, setter }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase" style={{ color: "var(--color-text-muted)" }}>{label}</span>
              <select
                className="h-8 px-2 rounded text-xs"
                style={{ background: "var(--color-bg-sidebar)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}
                value={value}
                onChange={(e) => setter(isNaN(e.target.value) ? e.target.value : Number(e.target.value))}
              >
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4" style={{ height: "calc(100vh - 200px)" }}>
        {/* Graph */}
        <div className="flex-1 rounded-lg overflow-hidden relative" style={{ background: "var(--color-bg-app)", border: "1px solid var(--color-border)" }}>
          <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 500 440">
            {/* Edges */}
            {networkEdges.map((e, i) => {
              const s = positions[e.source];
              const t = positions[e.target];
              if (!s || !t) return null;
              return (
                <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  stroke={e.sameCommunity ? "rgba(21,101,192,0.6)" : "rgba(74,88,128,0.4)"}
                  strokeWidth={Math.log(e.weight + 1) * 1.5}
                />
              );
            })}
            {/* Nodes */}
            {networkNodes.map((n) => {
              const pos = positions[n.id];
              const r = 6 + n.degree * 18;
              const isSelected = selectedNode?.id === n.id;
              return (
                <g key={n.id} onClick={() => setSelectedNode(n)} className="cursor-pointer">
                  {isSelected && <circle cx={pos.x} cy={pos.y} r={r + 6} fill="none" stroke={tierColor(n.tier)} strokeWidth={2} opacity={0.5} />}
                  <circle cx={pos.x} cy={pos.y} r={r} fill={tierColor(n.tier)} fillOpacity={0.8} stroke={isSelected ? "#F0F4FF" : "none"} strokeWidth={2} />
                  <text x={pos.x} y={pos.y + r + 12} textAnchor="middle" fill="#8899BB" fontSize="9" fontFamily="IBM Plex Mono">{n.id}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Detail */}
        {selectedNode && (
          <div className="w-80 rounded-lg overflow-y-auto" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>{selectedNode.label}</h2>
                <button onClick={() => setSelectedNode(null)} className="text-xs" style={{ color: "var(--color-text-muted)" }}>✕</button>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <span className="font-mono text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>{selectedNode.risk}</span>
                <RiskBadge tier={selectedNode.tier} />
              </div>
              <div className="space-y-2 mb-6">
                {[
                  ["Community", `Cluster ${selectedNode.community}`],
                  ["Degree Centrality", selectedNode.degree],
                  ["1-Hop Density", "12 crimes"],
                  ["2-Hop Density", "34 crimes"],
                  ["Clustering Coeff", "0.71"],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between text-xs">
                    <span style={{ color: "var(--color-text-secondary)" }}>{l}</span>
                    <span className="font-mono" style={{ color: "var(--color-text-primary)" }}>{v}</span>
                  </div>
                ))}
              </div>

              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-secondary)" }}>Neighbours (1-hop)</h3>
              <div className="space-y-2">
                {networkNodes.filter((n) =>
                  networkEdges.some((e) =>
                    (e.source === selectedNode.id && e.target === n.id) ||
                    (e.target === selectedNode.id && e.source === n.id)
                  )
                ).map((n) => (
                  <div key={n.id} className="flex items-center justify-between text-xs cursor-pointer hover:bg-gscip-surface p-1 rounded" onClick={() => setSelectedNode(n)}>
                    <span style={{ color: "var(--color-text-primary)" }}>{n.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono" style={{ color: "var(--color-text-secondary)" }}>{n.risk}</span>
                      <RiskBadge tier={n.tier} size="small" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
