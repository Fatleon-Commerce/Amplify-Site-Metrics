import { VISIT_GAP_MS } from "./constants";
import { formatDuration } from "./format";
import type { EventRecord } from "../server/metrics/types";

export type TimelineRow =
  | { kind: "gap"; label: string }
  | { kind: "page"; event: EventRecord; durationLabel: string; current: boolean };

export function buildTimeline(events: EventRecord[], now = Date.now()): TimelineRow[] {
  const sorted = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const rows: TimelineRow[] = [];

  sorted.forEach((event, index) => {
    const previous = sorted[index - 1];
    if (previous) {
      const gap = new Date(event.occurredAt).getTime() - new Date(previous.occurredAt).getTime();
      if (gap > VISIT_GAP_MS) {
        rows.push({ kind: "gap", label: `Gap of ${formatDuration(gap)}` });
      }
    }

    const next = sorted[index + 1];
    let durationLabel = "—";
    let current = false;
    if (event.durationMs >= 0) {
      durationLabel = `Stayed ${formatDuration(event.durationMs)}`;
    } else if (next) {
      const gap = new Date(next.occurredAt).getTime() - new Date(event.occurredAt).getTime();
      if (gap >= 0 && gap <= VISIT_GAP_MS) {
        durationLabel = `Stayed ${formatDuration(gap)}`;
      }
    } else if (now - new Date(event.occurredAt).getTime() < 2 * 60 * 1000) {
      durationLabel = "Current page";
      current = true;
    }

    rows.push({ kind: "page", event, durationLabel, current });
  });

  return rows;
}
