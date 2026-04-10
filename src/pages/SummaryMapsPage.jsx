import { useState } from "react";
import SummaryTabs from "../components/SummaryTabs";
import SummarySection from "../components/SummarySection";

export default function SummaryMapsPage() {
  const [activeTab, setActiveTab] = useState("Police Districts");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Summary Maps</h1>
        </div>
      </div>

      <SummaryTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <SummarySection activeTab={activeTab} />
    </div>
  );
}
