export function parseIsoDateToUtc(value) {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getTime());
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const date = new Date(`${str}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  // Backend sometimes returns timezone-naive timestamps like "2026-04-20T00:00:00".
  // Treat those as UTC to avoid off-by-one-day issues when formatting via toISOString().
  const naiveMatch = str.match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(\.\d+)?$/
  );
  if (naiveMatch) {
    const [, ymd, hms, frac = ""] = naiveMatch;
    const date = new Date(`${ymd}T${hms}${frac}Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIsoDateStringUtc(value) {
  const date = parseIsoDateToUtc(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function addDaysUtc(value, days) {
  const date = parseIsoDateToUtc(value);
  if (!date) return null;
  return new Date(date.getTime() + days * 86400000);
}

export function shiftIsoDateStringUtc(isoDateString, days) {
  const shifted = addDaysUtc(isoDateString, days);
  return shifted ? toIsoDateStringUtc(shifted) : "";
}
