import { isIsoDate, isObject, type ParseRowResult } from './parse-utils.js';
import { openCodeDailyTokensRows } from './opencode-data-daily.js';

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
 *  - 저장 경로는 dailyTokens의 모든 날짜·모델을 보존한다(최신 날짜 컷 없음, p5 설계 §2).
 *  - leaderboard 요소 키 이름은 조회 깊이 제한으로 미확보 → 파싱하지 않고 TODO(구조 확보 시 확장).
 *  - updatedAt 값 형식 미확보 → ISO 형태만 날짜로 채택하고 아니면 null(추측 금지). */

export interface OpenCodeDataJsonParse { readonly rows: readonly ParseRowResult[]; readonly updatedAt: string | null }

function utcDateFrom(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return iso && isIsoDate(iso[1]!) ? iso[1]! : null;
}
/** 전체 dailyTokens 날짜·모델 저장용 request scope. 기존 최신 날짜 캐시와 구분한다(p5 설계 §1·§2). */
export const OPENCODE_DATA_FULL_REQUEST_SCOPE = 'opencode-data:internal-daily:all';

export function parseOpenCodeDataJson(payload: unknown, observedAt: string): OpenCodeDataJsonParse {
  if (!isObject(payload)) return { rows: [{ ok: false, index: 0, reason: 'invalid-payload', warnings: [] }], updatedAt: null };
  const updatedAt = utcDateFrom(payload.updatedAt);
  const daily = Array.isArray(payload.dailyTokens) ? payload.dailyTokens : null;
  if (!daily?.length) return { rows: [{ ok: false, index: 0, reason: 'no-daily-tokens', warnings: [] }], updatedAt };
  return { rows: openCodeDailyTokensRows(daily, updatedAt, observedAt), updatedAt };
}
