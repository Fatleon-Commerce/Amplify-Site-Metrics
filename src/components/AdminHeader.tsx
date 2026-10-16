import Link from "next/link";

export function AdminHeader() {
  return (
    <header className="topbar">
      <div className="wrap">
        <Link href="/admin" className="brand">
          Site metrics
        </Link>
        <nav>
          <Link href="/admin">Sites</Link>
          <form action="/api/admin/logout" method="post">
            <button type="submit" className="secondary">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
