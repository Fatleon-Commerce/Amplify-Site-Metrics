export function isBot(userAgent: string): boolean {
  return /bot|spider|crawl|headless|slurp|bingpreview|facebookexternalhit/i.test(userAgent);
}

export function parseDevice(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Version\/[\d.]+.*Safari\//.test(userAgent)
          ? "Safari"
          : "Browser";

  const os = /iPhone|iPad|iPod/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Mac OS X/.test(userAgent)
        ? "macOS"
        : /Windows/.test(userAgent)
          ? "Windows"
          : "Other";

  if (!userAgent) return "—";
  return `${os} · ${browser}`;
}

export function trafficSource(referrer: string): string {
  if (!referrer) return "direct";
  let host = "";
  try {
    host = new URL(referrer).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "direct";
  }
  if (!host) return "direct";
  if (host === "google.com" || host.endsWith(".google.com") || /^google\.[a-z.]+$/.test(host)) {
    return "google";
  }
  if (host === "baidu.com" || host.endsWith(".baidu.com")) return "baidu";
  if (host === "bing.com" || host.endsWith(".bing.com")) return "bing";
  return host;
}

export function clampOccurredAt(value: string, now: Date): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return now.toISOString();
  const skew = parsed.getTime() - now.getTime();
  if (skew > 5 * 60 * 1000 || skew < -24 * 60 * 60 * 1000) return now.toISOString();
  return parsed.toISOString();
}
