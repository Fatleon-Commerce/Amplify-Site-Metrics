"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { VisitorNote } from "./VisitorNote";

export type VisitorView = {
  visitorId: string;
  shortId: string;
  firstSeen: string;
  lastSeen: string;
  spanLabel: string;
  stayLabel: string;
  visitCount: number;
  pageCount: number;
  device: string;
  region: string;
  locale: string;
  source: string;
  landingPath: string;
  href: string;
  siteKey: string;
  note: string;
  mark: string;
};

function landingLabel(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

export function VisitorTable({ visitors }: { visitors: VisitorView[] }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const sources = useMemo(
    () => Array.from(new Set(visitors.map((visitor) => visitor.source))).sort(),
    [visitors],
  );
  const filtered = visitors.filter((visitor) => {
    if (source && visitor.source !== source) return false;
    const haystack = [
      visitor.visitorId,
      visitor.device,
      visitor.region,
      visitor.source,
      visitor.landingPath,
      visitor.locale,
      visitor.note,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div className="card">
      <div className="filters">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search visitor, device, region, or path"
          aria-label="Search visitors"
        />
        <select value={source} onChange={(event) => setSource(event.target.value)} aria-label="Source">
          <option value="">All sources</option>
          {sources.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <span className="muted">
          {filtered.length} / {visitors.length} visitors
        </span>
      </div>
      <div className="table-wrap">
        <table className="visitors">
          <thead>
            <tr>
              <th>Visitor</th>
              <th>First seen</th>
              <th>Activity</th>
              <th>Origin</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visitors.length === 0 ? (
              <tr>
                <td colSpan={6}>No visits yet. Add the script to a page, then refresh.</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>No visitors match this filter.</td>
              </tr>
            ) : (
              filtered.map((visitor) => (
                <tr key={visitor.visitorId}>
                  <td className="mono" title={visitor.visitorId}>
                    {visitor.shortId}
                  </td>
                  <td>
                    {visitor.firstSeen}
                    <span className="sub">Last seen {visitor.lastSeen}</span>
                  </td>
                  <td className="activity">
                    {visitor.spanLabel}
                    <span className="sub">
                      {visitor.stayLabel} on site · {visitor.visitCount}{" "}
                      {visitor.visitCount === 1 ? "visit" : "visits"} · {visitor.pageCount}{" "}
                      {visitor.pageCount === 1 ? "pageview" : "pageviews"}
                    </span>
                  </td>
                  <td className="origin">
                    {visitor.region} · {visitor.device}
                    <span className="sub" title={`${visitor.source} · ${landingLabel(visitor.landingPath)}`}>
                      {visitor.source} · {landingLabel(visitor.landingPath)}
                    </span>
                  </td>
                  <td className="note-cell">
                    <VisitorNote
                      siteKey={visitor.siteKey}
                      visitorId={visitor.visitorId}
                      note={visitor.note}
                      mark={visitor.mark}
                    />
                  </td>
                  <td>
                    <Link href={visitor.href} className="button secondary path-btn">
                      Path
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
