import Link from "next/link";
import { CreateSiteForm } from "@/components/CreateSiteForm";
import { SiteOrderButtons } from "@/components/SiteOrderButtons";
import { requireAdmin, publicOrigin } from "@/server/http";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const { token, backend } = await requireAdmin();
  const sites = await backend.listSites(token);
  const origin = publicOrigin();

  return (
    <main className="wrap">
      <h1>Sites</h1>
      <p className="lede">Each site has its own script. Raw visits are kept for 90 days.</p>
      <CreateSiteForm />
      {sites.length === 0 ? (
        <p className="muted">No sites yet.</p>
      ) : (
        <div className="card table-wrap">
          <div className="table-wide">
          <table className="sites-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Pageviews today</th>
                <th>Visitors today</th>
                <th>Total pageviews</th>
                <th>Script</th>
                <th className="order-cell">
                  <span className="sr-only">Order</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site, index) => (
                <tr key={site.siteKey}>
                  <td>
                    <Link href={`/admin/sites/${site.siteKey}`}>{site.name}</Link>
                    <span className="sub mono">{site.siteKey}</span>
                  </td>
                  <td>{site.todayPageviews}</td>
                  <td>{site.todayUniques}</td>
                  <td>{site.pageviewCount}</td>
                  <td className="mono path" title={`${origin}/${site.siteKey}.js`}>
                    {origin}/{site.siteKey}.js
                  </td>
                  <td className="order-cell">
                    <SiteOrderButtons siteKey={site.siteKey} index={index} count={sites.length} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </main>
  );
}
