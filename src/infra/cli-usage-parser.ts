import { createSnapshot, type UsageWindow } from '../domain/usage.js';
import { SourceError } from '../app/usage-source.js';

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

  const sessionMatch = clean.match(/Current session:\s*(\d+(?:\.\d+)?)%\s*used/i);
  const sessionVal = sessionMatch?.[1];
  if (sessionVal !== undefined) {
    const percent = Number(sessionVal);
    if (Number.isFinite(percent) && percent >= 0 && percent <= 100) {
      windows.push({ id: 'session:5h', unit: 'percent', percent });
    }
  }

  const weekMatch = clean.match(/Current week \(all models\):\s*(\d+(?:\.\d+)?)%\s*used/i);
  const weekVal = weekMatch?.[1];
  if (weekVal !== undefined) {
    const percent = Number(weekVal);
    if (Number.isFinite(percent) && percent >= 0 && percent <= 100) {
      windows.push({ id: 'weekly:7d', unit: 'percent', percent });
    }
  }

  const sonnetMatch = clean.match(/Current week \(Sonnet only\):\s*(\d+(?:\.\d+)?)%\s*used/i);
  const sonnetVal = sonnetMatch?.[1];
  if (sonnetVal !== undefined) {
    const percent = Number(sonnetVal);
    if (Number.isFinite(percent) && percent >= 0 && percent <= 100) {
      windows.push({ id: 'weekly:sonnet:7d', unit: 'percent', percent });
    }
  }

  if (windows.length === 0) throw new SourceError('parse');
  try {
    return createSnapshot('claude', observedAt, windows);
  } catch {
    throw new SourceError('parse');
  }
}
