import { load } from 'cheerio';
import { isIsoDate } from './parse-utils.js';
import type { InsightRecord } from './record.js';
import type { ParseRowResult } from './parse-utils.js';

/** 차단/캡차 페이지 감지(예의 있는 중단용 — 우회하지 않는다). */
export function isOpenCodeDataBlockedPage(html: string): boolean {
  const text = html.toLowerCase();
  return ['captcha', 'cf-challenge', 'just a moment', 'attention required', 'verify you are human', 'access denied']
    .some(marker => text.includes(marker));
}

const num = (value: string): number | undefined => {
  const match = /(-?\d[\d,]*(?:\.\d+)?)\s*([kmb])?/i.exec(value.replace(/[$%]/g, ''));
  if (!match) return undefined;
  const base = Number(match[1]!.replace(/,/g, ''));
  if (!Number.isFinite(base)) return undefined;
  const scale = match[2]?.toLowerCase();
  return scale === 'k' ? base * 1e3 : scale === 'm' ? base * 1e6 : scale === 'b' ? base * 1e9 : base;
};

const MONTHS: Readonly<Record<string, string>> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
/** 표기 문자열을 UTC 달력 날짜로 변환한다(로컬 TZ 경유 금지 — TZ=Asia/Seoul에서도 같은 날짜). */
export function toUtcDate(source: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(source.trim());
  if (iso) return isIsoDate(iso[0]) ? iso[0] : null;
  const named = /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(source);
  const month = named ? MONTHS[named[1]!.slice(0, 3).toLowerCase()] : undefined;
  if (!named || !month) return null;
  const day = String(Number(named[2])).padStart(2, '0');
  const date = `${named[3]}-${month}-${day}`;
  return isIsoDate(date) ? date : null;
}
/** updatedAt(페이지 표기) 후보를 메타/본문에서 찾는다. 찾지 못하면 null(추측하지 않는다). */
export function extractUpdatedAt(html: string): string | null {
  const $ = load(html);
  const raw = $('time[datetime]').first().attr('datetime') ?? $('meta[property="article:modified_time"]').attr('content');
  const source = raw ?? /updated\s*:?\s*([A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i.exec($('body').text())?.[1];
  return source ? toUtcDate(source) : null;
}

interface ColumnMap { readonly rank?: number; readonly tokens?: number; readonly share?: number }
function columnMap(headers: readonly string[]): ColumnMap {
  const find = (patterns: readonly RegExp[]) => headers.findIndex(h => patterns.some(p => p.test(h)));
  return { rank: find([/rank|순위/i]), tokens: find([/token|토큰|-tokens/i]), share: find([/share|점유|%|usage/i]) };
}
function metricRecord(modelId: string, metric: string, value: number, unit: string, observedAt: string, date: string,
  updatedAt: string | null): InsightRecord {
  return { source: 'opencode-data', modelId, metric, value, unit, category: 'usage',
    observedAt, sourceAsOf: updatedAt ?? date, sourceUrl: 'https://opencode.ai/ko/data',
    sourceName: 'OpenCode Data (내부 참조 · 약관상 자동 추출 제한)', license: null,
    attributionText: updatedAt ? `Source: OpenCode Data (내부 참조), as of ${updatedAt}.` : 'Source: OpenCode Data (내부 참조).',
    method: 'page-scrape-polite', schemaVersion: 'opencode-data-v1', metadata: { date, ...(updatedAt && { updatedAt }) } };
}

/** 표에서 모델별 지표(순위·토큰 사용량·점유율)를 정규화한다. 원문은 저장하지 않는다.
 *  표를 찾지 못하면 빈 배열(구조 변경 → empty 실패)로 끝내고 예외를 던지지 않는다. */
export function parseOpenCodeDataPage(html: string, observedAt: string): readonly ParseRowResult[] {
  const $ = load(html);
  const table = $('table').first();
  if (!table.length) return [];
  const rows = table.find('tr').toArray();
  if (!rows.length) return [];
  const headers = $(rows[0]!).find('th,td').toArray().map(cell => $(cell).text().trim());
  const map = columnMap(headers);
  const date = observedAt.slice(0, 10), updatedAt = extractUpdatedAt(html);
  const results: ParseRowResult[] = [];
  rows.slice(1).forEach((row, index) => {
    const cells = $(row).find('td,th').toArray().map(cell => $(cell).text().trim());
    const name = cells.find(cell => /[A-Za-z]{2,}/.test(cell)); // 숫자가 든 모델명(GPT-5, Claude Sonnet 4.5) 인정, '10K' 같은 단일 문자 셀 제외
    if (!name) { results.push({ ok: false, index, reason: 'invalid-row', warnings: [] }); return; }
    const rank = (map.rank !== undefined ? num(cells[map.rank] ?? '') : undefined) ?? index + 1;
    const tokens = map.tokens !== undefined ? num(cells[map.tokens] ?? '')
      : cells.map(cell => /[kmb]$/i.test(cell.trim()) || /\d[kmb][^a-z]/i.test(cell) ? num(cell) : undefined).find(v => v !== undefined);
    const share = map.share !== undefined ? num(cells[map.share] ?? '')
      : cells.map(cell => /%/.test(cell) ? num(cell) : undefined).find(v => v !== undefined);
    const records: InsightRecord[] = [metricRecord(name, 'opencode_data_rank', rank, 'rank', observedAt, date, updatedAt)];
    if (tokens !== undefined) records.push(metricRecord(name, 'opencode_data_tokens', tokens, 'tokens', observedAt, date, updatedAt));
    if (share !== undefined) records.push(metricRecord(name, 'opencode_data_share', share, 'percent', observedAt, date, updatedAt));
    results.push({ ok: true, index, records, warnings: [] });
  });
  return results;
}
