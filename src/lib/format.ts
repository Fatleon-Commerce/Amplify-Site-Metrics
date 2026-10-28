const COUNTRY_NAMES: Record<string, string> = {
  CN: "China",
  HK: "Hong Kong",
  MO: "Macao",
  TW: "Taiwan",
  US: "United States",
  JP: "Japan",
  KR: "South Korea",
  SG: "Singapore",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  AU: "Australia",
  CA: "Canada",
  IN: "India",
  TH: "Thailand",
  VN: "Vietnam",
  MY: "Malaysia",
  PH: "Philippines",
  ID: "Indonesia",
  NL: "Netherlands",
  RU: "Russia",
  BR: "Brazil",
  IT: "Italy",
  ES: "Spain",
  SE: "Sweden",
  NO: "Norway",
  FI: "Finland",
  DK: "Denmark",
  NZ: "New Zealand",
  IE: "Ireland",
  CH: "Switzerland",
  AT: "Austria",
  BE: "Belgium",
  PL: "Poland",
  MX: "Mexico",
  AE: "United Arab Emirates",
  TR: "Turkey",
  PT: "Portugal",
  IL: "Israel",
};

const SOURCE_NAMES: Record<string, string> = {
  direct: "Direct",
  google: "Google",
  baidu: "Baidu",
  bing: "Bing",
};

export function countryLabel(code: string): string {
  if (!code) return "";
  const upper = code.toUpperCase();
  return COUNTRY_NAMES[upper] ?? upper;
}

export function regionLabel(country: string, city: string): string {
  const countryName = countryLabel(country);
  if (city && countryName) return `${city} · ${countryName}`;
  return city || countryName || "—";
}

export function sourceLabel(source: string): string {
  if (!source) return "Direct";
  return SOURCE_NAMES[source] ?? source;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function unit(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 1000) return "less than 1 second";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return unit(seconds, "second", "seconds");
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) {
    const minuteLabel = unit(minutes, "minute", "minutes");
    return rest ? `${minuteLabel} ${unit(rest, "second", "seconds")}` : minuteLabel;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours >= 24) {
    const tenths = Math.round((seconds / (24 * 60 * 60)) * 10);
    const shown = tenths % 10 === 0 ? String(tenths / 10) : (tenths / 10).toFixed(1);
    return `${shown} ${tenths === 10 ? "day" : "days"}`;
  }
  const hourLabel = unit(hours, "hour", "hours");
  return restMinutes ? `${hourLabel} ${unit(restMinutes, "minute", "minutes")}` : hourLabel;
}

export function formatSpan(firstIso: string, lastIso: string): string {
  const ms = new Date(lastIso).getTime() - new Date(firstIso).getTime();
  if (!Number.isFinite(ms) || ms < 1000) return "less than 1 second";
  return formatDuration(ms);
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}
