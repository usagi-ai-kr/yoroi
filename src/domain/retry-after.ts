function httpDate(raw: string, nowMs: number): string {
  const obsolete = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\d{2})-(\w{3})-(\d{2}) (\d{2}:\d{2}:\d{2}) GMT$/.exec(raw);
  if (obsolete) {
    const yearNow = new Date(nowMs).getUTCFullYear();
    const horizon = new Date(nowMs); horizon.setUTCFullYear(yearNow + 50);
    let year = Math.floor(horizon.getUTCFullYear() / 100) * 100 + Number(obsolete[4]);
    const candidate = `${obsolete[2]} ${obsolete[3]} ${year} ${obsolete[5]} GMT`;
    if (Date.parse(candidate) > horizon.getTime()) year -= 100;
    return `${obsolete[1]!.slice(0, 3)}, ${obsolete[2]} ${obsolete[3]} ${year} ${obsolete[5]} GMT`;
  }
  const asctime = /^(\w{3}) (\w{3}) ( [1-9]|\d{2}) (\d{2}:\d{2}:\d{2}) (\d{4})$/.exec(raw);
  return asctime ? `${asctime[1]}, ${asctime[3]!.trim().padStart(2, '0')} ${asctime[2]} ${asctime[5]} ${asctime[4]} GMT` : raw;
}
/** Seconds or HTTP-date (including obsolete formats). Invalid/absent values use fallback.
 * Pure: past dates mean zero delay; oversized valid delays mean Infinity, never a short retry. */
export function parseRetryAfter(value: string | undefined, nowMs: number): number | undefined {
  if (value === undefined || !Number.isSafeInteger(nowMs)) return undefined;
  const raw = httpDate(value.trim(), nowMs);
  if (/^\d+$/.test(raw)) {
    const ms = Number(raw) * 1000;
    return Number.isSafeInteger(ms) ? ms : Infinity;
  }
  if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(raw)) return undefined;
  const date = Date.parse(raw);
  if (!Number.isFinite(date) || new Date(date).toUTCString() !== raw) return undefined;
  const delay = Math.max(0, date - nowMs);
  return Number.isSafeInteger(delay) ? delay : undefined;
}
