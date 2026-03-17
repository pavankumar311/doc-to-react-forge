import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import GscipCard from "../components/GscipCard";
import { fetchAuditLogs } from "../services/api";

export default function AuditPage() {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchAuditLogs();
        setAuditLogs(data);
      } catch (err) {
        console.error("AuditPage load error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin" style={{ color: "var(--color-azure)" }} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--color-text-primary)" }}>Audit Log</h1>

      <GscipCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                {["Action", "User", "Details", "Timestamp"].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="transition-colors hover:bg-gscip-surface" style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td className="py-3 px-4 font-medium" style={{ color: "var(--color-text-primary)" }}>{log.action}</td>
                  <td className="py-3 px-4 font-mono text-xs" style={{ color: "var(--color-text-secondary)" }}>{log.user}</td>
                  <td className="py-3 px-4 text-xs" style={{ color: "var(--color-text-secondary)" }}>{log.details}</td>
                  <td className="py-3 px-4 text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>{log.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GscipCard>
    </div>
  );
}
