"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SiteOrderButtons({
  siteKey,
  index,
  count,
}: {
  siteKey: string;
  index: number;
  count: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function move(direction: "up" | "down") {
    setPending(true);
    const response = await fetch("/api/admin/sites/order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ siteKey, direction }),
    });
    if (response.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    if (!response.ok) {
      setPending(false);
      window.alert("Could not move the site");
      return;
    }
    router.refresh();
    setPending(false);
  }

  return (
    <div className="order-actions">
      <button
        type="button"
        className="order-up"
        aria-label="Move up"
        disabled={pending || index === 0}
        onClick={() => move("up")}
      >
        <Arrow direction="up" />
      </button>
      <button
        type="button"
        className="order-down"
        aria-label="Move down"
        disabled={pending || index === count - 1}
        onClick={() => move("down")}
      >
        <Arrow direction="down" />
      </button>
    </div>
  );
}

function Arrow({ direction }: { direction: "up" | "down" }) {
  const up = direction === "up";
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d={up ? "M8 3.2 3.4 8.2M8 3.2l4.6 5M8 3.2V12.8" : "M8 12.8 3.4 7.8M8 12.8l4.6-5M8 12.8V3.2"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
