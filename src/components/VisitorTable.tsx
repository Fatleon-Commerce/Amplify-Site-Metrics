"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
};

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
        <table>
          <thead>
            <tr>
              <th>Visitor</th>
              <th>First seen</th>
              <th>Span</th>
              <th className="hide-sm">Time on site</th>
              <th>Visits</th>
              <th className="hide-sm">Pageviews</th>
              <th>Device</th>
              <th>Region</th>
              <th>Source</th>
              <th>Landing page</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visitors.length === 0 ? (
              <tr>
                <td colSpan={11}>No visits yet. Add the script to a page, then refresh.</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={11}>No visitors match this filter.</td>
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
                  <td>{visitor.spanLabel}</td>
                  <td className="hide-sm">{visitor.stayLabel}</td>
                  <td>{visitor.visitCount}</td>
                  <td className="hide-sm">{visitor.pageCount}</td>
                  <td>{visitor.device}</td>
                  <td>{visitor.region}</td>
                  <td>{visitor.source}</td>
                  <td className="path" title={visitor.landingPath}>
                    {visitor.landingPath}
                  </td>
                  <td>
                    <Link href={visitor.href}>Path</Link>
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
