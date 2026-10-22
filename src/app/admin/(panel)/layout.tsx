import { AdminHeader } from "@/components/AdminHeader";
import { AutoRefresh } from "@/components/AutoRefresh";
import { RepoLink } from "@/components/RepoLink";

export const dynamic = "force-dynamic";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminHeader />
      <AutoRefresh />
      <div className="page">{children}</div>
      <footer className="site-footer">
        <RepoLink />
      </footer>
    </>
  );
}
