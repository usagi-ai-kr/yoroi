import { SourceError } from '../app/usage-source.js';
import { createSnapshot, type UsageWindow } from '../domain/usage.js';

const buckets = [
  ['five_hour', 'session:5h'],
  ['seven_day', 'weekly:7d'],
  ['seven_day_sonnet', 'weekly:sonnet:7d'],
  ['seven_day_opus', 'weekly:opus:7d'],
] as const;
const resetPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SourceError('parse');
  return value as Record<string, unknown>;
}

function resetInstant(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new SourceError('parse');
  const match = resetPattern.exec(value);
  if (!match) throw new SourceError('parse');
  const zone = match[8]!;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const hour = Number(match[4]), minute = Number(match[5]), second = Number(match[6]);
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) {
    throw new SourceError('parse');
  }
  const fraction = match[7];
  const millis = fraction === undefined ? 0 : Number(fraction.slice(0, 3).padEnd(3, '0'));
  let offsetMinutes = 0;
  if (zone !== 'Z') {
    if (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4, 6)) > 59) {
      throw new SourceError('parse');
    }
    const sign = zone.startsWith('-') ? -1 : 1;
    offsetMinutes = sign * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)));
  }
  const utc = Date.UTC(year, month - 1, day, hour, minute, second, millis) - offsetMinutes * 60000;
  const shifted = new Date(utc + offsetMinutes * 60000);
  if (!Number.isFinite(utc) || shifted.getUTCFullYear() !== year ||
    shifted.getUTCMonth() !== month - 1 || shifted.getUTCDate() !== day ||
    shifted.getUTCHours() !== hour || shifted.getUTCMinutes() !== minute ||
    shifted.getUTCSeconds() !== second) {
    throw new SourceError('parse');
  }
  return new Date(utc).toISOString();
}

export function parseClaudeApiUsage(body: string, observedAt: string) {
  let payload: unknown;
  try { payload = JSON.parse(body); }
  catch { throw new SourceError('parse'); }
  const root = object(payload);
  const windows: UsageWindow[] = [];
  for (const [key, id] of buckets) {
    const value = root[key];
    if (value === undefined || value === null) continue;
    const bucket = object(value);
    const utilization = bucket.utilization;
    if (typeof utilization !== 'number' || !Number.isFinite(utilization) ||
      utilization < 0 || utilization > 100) {
      throw new SourceError('parse');
    }
    const resetAt = resetInstant(bucket.resets_at);
    windows.push(resetAt === undefined
      ? { id, unit: 'percent', percent: utilization }
      : { id, unit: 'percent', percent: utilization, resetAt });
  }
  if (windows.length === 0) throw new SourceError('parse');
  try { return createSnapshot('claude', observedAt, windows); }
  catch { throw new SourceError('parse'); }
}
