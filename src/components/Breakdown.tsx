const PALETTE = ["#0b57d0", "#137333", "#b06000", "#6941c6", "#0e7490", "#b42318", "#475467", "#98a2b3"];

type Slice = { key: string; count: number };

function ranked(slices: Slice[], label: (key: string) => string, limit = 7) {
  const rows = slices
    .filter((slice) => slice.count > 0)
    .map((slice) => ({ key: slice.key, name: label(slice.key), count: slice.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const head = rows.slice(0, limit);
  const rest = rows.slice(limit).reduce((sum, row) => sum + row.count, 0);
  if (rest > 0) head.push({ key: "__other", name: "Other", count: rest });
  return head;
}

function percent(count: number, total: number): string {
  if (total <= 0) return "0%";
  const value = (count / total) * 100;
  if (value > 0 && value < 10) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
}

function wedge(cx: number, cy: number, radius: number, start: number, end: number): string {
  const large = end - start > Math.PI ? 1 : 0;
  const x1 = cx + radius * Math.cos(start);
  const y1 = cy + radius * Math.sin(start);
  const x2 = cx + radius * Math.cos(end);
  const y2 = cy + radius * Math.sin(end);
  return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

export function Breakdown({
  slices,
  label,
  variant,
  empty,
}: {
  slices: Slice[];
  label: (key: string) => string;
  variant: "pie" | "bars";
  empty: string;
}) {
  const rows = ranked(slices, label);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (total <= 0) return <p className="muted">{empty}</p>;

  if (variant === "bars") {
    const max = Math.max(...rows.map((row) => row.count));
    return (
      <div className="mix">
        {rows.map((row, index) => (
          <div className="mix-row" key={row.key}>
            <span className="mix-label" title={row.name}>
              <i className="swatch" style={{ background: PALETTE[index % PALETTE.length] }} />
              {row.name}
            </span>
            <b>
              {row.count} <span className="pct">{percent(row.count, total)}</span>
            </b>
            <div className="mix-track">
              <div
                className="mix-fill"
                style={{
                  width: `${Math.max(4, (row.count / max) * 100)}%`,
                  background: PALETTE[index % PALETTE.length],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const cx = 84;
  const cy = 84;
  const radius = 72;
  let angle = -Math.PI / 2;
  const summary = rows.map((row) => `${row.name} ${percent(row.count, total)}`).join(", ");

  return (
    <div className="pie-layout">
      <svg className="pie" viewBox="0 0 168 168" role="img" aria-label={summary}>
        {rows.map((row, index) => {
          const sweep = (row.count / total) * Math.PI * 2;
          const start = angle;
          const end = angle + sweep;
          angle = end;
          const color = PALETTE[index % PALETTE.length];
          if (rows.length === 1 || sweep >= Math.PI * 2 - 0.0001) {
            return <circle key={row.key} cx={cx} cy={cy} r={radius} fill={color} />;
          }
          return <path key={row.key} d={wedge(cx, cy, radius, start, end)} fill={color} />;
        })}
      </svg>
      <ul className="pie-legend">
        {rows.map((row, index) => (
          <li key={row.key}>
            <i className="swatch" style={{ background: PALETTE[index % PALETTE.length] }} />
            <span className="pie-name">{row.name}</span>
            <b>{row.count}</b>
            <span className="pct">{percent(row.count, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
