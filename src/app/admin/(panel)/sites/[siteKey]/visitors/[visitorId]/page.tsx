import Link from "next/link";
import { notFound } from "next/navigation";
import { VisitorNote } from "@/components/VisitorNote";
import { formatDateTime, formatSpan, regionLabel, sourceLabel } from "@/lib/format";
import { buildTimeline } from "@/lib/timeline";
import { isClientId, isSiteKey } from "@/server/metrics/ids";
import { requireAdmin } from "@/server/http";

export const dynamic = "force-dynamic";

export default async function VisitorPage({
  params,
}: {
  params: { siteKey: string; visitorId: string };
}) {
  if (!isSiteKey(params.siteKey) || !isClientId(params.visitorId)) notFound();
  const { token, backend } = await requireAdmin();
  const detail = await backend.detail(token, params.siteKey, params.visitorId);
  if (!detail) notFound();

  const rows = buildTimeline(detail.events);
  const visitor = detail.visitor;
  const utm = [visitor.utmSource, visitor.utmMedium, visitor.utmCampaign].filter(Boolean).join(" / ");

  return (
    <main className="wrap">
      <p className="muted">
        <Link href="/admin">Sites</Link> / <Link href={`/admin/sites/${detail.site.siteKey}`}>{detail.site.name}</Link> / Path
      </p>
      <h1 className="mono">{visitor.visitorId}</h1>
      <div className="meta">
        <span>{visitor.device || "—"}</span>
        {visitor.country || visitor.city ? <span>{regionLabel(visitor.country, visitor.city)}</span> : null}
        <span>{sourceLabel(visitor.trafficSource)}</span>
        <span>{visitor.locale || "—"}</span>
        <span>{visitor.visitCount} visits</span>
        <span>{visitor.pageCount} pageviews</span>
        <span>Span {formatSpan(visitor.firstSeenAt, visitor.lastSeenAt)}</span>
        {visitor.ip ? <span>IP {visitor.ip}</span> : null}
      </div>
      <p className="note-line">
        <VisitorNote
          siteKey={detail.site.siteKey}
          visitorId={visitor.visitorId}
          note={visitor.note ?? ""}
          mark={visitor.mark ?? ""}
        />
      </p>
      {visitor.firstReferrer ? <p className="muted">Referrer {visitor.firstReferrer}</p> : null}
      {utm ? <p className="muted">UTM {utm}</p> : null}
      <section className="card timeline">
        {rows.length === 0 ? <p>No page views yet.</p> : null}
        {rows.map((row, index) =>
          row.kind === "gap" ? (
            <div className="gap-row" key={`gap-${index}`}>
              <span />
              <span className="pill gap">{row.label}</span>
              <span />
            </div>
          ) : (
            <div className="time-row" key={row.event.eventId}>
              <time className="muted">{formatDateTime(row.event.occurredAt)}</time>
              <div>
                <div className="mono">{row.event.path}</div>
                {row.event.title ? <span className="sub">{row.event.title}</span> : null}
              </div>
              <span className={row.current ? "pill current" : row.durationLabel === "—" ? "muted" : "pill stay"}>
                {row.durationLabel}
              </span>
            </div>
          ),
        )}
      </section>
    </main>
  );
}
