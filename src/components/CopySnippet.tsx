"use client";

import { useState } from "react";

export function CopySnippet({ snippet }: { snippet: string }) {
  const [done, setDone] = useState(false);

  return (
    <div className="snippet">
      <code>{snippet}</code>
      <button
        type="button"
        className="secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(snippet);
          setDone(true);
        }}
      >
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
