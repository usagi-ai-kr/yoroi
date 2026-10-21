/** #253: Mermaid 렌더 — 고정 노드 ID · 라벨 이스케이프 · 코드 펜스 주입 방지.
 *  모델명은 라벨로만 쓰며(노드 ID 아님) 펜스·문법 주입을 막는다. */
import type { TeamCombination, TeamRole } from './letter-team-combinations.js';
import { displayModelId } from './model-display.js';
import type { RoleCandidate } from './letter-role-selection.js';
import type { RoleRunnersUp } from './letter-team-runners.js';

const ROLE_LABEL: Record<TeamRole, string> = { orchestrator: '오케스트레이터', reviewer: '리뷰어', worker: '워커' };
/** #261: 역할 이모지 + Free 표식(🆓). */
const ROLE_EMOJI: Record<TeamRole, string> = { orchestrator: '🧭', reviewer: '🔍', worker: '🛠️' };
const freeMark = (c: unknown): string => ((c as { readonly free?: unknown })?.free === true ? ' 🆓' : '');
const NODE_ID: Record<TeamRole, string> = { orchestrator: 'O', reviewer: 'R', worker: 'W' };

/** Mermaid 라벨 안전 처리: 펜스·따옴표·대괄호·중괄호·해석 특수문자를 제거하고 한 줄로 제한한다. */
export const escapeMermaidLabel = (text: string): string =>
  text.replace(/[`"'\\{}[\]<>|#;]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

/** ```mermaid 펜스 — 라벨이 펜스를 깨뜨리지 못하도록 본문은 고정 문자열로만 감싼다. */
export const mermaidFence = (lines: readonly string[]): string => ['```mermaid', ...lines, '```'].join('\n');

/** 조합 1개를 Mermaid 다이어그램으로 그린다. 구성 불가면 사유를 표시한다(가짜 모델 없음). */
export const renderTeamMermaid = (combination: TeamCombination): string => {
  if (!combination.feasible || !combination.slots.length) {
    return mermaidFence(['flowchart TB', `  NA["조합 구성 불가: ${escapeMermaidLabel(combination.reason ?? '후보 부족')}"]`]);
  }
  const nodes: string[] = [], edges: string[] = [];
  let workerNo = 0;
  for (const slot of combination.slots) {
    const isWorker = slot.role === 'worker';
    const id = isWorker ? `${NODE_ID.worker}${++workerNo}` : NODE_ID[slot.role];
    const roleLabel = `${ROLE_EMOJI[slot.role]} ${isWorker ? `${ROLE_LABEL.worker} ${workerNo}` : ROLE_LABEL[slot.role]}`;
    const free = (slot as { readonly free?: unknown }).free === true ? ' 🆓' : '';
    nodes.push(`  ${id}["${escapeMermaidLabel(`${roleLabel} · ${displayModelId(slot.modelId)}${free}`)}"]`);
    if (slot.role !== 'orchestrator') edges.push(`  ${NODE_ID.orchestrator} --> ${id}`);
  }
  return mermaidFence(['flowchart TB', ...nodes, ...edges]);
}

/** 캡션 모델명 안전 처리: 줄바꿈·백틱·연속 공백을 한 칸으로. Free 표기는 호출자가 붙인다. */
const escapeCaptionId = (text: string): string => text.replace(/[`\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

/** 차선 캡션(펜스 밖): 같은 풀에서 조합에 없는 역할별 최고 후보. 없으면 '-'. */
export function runnersUpCaption(runners: RoleRunnersUp): string {
  const name = (c: RoleCandidate | undefined): string => {
    if (c === undefined) return '-';
    return `${escapeCaptionId(displayModelId(c.modelId))}${freeMark(c)}`;
  };
  // 캡션 차선은 **조합에 실제로 있는 역할만**(1+2 는 리뷰어 차선 없음). 후보가 없으면 '-'.
  const roles = [...new Set(runners.roles ?? (['orchestrator', 'reviewer', 'worker'] as const).filter(role => runners[role] !== undefined))];
  const label: Record<string, string> = { orchestrator: '오케스트레이터', reviewer: '리뷰어', worker: '워커' };
  const lanes = roles.map(role => `- ${ROLE_EMOJI[role]} ${label[role] ?? role}: ${name(runners[role])}`);
  return lanes.length ? ['**🥈 차선**', ...lanes].join('\n') : '-';
};

/** #261: 조합 제목용 badge — 정책(가장 최선/Free) + 슬롯 구성 1개. */
export function combinationBadges(combination: TeamCombination): string {
  const open = combination.key.startsWith('open-');
  const slots = combination.key.split('-')[1] ?? '';
  const alt = open ? 'open' : 'best', text = open ? '오픈_웨이트·Free' : '🥇_가장_최선', color = open ? '8957e5' : 'blue';
  return `![${alt}](https://img.shields.io/badge/${text}-${slots}-${color})`;
}
