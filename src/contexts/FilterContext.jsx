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

const DEFAULT_DISTRICT_OPTIONS = ["District 7", "District 8", "District 11", "District 14"];
const DEFAULT_CRIME_TYPE_OPTIONS = ["Theft", "Assault", "Burglary", "Battery", "Robbery"];
const DEFAULT_RISK_TIER_OPTIONS = ["HIGH", "MED", "LOW"];
const SUMMARY_ENDPOINT = "http://localhost:9000/api/v1/dashboard/summary";
const FILTER_STORAGE_KEY = "gscip.filters";
const FILTER_PARAM_KEYS = ["dateFrom", "dateTo", "districts", "crimeTypes", "riskTiers"];

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

function hasFilterParams(params) {
  return FILTER_PARAM_KEYS.some((key) => params.get(key));
}

function normalizeStoredFilters(value) {
  if (!value || typeof value !== "object") return null;
  return {
    dateFrom: typeof value.dateFrom === "string" ? value.dateFrom : defaultFilters.dateFrom,
    dateTo: typeof value.dateTo === "string" ? value.dateTo : defaultFilters.dateTo,
    districts: Array.isArray(value.districts) ? value.districts.filter(Boolean) : [],
    crimeTypes: Array.isArray(value.crimeTypes) ? value.crimeTypes.filter(Boolean) : [],
    riskTiers: Array.isArray(value.riskTiers) ? value.riskTiers.filter(Boolean) : [],
  };
}

function readStoredFilters() {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return null;
    return normalizeStoredFilters(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeStoredFilters(filters) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // ignore storage errors
  }
}

