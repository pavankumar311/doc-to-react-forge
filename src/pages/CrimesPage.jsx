import CrimesSection from "../components/CrimesSection";

export default function CrimesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
            Crimes
          </h1>
        </div>
      </div>

      <CrimesSection />
    </div>
  );
}
