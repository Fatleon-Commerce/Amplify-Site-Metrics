import Link from "next/link";

export function PageFilters({
  action,
  hidden,
  range,
}: {
  action: string;
  hidden?: Record<string, string>;
  range: { mode: "day" | "week"; from: string; today: string; yesterday: string };
}) {
  const linkClass = (active: boolean) => (active ? "button path-btn" : "button secondary path-btn");
  const href = (extra: Record<string, string> = {}) => {
    const query = new URLSearchParams({ ...hidden, ...extra }).toString();
    return query ? `${action}?${query}` : action;
  };

  return (
    <form className="filters" action={action} method="get">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input
        key={`${range.mode}-${range.from}`}
        type="date"
        name="date"
        defaultValue={range.mode === "day" ? range.from : range.today}
        aria-label="Date"
      />
      <button className="secondary" type="submit">
        Show day
      </button>
      <Link className={linkClass(range.mode === "day" && range.from === range.today)} href={href()}>
        Today
      </Link>
      <Link
        className={linkClass(range.mode === "day" && range.from === range.yesterday)}
        href={href({ date: range.yesterday })}
      >
        Yesterday
      </Link>
      <Link className={linkClass(range.mode === "week")} href={href({ range: "7" })}>
        Last 7 days
      </Link>
    </form>
  );
}
