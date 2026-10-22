import Link from "next/link";
import { notFound } from "next/navigation";
import { CopySnippet } from "@/components/CopySnippet";
import { DeleteSiteButton } from "@/components/DeleteSiteButton";
import { GuestbookAdmin } from "@/components/GuestbookAdmin";
import { VisitorTable, type VisitorView } from "@/components/VisitorTable";
import { EVENT_TTL_DAYS } from "@/lib/constants";
import { formatDateTime, formatDuration, formatSpan, regionLabel, shortId, sourceLabel } from "@/lib/format";
import { isSiteKey } from "@/server/metrics/ids";
import { publicOrigin, requireAdmin } from "@/server/http";

export const dynamic = "force-dynamic";

export default async function SitePage({
  params,
  searchParams,
}: {
  params: { siteKey: string };
  searchParams: { created?: string };
}) {
  if (!isSiteKey(params.siteKey)) notFound();
  const { token, backend } = await requireAdmin();
  const [overview, visitors, messages] = await Promise.all([
    backend.overview(token, params.siteKey),
    backend.visitors(token, params.siteKey),
    backend.boardMessages(token, params.siteKey),
  ]);
  if (!overview || !visitors || !messages) notFound();

  const origin = publicOrigin();
  const snippet = `<script defer src="${origin}/${overview.site.siteKey}.js"></script>`;
  const max = Math.max(1, ...overview.days.map((day) => day.pageviews));
  const rows: VisitorView[] = visitors.map((visitor) => ({
    visitorId: visitor.visitorId,
    shortId: shortId(visitor.visitorId),
    firstSeen: formatDateTime(visitor.firstSeenAt),
    lastSeen: formatDateTime(visitor.lastSeenAt),
    spanLabel: formatSpan(visitor.firstSeenAt, visitor.lastSeenAt),
    stayLabel: visitor.activeMs > 0 ? formatDuration(visitor.activeMs) : "—",
    visitCount: visitor.visitCount,
    pageCount: visitor.pageCount,
    device: visitor.device || "—",
    region: regionLabel(visitor.country, visitor.city),
    locale: visitor.locale || "—",
    source: sourceLabel(visitor.trafficSource),
    landingPath: visitor.landingPath || "/",
    href: `/admin/sites/${overview.site.siteKey}/visitors/${visitor.visitorId}`,
    siteKey: overview.site.siteKey,
    note: visitor.note ?? "",
    mark: visitor.mark ?? "",
  }));
  const daily = [...overview.days].reverse();

  return (
    <main className="wrap">
      <header className="site-head">
        <p className="crumb">
          <Link href="/admin">Sites</Link>
          <span aria-hidden="true">/</span>
          {overview.site.name}
        </p>
        <div className="spread">
          <h1>{overview.site.name}</h1>
          <DeleteSiteButton siteKey={overview.site.siteKey} />
        </div>
        {searchParams.created ? <div className="banner">Site created. Paste the script below before &lt;/body&gt;.</div> : null}
        <section className="install">
          <div className="install-label">
            <span>Tracking script</span>
            <span className="muted">Paste before &lt;/body&gt;</span>
          </div>
          <CopySnippet snippet={snippet} />
          <p className="install-links">
            <a href={`/preview.html?site=${overview.site.siteKey}`} target="_blank" rel="noreferrer">
              Open test page
            </a>
            <span className="muted">Raw visits are kept for {EVENT_TTL_DAYS} days</span>
          </p>
        </section>
      </header>
      <GuestbookAdmin
        siteKey={overview.site.siteKey}
        enabled={overview.site.guestbookEnabled === true}
        messages={messages}
      />
      <section className="stats">
        <div className="card stat">
          <b>{overview.todayPageviews}</b>
          <span>Pageviews today</span>
        </div>
        <div className="card stat">
          <b>{overview.todayUniques}</b>
          <span>Visitors today</span>
        </div>
        <div className="card stat">
          <b>{overview.last7Pageviews}</b>
          <span>Pageviews, last 7 days</span>
        </div>
      </section>
      <section className="card">
        <div className="spread section-head">
          <h2>Daily summary</h2>
          <Link href={`/admin/sites/${overview.site.siteKey}/pages`} className="button">
            View detail
          </Link>
        </div>
        <div className="summary-grid">
          <div className="bars" aria-label="Pageviews, last 7 days">
            {overview.days.map((day) => (
              <div className="bar" key={day.date}>
                <span>{day.pageviews}</span>
                <div className="bar-fill" style={{ height: `${Math.max(4, (day.pageviews / max) * 72)}px` }} />
                <em>{day.date.slice(5)}</em>
              </div>
            ))}
          </div>
          <div className="table-wrap">
            <table className="daily">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Visitors</th>
                  <th>Pageviews</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((day) => (
                  <tr key={day.date}>
                    <td>{day.date}</td>
                    <td>{day.uniques}</td>
                    <td>{day.pageviews}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <VisitorTable visitors={rows} />
    </main>
  );
}
