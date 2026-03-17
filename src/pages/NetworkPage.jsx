import { useState, useEffect, useMemo } from "react";
import { RefreshCw } from "lucide-react";
import GscipCard from "../components/GscipCard";
import RiskBadge from "../components/RiskBadge";
import { fetchNetworkGraph } from "../services/api";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from "react-leaflet";

function MapBounds({ bounds, focusNode }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (focusNode) {
      map.setView([focusNode.lat, focusNode.lng], 14, { animate: true });
    } else if (bounds && bounds.length) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [map, bounds, focusNode]);

  return null;
}

export default function NetworkPage() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [kHops, setKHops] = useState(2);
  const [colorBy, setColorBy] = useState("Risk");
  const [sizeBy, setSizeBy] = useState("Degree");
  const [networkNodes, setNetworkNodes] = useState([]);
  const [networkEdges, setNetworkEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const nodesById = useMemo(
    () => Object.fromEntries(networkNodes.map((n) => [n.id, n])),
    [networkNodes],
  );
  const bounds = useMemo(
    () => (networkNodes.length ? networkNodes.map((n) => [n.lat, n.lng]) : null),
    [networkNodes],
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { nodes, edges } = await fetchNetworkGraph({ kHops, colorBy, sizeBy });
        setNetworkNodes(nodes);
        setNetworkEdges(edges);
      } catch (err) {
        console.error("NetworkPage load error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [kHops, colorBy, sizeBy]);

  const tierColor = (tier) => tier === "HIGH" ? "#C62828" : tier === "MED" ? "#F57C00" : tier === "LOW" ? "#2E7D32" : "#546E7A";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin" style={{ color: "var(--color-azure)" }} />
      </div>
    );
  }

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
        <div className="flex-1 rounded-lg overflow-hidden relative" style={{ background: "var(--color-bg-app)", border: "1px solid var(--color-border)" }}>
          <MapContainer
            className="h-full w-full"
            bounds={bounds || undefined}
            center={[41.78, -87.66]}
            zoom={12}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapBounds bounds={bounds} focusNode={selectedNode} />
            {networkEdges.map((edge, idx) => {
              const source = nodesById[edge.source];
              const target = nodesById[edge.target];
              if (!source || !target) return null;
              return (
                <Polyline
                  key={`edge-${idx}`}
                  positions={[[source.lat, source.lng], [target.lat, target.lng]]}
                  pathOptions={{
                    color: edge.sameCommunity ? "rgba(21,101,192,0.7)" : "rgba(74,88,128,0.6)",
                    weight: Math.log(edge.weight + 1) * 2,
                    opacity: 0.8,
                  }}
                />
              );
            })}
            {networkNodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              return (
                <CircleMarker
                  key={node.id}
                  center={[node.lat, node.lng]}
                  radius={6 + node.degree * 8}
                  pathOptions={{
                    color: isSelected ? "#F0F4FF" : tierColor(node.tier),
                    fillColor: tierColor(node.tier),
                    fillOpacity: 0.9,
                    weight: isSelected ? 3 : 1,
                  }}
                  eventHandlers={{
                    click: () => setSelectedNode(node),
                  }}
                >
                  <Popup>
                    <div className="text-xs">
                      <div className="font-semibold" style={{ color: "var(--color-text-primary)" }}>{node.label}</div>
                      <div>Risk: {node.risk}</div>
                      <div>Community {node.community}</div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

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
