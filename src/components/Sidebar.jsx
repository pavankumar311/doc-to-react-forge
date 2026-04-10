import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  LayoutDashboard, MapPin, Map, Layers, Network, TrendingUp, FileText,
  MessageSquare, Activity, Settings, Shield, AlertTriangle,
} from "lucide-react";

const navItems = [
  { label: "Summary Maps", icon: Layers, path: "/Summarymaps", minRole: "Viewer" },
  { label: "Crimes", icon: AlertTriangle, path: "/crimes", minRole: "Viewer" },
  { label: "Dashboard", icon: LayoutDashboard, path: "/", minRole: "Viewer" },
  //{ label: "Risk Heatmap", icon: MapPin, path: "/heatmap", minRole: "Viewer" },
  { label: "Thematic Map", icon: Map, path: "/map", minRole: "Viewer" },
  { label: "Network Graph", icon: Network, path: "/network", minRole: "Analyst" },
  { label: "Trend Analysis", icon: TrendingUp, path: "/trends", minRole: "Viewer" },
  { label: "Reports", icon: FileText, path: "/reports", minRole: "Viewer" },
  { label: "Chat Assistant", icon: MessageSquare, path: "/chat", minRole: "Analyst" },
  { label: "Model Monitor", icon: Activity, path: "/models", minRole: "Data Scientist" },
  { separator: true },
  { label: "Settings", icon: Settings, path: "/settings", minRole: "Admin" },
  { label: "Audit Log", icon: Shield, path: "/audit", minRole: "Admin" },
];

export default function Sidebar() {
  const { hasRole } = useAuth();
  const location = useLocation();

  return (
    <nav
      className="fixed left-0 top-14 bottom-0 w-60 flex flex-col py-4 overflow-y-auto z-50"
      style={{ background: "var(--color-bg-card)", borderRight: "1px solid var(--color-border)" }}
      aria-label="Main navigation"
    >
      {navItems.map((item, i) => {
        if (item.separator) {
          return <div key={i} className="my-3 mx-4" style={{ borderTop: "1px solid var(--color-border)" }} />;
        }
        if (!hasRole(item.minRole)) return null;
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className="flex items-center gap-3 mx-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-150"
            style={{
              color: isActive ? "var(--color-cobalt)" : "var(--color-text-secondary)",
              background: isActive ? "rgba(37,99,235,0.08)" : "transparent",
              borderLeft: isActive ? "3px solid var(--color-cobalt)" : "3px solid transparent",
            }}
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
