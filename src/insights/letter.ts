import { insightPublicationDate } from './history-port.js';
import { isIsoDate, isIsoTimestamp } from './parse-utils.js';
import { isInsightSource } from './types.js';
import { validateInsightRecord, type ValidatedInsightRecord } from './validation.js';
import { evidenceRow, rankRow, summarizeLetter, type LetterSection, type LetterSourceInput,
  type LetterEvidence, type LetterRankEvidence, type LetterSourceCredit } from './letter-sections.js';

export type InsightLetterResult = { readonly ok: true; readonly sections: readonly LetterSection[] } |
  { readonly ok: false; readonly reason: '전체 소스 실패'; readonly failedSources: readonly string[] };
function valid(value: ValidatedInsightRecord, source: string): boolean {
  const checked = validateInsightRecord(value.record);
  return checked.ok && value.record.source === source && checked.value.comparisonDate === value.comparisonDate;
}
const failureText = { fetch: '수집 실패', parse: '자료 검증 실패', empty: '유효 측정 없음', incomplete: '페이지·자료 일부 누락' };
/** Pure internal-only structure. C1/C2/C3 results must refer to the supplied measurements/cohorts.
 * No rendering, delivery, LLM, clock or I/O. Issuance time and collection timestamps remain distinct. */
export function buildInsightLetter(sources: readonly LetterSourceInput[], issuedAt: string): InsightLetterResult {
  if (!isIsoTimestamp(issuedAt) || !issuedAt.endsWith('Z') ||
    sources.some(source => !isInsightSource(source.source)) || new Set(sources.map(source => source.source)).size !== sources.length) {
    throw new RangeError('Invalid insight letter input');
  }
  const rows: LetterEvidence[] = [], groups: LetterRankEvidence[] = [];
  const failures: { source: LetterSourceInput['source']; reason: string }[] = [];
  for (const source of sources) {
    if (!source.ok) { failures.push({ source: source.source, reason: failureText[source.failure] }); continue; }
    if (!source.measurements.length || source.measurements.some(input => !valid(input.measurement, source.source)) ||
      source.ranks?.some(input => !valid(input.reference, source.source) ||
        (input.previousDate !== null && !isIsoDate(input.previousDate)))) {
      failures.push({ source: source.source, reason: '유효 측정 없음 또는 자료 검증 실패' }); continue;
    }
    rows.push(...source.measurements.map((input, index) => evidenceRow(input, `${source.source}:measurement:${index}`)));
    groups.push(...(source.ranks ?? []).map((input, index) => rankRow(input, `${source.source}:rank:${index}`)));
    if (source.partial) failures.push({ source: source.source, reason: failureText.incomplete });
  }
  if (!rows.length) return { ok: false, reason: '전체 소스 실패', failedSources: failures.map(failure => failure.source) };
  const credits = new Map<string, LetterSourceCredit>();
  for (const row of [...rows, ...groups]) {
    const credit = { source: row.source, name: row.sourceName, url: row.sourceUrl,
      attribution: row.attributionText, license: row.license, observedAt: row.observedAt };
    credits.set(JSON.stringify(credit), credit);
  }
  const notes = new Set(['내부 전용: 외부 재배포 권한을 뜻하지 않습니다.',
    '서로 다른 소스·모델·지표·단위·평가 버전은 합산하지 않습니다. 전체 시장점유율로 해석하지 않습니다.',
    '증감은 지표 수치의 변화이며 성능 개선이나 통계적 유의성을 뜻하지 않습니다.']);
  for (const row of rows) {
    if (!row.comparison.comparable) notes.add(row.comparison.reason);
    else if (row.comparison.percentUnavailable) notes.add(row.comparison.percentUnavailable);
    if (row.comparisonDate === null) notes.add('n/a: 기준일 미상');
    if (row.trend.status === 'unavailable') notes.add(row.trend.reason);
    else {
      if (row.trend.missingDays) notes.add('7일 결측은 보간하지 않습니다. 실제 범위·결측 수를 근거 표에서 확인하세요.');
      if (row.trend.initialLoad) notes.add('초기 적재: 이전 이력 부족');
    }
  }
  for (const group of groups) {
    if (!group.result.comparable) notes.add(group.result.reason);
    else if (group.result.changes.some(change => change.status === 'missing')) notes.add('순위 자료 누락: 진입·이탈·변동 추정 안 함');
  }
  if (failures.length) notes.add('부분 실패: 실패 소스의 자료는 최신 성공으로 표시하지 않습니다.');
  const sections: LetterSection[] = [
    { kind: 'metadata', title: 'AI 인사이트 레터', audience: 'internal', notice: '내부 전용',
      publicationDate: insightPublicationDate(issuedAt), timeZone: 'Asia/Seoul', issuedAt },
    { kind: 'summary', title: '요약', items: summarizeLetter(rows, groups) },
    { kind: 'evidence', title: '지표·전일·7일 근거', rows },
    { kind: 'ranks', title: '순위 변동 근거', groups },
    { kind: 'sources', title: '출처·귀속·수집 시각(UTC)', entries: [...credits.values()] },
    { kind: 'failures', title: '실패·부분 실패 소스', entries: failures },
    { kind: 'limitations', title: '해석과 한계', items: [...notes] },
  ];
  return structuredClone({ ok: true, sections });
}
