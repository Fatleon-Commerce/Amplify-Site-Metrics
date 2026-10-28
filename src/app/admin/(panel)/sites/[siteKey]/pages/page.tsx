import Link from "next/link";
import { notFound } from "next/navigation";
import { Breakdown } from "@/components/Breakdown";
import { countryLabel, sourceLabel } from "@/lib/format";
import { isSiteKey } from "@/server/metrics/ids";
import { requireAdmin } from "@/server/http";
import { PageFilters } from "./filters";
import { pageDetailHref, selectedRange } from "./range";

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

export default async function PagesPage({
  params,
  searchParams,
}: {
  params: { siteKey: string };
  searchParams: { date?: string; range?: string };
}) {
  if (!isSiteKey(params.siteKey)) notFound();
  const { token, backend } = await requireAdmin();
  const range = selectedRange(searchParams);
  const report = await backend.pages(token, params.siteKey, range.from, range.to);
  if (!report) notFound();

  const base = `/admin/sites/${report.site.siteKey}/pages`;
  const heading = range.mode === "week" ? `${range.from} to ${range.to}` : range.from;
  const devices = report.devices ?? [];
  const sources = report.sources ?? [];
  const countries = report.countries ?? [];
  const hasMix = devices.length > 0 || sources.length > 0 || countries.length > 0;

  return (
    <main className="wrap">
      <p className="crumb">
        <Link href="/admin">Sites</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/admin/sites/${report.site.siteKey}`}>{report.site.name}</Link>
        <span aria-hidden="true">/</span>
        Pages
      </p>
      <h1>Pages</h1>
      <p className="muted page-note">
        The query string is not counted separately. Totals count a person once on each page per day. View detail opens that page alone.
      </p>
      <PageFilters action={base} range={range} />
      {report.pages.length > 0 && !hasMix ? (
        <p className="muted">Device, source, and country totals start with visits recorded after this breakdown was added.</p>
      ) : null}
      {hasMix ? (
        <div className="chart-grid">
          <section className="card">
            <h2>Devices</h2>
            <p className="muted chart-note">{heading}</p>
            <Breakdown
              variant="bars"
              slices={devices}
              label={(key) => named("device", key)}
              empty="No device data for this period."
            />
          </section>
          <div>
            <section className="card">
              <h2>Sources</h2>
              <Breakdown
                variant="pie"
                slices={sources}
                label={(key) => named("source", key)}
                empty="No source data for this period."
              />
            </section>
            <section className="card">
              <h2>Countries</h2>
              <Breakdown
                variant="bars"
                slices={countries}
                label={(key) => named("country", key)}
                empty="No country data for this period."
              />
            </section>
          </div>
        </div>
      ) : null}
      <section className="card">
        <h2>{heading}</h2>
        {report.pages.length === 0 ? (
          <p className="muted">No pageviews for this period.</p>
        ) : (
          <div className="table-wrap">
            <div className="table-wide">
            <table className="pages">
              <thead>
                <tr>
                  <th>Path</th>
                  <th>Visitors</th>
                  <th>Pageviews</th>
                  <th className="detail-cell">
                    <span className="sr-only">Detail</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.pages.map((page) => (
                  <tr key={page.path}>
                    <td>{pageLabel(page.path)}</td>
                    <td>{page.visitors > 0 ? page.visitors : "—"}</td>
                    <td>{page.pageviews}</td>
                    <td className="detail-cell">
                      <Link href={pageDetailHref(report.site.siteKey, page.path, range)} className="button secondary">
                        View detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
