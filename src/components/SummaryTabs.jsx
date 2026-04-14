const TABS = ["Police Districts", "Police Beats", "Wards"];

export default function SummaryTabs({ activeTab, onTabChange }) {
  return (
    <div className="flex items-center rounded-lg p-1 mb-6" style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}>
      {TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className="flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200"
          style={{
            background: activeTab === tab ? "var(--color-cobalt)" : "transparent",
            color: activeTab === tab ? "#FFFFFF" : "var(--color-text-secondary)",
            boxShadow: activeTab === tab ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
