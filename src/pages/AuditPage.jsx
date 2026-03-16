import GscipCard from "../components/GscipCard";
import { auditLogs } from "../services/mockData";

export default function AuditPage() {
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
