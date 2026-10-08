import type { UsageWindow } from '../domain/usage.js';

export function ollamaActivityWindows(data: Record<string, unknown>): UsageWindow[] {
  if (!data.totals || typeof data.totals !== 'object' || Array.isArray(data.totals) ||
    typeof data.range !== 'string' || !/^[a-z0-9-]+$/.test(data.range)) throw new Error();
  const totals = data.totals as Record<string, unknown>;
  const metrics = { request_count: 'requests', usage_usd: 'USD', input_tokens: 'tokens',
    cached_input_tokens: 'tokens', output_tokens: 'tokens' };
  const windows: UsageWindow[] = [];
  for (const [name, unit] of Object.entries(metrics)) {
    const value = totals[name];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error();
    windows.push({ id: `activity:${data.range}:${name}`, unit, used: value });
  }
  if (!windows.length) throw new Error();
  return windows;
}
