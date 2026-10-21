import { dayKey, isDayKey, recentDayKeys } from "@/server/metrics/ids";

export function selectedRange(search: { date?: string; range?: string }, now = new Date()) {
  const days = recentDayKeys(7, now);
  const today = days[days.length - 1] ?? dayKey(now);
  const yesterday = days[days.length - 2] ?? today;
  if (search.range === "7") {
    return { from: days[0] ?? today, to: today, mode: "week" as const, today, yesterday };
  }
  const date = search.date && isDayKey(search.date) ? search.date : today;
  return { from: date, to: date, mode: "day" as const, today, yesterday };
}

export function pageDetailHref(
  siteKey: string,
  path: string,
  range: { mode: "day" | "week"; from: string; today: string },
): string {
  const query = new URLSearchParams();
  query.set("path", path);
  if (range.mode === "week") query.set("range", "7");
  else if (range.from !== range.today) query.set("date", range.from);
  return `/admin/sites/${siteKey}/pages/detail?${query.toString()}`;
}
