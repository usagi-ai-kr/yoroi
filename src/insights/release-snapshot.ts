import { splitBaseAndEffort } from './letter-top10-group.js';
import type { Top10RecordInput } from './letter-top10-rank.js';
import { trailingSnapshot } from './model-id.js';
import { isIsoDate } from './parse-utils.js';

type DatedRecord = Top10RecordInput & { readonly releaseDate?: string };
export interface ReleaseArbitration { readonly rows: readonly Top10RecordInput[]; readonly warnings: readonly string[] }
/** run-once가 AA record.metadata.releaseDate를 실어 보내면 그 값을 쓴다(없으면 undefined). */
const releaseDateOf = (record: Top10RecordInput): string | undefined => (record as DatedRecord).releaseDate;

/** 같은 canonical base 안의 릴리스 판정(p20b·p20c): 호출부가 근거 행(EVIDENCE_METRICS)을 빼고 넘긴 지수 행만 본다.
 *  모든 행의 releaseDate가 있으면 가장 늦은 releaseDate 행만 남긴다
 *  (동일 날짜·다른 effort 키는 함께 유지). 결측이 있으면 p20 스냅샷 비교로 fallback, 그것도 비교 불가하면 모두
 *  유지하고 경고에 남긴다. 날짜 접미사 모양만으로 무날짜 id를 최신으로 추측하지 않는다. */
export function arbitrateReleases(records: readonly Top10RecordInput[], baseOf: (record: Top10RecordInput) => string,
  releaseOf: (record: Top10RecordInput) => string | undefined = releaseDateOf): ReleaseArbitration {
  const byBase = new Map<string, Top10RecordInput[]>();
  for (const r of records) { const base = baseOf(r); byBase.set(base, [...(byBase.get(base) ?? []), r]); }
  const drop = new Set<Top10RecordInput>(), warnings: string[] = [];
  for (const [base, rows] of byBase) {
    const dates = rows.map(row => releaseOf(row));
    if (dates.every((date): date is string => typeof date === 'string' && isIsoDate(date))) {
      const latest = [...dates].sort().at(-1)!;
      rows.forEach((row, index) => { if (dates[index]! < latest) drop.add(row); });
      continue;
    }
    const forms = new Map<'mmdd' | 'full', { readonly row: Top10RecordInput; readonly key: string }[]>();
    let undated = 0, datedRows = 0;
    for (const row of rows) {
      const snapshot = trailingSnapshot(splitBaseAndEffort(row.modelId).base);
      if (snapshot === undefined) { undated += 1; continue; }
      datedRows += 1;
      const form = snapshot.kind === 'mmdd' ? 'mmdd' : 'full';
      forms.set(form, [...(forms.get(form) ?? []), { row, key: snapshot.fullDate ?? snapshot.raw }]);
    }
    let dropped = 0;
    for (const dated of forms.values()) {
      const latest = dated.map(entry => entry.key).sort().at(-1)!;
      for (const entry of dated) if (entry.key < latest) { drop.add(entry.row); dropped += 1; }
    }
    if (dates.some(date => date !== undefined) && dropped === 0) {
      warnings.push(`${base}: releaseDate 결측으로 스냅샷 fallback에서 비교 불가 — 모두 유지`);
    } else if (undated && datedRows) warnings.push(`${base}: 날짜 없는 행과 날짜 있는 행이 섞여 둘 다 유지합니다`);
  }
  return { rows: records.filter(r => !drop.has(r)), warnings };
}
