import type { InsightRecord } from './record.js';
import { isIsoDate, isObject, type ParseRowResult } from './parse-utils.js';

/** 값·모델명 없이 구조만 요약하는 진단(다음 정기 수집에서 리더보드 키 확보용). 숫자는 개수/타입뿐이다. */
const valueType = (v: unknown): string => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
const keyShape = (v: unknown): string => Array.isArray(v) ? `array(${v.length})` : isObject(v)
  ? `object(keyCount=${Object.keys(v).length},valueTypes=[${[...new Set(Object.values(v).map(valueType))].sort().join(',')}])` : valueType(v);
function arraySummary(payload: Record<string, unknown>, name: string): string {
  const list = payload[name];
  if (!Array.isArray(list)) return `${name}[none]`;
  const first = list.find(isObject);
  const keys = first ? Object.entries(first).map(([k, v]) => `${k}:${keyShape(v)}`).join(',') : '';
  return `${name}[n=${list.length}${keys ? `,${keys}` : ''}]`;
}
export function updatedAtFormatPattern(value: unknown): 'ABSENT' | 'ISO-UTC' | 'ISO-OFFSET' | 'DATE' | 'RFC' | 'OTHER' {
  if (typeof value !== 'string') return 'ABSENT';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value)) return 'ISO-UTC';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?[+-]\d{2}:\d{2}$/.test(value)) return 'ISO-OFFSET';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'DATE';
  return /^[A-Za-z]{3},?\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/.test(value) ? 'RFC' : 'OTHER';
}
/** 'opencode-data: schema …' 1줄. leaderboard 요소 키 이름·값 타입·요소 수와 updatedAt 형식만 담는다(값 자체 금지). */
export function describeOpenCodeDataSchema(payload: unknown): string | null {
  if (!isObject(payload) || !isObject(payload.leaderboard)) return null;
  const board = payload.leaderboard;
  return `opencode-data: schema ${arraySummary(board, 'pastWeek')}, ${arraySummary(board, 'pastDay')}; ` +
    `updatedAt=${updatedAtFormatPattern(payload.updatedAt)}`;
}
/** 기본 sink는 process.stderr이지만 호출자가 주입한 writer(CLI IO 계약)로 대체할 수 있다. */
export function emitOpenCodeDataSchemaDiagnostic(payload: unknown, write?: (line: string) => void): void {
  const line = describeOpenCodeDataSchema(payload);
  if (!line) return;
  if (write === undefined) process.stderr.write(line + '\n');
  else write(line);
}

/** #102 JSON 구조(2026-10-12 1회 조회로 기록한 키만 사용, 값·모델명 원문 미저장):
 *  root{page:string, updatedAt:string, summary:string, leaderboard{pastWeek:array<object>, pastDay:array<object>},
 *  dailyTokens: array<{date:string, total:number, models:object<string,number>}>}
 *  - leaderboard 요소 키 이름은 조회 깊이 제한으로 미확보 → 파싱하지 않고 TODO(구조 확보 시 확장).
 *  - updatedAt 값 형식 미확보 → ISO 형태만 날짜로 채택하고 아니면 null(추측 금지). */

export interface OpenCodeDataJsonParse { readonly rows: readonly ParseRowResult[]; readonly updatedAt: string | null }

function utcDateFrom(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return iso && isIsoDate(iso[1]!) ? iso[1]! : null;
}
function record(modelId: string, metric: string, value: number, unit: string, date: string,
  updatedAt: string | null, observedAt: string): InsightRecord {
  return { source: 'opencode-data', modelId, metric, value, unit, category: 'usage',
    observedAt, sourceAsOf: updatedAt ?? date, sourceUrl: 'https://opencode.ai/data/index.json',
    sourceName: 'OpenCode Data (내부 참조 · 약관상 자동 추출 제한)', license: null,
    attributionText: updatedAt ? `Source: OpenCode Data (내부 참조), as of ${updatedAt}.` : 'Source: OpenCode Data (내부 참조).',
    method: 'page-json-polite', schemaVersion: 'opencode-data-v1', metadata: { date, ...(updatedAt && { updatedAt }) } };
}

export function parseOpenCodeDataJson(payload: unknown, observedAt: string): OpenCodeDataJsonParse {
  if (!isObject(payload)) return { rows: [{ ok: false, index: 0, reason: 'invalid-payload', warnings: [] }], updatedAt: null };
  const updatedAt = utcDateFrom(payload.updatedAt);
  const daily = Array.isArray(payload.dailyTokens) ? payload.dailyTokens : null;
  if (!daily?.length) return { rows: [{ ok: false, index: 0, reason: 'no-daily-tokens', warnings: [] }], updatedAt };
  const rows: ParseRowResult[] = [];
  const latest = latestDate(daily);
  let rejected = 0;
  daily.forEach((element, index) => {
    const date = isObject(element) ? element.date : undefined;
    if (!isObject(element) || typeof date !== 'string' || !isIsoDate(date) || !isObject(element.models)) {
      rows.push({ ok: false, index, reason: 'invalid-row', warnings: [] }); return;
    }
    if (date !== latest) return; // 최신 날짜 스냅샷만 정규화한다
    const entries = Object.entries(element.models as Record<string, unknown>);
    const usable = entries.filter((entry): entry is [string, number] =>
      typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] >= 0);
    const records = usable.map(([modelId, value]) => record(modelId, 'opencode_data_tokens', value, 'tokens', date, updatedAt, observedAt));
    rows.push(records.length ? { ok: true, index, records, warnings: [] } : { ok: false, index, reason: 'no-models', warnings: [] });
    // 비수치 항목은 조용히 버리지 않고 거절 행으로 집계해 부분 수집으로 보이게 한다.
    if (usable.length < entries.length) rows.push({ ok: false, index: daily.length + rejected++,
      reason: 'non-numeric-model-entries', warnings: [`non-numeric model entries: ${entries.length - usable.length}`] });
  });
  return { rows, updatedAt };
}
function latestDate(daily: readonly unknown[]): string {
  return daily.map(element => isObject(element) && typeof element.date === 'string' ? element.date : '')
    .filter(isIsoDate).sort().at(-1) ?? '';
}
