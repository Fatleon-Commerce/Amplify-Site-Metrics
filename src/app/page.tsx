import Link from "next/link";
import { RepoLink } from "@/components/RepoLink";

export default function HomePage() {
  return (
    <>
      <main className="wrap home">
        <h1>Site metrics</h1>
        <p className="lede">Add one script to a page to see visitors and the pages they view.</p>
        <p>
          <Link className="button" href="/admin">
            Open admin
          </Link>
        </p>
      </main>
      <footer className="site-footer">
        <RepoLink />
      </footer>
    </>
  );
}
