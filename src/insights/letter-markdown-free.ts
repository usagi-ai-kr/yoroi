import { computeRoleTop10, type RoleEntry, type RoleList, type RoleLists } from './letter-top10-unified.js';
import { splitBaseAndEffort } from './letter-top10-group.js';
import type { PlanCatalogEntry } from './plan-catalog.js';
import { normalizeModelName, type Top10Options, type Top10RecordInput } from './letter-top10-rank.js';
export { barePlan, freeOnlyModelIds, shortPlan } from './letter-top10-plans.js';

/** Free 경로 칸: 알려진 free 플랜명에 공식 근거의 주의를 붙이고, 모르는 플랜은 이름 그대로 쓴다. */
const PATH: Readonly<Record<string, string>> = {
  'OpenCode Zen Free': 'OpenCode Zen Free',
  'OpenCode Go Free': 'OpenCode Go Free ⚠️세션 헤더 필요',
};
const pathOf = (plans: readonly string[]): string => plans.map(p => PATH[p] ?? p).join('+');
export const FREE_HEADING = '## 🆓 Free 티어';
export const FREE_EMPTY_NOTE = 'Free 목록 수집 실패(opencode models)';
const MD_HEAD = '| 순위 | 모델 | 추천 effort | 스코어 | 지수 | Free 경로 |\n| --- | --- | --- | --- | --- | --- |';
/** 티어별 한도·조건(Zen Free·Go Free 2줄). */
export const FREE_LIMIT_NOTES: readonly string[] = [
  '- OpenCode Zen Free: 기간 한정 무료(수치 한도 미공개), 수집 데이터가 모델 개선에 쓰일 수 있다(일부 zero-retention).',
  '- OpenCode Go Free: Unlimited·기간 한정, x-opencode-session 헤더 필수로 OpenCode 클라이언트 세션에서만 사용.',
];

/** Free 섹션 목록은 렌더 입력의 freeCatalog(codex의 `opencode models` 실시간 수집)로만 만든다.
 *  비어 있으면 undefined → 섹션은 수집 실패 1줄만 표시한다. */
export const freeListsFrom = (records: readonly Top10RecordInput[], freeCatalog: readonly PlanCatalogEntry[] | undefined,
  opts?: Top10Options): RoleLists | undefined =>
  freeCatalog?.length ? computeRoleTop10(records, { ...opts, catalog: freeCatalog }) : undefined;

/** freeCatalog에는 있으나 AA 기록이 없어 순위를 매기지 못한 모델 ID(원 ID). */
export const unmeasuredFreeIds = (freeCatalog: readonly PlanCatalogEntry[] | undefined,
  records: readonly Top10RecordInput[]): readonly string[] => {
  if (!freeCatalog?.length) return [];
  const measured = new Set(records.filter(r => Number.isFinite(r.value))
    .map(r => normalizeModelName(splitBaseAndEffort(r.modelId).base)));
  return [...new Set(freeCatalog.flatMap(p => p.models
    .filter(m => m.verified && !measured.has(normalizeModelName(m.modelId))).map(m => m.modelId)))].sort();
};

const indexOf = (e: RoleEntry): number | undefined => {
  const value = Number(e.indexText);
  return e.indexText !== '-' && Number.isFinite(value) ? value : undefined;
};
/** Free 표 파레토: 무료 모델은 단가가 모두 0(동일)이므로 지수가 엄격히 더 높은 다른 free 모델이
 *  없을 때만 ⭐로 표시한다. 지수 결측('-') 행은 ⭐가 없다. */
const starsOf = (entries: readonly RoleEntry[]): ReadonlySet<string> => {
  const values = entries.map(e => [e.modelId, indexOf(e)] as const);
  return new Set(values.filter(([id, value]) => value !== undefined &&
    !values.some(([other, ov]) => other !== id && ov !== undefined && ov > value)).map(([id]) => id));
};

const rows = (entries: readonly RoleEntry[], markdown: boolean) => {
  const stars = starsOf(entries);
  return entries.map(e => {
    const rank = `${stars.has(e.modelId) ? '⭐ ' : ''}${e.belowZone ? '▽ ' : ''}${e.rank}`;
    return markdown
      ? `| ${rank} | ${e.modelId}${e.both ? ' ↔' : ''} | ${e.repEffort} | ${e.scoreText ?? '-'} | ${e.indexText} | ${pathOf(e.plans)} |`
      : `${rank}. ${e.modelId}${e.both ? ' ↔' : ''} · effort ${e.repEffort} · 스코어 ${e.scoreText ?? '-'} · ${e.indexText} · ${pathOf(e.plans)}`;
  });
};
const pick = (list: RoleList, limit: number): readonly RoleEntry[] => list.entries.slice(0, limit);
const unmeasuredLine = (unmeasured: readonly string[]): string[] =>
  unmeasured.length ? [`- AA 미측정(순위 제외): ${unmeasured.join(', ')}`] : [];
/** 소제목마다 독립 표(헤더+구분선+행)를 둬서 마크다운 표가 깨지지 않게 한다. */
export function renderFreeSectionMarkdown(lists: RoleLists | undefined, unmeasured: readonly string[] = [], limit = 5): string[] {
  if (!lists) return [FREE_HEADING, '', FREE_EMPTY_NOTE];
  return [FREE_HEADING, '', '### 오케스트레이터', '', MD_HEAD, ...rows(pick(lists.orchestrator, limit), true),
    '', '### 워커', '', MD_HEAD, ...rows(pick(lists.worker, limit), true), '', ...FREE_LIMIT_NOTES, ...unmeasuredLine(unmeasured)];
}
export function renderFreeSectionCompact(lists: RoleLists | undefined, unmeasured: readonly string[] = [], limit = 3): string[] {
  if (!lists) return [FREE_HEADING, FREE_EMPTY_NOTE];
  return [FREE_HEADING, ...rows(pick(lists.orchestrator, limit), false), ...rows(pick(lists.worker, limit), false),
    ...FREE_LIMIT_NOTES, ...unmeasuredLine(unmeasured)];
}
