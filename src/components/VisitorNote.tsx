"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function VisitorNote({
  siteKey,
  visitorId,
  note,
}: {
  siteKey: string;
  visitorId: string;
  note: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const text = note.trim();

  function openEditor() {
    setDraft(note);
    setError("");
    setOpen(true);
  }

  async function save() {
    setPending(true);
    setError("");
    const response = await fetch(`/api/admin/sites/${siteKey}/visitors/${visitorId}/note`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: draft }),
    });
    if (response.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not save the note");
      setPending(false);
      return;
    }
    setPending(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" className={text ? "note-btn has-note" : "note-btn"} onClick={openEditor}>
        {text ? "Note" : "Add note"}
      </button>
      {text ? (
        <span className="sub note-preview" title={text}>
          {text}
        </span>
      ) : null}
      {open ? (
        <div className="note-backdrop" onClick={() => !pending && setOpen(false)}>
          <form
            className="note-dialog card"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <h2>Visitor note</h2>
            <p className="muted">Only you can see this. It stays on this visitor.</p>
            <textarea
              value={draft}
              maxLength={500}
              rows={5}
              autoFocus
              placeholder="Where they came from, what they asked, or whether to follow up"
              onChange={(event) => setDraft(event.target.value)}
            />
            {error ? <p className="error">{error}</p> : null}
            <div className="row">
              <button type="button" className="secondary" disabled={pending} onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
