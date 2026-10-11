// yoroi-managed: opencode-zen-free v1
export const safeID = value => typeof value === 'string' && /^[\w.-]{1,128}$/.test(value);

export function limitError(error) {
  if (error?.name !== 'APIError') return false;
  const data = error.data;
  try {
    if (typeof data?.responseBody === 'string' && data.responseBody.length <= 65536) {
      const kind = JSON.parse(data.responseBody)?.error?.type;
      if (kind) return kind === 'FreeUsageLimitError';
    }
  } catch {}
  return typeof data?.message === 'string' && data.message.length <= 4096 &&
    /^(?:Free usage exceeded(?:\b|,)|Rate limit exceeded(?:\b|\.|$))/i.test(data.message);
}

export function retryAt(data, now = Date.now()) {
  const headers = Object.fromEntries(Object.entries(data?.responseHeaders ?? {})
    .map(([key, value]) => [key.toLowerCase(), value]));
  const valid = ms => Number.isFinite(ms) && ms > 0 && ms <= 366 * 86400000;
  for (const key of ['retry-after-ms', 'retry-after']) {
    const raw = headers[key];
    if (typeof raw !== 'string' || raw.length >= 128) continue;
    const ms = /^\d+(?:\.\d+)?$/.test(raw) ? Number(raw) * (key === 'retry-after-ms' ? 1 : 1000) :
      key === 'retry-after' ? Date.parse(raw) - now : NaN;
    if (valid(ms)) return new Date(now + ms).toISOString();
  }
  const match = /^Free usage exceeded, retrying in (\d+(?:\.\d+)?)([hms])\s*$/i
    .exec(typeof data?.message === 'string' ? data.message : '');
  const ms = match ? Number(match[1]) * ({ h: 3600000, m: 60000, s: 1000 }[match[2].toLowerCase()]) : NaN;
  return valid(ms) ? new Date(now + ms).toISOString() : undefined;
}
