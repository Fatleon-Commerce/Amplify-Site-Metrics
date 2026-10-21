import Link from "next/link";
import { notFound } from "next/navigation";
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
      <p className="muted page-note">The query string is not counted separately. Open a path for sources and devices.</p>
      <PageFilters action={base} range={range} />
      <section className="card">
        <h2>{heading}</h2>
        {report.pages.length === 0 ? (
          <p className="muted">No pageviews for this period.</p>
        ) : (
          <div className="table-wrap">
            <table className="pages">
              <thead>
                <tr>
                  <th>Path</th>
                  <th>Visitors</th>
                  <th>Pageviews</th>
                </tr>
              </thead>
              <tbody>
                {report.pages.map((page) => (
                  <tr key={page.path}>
                    <td>
                      <Link href={pageDetailHref(report.site.siteKey, page.path, range)}>{pageLabel(page.path)}</Link>
                    </td>
                    <td>{page.visitors > 0 ? page.visitors : "—"}</td>
                    <td>{page.pageviews}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
