import { createContext, useContext, useState, useCallback } from "react";

const FilterContext = createContext(null);

const defaultFilters = {
  dateRange: "Feb 1 — Feb 27, 2025",
  districts: ["All"],
  crimeTypes: ["All"],
  riskTiers: ["All"],
};

export function FilterProvider({ children }) {
  const [filters, setFilters] = useState(defaultFilters);
  const [pendingFilters, setPendingFilters] = useState(defaultFilters);
  const [hasChanges, setHasChanges] = useState(false);

  const updatePending = useCallback((key, value) => {
    setPendingFilters((prev) => {
      const next = { ...prev, [key]: value };
      setHasChanges(JSON.stringify(next) !== JSON.stringify(filters));
      return next;
    });
  }, [filters]);

  const applyFilters = useCallback(() => {
    setFilters(pendingFilters);
    setHasChanges(false);
  }, [pendingFilters]);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setPendingFilters(defaultFilters);
    setHasChanges(false);
  }, []);

  return (
    <FilterContext.Provider value={{ filters, pendingFilters, hasChanges, updatePending, applyFilters, clearFilters }}>
      {children}
    </FilterContext.Provider>
  );
}

export const useFilters = () => useContext(FilterContext);
