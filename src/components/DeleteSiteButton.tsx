"use client";

import { useState } from "react";

export function DeleteSiteButton({ siteKey }: { siteKey: string }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      className="danger"
      disabled={pending}
      onClick={async () => {
        if (!window.confirm("Delete this site? Recorded visits will disappear from the admin.")) return;
        setPending(true);
        const response = await fetch(`/api/admin/sites/${siteKey}`, { method: "DELETE" });
        if (response.status === 401) {
          window.location.href = "/admin/login";
          return;
        }
        if (!response.ok) {
          setPending(false);
          window.alert("Could not delete the site");
          return;
        }
        window.location.href = "/admin";
      }}
    >
      {pending ? "Deleting…" : "Delete site"}
    </button>
  );
}
