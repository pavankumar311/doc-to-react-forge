import { useState } from "react";
import { FileText, Download, Share2, Trash2, Plus, Radio } from "lucide-react";
import GscipCard from "../components/GscipCard";
import { reports } from "../services/mockData";

const reportTypes = ["Crime Risk PDF", "Weekly Summary", "District Compare", "Model Audit", "CSV Export"];

export default function ReportsPage() {
  const [selectedType, setSelectedType] = useState("Crime Risk PDF");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => setGenerating(false), 3000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Reports</h1>
        <button onClick={handleGenerate} className="h-10 px-5 rounded text-sm font-semibold flex items-center gap-2" style={{ background: "var(--color-cobalt)", color: "#fff" }}>
          <Plus size={16} /> Generate New Report
        </button>
      </div>

      <div className="flex gap-6">
        {/* Report Type Selector */}
        <div className="w-56 shrink-0">
          <GscipCard title="Report Type">
            <div className="space-y-1">
              {reportTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedType(t)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded text-xs font-medium text-left transition-colors"
                  style={{
                    color: selectedType === t ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                    background: selectedType === t ? "rgba(21,101,192,0.15)" : "transparent",
                  }}
                >
                  <div className="w-3 h-3 rounded-full border-2" style={{
                    borderColor: selectedType === t ? "var(--color-cobalt)" : "var(--color-border)",
                    background: selectedType === t ? "var(--color-cobalt)" : "transparent",
                  }} />
                  {t}
                </button>
              ))}
            </div>
          </GscipCard>

          {/* Parameters */}
          <GscipCard title="Parameters" className="mt-4">
            <div className="space-y-3">
              <div>
                <label className="text-[11px] uppercase font-semibold block mb-1" style={{ color: "var(--color-text-muted)" }}>District</label>
                <select className="w-full h-8 px-2 rounded text-xs" style={{ background: "var(--color-bg-sidebar)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
                  <option>District 8</option>
                  <option>District 7</option>
                  <option>District 11</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] uppercase font-semibold block mb-1" style={{ color: "var(--color-text-muted)" }}>Date Range</label>
                <div className="h-8 px-2 rounded text-xs flex items-center" style={{ background: "var(--color-bg-sidebar)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
                  Feb 1 — Feb 27
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase font-semibold block mb-1" style={{ color: "var(--color-text-muted)" }}>Crime Type</label>
                <select className="w-full h-8 px-2 rounded text-xs" style={{ background: "var(--color-bg-sidebar)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
                  <option>All</option>
                </select>
              </div>
              <button onClick={handleGenerate} disabled={generating} className="w-full h-9 rounded text-xs font-semibold" style={{
                background: generating ? "var(--color-text-muted)" : "var(--color-cobalt)",
                color: "#fff",
                cursor: generating ? "not-allowed" : "pointer",
              }}>
                {generating ? "Generating..." : "Generate Report"}
              </button>
              {generating && (
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-bg-app)" }}>
                  <div className="h-full rounded-full animate-pulse" style={{ width: "60%", background: "var(--color-cobalt)" }} />
                </div>
              )}
            </div>
          </GscipCard>
        </div>

        {/* Report List */}
        <div className="flex-1">
          <GscipCard title="Recent Reports">
            <div className="space-y-3">
              {reports.map((r) => (
                <div key={r.id} className="p-4 rounded-lg transition-colors hover:bg-gscip-surface" style={{ border: "1px solid var(--color-border)" }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <FileText size={20} style={{ color: "var(--color-azure)" }} className="mt-0.5" />
                      <div>
                        <h3 className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{r.name}</h3>
                        <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>
                          Districts: {r.districts} | {r.auto ? "Auto-generated" : `By: ${r.by}`}
                        </p>
                        <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>{r.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="h-8 px-3 rounded text-xs font-medium flex items-center gap-1" style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}>
                        <Download size={12} /> PDF
                      </button>
                      <button className="h-8 px-3 rounded text-xs font-medium flex items-center gap-1" style={{ color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}>
                        <Share2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GscipCard>
        </div>
      </div>
    </div>
  );
}
