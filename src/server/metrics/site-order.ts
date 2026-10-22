import type { SiteRecord } from "./types";

export function finiteOrder(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function compareSites(a: SiteRecord, b: SiteRecord): number {
  const aOrder = finiteOrder(a.sortOrder);
  const bOrder = finiteOrder(b.sortOrder);
  if (aOrder !== undefined && bOrder !== undefined && aOrder !== bOrder) return aOrder - bOrder;
  if (aOrder !== undefined && bOrder === undefined) return -1;
  if (aOrder === undefined && bOrder !== undefined) return 1;
  const created = b.createdAt.localeCompare(a.createdAt);
  if (created !== 0) return created;
  return a.siteKey.localeCompare(b.siteKey);
}

export function nextSortOrder(sites: Pick<SiteRecord, "sortOrder">[]): number | undefined {
  let min: number | undefined;
  for (const site of sites) {
    const order = finiteOrder(site.sortOrder);
    if (order === undefined) continue;
    min = min === undefined ? order : Math.min(min, order);
  }
  return min === undefined ? undefined : min - 1;
}
