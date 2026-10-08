import { createSnapshot, type UsageWindow } from '../domain/usage.js';
import { SourceError } from '../app/usage-source.js';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SourceError('parse');
  return value as Record<string, unknown>;
}
export function parseCodexOutput(stdout: string, observedAt: string) {
  let response: Record<string, unknown> | undefined;
  for (const line of stdout.split('\n').filter(line => line.trim())) {
    try {
      const message = object(JSON.parse(line));
      if (message.id === 2) response = message;
      if (message.id === 1 && message.error) throw new SourceError('unavailable');
    } catch (error) {
      if (error instanceof SourceError && error.code !== 'parse') throw error;
      throw new SourceError('parse');
    }
  }
  if (!response) throw new SourceError('parse');
  if (response.error) {
    const error = object(response.error);
    throw new SourceError(error.code === 401 || error.code === 403 ? 'authentication' : 'unavailable');
  }
  const result = object(response.result);
  const buckets = result.rateLimitsByLimitId !== undefined && result.rateLimitsByLimitId !== null
    ? object(result.rateLimitsByLimitId) : { codex: object(result.rateLimits) };
  const windows: UsageWindow[] = [];
  for (const [bucketId, value] of Object.entries(buckets)) {
    const bucket = object(value);
    for (const kind of ['primary', 'secondary']) {
      if (bucket[kind] === undefined || bucket[kind] === null) continue;
      const raw = object(bucket[kind]);
      if (typeof raw.usedPercent !== 'number' || typeof raw.windowDurationMins !== 'number' ||
        !Number.isFinite(raw.windowDurationMins) || raw.windowDurationMins <= 0) {
        throw new SourceError('parse');
      }
      const window: UsageWindow = {
        id: `${bucketId}:${kind}:${raw.windowDurationMins}m`, unit: 'percent', percent: raw.usedPercent,
      };
      if (raw.resetsAt !== undefined && raw.resetsAt !== null) {
        if (typeof raw.resetsAt !== 'number' || !Number.isFinite(raw.resetsAt)) throw new SourceError('parse');
        try { windows.push({ ...window, resetAt: new Date(raw.resetsAt * 1000).toISOString() }); }
        catch { throw new SourceError('parse'); }
      } else windows.push(window);
    }
  }
  try { return createSnapshot('codex', observedAt, windows); }
  catch { throw new SourceError('parse'); }
}
