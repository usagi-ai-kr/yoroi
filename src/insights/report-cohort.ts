import type { InsightRecord } from './record.js';
import type { ParseRowResult } from './parse-utils.js';
import { selectAaValueTop, VALUE_TOP_N } from './aa-value-top.js';
import { filterOpenRouterTop50, OPENROUTER_TOP_N } from './openrouter-top50.js';
import { filterCognitionTop50, COGNITION_TOP_N } from './cognition-top50.js';

/** 조회·표시 단계의 소스별 cohort 선택 합성(p5 설계 §1).
 *  - 저장은 각 파서가 전체 records를 보존하고, 여기서만 top50류 컷을 적용한다.
 *  - AA Top10 후보 풀(run-once의 letter 입력)은 이 모듈을 쓰지 않는다: 전체 records를 그대로 쓰고
 *    접근 요금제 필터만 적용한다(top50으로 재제한 금지).
 *  - 반환값은 evidence·참조 목록 등 조회용이며 저장 payload를 대체하지 않는다. */
export function selectAaReportRecords(records: readonly InsightRecord[], limit = VALUE_TOP_N): InsightRecord[] {
  return selectAaValueTop(records, limit);
}
export function selectOpenRouterReportRows(rows: readonly ParseRowResult[], limit = OPENROUTER_TOP_N): ParseRowResult[] {
  return filterOpenRouterTop50(rows, limit);
}
export function selectCognitionReportRows(rows: readonly ParseRowResult[], limit = COGNITION_TOP_N): ParseRowResult[] {
  return filterCognitionTop50(rows, limit);
}
