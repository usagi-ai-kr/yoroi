import { buildCatalogAliasResolver } from './model-aliases.js';
import { computeRoleTop10, type RoleEntry, type RoleList, type RoleLists } from './letter-top10-unified.js';
import { splitBaseAndEffort } from './letter-top10-group.js';
import type { PlanCatalogEntry } from './plan-catalog.js';
import { normalizeModelName, type Top10Options, type Top10RecordInput } from './letter-top10-rank.js';
import { PARETO_MARK, ROLE_LABELS, dimensionsLabel, dimensionsText } from './letter-top10-legend.js';
import type { OptimalZoneRole } from './letter-top10-worker.js';
export { barePlan, freeOnlyModelIds, shortPlan } from './letter-top10-plans.js';

/** Free 경로 칸: 알려진 free 플랜명에 공식 근거의 주의를 붙이고, 모르는 플랜은 이름 그대로 쓴다. */
const PATH: Readonly<Record<string, string>> = {
  'OpenCode Zen Free': 'OpenCode Zen Free',
  'OpenCode Go Free': 'OpenCode Go Free ⚠️세션 헤더 필요',
};
const pathOf = (plans: readonly string[]): string => plans.map(p => PATH[p] ?? p).join('+');
export const FREE_HEADING = '## 🆓 Free 티어';
export const FREE_EMPTY_NOTE = 'Free 목록 수집 실패(opencode models)';
const mdHead = (role: OptimalZoneRole): string => `| 순위 | 파레토 | 모델 | 추천 effort | 스코어 | ${dimensionsLabel(role)} | Free 경로 |\n| --- | --- | --- | --- | --- | --- | --- |`;
/** 네 소스(AA·Cognition·OR·OCD) 어디에도 근거가 없어 스코어를 못 낸 free 모델. */
const UNMEASURED = '근거 없음';
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

/** freeCatalog에는 있으나 순위를 매기지 못한 모델 ID(원 ID). 어느 소스 근거로든 Free 순위 표에 오른 모델(`ranked`)은
 *  미측정 행으로 다시 붙이지 않는다. */
export const unmeasuredFreeIds = (freeCatalog: readonly PlanCatalogEntry[] | undefined,
  records: readonly Top10RecordInput[], ranked?: RoleLists): readonly string[] => {
  if (!freeCatalog?.length) return [];
  const measured = new Set(records.filter(r => Number.isFinite(r.value))
    .map(r => normalizeModelName(splitBaseAndEffort(r.modelId).base)));
  for (const e of [...(ranked?.orchestrator.entries ?? []), ...(ranked?.worker.entries ?? [])]) measured.add(normalizeModelName(e.modelId));
  // 순위 표와 같은 별칭 해석(p29)을 써야 별칭으로 측정된 모델이 '미측정'에 함께 남지 않는다.
  const resolve = buildCatalogAliasResolver(records, freeCatalog.flatMap(p => p.models.map(m => m.modelId)));
  return [...new Set(freeCatalog.flatMap(p => p.models
    .filter(m => m.verified && !measured.has(resolve(normalizeModelName(m.modelId)))).map(m => m.modelId)))].sort();
};
export interface UnmeasuredFree { readonly modelId: string; readonly plans: readonly string[] }
/** 미측정 ID에 free 경로(플랜명)를 붙인다. 플랜 순서는 freeCatalog 순서다. */
export const unmeasuredFreeEntries = (freeCatalog: readonly PlanCatalogEntry[] | undefined,
  records: readonly Top10RecordInput[], ranked?: RoleLists): readonly UnmeasuredFree[] => unmeasuredFreeIds(freeCatalog, records, ranked).map(modelId => ({
  modelId, plans: (freeCatalog ?? []).filter(p => p.models.some(m => m.verified && m.modelId === modelId)).map(p => p.planName) }));

const numberOf = (text: string | undefined): number | undefined => {
  const value = Number(text);
  return text !== undefined && text !== '-' && Number.isFinite(value) ? value : undefined;
};
const scoreOf = (e: RoleEntry): number | undefined => numberOf(e.scoreText);
/** Free 표 파레토: 무료 모델은 단가가 모두 0(동일)이므로 스코어가 엄격히 더 높은 다른 free 모델이 없을 때만 👍. */
const starsOf = (entries: readonly RoleEntry[]): ReadonlySet<string> => {
  const values = entries.map(e => [e.modelId, scoreOf(e)] as const);
  return new Set(values.filter(([id, value]) => value !== undefined &&
    !values.some(([other, ov]) => other !== id && ov !== undefined && ov > value)).map(([id]) => id));
};

const rows = (entries: readonly RoleEntry[], markdown: boolean, role: OptimalZoneRole) => {
  const stars = starsOf(entries);
  return entries.map(e => {
    const rank = `${e.belowZone ? '▽ ' : ''}${e.rank}`, mark = stars.has(e.modelId) ? PARETO_MARK : '';
    const metric = dimensionsText(e, role);
    return markdown
      ? `| ${rank} | ${mark} | ${e.modelId} | ${e.repEffort} | ${e.scoreText ?? '-'} | ${metric} | ${pathOf(e.plans)} |`
      : `${rank}. ${e.modelId} · effort ${e.repEffort} · 스코어 ${e.scoreText ?? '-'} · ${metric} · ${pathOf(e.plans)}${mark ? ` · ${mark}` : ''}`;
  });
};
/** 근거 없는 free 모델도 목록 행으로 넣는다(2026-10-13 사용자 지시). 순위·스코어 없이 근거 칸에 '근거 없음'. */
const unmeasuredRows = (unmeasured: readonly UnmeasuredFree[], markdown: boolean, role: OptimalZoneRole): string[] => unmeasured.map(u => markdown
  ? `| - |  | ${u.modelId} | - | - | ${role === 'orchestrator' ? '-/-/-' : '-/-/-/-'} | ${pathOf(u.plans)} |`
  : `-. ${u.modelId} · ${UNMEASURED} · ${pathOf(u.plans)}`);
const pick = (list: RoleList, limit: number): readonly RoleEntry[] => list.entries.slice(0, limit);
/** 소제목마다 독립 표(헤더+구분선+행)를 둬서 마크다운 표가 깨지지 않게 한다. 미측정 행은 두 역할 표 끝에 함께 붙는다. */
export function renderFreeSectionMarkdown(lists: RoleLists | undefined, unmeasured: readonly UnmeasuredFree[] = [], limit = 5): string[] {
  if (!lists) return [FREE_HEADING, '', FREE_EMPTY_NOTE];
  return [FREE_HEADING, '', `### ${ROLE_LABELS.orchestrator}`, '', mdHead('orchestrator'), ...rows(pick(lists.orchestrator, limit), true, 'orchestrator'), ...unmeasuredRows(unmeasured, true, 'orchestrator'),
    '', `### ${ROLE_LABELS.worker}`, '', mdHead('worker'), ...rows(pick(lists.worker, limit), true, 'worker'), ...unmeasuredRows(unmeasured, true, 'worker'), '', ...FREE_LIMIT_NOTES];
}
export function renderFreeSectionCompact(lists: RoleLists | undefined, unmeasured: readonly UnmeasuredFree[] = [], limit = 3): string[] {
  if (!lists) return [FREE_HEADING, FREE_EMPTY_NOTE];
  return [FREE_HEADING, ...rows(pick(lists.orchestrator, limit), false, 'orchestrator'), ...rows(pick(lists.worker, limit), false, 'worker'),
    ...unmeasuredRows(unmeasured, false, 'worker'), ...FREE_LIMIT_NOTES];
}
