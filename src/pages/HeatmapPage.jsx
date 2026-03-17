import { useState, useEffect } from "react";
import { Layers, Download, RefreshCw } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import RiskBadge from "../components/RiskBadge";
import { fetchHeatmapData, fetchSHAPFeatures } from "../services/api";

const blocks = [
  { id: "047W", lat: 41.884, lng: -87.624, risk: 0.87, tier: "HIGH", address: "047W Madison St" },
  { id: "063E", lat: 41.773, lng: -87.566, risk: 0.74, tier: "HIGH", address: "063E 79th St" },
  { id: "025N", lat: 41.814, lng: -87.659, risk: 0.71, tier: "HIGH", address: "025N Kedzie Ave" },
  { id: "011W", lat: 41.796, lng: -87.613, risk: 0.68, tier: "MED", address: "011W 51st St" },
  { id: "033S", lat: 41.880, lng: -87.664, risk: 0.65, tier: "MED", address: "033S Ashland Ave" },
  { id: "B006", lat: 41.885, lng: -87.640, risk: 0.42, tier: "MED", address: "055W Lake St" },
  { id: "B007", lat: 41.789, lng: -87.601, risk: 0.31, tier: "LOW", address: "070E Garfield Blvd" },
  { id: "B008", lat: 41.794, lng: -87.707, risk: 0.28, tier: "LOW", address: "020W Pershing Rd" },
];

const legend = [
  { tier: "HIGH", label: "High (≥ 0.7)" },
  { tier: "MED", label: "Med (0.3 – 0.69)" },
  { tier: "LOW", label: "Low (< 0.3)" },
];

const mapCenter = [41.84, -87.63];

export default function Heatmap() {
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [shapFeatures, setShapFeatures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [, shap] = await Promise.all([
          fetchHeatmapData(),
          fetchSHAPFeatures("v2.1"),
        ]);
        setShapFeatures(shap);
      } catch (err) {
        console.error("HeatmapPage load error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const tierColor = (tier) => tier === "HIGH" ? "#C62828" : tier === "MED" ? "#F57C00" : "#2E7D32";

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
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Risk Heatmap</h1>
        <div className="flex items-center gap-2">
          <button className="h-9 px-3 rounded text-xs font-medium flex items-center gap-2" style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}>
            <Layers size={14} /> Layers
          </button>
          <button className="h-9 px-3 rounded text-xs font-medium flex items-center gap-2" style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}>
            <Download size={14} /> Export PNG
          </button>
        </div>
      </div>

      <div className="flex gap-4" style={{ height: "calc(100vh - 200px)" }}>
        <div className="flex-1 relative rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)", minHeight: "420px" }}>
          <MapContainer center={mapCenter} zoom={12} scrollWheelZoom className="h-full w-full" style={{ background: "#0a0e17" }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
            />
            {blocks.map((block) => (
              <CircleMarker
                key={block.id}
                center={[block.lat, block.lng]}
                radius={8 + block.risk * 18}
                pathOptions={{
                  color: tierColor(block.tier),
                  fillColor: tierColor(block.tier),
                  fillOpacity: 0.35,
                  weight: 2,
                }}
                eventHandlers={{ click: () => setSelectedBlock(block) }}
              >
                <Tooltip direction="top" offset={[0, -12]} opacity={1}>
                  <div className="text-xs font-semibold">
                    {block.id} · {block.address}
                  </div>
                  <div className="text-[10px] tracking-wide">Risk: {block.risk.toFixed(2)}</div>
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>

          <div className="absolute bottom-4 right-4 rounded-lg p-3" style={{ background: "rgba(26,39,68,0.9)", border: "1px solid var(--color-border)" }}>
            <p className="text-[10px] font-semibold uppercase mb-2" style={{ color: "var(--color-text-secondary)" }}>Legend</p>
            {legend.map((entry) => (
              <div key={entry.tier} className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-sm" style={{ background: tierColor(entry.tier) }} />
                <span className="text-[10px]" style={{ color: "var(--color-text-primary)" }}>{entry.label}</span>
              </div>
            ))}
          </div>
        </div>

        {selectedBlock && (
          <div className="w-80 rounded-lg overflow-y-auto" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Block: {selectedBlock.address}</h2>
                <button onClick={() => setSelectedBlock(null)} className="text-xs" style={{ color: "var(--color-text-muted)" }}>✕</button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <span className="font-mono text-3xl font-bold" style={{ color: "var(--color-text-primary)" }}>{selectedBlock.risk}</span>
                <RiskBadge tier={selectedBlock.tier} />
              </div>
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--color-text-secondary)" }}>Predicted crimes:</span>
                  <span className="font-mono" style={{ color: "var(--color-text-primary)" }}>4.2</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--color-text-secondary)" }}>CI:</span>
                  <span className="font-mono" style={{ color: "var(--color-text-primary)" }}>[2.8 — 5.6]</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--color-text-secondary)" }}>Last updated:</span>
                  <span style={{ color: "var(--color-text-muted)" }}>2h ago</span>
                </div>
              </div>

              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-secondary)" }}>Top Features (SHAP)</h3>
              <div className="space-y-2">
                {shapFeatures.map((f) => (
                  <div key={f.feature} className="flex items-center gap-2">
                    <span className="text-xs w-28 truncate" style={{ color: "var(--color-text-secondary)" }}>{f.feature}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--color-bg-app)" }}>
                      <div className="h-full rounded-full" style={{ width: `${(Math.abs(f.value) / 1.24) * 100}%`, background: f.direction === "positive" ? "#1565C0" : "#C62828" }} />
                    </div>
                    <span className="font-mono text-[11px] w-10 text-right" style={{ color: f.direction === "positive" ? "#64B5F6" : "#EF5350" }}>
                      {f.direction === "positive" ? "+" : ""}{f.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-6">
                <button className="flex-1 h-8 rounded text-xs font-medium" style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}>View Trend</button>
                <button className="flex-1 h-8 rounded text-xs font-medium" style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}>Full Explain</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
