import GscipCard from "../components/GscipCard";
import { useAuth } from "../contexts/AuthContext";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--color-text-primary)" }}>Settings</h1>

      <div className="grid grid-cols-2 gap-4">
        <GscipCard title="User Profile">
          <div className="space-y-4">
            {[["Name", user.name], ["Email", user.email], ["Role", user.role], ["District Scope", user.districtScope.join(", ")]].map(([l, v]) => (
              <div key={l}>
                <label className="text-[11px] uppercase font-semibold block mb-1" style={{ color: "var(--color-text-muted)" }}>{l}</label>
                <div className="h-9 px-3 rounded text-sm flex items-center" style={{ background: "var(--color-bg-sidebar)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
                  {v}
                </div>
              </div>
            ))}
          </div>
        </GscipCard>

        <GscipCard title="Platform Configuration">
          <div className="space-y-4">
            <div>
              <label className="text-[11px] uppercase font-semibold block mb-1" style={{ color: "var(--color-text-muted)" }}>Auto-refresh Interval</label>
              <select className="w-full h-9 px-3 rounded text-sm" style={{ background: "var(--color-bg-sidebar)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
                <option>5 minutes</option>
                <option>10 minutes</option>
                <option>15 minutes</option>
                <option>30 minutes</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase font-semibold block mb-1" style={{ color: "var(--color-text-muted)" }}>Default Date Window</label>
              <select className="w-full h-9 px-3 rounded text-sm" style={{ background: "var(--color-bg-sidebar)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
                <option>Last 7 days</option>
                <option>Last 30 days</option>
                <option>Last 90 days</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Enable Notifications</span>
              <div className="w-10 h-5 rounded-full relative cursor-pointer" style={{ background: "var(--color-cobalt)" }}>
                <div className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full" style={{ background: "#fff" }} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Show Stale Data Warnings</span>
              <div className="w-10 h-5 rounded-full relative cursor-pointer" style={{ background: "var(--color-cobalt)" }}>
                <div className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full" style={{ background: "#fff" }} />
              </div>
            </div>
          </div>
        </GscipCard>
      </div>
    </div>
  );
}
