import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Download, Share2, Plus } from "lucide-react";
import GscipCard from "../components/GscipCard";
import { ReportsSkeleton } from "../components/Skeletons";
import { downloadReport, fetchReports, fetchReportStatus, generateReport } from "../services/api";
import { useFilters } from "../contexts/FilterContext";

const reportTypes = ["Crime Risk PDF", "Weekly Summary", "District Compare", "CSV Export"];

export default function ReportsPage() {
  const { filters, DISTRICT_OPTIONS, CRIME_TYPE_OPTIONS, districtIdByName, crimeTypeIdByName } = useFilters();
  const [selectedType, setSelectedType] = useState("Crime Risk PDF");
  const [generating, setGenerating] = useState(false);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedDistricts, setSelectedDistricts] = useState([]);
  const [selectedCrimeType, setSelectedCrimeType] = useState("");
  const reportsRef = useRef(reports);

  const dateRangeLabel = useMemo(() => {
    if (!filters?.dateFrom || !filters?.dateTo) return "Select range";
    return `${filters.dateFrom} - ${filters.dateTo}`;
  }, [filters?.dateFrom, filters?.dateTo]);

  const toDistrictId = (name) =>
    districtIdByName?.[name] || name.replace(/\D/g, "").padStart(3, "0");

  useEffect(() => {
    reportsRef.current = reports;
  }, [reports]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchReports();
        setReports(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("ReportsPage load error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const districtIds = selectedType === "District Compare"
        ? selectedDistricts.map((d) => toDistrictId(d)).filter(Boolean)
        : (selectedDistrict ? [toDistrictId(selectedDistrict)] : []);
      const crimeTypeId = selectedCrimeType ? selectedCrimeType : null;

      const payload = {
        type: selectedType,
        date_from: filters?.dateFrom,
        date_to: filters?.dateTo,
        district_ids: districtIds,
        crime_type_ids: crimeTypeId ? [crimeTypeId] : [],
      };

      await generateReport(payload);
      const updated = await fetchReports();
      setReports(Array.isArray(updated) ? updated : []);
    } catch (err) {
      console.error("Report generation error:", err);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    const pollStatuses = async () => {
      const pending = reportsRef.current.filter((r) => r.status === "queued");
      if (!pending.length) return;
      try {
        const updates = await Promise.all(
          pending.map((r) => fetchReportStatus(r.report_id || r.id))
        );
        const updatesById = new Map(updates.map((u) => [u.report_id || u.id, u]));
        setReports((prev) =>
          prev.map((r) => updatesById.get(r.report_id || r.id) || r)
        );
      } catch (err) {
        console.error("Report status polling error:", err);
      }
    };

    const interval = setInterval(pollStatuses, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <ReportsSkeleton />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Reports</h1>
        <button onClick={handleGenerate} className="h-10 px-5 rounded text-sm font-semibold flex items-center gap-2" style={{ background: "var(--color-cobalt)", color: "#fff" }}>
          <Plus size={16} /> Generate New Report
        </button>
      </div>

      <div className="flex gap-6">
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

          <GscipCard title="Parameters" className="mt-4">
            <div className="space-y-3">
              <div>
                <label className="text-[11px] uppercase font-semibold block mb-1" style={{ color: "var(--color-text-muted)" }}>District</label>
                {selectedType === "District Compare" ? (
                  <div className="max-h-40 overflow-y-auto rounded p-2 space-y-1" style={{ background: "var(--color-bg-sidebar)", border: "1px solid var(--color-border)" }}>
                    {DISTRICT_OPTIONS.map((d) => {
                      const active = selectedDistricts.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSelectedDistricts((prev) => active ? prev.filter((x) => x !== d) : [...prev, d])}
                          className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left"
                          style={{
                            color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                            background: active ? "rgba(21,101,192,0.15)" : "transparent",
                          }}
                        >
                          <span className="inline-block w-2.5 h-2.5 rounded-full border" style={{
                            borderColor: active ? "var(--color-cobalt)" : "var(--color-border)",
                            background: active ? "var(--color-cobalt)" : "transparent",
                          }} />
                          {d}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="w-full h-8 px-2 rounded text-xs"
                    style={{ background: "var(--color-bg-sidebar)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}
                  >
                    <option value="">All</option>
                    {DISTRICT_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="text-[11px] uppercase font-semibold block mb-1" style={{ color: "var(--color-text-muted)" }}>Date Range</label>
                <div className="h-8 px-2 rounded text-xs flex items-center" style={{ background: "var(--color-bg-sidebar)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
                  {dateRangeLabel}
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase font-semibold block mb-1" style={{ color: "var(--color-text-muted)" }}>Crime Type</label>
                <select
                  value={selectedCrimeType}
                  onChange={(e) => setSelectedCrimeType(e.target.value)}
                  className="w-full h-8 px-2 rounded text-xs"
                  style={{ background: "var(--color-bg-sidebar)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}
                >
                  <option value="">All</option>
                  {CRIME_TYPE_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
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

        <div className="flex-1">
          <GscipCard title="Recent Reports">
            <div className="space-y-3">
              {reports.map((r) => (
                <div key={r.report_id || r.id} className="p-4 rounded-lg transition-colors hover:bg-gscip-surface" style={{ border: "1px solid var(--color-border)" }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <FileText size={20} style={{ color: "var(--color-azure)" }} className="mt-0.5" />
                      <div>
                        <h3 className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{r.type || r.name}</h3>
                        <p className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>
                          Districts: {Array.isArray(r.districts) ? r.districts.join(", ") : r.districts || "All"} | Status: {r.status || "unknown"}
                        </p>
                        <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>
                          Created: {r.created_at || r.date || "-"}
                        </p>
                        {r.generated_at && (
                          <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>
                            Generated: {r.generated_at}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="h-8 px-3 rounded text-xs font-medium flex items-center gap-1"
                        style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)", opacity: r.status === "complete" ? 1 : 0.5 }}
                        disabled={r.status !== "complete"}
                        onClick={() => downloadReport(r.report_id || r.id)}
                      >
                        <Download size={12} /> Download CSV
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
