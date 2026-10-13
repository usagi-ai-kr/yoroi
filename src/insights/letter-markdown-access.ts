import type { RoleLists } from './letter-top10-unified.js';
import { barePlan } from './letter-top10-plans.js';
import { PLAN_CATALOG } from './plan-catalog.js';

/** 사용자 요청(2026-10-13): 접근 요금제는 별도 표 + 체크박스로 표시(Top10 unique 모델).
 *  제목은 이모지·설명 문구 없이 `## 접근 요금제` 하나만 쓴다. */
export const ACCESS_HEADING = '## 접근 요금제';
const CATALOG_ORDER = PLAN_CATALOG.map(plan => plan.planName);

/** 오케스트레이터 → 워커 첫 등장 순서의 unique 모델 × 보유 요금제 접근 매트릭스.
 *  열은 행 모델 plans를 barePlan으로 벗긴 합집합이며 PLAN_CATALOG 순서(미등록 플랜명은 뒤에 첫 등장 순).
 *  모델 셀은 modelId만(↔·⭐ 없음), 접근 가능 ☑·불가 ☐. 행이 없으면 빈 배열(표 생략). */
export function renderAccessMatrixMarkdown(lists: RoleLists): string[] {
  const rows = [...lists.orchestrator.entries, ...lists.worker.entries]
    .filter((e, i, all) => all.findIndex(x => x.modelId === e.modelId) === i)
    .map(e => ({ modelId: e.modelId, plans: new Set(e.plans.map(barePlan)) }));
  if (!rows.length) return [];
  const used = [...new Set(rows.flatMap(r => [...r.plans]))];
  const plans = [...CATALOG_ORDER.filter(name => used.includes(name)),
    ...used.filter(name => !CATALOG_ORDER.includes(name))];
  return [ACCESS_HEADING, '', `| 모델 | ${plans.join(' | ')} |`, `| --- | ${plans.map(() => '---').join(' | ')} |`,
    ...rows.map(r => `| ${r.modelId} | ${plans.map(p => (r.plans.has(p) ? '☑' : '☐')).join(' | ')} |`)];
}
