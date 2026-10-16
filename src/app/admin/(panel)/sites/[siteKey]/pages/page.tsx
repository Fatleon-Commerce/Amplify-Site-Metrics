import Link from "next/link";
import { notFound } from "next/navigation";
import { dayKey, isDayKey, isSiteKey, recentDayKeys } from "@/server/metrics/ids";
import { requireAdmin } from "@/server/http";

export const dynamic = "force-dynamic";

function pageLabel(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function selectedRange(search: { date?: string; range?: string }, now = new Date()) {
  const days = recentDayKeys(7, now);
  const today = days[days.length - 1] ?? dayKey(now);
  const yesterday = days[days.length - 2] ?? today;
  if (search.range === "7") {
    return { from: days[0] ?? today, to: today, mode: "week" as const, today, yesterday };
  }
  const date = search.date && isDayKey(search.date) ? search.date : today;
  return { from: date, to: date, mode: "day" as const, today, yesterday };
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
  const linkClass = (active: boolean) => (active ? "button path-btn" : "button secondary path-btn");

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
      <p className="muted page-note">The query string is not counted separately.</p>
      <form className="filters" action={base} method="get">
        <input
          key={`${range.mode}-${range.from}`}
          type="date"
          name="date"
          defaultValue={range.mode === "day" ? range.from : range.today}
          aria-label="Date"
        />
        <button className="secondary" type="submit">
          Show day
        </button>
        <Link className={linkClass(range.mode === "day" && range.from === range.today)} href={base}>
          Today
        </Link>
        <Link
          className={linkClass(range.mode === "day" && range.from === range.yesterday)}
          href={`${base}?date=${range.yesterday}`}
        >
          Yesterday
        </Link>
        <Link className={linkClass(range.mode === "week")} href={`${base}?range=7`}>
          Last 7 days
        </Link>
      </form>
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
                  <th>Pageviews</th>
                </tr>
              </thead>
              <tbody>
                {report.pages.map((page) => (
                  <tr key={page.path}>
                    <td>{pageLabel(page.path)}</td>
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
