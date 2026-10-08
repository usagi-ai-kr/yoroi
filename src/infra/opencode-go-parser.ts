import { SourceError } from '../app/usage-source.js';
import { createSnapshot, type UsageSnapshot, type UsageWindow } from '../domain/usage.js';

const windowIds = ['rolling', 'weekly', 'monthly'] as const;
type WindowId = typeof windowIds[number];

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SourceError('parse');
  return value as Record<string, unknown>;
}

function parseWindow(id: WindowId, value: unknown): UsageWindow {
  const raw = object(value);
  if (raw.status !== 'ok' && raw.status !== 'rate-limited') throw new SourceError('parse');
  if (typeof raw.percent !== 'number' || !Number.isInteger(raw.percent) ||
    raw.percent < 0 || raw.percent > 100) {
    throw new SourceError('parse');
  }
  const window: UsageWindow = { id, unit: 'percent', percent: raw.percent };
  if (raw.resetsAt === undefined || raw.resetsAt === null) return window;
  if (typeof raw.resetsAt !== 'string' || !Number.isFinite(Date.parse(raw.resetsAt))) {
    throw new SourceError('parse');
  }
  return { ...window, resetAt: new Date(raw.resetsAt).toISOString() };
}

export function parseOpenCodeGoUsage(body: string, observedAt: string): UsageSnapshot {
  let payload: unknown;
  try { payload = JSON.parse(body); }
  catch { throw new SourceError('parse'); }
  const usage = object(object(payload).usage);
  const windows: UsageWindow[] = [];
  for (const id of windowIds) {
    const value = usage[id];
    if (value === undefined || value === null) continue;
    windows.push(parseWindow(id, value));
  }
  if (windows.length === 0) throw new SourceError('parse');
  try { return createSnapshot('opencode-go', observedAt, windows); }
  catch { throw new SourceError('parse'); }
}
