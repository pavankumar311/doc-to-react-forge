import { useFilters } from "../contexts/FilterContext";

export default function FilterBar() {
  const { pendingFilters, hasChanges, updatePending, applyFilters, clearFilters } = useFilters();

  const filterChip = (label, value, key) => (
    <div className="flex items-center gap-2">
      <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>{label}</label>
      <select
        className="h-8 px-3 rounded text-xs font-medium"
        style={{
          background: "var(--color-bg-sidebar)",
          color: "var(--color-text-primary)",
          border: "1px solid var(--color-border)",
        }}
        value={Array.isArray(value) ? value[0] : value}
        onChange={(e) => updatePending(key, [e.target.value])}
      >
        <option>All</option>
        {key === "districts" && [7, 8, 11, 14].map((d) => <option key={d}>District {d}</option>)}
        {key === "crimeTypes" && ["Theft", "Assault", "Burglary", "Battery", "Robbery"].map((c) => <option key={c}>{c}</option>)}
        {key === "riskTiers" && ["HIGH", "MED", "LOW"].map((r) => <option key={r}>{r}</option>)}
      </select>
    </div>
  );

  return (
    <div
      className="sticky top-14 z-40 flex items-center gap-5 h-12 px-6"
      style={{ background: "var(--color-bg-app)", borderBottom: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Date</label>
        <div className="h-8 px-3 rounded text-xs font-medium flex items-center" style={{ background: "var(--color-bg-sidebar)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
          Feb 1 — Feb 27, 2025
        </div>
      </div>

      {filterChip("District", pendingFilters.districts, "districts")}
      {filterChip("Crime Type", pendingFilters.crimeTypes, "crimeTypes")}
      {filterChip("Risk Tier", pendingFilters.riskTiers, "riskTiers")}

      <div className="flex items-center gap-2 ml-auto">
        {hasChanges && (
          <button
            onClick={clearFilters}
            className="h-8 px-3 rounded text-xs font-medium transition-colors"
            style={{ color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
          >
            Clear All
          </button>
        )}
        <button
          onClick={applyFilters}
          disabled={!hasChanges}
          className="h-8 px-4 rounded text-xs font-semibold transition-colors"
          style={{
            background: hasChanges ? "var(--color-cobalt)" : "var(--color-text-muted)",
            color: "#fff",
            opacity: hasChanges ? 1 : 0.4,
            cursor: hasChanges ? "pointer" : "not-allowed",
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
