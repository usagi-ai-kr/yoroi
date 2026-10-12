import Table from 'cli-table3';
import type { InsightLetterView } from './insights-view.js';

type Sections = Extract<InsightLetterView, { ok: true }>['sections'];
type Evidence = Extract<Sections[number], { kind: 'evidence' }>['rows'][number];
const MAX_ITEMS = 50;
/** Bound untrusted fields, remove terminal/bidi controls, and redact credential-like fragments. */
const clean = (value: string, limit = 240): string => value
  .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
  .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, ' ')
  .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
  .replace(/\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password|secret)\s*[:=]\s*[^\s&]+/gi, '[redacted]')
  .replace(/\b(?:sk-|sk_|hf_|gh[pousr]_)[A-Za-z0-9_-]{4,}/g, '[redacted]').slice(0, limit);
const number = (value: number | null): string => value !== null && Number.isFinite(value) ? String(value) : 'n/a';
function url(value: string): string {
  try {
    const parsed = new URL(value);
    if (!['https:', 'http:'].includes(parsed.protocol)) return 'n/a: 출처 URL 오류';
    parsed.username = ''; parsed.password = ''; parsed.search = ''; parsed.hash = '';
    return clean(parsed.toString(), 512);
  } catch { return 'n/a: 출처 URL 오류'; }
}
const sourceNames: Readonly<Record<string, string>> = { arena: 'Arena', 'artificial-analysis': 'Artificial Analysis',
  openrouter: 'OpenRouter', cognition: 'Cognition' };
const label = (source: string): string => sourceNames[source] ?? '알 수 없는 소스';
const limited = <T>(values: readonly T[]): readonly T[] => values.slice(0, MAX_ITEMS);
function table(headers: string[], rows: string[][], pretty: boolean): string[] {
  if (!pretty) return [headers.join(' | '), ...rows.map(row => row.join(' | '))];
  const view = new Table({ head: headers, wordWrap: true,
    colWidths: headers.map((_, index) => index === headers.length - 1 ? 58 : 28), style: { head: [], border: [] } });
  view.push(...rows); return view.toString().split('\n');
}
function comparison(row: Evidence): string {
  const value = row.comparison;
  return value.comparable ? `${number(value.absoluteChange)} ${clean(row.unit)} / ${value.percentChange === null
    ? clean(value.percentUnavailable ?? 'n/a') : `${number(value.percentChange)}%`} (${clean(value.previousDate)}→${clean(value.currentDate)})`
    : clean(value.reason);
}
function trend(row: Evidence): string {
  const value = row.trend;
  if (value.status === 'unavailable') return clean(value.reason);
  const direction = value.direction === null ? 'n/a' : { increasing: '증가', decreasing: '감소', unchanged: '변화 없음', mixed: '혼합' }[value.direction];
  return `${clean(value.startDate)}~${clean(value.endDate)} / 결측 ${number(value.missingDays)}일 / ${direction}` +
    (value.initialLoad ? ' / 초기 적재: 이력 부족' : '') + ' / ' + limited(value.points)
      .map(point => `${clean(point.date, 32)}:${point.value === null ? '결측' : number(point.value)}`).join(', ');
}
export interface RenderInsightsOptions { readonly pretty?: boolean; readonly full?: boolean;
  /** Composition-injected compact renderer (ui must not import the insights core directly). */
  readonly compact?: (letter: InsightLetterView) => string }
const failure = (result: Extract<InsightLetterView, { ok: false }>) =>
  ({ stdout: '', stderr: `인사이트: 전체 소스 실패 (${limited(result.failedSources).map(label).join(', ')})\n`, exitCode: 1 as const });
