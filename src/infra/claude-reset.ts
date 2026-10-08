const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'];
const RESET = /^([a-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s+\(([^()]+)\)$/i;
const HOUR = 3600000;

function localTime(formatter: Intl.DateTimeFormat, timestamp: number): number {
  const fields = Object.fromEntries(formatter.formatToParts(timestamp)
    .filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  return Date.UTC(fields.year!, fields.month! - 1, fields.day!,
    fields.hour!, fields.minute!, fields.second!);
}

/** Convert a displayed local reset to UTC; ambiguous or unsupported values stay unknown. */
export function parseClaudeReset(text: string, observedAt: string): string | undefined {
  const match = RESET.exec(text.trim());
  if (!match) return undefined;
  const [, monthName, dayText, yearText, hourText, minuteText, meridiem, zone] = match;
  const month = MONTHS.findIndex(name => name === monthName?.toLowerCase() ||
    name.slice(0, 3) === monthName?.toLowerCase());
  const day = Number(dayText), hour = Number(hourText), minute = Number(minuteText ?? '0');
  const observed = Date.parse(observedAt);
  if (month < 0 || day < 1 || day > 31 || hour < 1 || hour > 12 || minute > 59 ||
    (yearText !== undefined && Number(yearText) < 1000) || !Number.isFinite(observed) ||
    !/^(?:UTC|[a-z_]+(?:\/[a-z0-9_+-]+)+)$/i.test(zone ?? '')) return undefined;
  const clockHour = hour % 12 + (meridiem?.toLowerCase() === 'pm' ? 12 : 0);
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone!, calendar: 'iso8601', numberingSystem: 'latn', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const localObserved = localTime(formatter, observed);
    const observedYear = new Date(localObserved).getUTCFullYear();
    const years = yearText ? [Number(yearText)] : [observedYear - 1, observedYear, observedYear + 1];
    const walls = years.map(year => Date.UTC(year, month, day, clockHour, minute)).filter(value => {
      const date = new Date(value);
      return date.getUTCMonth() === month && date.getUTCDate() === day && date.getUTCFullYear() >= 1000;
    });
    walls.sort((a, b) => Math.abs(a - localObserved) - Math.abs(b - localObserved) || b - a);
    const wall = walls[0];
    if (wall === undefined) return undefined;
    const candidates = new Set<number>();
    // Sample both sides of a possible offset transition, then round-trip every candidate.
    for (const delta of [-36 * HOUR, 0, 36 * HOUR]) {
      const sample = wall + delta;
      const offset = localTime(formatter, sample) - sample;
      const utc = wall - offset;
      if (localTime(formatter, utc) === wall) candidates.add(utc);
    }
    return candidates.size === 1 ? new Date([...candidates][0]!).toISOString() : undefined;
  } catch {
    return undefined;
  }
}
