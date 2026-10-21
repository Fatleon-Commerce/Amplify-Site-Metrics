import type { CountMap, PageDayDelta, PageDayRecord, PageSlice } from "./types";

export function blankPageDay(siteKey: string, date: string, path: string, ttl: number): PageDayRecord {
  return {
    siteKey,
    date,
    path,
    pageviews: 0,
    visitors: 0,
    entrances: 0,
    durationMs: 0,
    durationCount: 0,
    sources: {},
    devices: {},
    countries: {},
    ttl,
  };
}

export function bucketKey(raw: string): string {
  const cleaned = raw.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 80);
  return cleaned || "unknown";
}

export function addCount(map: CountMap, key: string, amount = 1): void {
  if (!Number.isFinite(amount) || amount === 0) return;
  const name = bucketKey(key);
  map[name] = (map[name] ?? 0) + amount;
}

export function mergeCounts(target: CountMap, extra: CountMap | undefined): void {
  if (!extra) return;
  for (const [key, value] of Object.entries(extra)) addCount(target, key, value);
}

export function applyPageDelta(page: PageDayRecord, delta: PageDayDelta, ttl?: number): void {
  page.sources ??= {};
  page.devices ??= {};
  page.countries ??= {};
  page.pageviews = (page.pageviews ?? 0) + (delta.pageviews ?? 0);
  page.visitors = (page.visitors ?? 0) + (delta.visitors ?? 0);
  page.entrances = (page.entrances ?? 0) + (delta.entrances ?? 0);
  page.durationMs = (page.durationMs ?? 0) + (delta.durationMs ?? 0);
  page.durationCount = (page.durationCount ?? 0) + (delta.durationCount ?? 0);
  mergeCounts(page.sources, delta.sources);
  mergeCounts(page.devices, delta.devices);
  mergeCounts(page.countries, delta.countries);
  if (ttl) page.ttl = ttl;
}

export function touchPageDay(
  pages: PageDayRecord[],
  siteKey: string,
  date: string,
  path: string,
  delta: PageDayDelta,
  ttl: number,
): void {
  let current = pages.find((page) => page.siteKey === siteKey && page.date === date && page.path === path);
  if (!current) {
    current = blankPageDay(siteKey, date, path, ttl);
    pages.push(current);
  }
  applyPageDelta(current, delta, ttl);
}

export function slices(map: CountMap | undefined): PageSlice[] {
  return Object.entries(map ?? {})
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
