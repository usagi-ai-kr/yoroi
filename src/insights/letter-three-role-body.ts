/** #195 unit6: 3역할 블록을 본문·출력 텍스트에 **한 번만** 넣기 위한 보조.
 *  기존 2역할 블록(오케스트레이터·리뷰어 Top7 / 워커·메신저 Top7)을 잘라내고 그 자리에 3역할 블록을 넣는다.
 *  제목·표시 안내·Free·댓글 3개 계약은 건드리지 않는다. */

import { replaceLetterGuide } from './letter-three-role-legend.js';

export interface ThreeRoleSections {
  readonly orchestrator: string;
  readonly reviewer: string;
  readonly worker: string;
  readonly messenger?: string;
}

const LEGACY_ORCHESTRATOR = '## 🧭 오케스트레이터·리뷰어';
const LEGACY_WORKER = '## 🛠️ 워커·메신저';
/** 내부용 식별자(호환·테스트용). **발행 본문에는 출력하지 않는다**(사용자에게는 내부 구현이 보인다). */
export const THREE_ROLE_HEADING = '## 🧭 3역할 후보 (opt-in)';

/** 발행 본문에는 역할 섹션만 연속해서 넣는다(중간 머리글·빈 단락 없음). 메신저가 없으면 3섹션만 둔다. */
const threeRoleBlock = (sections: ThreeRoleSections): string[] =>
  [sections.orchestrator, '', sections.reviewer, '', sections.worker,
    ...(sections.messenger !== undefined ? ['', sections.messenger] : [])];

/** 기존 2역할 블록이 남아 있는지(테스트의 이중출력 단언용). */
export function hasLegacyRoleBlocks(text: string): boolean {
  const lines = text.split('\n');
  return lines.some(line => line.startsWith(LEGACY_ORCHESTRATOR) || line.startsWith(LEGACY_WORKER));
}

/** U3c 메신저 가중치 안내(설정값 문서화 — 계산 로직 불변). */
const MESSENGER_WEIGHT_LINE = '- 가중치: 메신저 성능 20%·사용량 10%·속도 30%·가격 40% (워커와 같은 배관, 가중치만 상이)';
const WORKER_WEIGHT_MARK = '워커 성능 30%·사용량 20%·속도 10%·가격 40%';
/** U3c: 3/4역할 본문에서만 2역할 라벨을 분리한다. '- ' 목록줄만 대상으로 제목·표는 손대지 않는다. */
const normalizeThreeRoleLabels = (text: string): string => {
  const lines = text.split('\n').map(line => line.startsWith('- ')
    ? line.replaceAll('워커·메신저', '워커').replaceAll('60%(워커)', '60%(워커)/60%(메신저)') : line);
  const idx = lines.findIndex(line => line.includes(WORKER_WEIGHT_MARK));
  if (idx >= 0 && !(lines[idx + 1]?.startsWith('- 가중치: 메신저'))) lines.splice(idx + 1, 0, MESSENGER_WEIGHT_LINE);
  return lines.join('\n');
};

/** 기존 2역할 블록을 3역할 블록으로 대체한다. 블록이 없으면 끝에 덧붙인다(중복 없음).
 *  본문에 2역할 안내가 있으면 3역할 안내로 함께 교체한다(산출 공식·출처는 보존). */
export function replaceLegacyRoleBlocks(text: string, sections: ThreeRoleSections): string {
  const lines = text.split('\n');
  const oIdx = lines.findIndex(line => line.startsWith(LEGACY_ORCHESTRATOR));
  const wIdx = lines.findIndex(line => line.startsWith(LEGACY_WORKER));
  if (oIdx < 0 || wIdx < 0) return normalizeThreeRoleLabels(replaceLetterGuide([...lines, '', ...threeRoleBlock(sections), ''].join('\n')));
  let end = wIdx + 1;
  while (end < lines.length && !lines[end]!.startsWith('## ')) end++;
  return normalizeThreeRoleLabels(replaceLetterGuide([...lines.slice(0, oIdx), ...threeRoleBlock(sections), '', ...lines.slice(end)].join('\n')));
}
