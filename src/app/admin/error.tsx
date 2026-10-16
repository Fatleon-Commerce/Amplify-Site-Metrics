"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="wrap page">
      <h1>This page failed to load</h1>
      <p className="error">{error.message || "Refresh and try again."}</p>
      <button type="button" onClick={() => reset()}>
        Retry
      </button>
    </main>
  );
}
