import { expandSuccessors } from './model-successors.js';
import { validateInsightRecord, type ValidatedInsightRecord } from './validation.js';

/** AA 검증 기록에 모델 후속 행을 합쳐 Top10 후보를 만든다(지수·속도·공식 단가 행 포함).
 *  저장된 성공 캐시는 건드리지 않고 렌더 경로에서만 확장한다. */
export function withSuccessors(base: readonly ValidatedInsightRecord[]): ValidatedInsightRecord[] {
  const known = new Set(base.map(v => v.record.modelId));
  const added = expandSuccessors(base.map(v => v.record)).filter(r => !known.has(r.modelId))
    .flatMap(rec => { const v = validateInsightRecord(rec); return v.ok ? [v.value] : []; });
  return [...base, ...added];
}
