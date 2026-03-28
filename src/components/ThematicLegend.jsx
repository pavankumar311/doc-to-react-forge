import { useMemo } from "react";

const defaultColors = ["#fee8c8", "#fdbb84", "#fc8d59", "#ef6548", "#b30000"];

function formatValue(value) {
  if (value == null || Number.isNaN(value)) return "-";
  return Number(value).toFixed(2);
}

export default function ThematicLegend({ title = "Safety Index", bins = [], colors = defaultColors }) {
  const legendItems = useMemo(() => {
    if (!bins.length) {
      return colors.map((color, idx) => ({
        color,
        label: `Bin ${idx + 1}`,
      }));
    }
    return bins.map((bin, idx) => ({
      color: colors[idx] || colors[colors.length - 1],
      label: `${formatValue(bin.min)} - ${formatValue(bin.max)}`,
    }));
  }, [bins, colors]);

  return (
    <div
      className="absolute bottom-4 right-4 rounded-lg p-3"
      style={{
        background: "rgba(26,39,68,0.9)",
        border: "1px solid var(--color-border)",
        zIndex: 1000,
      }}
    >
      <p className="text-[10px] font-semibold uppercase mb-2" style={{ color: "var(--color-text-secondary)" }}>{title}</p>
      {legendItems.map((item) => (
        <div key={item.label} className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-sm" style={{ background: item.color }} />
          <span className="text-[10px]" style={{ color: "var(--color-text-primary)" }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
