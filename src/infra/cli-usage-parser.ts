import { createSnapshot, type UsageWindow } from '../domain/usage.js';
import { SourceError } from '../app/usage-source.js';
import { parseClaudeReset } from './claude-reset.js';

const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;
const AUTH_PATTERNS = [
  /unauthenticated/i, /not logged in/i, /sign in/i, /\/login/i, /\blogin\b/i,
  /authenticate/i, /account ineligible/i, /authentication required/i, /unauthorized/i,
];

export function checkAuth(text: string): void {
  if (AUTH_PATTERNS.some(pattern => pattern.test(text))) {
    throw new SourceError('authentication');
  }
}

export function parseAgyUsage(stdout: string, observedAt: string) {
  const clean = stdout.replace(ANSI_REGEX, '').trim();
  checkAuth(clean);
  const windows: UsageWindow[] = [];
  const lines = clean.split('\n').map(line => line.trim()).filter(Boolean);

  for (const line of lines) {
    const parts = line.split('\t').map(p => p.trim());
    if (parts.length !== 4) continue;
    const bucket = parts[0] ?? '';
    const windowName = parts[1] ?? '';
    const percentStr = parts[2] ?? '';
    const resetAt = parts[3] ?? '';
    const percentMatch = percentStr.match(/^(\d+(?:\.\d+)?)%$/);
    const rawVal = percentMatch?.[1];
    if (rawVal === undefined) continue;

    const remaining = Number(rawVal);
    if (!Number.isFinite(remaining) || remaining < 0 || remaining > 100) continue;
    const usedPercent = Math.max(0, Math.min(100, Math.round((100 - remaining) * 10) / 10));

    const bucketSlug = bucket.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const windowSlug = windowName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const id = `${bucketSlug}:${windowSlug}`;

    const window: UsageWindow = { id, unit: 'percent', percent: usedPercent, remaining };
    if (/^\d{4}-\d{2}-\d{2}T/.test(resetAt)) {
      windows.push({ ...window, resetAt });
    } else {
      windows.push(window);
    }
  }

  if (windows.length === 0) throw new SourceError('parse');
  try {
    return createSnapshot('agy', observedAt, windows);
  } catch {
    throw new SourceError('parse');
  }
}

export function parseClaudeUsage(stdout: string, observedAt: string) {
  const clean = stdout.replace(ANSI_REGEX, '').trim();
  checkAuth(clean);
  const windows: UsageWindow[] = [];

  const labels: Readonly<Record<string, string>> = {
    'session': 'session:5h', 'week (all models)': 'weekly:7d', 'week (sonnet only)': 'weekly:sonnet:7d',
  };
  for (const line of clean.split(/\r?\n/)) {
    const match = /^Current (session|week \(all models\)|week \(Sonnet only\)):\s*(\d+(?:\.\d+)?)%\s*used\b(.*)$/i.exec(line.trim());
    if (!match) continue;
    const percent = Number(match[2]);
    if (percent > 100) continue;
    const resetText = /·\s*resets\s+(.+)$/i.exec(match[3] ?? '')?.[1];
    const resetAt = resetText ? parseClaudeReset(resetText, observedAt) : undefined;
    const window: UsageWindow = { id: labels[match[1]!.toLowerCase()]!, unit: 'percent', percent };
    windows.push(resetAt ? { ...window, resetAt } : window);
  }

  if (windows.length === 0) throw new SourceError('parse');
  try {
    return createSnapshot('claude', observedAt, windows);
  } catch {
    throw new SourceError('parse');
  }
}
