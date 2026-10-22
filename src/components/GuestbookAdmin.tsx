"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";

type GuestbookMessage = {
  messageId: string;
  name: string;
  email?: string;
  body: string;
  createdAt: string;
  ip: string;
};

export function GuestbookAdmin({
  siteKey,
  enabled,
  messages,
}: {
  siteKey: string;
  enabled: boolean;
  messages: GuestbookMessage[];
}) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [rows, setRows] = useState(messages);
  const [pending, setPending] = useState(false);
  const [pendingId, setPendingId] = useState("");

  useEffect(() => {
    setOn(enabled);
  }, [enabled]);

  useEffect(() => {
    setRows(messages);
  }, [messages]);

  return (
    <section className="card guestbook">
      <div className="spread section-head">
        <h2>Guestbook</h2>
        <div className="guestbook-toggle">
          <span className="guestbook-state">{on ? "On" : "Off"}</span>
          <button
            type="button"
            className={on ? "secondary" : undefined}
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const response = await fetch(`/api/admin/sites/${siteKey}/board`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ enabled: !on }),
              });
              if (response.status === 401) {
                window.location.href = "/admin/login";
                return;
              }
              if (!response.ok) {
                setPending(false);
                window.alert("Could not update the guestbook");
                return;
              }
              setOn(!on);
              setPending(false);
              router.refresh();
            }}
          >
            {pending ? "Saving…" : on ? "Turn off" : "Turn on"}
          </button>
        </div>
      </div>
      <p className="muted">
        Hidden until you turn it on. Visitors then see a button at the bottom-right and open the board themselves. The
        button shows up within a minute. Messages stay until you delete them.
      </p>
      {rows.length === 0 ? (
        <p className="muted">No messages yet.</p>
      ) : (
        <ul className="board-list">
          {rows.map((message) => (
            <li key={message.messageId}>
              <div className="spread board-row">
                <div>
                  <strong>{message.name || "Anonymous"}</strong>
                  <span className="muted"> {formatDateTime(message.createdAt)}</span>
                  {message.email ? <span className="board-email">{message.email}</span> : null}
                  {message.ip ? <span className="sub mono">{message.ip}</span> : null}
                </div>
                <button
                  type="button"
                  className="danger tiny"
                  disabled={pendingId === message.messageId}
                  onClick={async () => {
                    if (!window.confirm("Delete this message?")) return;
                    setPendingId(message.messageId);
                    const response = await fetch(`/api/admin/sites/${siteKey}/board/${message.messageId}`, {
                      method: "DELETE",
                    });
                    if (response.status === 401) {
                      window.location.href = "/admin/login";
                      return;
                    }
                    if (!response.ok) {
                      setPendingId("");
                      window.alert("Could not delete the message");
                      return;
                    }
                    setRows((current) => current.filter((item) => item.messageId !== message.messageId));
                    setPendingId("");
                    router.refresh();
                  }}
                >
                  {pendingId === message.messageId ? "Deleting…" : "Delete"}
                </button>
              </div>
              <p className="board-body">{message.body}</p>
            </li>
          ))}
        </ul>
      )}
      {rows.length === 50 ? <p className="muted">Showing the latest 50.</p> : null}
    </section>
  );
}
