import { computeRoleTop10, type RoleEntry, type RoleList, type RoleLists } from './letter-top10-unified.js';
import { FREE_PLANS } from './plan-catalog-free.js';
import type { Top10Options, Top10RecordInput } from './letter-top10-rank.js';
export { cursorLabelFor, freeOnlyModelIds, shortPlan } from './letter-top10-plans.js';

/** Free 경로 칸: 플랜 이름에 공식 페이지 근거의 조건/주의를 붙인다(root 확정 사실만). */
const PATH: Readonly<Record<string, string>> = {
  'OpenCode Zen Free': 'OpenCode Zen Free',
  'OpenCode Go Free': 'OpenCode Go Free ⚠️세션 헤더 필요',
  'Antigravity Free': 'Antigravity Free(주간 쿼터)',
};
const pathOf = (plans: readonly string[]): string => plans.map(p => PATH[p] ?? p).join('+');
export const FREE_HEADING = '## 🆓 Free 티어';
const MD_HEAD = '| 순위 | 모델 | 추천 effort | 스코어 | 지수 | Free 경로 |\n| --- | --- | --- | --- | --- | --- |';
/** 티어별 한도·조건(공식 페이지 원문 요지)과 미확인 1줄. */
export const FREE_LIMIT_NOTES: readonly string[] = [
  '- OpenCode Zen Free: 기간 한정 무료(수치 한도 미공개), 수집 데이터가 모델 개선에 쓰일 수 있다(일부 zero-retention).',
  '- OpenCode Go Free: Unlimited·기간 한정, x-opencode-session 헤더 필수로 OpenCode 클라이언트 세션에서만 사용.',
  '- Antigravity Free: 주간 쿼터 갱신·주간 rate limit(수치 비공개).',
  '- 미확인: ChatGPT Free(공식 페이지 403), Claude Free·Gemini 앱(모델 버전 미표기), Ollama Free(스타터 모델 미명시).',
];

/** 유료 Top10에서 제외할 free 전용 모델(섹션 분리 — 같은 레코드를 Free 카탈로그로만 다시 돌린다).
 *  opts의 paid 전용 제외 목록은 Free 섹션에서 제거한다(여기서는 free 모델이 후보). */
export const freeLists = (records: readonly Top10RecordInput[], opts?: Top10Options): RoleLists => {
  const { excludeModelIds: paidOnly, ...rest } = opts ?? {};
  return computeRoleTop10(records, { ...rest, catalog: FREE_PLANS });
};

const rows = (entries: readonly RoleEntry[], markdown: boolean) => entries.map(e => {
  const rank = `${e.belowZone ? '▽ ' : ''}${e.rank}`;
  return markdown
    ? `| ${rank} | ${e.modelId} | ${e.repEffort} | ${e.scoreText ?? '-'} | ${e.indexText} | ${pathOf(e.plans)} |`
    : `${rank}. ${e.modelId} · effort ${e.repEffort} · 스코어 ${e.scoreText ?? '-'} · ${e.indexText} · ${pathOf(e.plans)}`;
});
const pick = (list: RoleList, limit: number): readonly RoleEntry[] => list.entries.slice(0, limit);
/** 소제목마다 독립 표(헤더+구분선+행)를 둬서 마크다운 표가 깨지지 않게 한다. */
export function renderFreeSectionMarkdown(lists: RoleLists, limit = 5): string[] {
  return [FREE_HEADING, '', '### 오케스트레이터', '', MD_HEAD, ...rows(pick(lists.orchestrator, limit), true),
    '', '### 워커', '', MD_HEAD, ...rows(pick(lists.worker, limit), true), '', ...FREE_LIMIT_NOTES];
}
export function renderFreeSectionCompact(lists: RoleLists, limit = 3): string[] {
  return [FREE_HEADING, ...rows(pick(lists.orchestrator, limit), false), ...rows(pick(lists.worker, limit), false), ...FREE_LIMIT_NOTES];
}
