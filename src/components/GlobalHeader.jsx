import { useAuth } from "../contexts/AuthContext";
import { Bell, ChevronDown, LogOut, Settings, User } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { alerts } from "../services/mockData";

export default function GlobalHeader() {
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-[1000] flex items-center justify-between px-5 h-14"
      style={{ background: "var(--color-bg-sidebar)", borderBottom: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded bg-gscip-cobalt flex items-center justify-center font-bold text-sm" style={{ color: "#fff" }}>G</div>
        <span className="font-semibold text-base tracking-wide" style={{ color: "var(--color-text-primary)" }}>GSCIP</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs px-3 py-1 rounded-full" style={{ background: "var(--color-bg-card)", color: "#64B5F6" }}>
          {user.role}
        </span>

        <div className="relative">
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}
            className="relative p-2 rounded transition-colors hover:bg-gscip-card"
            aria-label="Notifications"
          >
            <Bell size={18} style={{ color: "var(--color-text-secondary)" }} />
            <span className="absolute top-1 right-1 w-4 h-4 text-[10px] font-bold rounded-full flex items-center justify-center" style={{ background: "var(--color-risk-high)", color: "#fff" }}>3</span>
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-full mt-1 w-80 rounded-lg shadow-xl overflow-hidden" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>
              <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-secondary)", borderBottom: "1px solid var(--color-border)" }}>Notifications</div>
              {alerts.slice(0, 5).map((a) => (
                <div key={a.id} className="px-4 py-3 flex items-start gap-3 transition-colors hover:bg-gscip-card" style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${a.type === "warning" ? "bg-gscip-risk-med" : a.type === "error" ? "bg-gscip-risk-high" : a.type === "success" ? "bg-gscip-risk-low" : "bg-gscip-azure"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-primary)" }}>{a.message}</p>
                    <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
            className="flex items-center gap-2 p-1.5 rounded transition-colors hover:bg-gscip-card"
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: "var(--color-cobalt)", color: "#fff" }}>
              {user.initials}
            </div>
            <ChevronDown size={14} style={{ color: "var(--color-text-secondary)" }} />
          </button>
          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-xl overflow-hidden" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
                <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>{user.name}</p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{user.email}</p>
              </div>
              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-gscip-card" style={{ color: "var(--color-text-secondary)" }}>
                <User size={14} /> Profile
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-gscip-card" style={{ color: "var(--color-text-secondary)" }}>
                <Settings size={14} /> Settings
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-gscip-card" style={{ color: "var(--color-risk-high)", borderTop: "1px solid var(--color-border)" }}>
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
