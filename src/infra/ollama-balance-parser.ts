import { createSnapshot, type UsageWindow } from '../domain/usage.js';
import { SourceError } from '../app/usage-source.js';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  return value as Record<string, unknown>;
}
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error();
  return value;
}
export function parseOllamaBalance(body: string, observedAt: string) {
  try {
    const data = object(JSON.parse(body));
    const included = object(data.included);
    const remaining = number(included.balance_usd);
    const limit = number(included.allowance_usd);
    let window: UsageWindow = { id: 'credits:included', unit: 'USD', remaining, limit };
    if (remaining <= limit) {
      const used = limit - remaining;
      window = { ...window, used, ...(limit > 0 ? { percent: used / limit * 100 } : {}) };
    }
    if (included.period != null) {
      const period = object(included.period);
      if (period.until != null) {
        if (typeof period.until !== 'string') throw new Error();
        window = { ...window, resetAt: period.until };
      }
      if (period.from != null) {
        if (typeof period.from !== 'string') throw new Error();
        window = { ...window, periodStart: period.from };
      }
    }
    const windows: UsageWindow[] = [window];
    if (data.purchased != null) {
      windows.push({ id: 'credits:purchased', unit: 'USD',
        remaining: number(object(data.purchased).balance_usd) });
    }
    return createSnapshot('ollama-pro', observedAt, windows);
  } catch { throw new SourceError('parse'); }
}
