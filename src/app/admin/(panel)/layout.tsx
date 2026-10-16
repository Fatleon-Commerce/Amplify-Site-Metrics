import { AdminHeader } from "@/components/AdminHeader";
import { AutoRefresh } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminHeader />
      <AutoRefresh />
      <div className="page">{children}</div>
    </>
  );
}
