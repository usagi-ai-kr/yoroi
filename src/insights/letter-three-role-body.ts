/** #195 unit6: 3역할 블록을 본문·출력 텍스트에 **한 번만** 넣기 위한 보조.
 *  기존 2역할 블록(오케스트레이터·리뷰어 Top7 / 워커·메신저 Top7)을 잘라내고 그 자리에 3역할 블록을 넣는다.
 *  제목·표시 안내·Free·댓글 3개 계약은 건드리지 않는다. */

import { replaceLetterGuide } from './letter-three-role-legend.js';

export interface ThreeRoleSections {
  readonly orchestrator: string;
  readonly reviewer: string;
  readonly worker: string;
}

const LEGACY_ORCHESTRATOR = '## 🧭 오케스트레이터·리뷰어';
const LEGACY_WORKER = '## 🛠️ 워커·메신저';
/** 내부용 식별자(호환·테스트용). **발행 본문에는 출력하지 않는다**(사용자에게는 내부 구현이 보인다). */
export const THREE_ROLE_HEADING = '## 🧭 3역할 후보 (opt-in)';

/** 발행 본문에는 3역할 섹션만 연속해서 넣는다(중간 머리글·빈 단락 없음). */
const threeRoleBlock = (sections: ThreeRoleSections): string[] =>
  [sections.orchestrator, '', sections.reviewer, '', sections.worker];

/** 기존 2역할 블록이 남아 있는지(테스트의 이중출력 단언용). */
export function hasLegacyRoleBlocks(text: string): boolean {
  const lines = text.split('\n');
  return lines.some(line => line.startsWith(LEGACY_ORCHESTRATOR) || line.startsWith(LEGACY_WORKER));
}

/** 기존 2역할 블록을 3역할 블록으로 대체한다. 블록이 없으면 끝에 덧붙인다(중복 없음).
 *  본문에 2역할 안내가 있으면 3역할 안내로 함께 교체한다(산출 공식·출처는 보존). */
export function replaceLegacyRoleBlocks(text: string, sections: ThreeRoleSections): string {
  const lines = text.split('\n');
  const oIdx = lines.findIndex(line => line.startsWith(LEGACY_ORCHESTRATOR));
  const wIdx = lines.findIndex(line => line.startsWith(LEGACY_WORKER));
  if (oIdx < 0 || wIdx < 0) return replaceLetterGuide([...lines, '', ...threeRoleBlock(sections), ''].join('\n'));
  let end = wIdx + 1;
  while (end < lines.length && !lines[end]!.startsWith('## ')) end++;
  return replaceLetterGuide([...lines.slice(0, oIdx), ...threeRoleBlock(sections), '', ...lines.slice(end)].join('\n'));
}
