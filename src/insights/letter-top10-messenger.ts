import { splitBaseAndEffort } from './letter-top10-group.js';
import { activeLetterModelLists, banSetFor, listKeyOf } from './letter-model-lists.js';
import { FREE_ACCESS_METRIC, type Top10Options, type Top10RecordInput } from './letter-top10-rank.js';
import { buildCandidatePool } from './letter-top10-candidates.js';
import { catalogWithDiscovery } from './model-discovery-catalog.js';
import { type OptimalZoneRole, type ScoredGroup } from './letter-top10-worker.js';
import { scoreRoleCandidatesFromSources } from './letter-top10-score.js';
import { normalRankScores } from './letter-score-normal.js';
import { PLAN_CATALOG, type PlanCatalogEntry } from './plan-catalog.js';
import { loadEffortAvailability, UNCONSTRAINED_AVAILABILITY } from './letter-effort-availability.js';
import { buildList, type RoleList } from './letter-top10-unified.js';

/** U2 단일 역할 계산 경로. 메신저는 워커와 같은 후보 풀·cap·가산·하한으로 계산하고
 *  메신저 가중치·임계만 적용한다. 3역할 파이프라인·렌더러·publish에는 연결하지 않는다.
 *  computeRoleTop10의 오케·워커 출력은 그대로 둔다. */
export function computeRoleList(records: readonly Top10RecordInput[], role: OptimalZoneRole | 'messenger', opts?: Top10Options): RoleList {
  const av = opts?.effortAvailability ?? loadEffortAvailability(), input: Top10Options = { ...(opts ?? {}), ...(av && { effortAvailability: av }) };
  const lists = input.letterModelLists ?? activeLetterModelLists(), excluded = new Set([...(input.excludeModelIds ?? [])].map(id => listKeyOf(splitBaseAndEffort(id).base)));
  const base = input.catalog ?? PLAN_CATALOG, catalog = catalogWithDiscovery([...base, ...(input.freeCatalog ?? []).filter(f => !base.some(p => p.planId === f.planId))], { ...(lists.discovery?.autoEnroll !== undefined ? { autoEnroll: lists.discovery.autoEnroll } : {}) });
  const freeRows = catalog.filter(p => p.tier === 'free').flatMap(p => p.models.filter(m => m.verified).map(m => ({ modelId: m.modelId, metric: FREE_ACCESS_METRIC, value: 0 })));
  const evidence = [...(input.openrouterRecords ?? []), ...(input.opencodeDataRecords ?? []), ...(input.cognitionRecords ?? []), ...freeRows];
  const candidates = buildCandidatePool(records, catalog, evidence, lists).accessibleRecords;
  const scored = scoreRoleCandidatesFromSources(candidates, role, input), calibrated = normalRankScores(scored.map(s => s.score));
  const cal = new Map<ScoredGroup, number>(scored.map((s, i): [ScoredGroup, number] => [s, calibrated[i]!]));
  const uncapped = scoreRoleCandidatesFromSources(candidates, role, { ...input, effortAvailability: UNCONSTRAINED_AVAILABILITY });
  const benchmark = new Map(uncapped.map(s => [s.group.baseModelId, s.group.repVariant.effort] as const));
  return buildList(candidates, role, input, catalog, new Set([...excluded, ...banSetFor(lists, role)]), scored, cal, lists.allowOlder, benchmark);
}
