export default function GscipCard({ title, subtitle, children, className = "", compact = false, interactive = false }) {
  return (
    <div
      className={`rounded-lg transition-all duration-200 ${interactive ? "cursor-pointer" : ""} ${className}`}
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        padding: compact ? "12px" : "20px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={(e) => {
        if (interactive) {
          e.currentTarget.style.borderColor = "var(--color-cobalt)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.12)";
        }
      }}
      onMouseLeave={(e) => {
        if (interactive) {
          e.currentTarget.style.borderColor = "var(--color-border)";
          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)";
        }
      }}
    >
      {title && (
        <div className="pb-3 mb-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <h3
            className="text-xs font-bold uppercase"
            style={{ color: "var(--color-text-secondary)", letterSpacing: "0.08em" }}
          >
            {title}
          </h3>
          {subtitle && <p className="text-[11px] mt-1" style={{ color: "var(--color-text-muted)" }}>{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
