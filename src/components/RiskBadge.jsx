export default function RiskBadge({ tier, size = "default" }) {
  const colors = {
    HIGH: { bg: "#C62828", text: "#FFFFFF" },
    MED: { bg: "#F57C00", text: "#FFFFFF" },
    LOW: { bg: "#2E7D32", text: "#FFFFFF" },
    NONE: { bg: "#546E7A", text: "#FFFFFF" },
  };
  const c = colors[tier] || colors.NONE;
  const small = size === "small";
  return (
    <span
      className={`inline-flex items-center font-semibold rounded ${small ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-1"}`}
      style={{ background: c.bg, color: c.text }}
    >
      {tier}
    </span>
  );
}