function clearStoredFilters() {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(FILTER_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

function countActiveFilters(filters) {
  let count = 0;
  if (filters.dateFrom !== defaultFilters.dateFrom || filters.dateTo !== defaultFilters.dateTo) count++;
  if (filters.districts.length > 0) count++;
  if (filters.crimeTypes.length > 0) count++;
  if (filters.riskTiers.length > 0) count++;
  return count;
}

function normalizeDistrictId(value) {
  if (value == null) return "";
  const str = String(value).trim();
  const digits = str.match(/\d+/)?.[0];
  if (!digits) return str;
  return digits.padStart(3, "0");
}

function normalizeCrimeTypeId(value) {
  if (value == null) return "";
  return String(value).trim().toLowerCase().replace(/\s+/g, "_");
}

function buildSummaryUrl(filters, districtIdByName, crimeTypeIdByName) {
  const params = new URLSearchParams();
  params.set("date_from", filters.dateFrom);
  params.set("date_to", filters.dateTo);

  if (filters.districts.length > 0) {
    const ids = filters.districts
      .map((name) => districtIdByName[name] ?? normalizeDistrictId(name))
      .filter(Boolean);
    if (ids.length > 0) params.set("district_ids", ids.join(","));
  }

  if (filters.crimeTypes.length > 0) {
    const ids = filters.crimeTypes
      .map((name) => crimeTypeIdByName[name] ?? normalizeCrimeTypeId(name))
      .filter(Boolean);
    if (ids.length > 0) params.set("crime_type_ids", ids.join(","));
  }

  return `${SUMMARY_ENDPOINT}?${params.toString()}`;
}

export function FilterProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => {
    const fromUrl = hasFilterParams(searchParams) ? filtersFromParams(searchParams) : null;
    const fromStorage = fromUrl ? null : readStoredFilters();
    return fromUrl || fromStorage || defaultFilters;
  });
  const [pendingFilters, setPendingFilters] = useState(() => {
    const fromUrl = hasFilterParams(searchParams) ? filtersFromParams(searchParams) : null;
    const fromStorage = fromUrl ? null : readStoredFilters();
    return fromUrl || fromStorage || defaultFilters;
  });
  const [districtOptions, setDistrictOptions] = useState(DEFAULT_DISTRICT_OPTIONS);
  const [crimeTypeOptions, setCrimeTypeOptions] = useState(DEFAULT_CRIME_TYPE_OPTIONS);
  const [riskTierOptions, setRiskTierOptions] = useState(DEFAULT_RISK_TIER_OPTIONS);
  const [districtIdByName, setDistrictIdByName] = useState({});
  const [crimeTypeIdByName, setCrimeTypeIdByName] = useState({});
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

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
    writeStoredFilters(pendingFilters);
  }, [pendingFilters, setSearchParams]);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setPendingFilters(defaultFilters);
    setSearchParams({}, { replace: true });
    clearStoredFilters();
  }, [setSearchParams]);

  const fetchSummary = useCallback(
    async (nextFilters) => {
      try {
        setSummaryLoading(true);
        const url = buildSummaryUrl(nextFilters, districtIdByName, crimeTypeIdByName);
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiAidGVzdHVzZXIiLCAicm9sZXMiOiBbIkFkbWluIl0sICJkaXN0cmljdF9zY29wZSI6IFtdLCAiaWF0IjogMTc3MzcyNzYyOSwgImV4cCI6IDE3NzM4MTQwMjl9.sfJHNjwQefkaIQuyASBjGgj7-UkGjIeWCZ8Xg69t-eE`,
          },
        });
        if (!res.ok) throw new Error(`Summary fetch failed: ${res.status}`);
        const data = await res.json();
        setSummaryData(data);
      } catch (err) {
        console.error("Summary API error:", err);
      } finally {
        setSummaryLoading(false);
      }
    },
    [districtIdByName, crimeTypeIdByName]
  );

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const res = await fetch("http://localhost:9000/api/v1/dashboard/filters", {
          headers: {
            Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiAidGVzdHVzZXIiLCAicm9sZXMiOiBbIkFkbWluIl0sICJkaXN0cmljdF9zY29wZSI6IFtdLCAiaWF0IjogMTc3MzcyNzYyOSwgImV4cCI6IDE3NzM4MTQwMjl9.sfJHNjwQefkaIQuyASBjGgj7-UkGjIeWCZ8Xg69t-eE`, // adjust if needed
          },
        });

        if (!res.ok) throw new Error("Failed to fetch filters");

        const data = await res.json();
        const districtMap = {};
        const crimeTypeMap = {};

        const districts =
          data?.districts
            ?.map((d) => {
              const name = d?.district_name;
              const id = d?.district_id ?? d?.id;
              if (name && id != null) districtMap[name] = normalizeDistrictId(id);
              return name;
            })
            .filter(Boolean) || DEFAULT_DISTRICT_OPTIONS;

        const crimeTypes =
          data?.crime_types
            ?.map((c) => {
              const name = c?.primary_type;
              const id = c?.crime_type_id ?? c?.id;
              if (name && id != null) crimeTypeMap[name] = String(id);
              return name;
            })
            .filter(Boolean) || DEFAULT_CRIME_TYPE_OPTIONS;

        // ✅ Set state
        setDistrictOptions(districts);
        setCrimeTypeOptions(crimeTypes);
        setRiskTierOptions(data?.riskTiers || DEFAULT_RISK_TIER_OPTIONS);
        setDistrictIdByName(districtMap);
        setCrimeTypeIdByName(crimeTypeMap);
      } catch (err) {
        console.error("Filter API error:", err);

        // fallback to defaults on failure
        setDistrictOptions(DEFAULT_DISTRICT_OPTIONS);
        setCrimeTypeOptions(DEFAULT_CRIME_TYPE_OPTIONS);
        setRiskTierOptions(DEFAULT_RISK_TIER_OPTIONS);
        setDistrictIdByName({});
        setCrimeTypeIdByName({});
      }
    };

    loadOptions();
  }, []);

  // Sync from URL on popstate / external changes when URL has filter params
  useEffect(() => {
    if (!hasFilterParams(searchParams)) return;
    const fromUrl = filtersFromParams(searchParams);
    setFilters(fromUrl);
    setPendingFilters(fromUrl);
    writeStoredFilters(fromUrl);
  }, [searchParams]);

  // Sync across browser tabs
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== FILTER_STORAGE_KEY) return;
      if (!e.newValue) {
        setFilters(defaultFilters);
        setPendingFilters(defaultFilters);
        return;
      }
      let parsed = null;
      try {
        parsed = JSON.parse(e.newValue);
      } catch {
        return;
      }
      const next = normalizeStoredFilters(parsed);
      if (!next) return;
      setFilters(next);
      setPendingFilters(next);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    fetchSummary(filters);
  }, [filters, fetchSummary]);

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
 
        summaryData,
        summaryLoading,
        DISTRICT_OPTIONS: districtOptions,
        CRIME_TYPE_OPTIONS: crimeTypeOptions,
        RISK_TIER_OPTIONS: riskTierOptions,
        districtIdByName,
        crimeTypeIdByName,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export const useFilters = () => useContext(FilterContext);
