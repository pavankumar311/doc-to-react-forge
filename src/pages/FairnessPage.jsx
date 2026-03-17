import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, Download } from "lucide-react";
import GscipCard from "../components/GscipCard";
import { FairnessSkeleton } from "../components/Skeletons";
import { fetchBiasData } from "../services/api";

export default function FairnessPage() {
  const [threshold, setThreshold] = useState(15);
  const [biasData, setBiasData] = useState([]);
  const [biasPerCrimeType, setBiasPerCrimeType] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchBiasData({ threshold });
        setBiasData(data.byDistrict);
        setBiasPerCrimeType(data.byCrimeType);
      } catch (err) {
        console.error("FairnessPage load error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [threshold]);

  if (loading) {
    return <FairnessSkeleton />;
  }

  const flaggedCount = biasData.filter((d) => d.flagged).length + biasPerCrimeType.filter((d) => d.flagged).length;

  return (
    <div>
      {flaggedCount > 0 && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg" style={{ background: "rgba(245,124,0,0.15)", border: "1px solid rgba(245,124,0,0.3)" }}>
          <AlertTriangle size={16} style={{ color: "#F57C00" }} />
          <span className="text-sm" style={{ color: "#F57C00" }}>{flaggedCount} disparity flags detected</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Bias & Fairness</h1>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Active Model: graph_xgb_v2.1</p>
        </div>
        <button className="h-9 px-4 rounded text-xs font-medium flex items-center gap-2" style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}>
          <Download size={14} /> Download Bias Report
        </button>
      </div>

      <GscipCard title="Prediction Error by District" className="mb-4">
        <div className="space-y-3">
          {biasData.map((d) => (
            <div key={d.district} className="flex items-center gap-3">
              <span className="text-xs w-16" style={{ color: "var(--color-text-secondary)" }}>{d.district}</span>
              <div className="flex-1 h-4 rounded overflow-hidden" style={{ background: "var(--color-bg-app)" }}>
                <div className="h-full rounded" style={{
                  width: `${(d.rmse / 2.5) * 100}%`,
                  background: d.flagged ? "#F57C00" : "#1565C0",
                }} />
              </div>
              <span className="font-mono text-xs w-20" style={{ color: "var(--color-text-primary)" }}>RMSE: {d.rmse}</span>
              {d.flagged ? (
                <span className="flex items-center gap-1 text-xs" style={{ color: "#F57C00" }}>
                  <AlertTriangle size={12} /> +{d.delta}% vs avg
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs" style={{ color: "#2E7D32" }}>
                  <CheckCircle size={12} /> within threshold
                </span>
              )}
            </div>
          ))}
        </div>
      </GscipCard>

      <div className="grid grid-cols-2 gap-4">
        <GscipCard title="Error by Crime Type">
          <div className="space-y-3">
            {biasPerCrimeType.map((c) => (
              <div key={c.type} className="flex items-center gap-3">
                <span className="text-xs w-16" style={{ color: "var(--color-text-secondary)" }}>{c.type}</span>
                <div className="flex-1 h-3 rounded overflow-hidden" style={{ background: "var(--color-bg-app)" }}>
                  <div className="h-full rounded" style={{
                    width: `${(c.rmse / 2.5) * 100}%`,
                    background: c.flagged ? "#F57C00" : "#1565C0",
                  }} />
                </div>
                <span className="font-mono text-xs" style={{ color: "var(--color-text-primary)" }}>{c.rmse}</span>
                {c.flagged ? <AlertTriangle size={12} style={{ color: "#F57C00" }} /> : <CheckCircle size={12} style={{ color: "#2E7D32" }} />}
              </div>
            ))}
          </div>
        </GscipCard>

        <GscipCard title="Disparity Threshold Config">
          <div className="space-y-4">
            <div>
              <label className="text-xs mb-2 block" style={{ color: "var(--color-text-secondary)" }}>Current threshold</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={5} max={50}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="h-9 w-20 px-3 rounded text-sm font-mono"
                  style={{ background: "var(--color-bg-sidebar)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}
                />
                <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>%</span>
              </div>
            </div>
            <div className="space-y-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
              <p>Districts flagged: <span className="font-mono" style={{ color: "var(--color-text-primary)" }}>{biasData.filter((d) => d.flagged).length}</span></p>
              <p>Crime types flagged: <span className="font-mono" style={{ color: "var(--color-text-primary)" }}>{biasPerCrimeType.filter((d) => d.flagged).length}</span></p>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              Note: Disparity flag does NOT block serving. Admin must review and accept or retrain.
            </p>
          </div>
        </GscipCard>
      </div>
    </div>
  );
}
