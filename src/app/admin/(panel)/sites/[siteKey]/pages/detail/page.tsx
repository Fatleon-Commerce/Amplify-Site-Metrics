import Link from "next/link";
import { notFound } from "next/navigation";
import { Breakdown } from "@/components/Breakdown";
import { countryLabel, formatDuration, sourceLabel } from "@/lib/format";
import { isSiteKey } from "@/server/metrics/ids";
import { requireAdmin } from "@/server/http";
import { PageFilters } from "../filters";
import { selectedRange } from "../range";

export const dynamic = "force-dynamic";

function pageLabel(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function named(kind: "source" | "device" | "country", key: string): string {
  if (key === "unknown") return "Unknown";
  if (kind === "source") return sourceLabel(key);
  if (kind === "country") return countryLabel(key) || key;
  return key;
}

function shown(value: number, pageviews: number): string {
  if (value === 0 && pageviews > 0) return "—";
  return String(value);
}

export default async function PageDetailPage({
  params,
  searchParams,
}: {
  params: { siteKey: string };
  searchParams: { path?: string; date?: string; range?: string };
}) {
  if (!isSiteKey(params.siteKey)) notFound();
  const rawPath = searchParams.path ?? "";
  if (!rawPath || rawPath.length > 300) notFound();
  const { token, backend } = await requireAdmin();
  const range = selectedRange(searchParams);
  const report = await backend.pageDetail(token, params.siteKey, rawPath, range.from, range.to);
  if (!report) notFound();

  const base = `/admin/sites/${report.site.siteKey}/pages`;
  const detail = `${base}/detail`;
  const heading = range.mode === "week" ? `${range.from} to ${range.to}` : range.from;
  const stay =
    report.durationCount > 0 ? formatDuration(report.durationMs / report.durationCount) : "—";
  const max = Math.max(1, ...report.days.map((day) => day.pageviews));
  const legacy = report.pageviews > 0 && report.visitors === 0;

  return (
    <main className="wrap">
      <p className="crumb">
        <Link href="/admin">Sites</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/admin/sites/${report.site.siteKey}`}>{report.site.name}</Link>
        <span aria-hidden="true">/</span>
        <Link href={base}>Pages</Link>
        <span aria-hidden="true">/</span>
        <span className="crumb-path">{pageLabel(report.path)}</span>
      </p>
      <h1 className="page-path">{pageLabel(report.path)}</h1>
      <p className="muted page-note">
        Each person is counted once on this page per day. Source is the site they came from on their first visit.
      </p>
      <PageFilters action={detail} hidden={{ path: report.path }} range={range} />
      <section className="stats quad">
        <div className="card stat">
          <b>{report.pageviews}</b>
          <span>Pageviews</span>
        </div>
        <div className="card stat">
          <b>{shown(report.visitors, report.pageviews)}</b>
          <span>Visitors</span>
        </div>
        <div className="card stat">
          <b>{report.entrances}</b>
          <span>Entrances</span>
        </div>
        <div className="card stat">
          <b className="stat-text">{stay}</b>
          <span>Average stay</span>
        </div>
      </section>
      {legacy ? (
        <p className="muted">
          These pageviews were recorded before source, device, and country were stored, so the charts are empty.
        </p>
      ) : null}
      <div className="chart-grid">
        <section className="card">
          <h2>Sources</h2>
          <p className="muted chart-note">{heading}</p>
          <Breakdown
            variant="pie"
            slices={report.sources}
            label={(key) => named("source", key)}
            empty="No source data for this period."
          />
        </section>
        <div>
          <section className="card">
            <h2>Devices</h2>
            <Breakdown
              variant="bars"
              slices={report.devices}
              label={(key) => named("device", key)}
              empty="No device data for this period."
            />
          </section>
          <section className="card">
            <h2>Countries</h2>
            <Breakdown
              variant="bars"
              slices={report.countries}
              label={(key) => named("country", key)}
              empty="No country data for this period."
            />
          </section>
        </div>
      </div>
      {report.days.length > 1 ? (
        <section className="card">
          <h2>Pageviews by day</h2>
          <div className="bars" aria-label="Pageviews by day">
            {report.days.map((day) => (
              <div className="bar" key={day.date}>
                <span>{day.pageviews}</span>
                <div className="bar-fill" style={{ height: `${Math.max(4, (day.pageviews / max) * 72)}px` }} />
                <em>{day.date.slice(5)}</em>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
