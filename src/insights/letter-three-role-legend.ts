import { LEGEND_HEADING } from './letter-top10-legend.js';
import { roleFitLegend } from './model-role-fit.js';

/** 3역할 표시 안내: 실제 표시 항목만 둔다.
 *  2역할 전용(0~100 차원·▽ 하한 보충·`*` 단가 대체·+N 가산·🔒 접근 제한)은 넣지 않는다. */
export const THREE_ROLE_LEGEND: readonly string[] = [
  LEGEND_HEADING,
  '- 👍 파레토 최적',
  '- 스코어·effort 는 표시된 값 그대로(effort=추천 추론 강도, -=근거 없음)',
  ...roleFitLegend(),
];

/** 본문의 2역할 안내 블록을 3역할 안내로 교체한다. 안내가 없으면 그대로 둔다.
 *  산출 공식·출처 블록에는 손대지 않는다. */
export function replaceLetterGuide(text: string, guide: readonly string[] = THREE_ROLE_LEGEND): string {
  const lines = text.split('\n');
  const start = lines.findIndex(line => line === LEGEND_HEADING);
  if (start < 0) return text;
  let end = start + 1;
  while (end < lines.length && lines[end]!.startsWith('- ')) end++;
  return [...lines.slice(0, start), ...guide, ...lines.slice(end)].join('\n');
}
