"use client";

import { FormEvent, useState } from "react";

export function CreateSiteForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    const response = await fetch("/api/admin/sites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; siteKey?: string };
    setPending(false);
    if (response.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    if (!response.ok || !body.siteKey) {
      setError(body.error ?? "Could not create the site");
      return;
    }
    window.location.href = `/admin/sites/${body.siteKey}?created=1`;
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <h2>New site</h2>
      <div className="row">
        <input name="name" aria-label="Site name" placeholder="Example: Company website" required maxLength={40} />
        <button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create"}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
}
