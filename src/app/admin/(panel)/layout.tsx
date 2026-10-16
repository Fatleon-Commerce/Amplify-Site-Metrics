import { AdminHeader } from "@/components/AdminHeader";

export const dynamic = "force-dynamic";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminHeader />
      <div className="page">{children}</div>
    </>
  );
}
