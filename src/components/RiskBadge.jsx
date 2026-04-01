export default function RiskBadge({ tier, size = "default" }) {
  const colors = {
    HIGH: { bg: "#FEE2E2", text: "#DC2626" },
    MED: { bg: "#FEF3C7", text: "#D97706" },
    LOW: { bg: "#DCFCE7", text: "#16A34A" },
    NONE: { bg: "#F3F4F6", text: "#6B7280" },
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
