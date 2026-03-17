import { useState, useRef, useEffect } from "react";
import { format, parse } from "date-fns";
import { CalendarIcon, ChevronDown, X } from "lucide-react";
import { useFilters } from "../contexts/FilterContext";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

/* ── Multi-Select Dropdown ─────────────────────────────── */
function MultiSelectDropdown({ label, options, selected, onToggle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const display = selected.length === 0 ? "All" : selected.length === 1 ? selected[0] : `${selected.length} selected`;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 h-8 px-3 rounded text-xs font-medium border border-input bg-background text-foreground hover:bg-accent/40 transition-colors"
        >
          <span className="max-w-[120px] truncate">{display}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] rounded-md border bg-popover text-popover-foreground shadow-md p-1 animate-in fade-in-0 zoom-in-95">
            <div className="max-h-56 overflow-y-auto pr-1">
              {options.map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={selected.includes(opt)}
                    onCheckedChange={() => onToggle(opt)}
                    className="h-3.5 w-3.5"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Date Range Picker ─────────────────────────────────── */
function DateInput({ label, value, onChange }) {
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  const isValid = !Number.isNaN(parsed?.getTime());
  const display = isValid ? format(parsed, "MMM d, yyyy") : "Select";

  const handleSelect = (date) => {
    if (!date) return;
    onChange(format(date, "yyyy-MM-dd"));
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 h-8 px-3 rounded text-xs font-medium border border-input bg-background text-foreground hover:bg-accent/40 transition-colors">
            <CalendarIcon className="h-3.5 w-3.5 opacity-60" />
            <span>{display}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={isValid ? parsed : undefined} onSelect={handleSelect} className="p-3" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ── Filter Bar ────────────────────────────────────────── */
export default function FilterBar() {
  const {
    pendingFilters,
    hasChanges,
    activeCount,
    updatePending,
    togglePendingArrayItem,
    applyFilters,
    clearFilters,
    DISTRICT_OPTIONS,
    CRIME_TYPE_OPTIONS,
    RISK_TIER_OPTIONS,
  } = useFilters();

  return (
    <div
      className="sticky top-14 z-40 flex items-center gap-5 h-12 px-6 border-b border-border"
      style={{ background: "var(--color-bg-app)" }}
    >
      <DateInput
        label="From Date"
        value={pendingFilters.dateFrom}
        onChange={(val) => updatePending("dateFrom", val)}
      />
      <DateInput
        label="To Date"
        value={pendingFilters.dateTo}
        onChange={(val) => updatePending("dateTo", val)}
      />

      <MultiSelectDropdown
        label="District"
        options={DISTRICT_OPTIONS}
        selected={pendingFilters.districts}
        onToggle={(item) => togglePendingArrayItem("districts", item)}
      />

      <MultiSelectDropdown
        label="Crime Type"
        options={CRIME_TYPE_OPTIONS}
        selected={pendingFilters.crimeTypes}
        onToggle={(item) => togglePendingArrayItem("crimeTypes", item)}
      />

      <MultiSelectDropdown
        label="Risk Tier"
        options={RISK_TIER_OPTIONS}
        selected={pendingFilters.riskTiers}
        onToggle={(item) => togglePendingArrayItem("riskTiers", item)}
      />

      {/* Active filter count badge */}
      {activeCount > 0 && (
        <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
          {activeCount}
        </span>
      )}

      <div className="flex items-center gap-2 ml-auto">
        {activeCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 h-8 px-3 rounded text-xs font-medium border border-input text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
          >
            <X className="h-3 w-3" />
            Clear All
          </button>
        )}
        <button
          onClick={applyFilters}
          disabled={!hasChanges}
          className="h-8 px-4 rounded text-xs font-semibold transition-colors bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
