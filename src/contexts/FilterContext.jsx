import { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

const FilterContext = createContext(null);

const defaultFilters = {
  dateFrom: "2025-02-01",
  dateTo: "2025-02-27",
  districts: [],
  crimeTypes: [],
  riskTiers: [],
};

const DISTRICT_OPTIONS = ["District 7", "District 8", "District 11", "District 14"];
const CRIME_TYPE_OPTIONS = ["Theft", "Assault", "Burglary", "Battery", "Robbery"];
const RISK_TIER_OPTIONS = ["HIGH", "MED", "LOW"];

function parseArrayParam(value) {
  if (!value) return [];
  return value.split(",").filter(Boolean);
}

function serializeArrayParam(arr) {
  return arr.length > 0 ? arr.join(",") : undefined;
}

function filtersFromParams(params) {
  return {
    dateFrom: params.get("dateFrom") || defaultFilters.dateFrom,
    dateTo: params.get("dateTo") || defaultFilters.dateTo,
    districts: parseArrayParam(params.get("districts")),
    crimeTypes: parseArrayParam(params.get("crimeTypes")),
    riskTiers: parseArrayParam(params.get("riskTiers")),
  };
}

function filtersToParams(filters) {
  const p = {};
  if (filters.dateFrom !== defaultFilters.dateFrom) p.dateFrom = filters.dateFrom;
  if (filters.dateTo !== defaultFilters.dateTo) p.dateTo = filters.dateTo;
  const d = serializeArrayParam(filters.districts);
  if (d) p.districts = d;
  const c = serializeArrayParam(filters.crimeTypes);
  if (c) p.crimeTypes = c;
  const r = serializeArrayParam(filters.riskTiers);
  if (r) p.riskTiers = r;
  return p;
}

function countActiveFilters(filters) {
  let count = 0;
  if (filters.dateFrom !== defaultFilters.dateFrom || filters.dateTo !== defaultFilters.dateTo) count++;
  if (filters.districts.length > 0) count++;
  if (filters.crimeTypes.length > 0) count++;
  if (filters.riskTiers.length > 0) count++;
  return count;
}

export function FilterProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => filtersFromParams(searchParams));
  const [pendingFilters, setPendingFilters] = useState(() => filtersFromParams(searchParams));

  const hasChanges = useMemo(
    () => JSON.stringify(pendingFilters) !== JSON.stringify(filters),
    [pendingFilters, filters]
  );

  const activeCount = useMemo(() => countActiveFilters(filters), [filters]);

  const updatePending = useCallback((key, value) => {
    setPendingFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const togglePendingArrayItem = useCallback((key, item) => {
    setPendingFilters((prev) => {
      const arr = prev[key] || [];
      const next = arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];
      return { ...prev, [key]: next };
    });
  }, []);

  const applyFilters = useCallback(() => {
    setFilters(pendingFilters);
    setSearchParams(filtersToParams(pendingFilters), { replace: true });
  }, [pendingFilters, setSearchParams]);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setPendingFilters(defaultFilters);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  // Sync from URL on popstate / external changes
  useEffect(() => {
    const fromUrl = filtersFromParams(searchParams);
    setFilters(fromUrl);
    setPendingFilters(fromUrl);
  }, [searchParams]);

  return (
    <FilterContext.Provider
      value={{
        filters,
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
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export const useFilters = () => useContext(FilterContext);
