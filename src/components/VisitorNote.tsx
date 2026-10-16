"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MARKS = [
  { id: "valid", label: "Valid" },
  { id: "review", label: "Review" },
  { id: "invalid", label: "Invalid" },
] as const;

type MarkId = (typeof MARKS)[number]["id"];

function knownMark(value: string): MarkId | "" {
  return MARKS.some((mark) => mark.id === value) ? (value as MarkId) : "";
}

export function VisitorNote({
  siteKey,
  visitorId,
  note,
  mark,
}: {
  siteKey: string;
  visitorId: string;
  note: string;
  mark: string;
}) {
  const router = useRouter();
  const current = knownMark(mark);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note);
  const [picked, setPicked] = useState<MarkId | "">(current);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const text = note.trim();

  function openEditor() {
    setDraft(note);
    setPicked(current);
    setError("");
    setOpen(true);
  }

  async function save() {
    setPending(true);
    setError("");
    const response = await fetch(`/api/admin/sites/${siteKey}/visitors/${visitorId}/note`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: draft, mark: picked }),
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

  const buttonClass = ["note-btn", text ? "has-note" : "", current ? `mark-${current}` : ""].filter(Boolean).join(" ");

  return (
    <>
      <button type="button" className={buttonClass} onClick={openEditor}>
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
            <div className="marks" role="group" aria-label="Visitor mark">
              {MARKS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={picked === item.id ? `mark-choice mark-${item.id} selected` : `mark-choice mark-${item.id}`}
                  aria-pressed={picked === item.id}
                  onClick={() => setPicked(picked === item.id ? "" : item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <textarea
              value={draft}
              maxLength={500}
              rows={5}
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
