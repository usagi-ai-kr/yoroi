import { SourceError } from '../app/usage-source.js';
import { createSnapshot, type UsageWindow } from '../domain/usage.js';
import { ollamaActivityWindows } from './ollama-activity-parser.js';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  return value as Record<string, unknown>;
}
export function parseOllamaUsage(body: string, observedAt: string) {
  try {
    const data = object(JSON.parse(body));
    if (data.limits === undefined && data.totals !== undefined) {
      return createSnapshot('ollama-pro', observedAt, ollamaActivityWindows(data));
    }
    const limits = object(data.limits);
    const windows: UsageWindow[] = [];
    for (const id of ['session', 'weekly', 'monthly']) {
      if (limits[id] == null) continue;
      const usage = object(limits[id]).usage;
      if (typeof usage !== 'number' || !Number.isFinite(usage) || usage < 0 || usage > 1) throw new Error();
      windows.push({ id, unit: 'percent', percent: Math.round(usage * 1000000) / 10000 });
    }
    if (data.activity != null) {
      const activity = object(data.activity);
      if (activity.cost != null) {
        if (typeof activity.cost !== 'string' || !/^\d+(?:\.\d+)?$/.test(activity.cost)) throw new Error();
        windows.push({ id: 'activity:last-4-weeks', unit: 'USD', used: Number(activity.cost) });
      }
    }
    return createSnapshot('ollama-pro', observedAt, windows);
  } catch { throw new SourceError('parse'); }
}