/** Default/--pretty: compact top-10 letter; --full (or legacy boolean pretty): detailed letter. */
export function renderInsights(result: InsightLetterView,
  options: boolean | RenderInsightsOptions = {}): { stdout: string; stderr: string; exitCode: 0 | 1 } {
  const opts: RenderInsightsOptions = typeof options === 'boolean' ? { pretty: options, full: true } : options;
  if (!result.ok) return failure(result);
  if (opts.full !== true && opts.compact !== undefined) {
    const diagnostics = result.sections.flatMap(section => section.kind === 'failures' ? section.entries : [])
      .map(entry => `인사이트: ${label(entry.source)}: ${clean(entry.reason)}`).slice(0, 20);
    return { stdout: `${opts.compact(result)}\n`,
      stderr: diagnostics.length ? diagnostics.join('\n') + '\n' : '', exitCode: 0 };
  }
  const pretty = Boolean(opts.pretty);
  const lines: string[] = [], diagnostics: string[] = [];
  const heading = (title: string): void => { lines.push(pretty ? `【${clean(title)}】` : `[${clean(title)}]`); };
  for (const section of result.sections.slice(0, 12)) {
    if (section.kind === 'failures') {
      diagnostics.push(...limited(section.entries).map(entry => `인사이트: ${label(entry.source)}: ${clean(entry.reason)}`)); continue;
    }
    heading(section.title);
    switch (section.kind) {
      case 'metadata': lines.push(`내부 전용 | 발행일(KST): ${clean(section.publicationDate)} | 발행 시각(UTC): ${clean(section.issuedAt)}`); break;
      case 'summary': lines.push(...limited(section.items).map(item => `${pretty ? '•' : '-'} ${clean(item.text)} [${limited(item.evidenceIds).map(id => clean(id, 80)).join(', ')}]`)); break;
      case 'evidence': lines.push(...table(['근거·모델·지표', '값·전일 변화', '7일 추세', '기준일·수집·출처'], limited(section.rows).map(row => [
        `${clean(row.id, 80)} ${clean(row.sourceName)} ${clean(row.modelId)} / ${clean(row.metric)} / ${clean(row.category)} / ${clean(row.schemaVersion)}`,
        `${number(row.value)} ${clean(row.unit)} / ${comparison(row)}`, trend(row),
        `${row.comparisonDate === null ? '미상' : clean(row.sourceAsOf)} / 비교일 ${clean(row.comparisonDate ?? '미상')} / ${clean(row.observedAt)} UTC / ${url(row.sourceUrl)}`]), pretty)); break;
      case 'ranks': for (const group of limited(section.groups)) {
        lines.push(`${clean(group.id, 80)} ${clean(group.sourceName)} / ${clean(group.metric)} / ${clean(group.category)} / ${clean(group.unit)} / ${clean(group.schemaVersion)}`,
          `기준일 ${clean(group.comparisonDate ?? '미상')} / 이전 ${clean(group.previousDate ?? '미상')} / 수집 ${clean(group.observedAt)} UTC / ${url(group.sourceUrl)}`);
        if (!group.result.comparable) lines.push(clean(group.result.reason));
        else lines.push(...table(['모델', '현재 순위', '이전 순위', '변동'], limited(group.result.changes).map(change => [clean(change.modelId),
          number(change.currentRank), number(change.previousRank), `${{ ranked: '비교', entered: '진입', exited: '이탈', missing: '누락' }[change.status]} / ${number(change.rankChange)}`]), pretty));
      } break;
      case 'sources': lines.push(...limited(section.entries).map(entry => `${clean(entry.name)} | ${url(entry.url)} | 수집 ${clean(entry.observedAt)} UTC | ${clean(entry.attribution)} | 라이선스 ${clean(entry.license ?? '미상(재배포 허가 아님)')}`)); break;
      case 'limitations': lines.push(...limited(section.items).map(item => `- ${clean(item)}`)); break;
    }
    const items = 'rows' in section ? section.rows : 'groups' in section ? section.groups : 'entries' in section ? section.entries : 'items' in section ? section.items : [];
    if (items.length > MAX_ITEMS) lines.push(`[길이 제한: ${MAX_ITEMS}개 항목까지만 표시]`);
    lines.push('');
  }
  return { stdout: lines.join('\n').trimEnd() + '\n', stderr: diagnostics.length ? diagnostics.join('\n') + '\n' : '', exitCode: 0 };
}
