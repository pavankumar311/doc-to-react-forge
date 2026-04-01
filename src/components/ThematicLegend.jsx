import { useMemo } from "react";

const defaultColors = ["#fee8c8", "#fdbb84", "#fc8d59", "#ef6548", "#b30000"];

function formatValue(value) {
  if (value == null || Number.isNaN(value)) return "-";
  return Number(value).toFixed(1);
}

export default function ThematicLegend({ title = "Density Analysis", bins = [], colors = defaultColors }) {
  const legendItems = useMemo(() => {
    if (!bins.length) return [];
    return bins.map((bin, idx) => ({
      color: colors[idx] || colors[colors.length - 1],
      label: `${formatValue(bin.min)} - ${formatValue(bin.max)}`
    }));
  }, [bins, colors]);

  if (!legendItems.length) return null;

  return (
    <div
      className="absolute bottom-10 left-8 rounded-xl p-4 border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all hover:scale-[1.02]"
      style={{
        background: "rgba(10, 15, 25, 0.95)",
        zIndex: 1000,
        minWidth: "160px"
      }}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-1.5 h-3.5 rounded-full bg-azure shadow-[0_0_10px_rgba(0,123,255,0.5)]"></div>
        <p className="text-[10px] font-black uppercase tracking-widest text-white">
          {title}
        </p>
      </div>

      <div className="space-y-2">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-3 transition-all cursor-default group">
            <div 
              className="w-4 h-4 rounded border border-white/10 shadow-lg" 
              style={{ background: item.color }} 
            />
            <span className="text-[11px] font-bold text-white transition-colors">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[8px] font-black text-white/50 uppercase tracking-tighter italic">
        <span>GSCIP Geospatial v1.5</span>
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-emerald-500/80">LIVE</span>
        </div>
      </div>
    </div>
  );
}

