export default function GscipCard({ title, subtitle, icon, children, className = "", compact = false, interactive = false }) {
  return (
    <div
      className={`rounded-xl transition-all duration-200 ${interactive ? "cursor-pointer" : ""} ${className}`}
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        padding: compact ? "12px" : "20px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      {title && (
        <div className="flex items-center justify-between pb-3 mb-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="flex items-center gap-2">
            {icon && <div className="text-gray-400">{icon}</div>}
            <h3
              className="text-[10px] font-bold uppercase tracking-[0.1em]"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {title}
            </h3>
          </div>
          {subtitle && <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
