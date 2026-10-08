/** 소수점 둘째 자리까지 올림한다. toPrecision으로 부동소수점 오차(1.1*100)를 먼저 제거한다. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  return String(Math.ceil(Number((n * 100).toPrecision(12))) / 100);
}

const MINUTE_MS = 60_000;

/**
 * 리셋까지 남은 시간을 큰 단위 2개로 보여준다(예: "6d 18h", "3h 5m").
 * 1시간 미만이면 분만 보여준다. 남은 초는 분으로 올림하고 지난 리셋은 "0m"이다.
 */
export function formatTimeLeft(resetAt: string | undefined, now: string | Date): string | undefined {
  if (!resetAt) return undefined;
  const end = new Date(resetAt).getTime();
  const start = new Date(now).getTime();
  if (Number.isNaN(end) || Number.isNaN(start)) return undefined;
  const minutes = Math.max(0, Math.ceil((end - start) / MINUTE_MS));
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
