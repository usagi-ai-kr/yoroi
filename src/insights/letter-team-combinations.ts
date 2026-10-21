/** #253: 권장 팀 조합 — 역할별 Top7 후보에서 슬롯(1+1+3 / 1+2)을 조합한다.
 *  조합 내 identityKey 유일 · 역할 합산 점수 최대 · 결정론적 tie-break. 점수·순위·선발은 불변. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { packageRootFrom } from '../config/env-file.js';
import { resolveIdentityKey, type RoleCandidate } from './letter-role-selection.js';

export type TeamRole = 'orchestrator' | 'reviewer' | 'worker';
export type TeamCombinationKey = 'best-1+1+3' | 'best-1+2' | 'open-1+1+3' | 'open-1+2';
export interface TeamSlot { readonly role: TeamRole; readonly modelId: string; readonly score?: number; readonly effort?: string; }
export interface TeamCombination {
  readonly key: TeamCombinationKey;
  readonly label: string;
  readonly slots: readonly TeamSlot[];
  readonly totalScore: number;
  readonly feasible: boolean;
  readonly reason?: string;
}
export interface TeamCombinationInput {
  readonly top7: {
    readonly orchestrator: readonly RoleCandidate[];
    readonly reviewer: readonly RoleCandidate[];
    readonly worker: readonly RoleCandidate[];
  };
  /** 검증된 오픈 웨이트 base id 집합(비어 있으면 오픈 조합은 구성 불가 — 브랜드명 자동 판정 금지). */
  readonly openWeightKeys?: ReadonlySet<string>;
}
export interface SlotCounts { readonly orchestrator: number; readonly reviewer: number; readonly worker: number; }

const COUNTS: Record<'1+1+3' | '1+2', SlotCounts> = {
  '1+1+3': { orchestrator: 1, reviewer: 1, worker: 3 }, '1+2': { orchestrator: 1, reviewer: 0, worker: 2 } };
export const OPEN_WEIGHT_PATH = resolve(packageRootFrom(import.meta.url), 'config/open-weight-models.json');
const effortOf = (c: RoleCandidate): string | undefined => (typeof c.effort === 'string' ? c.effort : undefined);
const keyOf = (c: RoleCandidate): string => resolveIdentityKey(c);
/** 점수 내림차순 → identityKey 오름차순(동점 결정론). */
const sorted = (list: readonly RoleCandidate[]): readonly RoleCandidate[] =>
  [...list].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || keyOf(a).localeCompare(keyOf(b)));
const choose = <T>(items: readonly T[], n: number): readonly (readonly T[])[] =>
  n === 0 ? [[]] : items.flatMap((item, i) => choose(items.slice(i + 1), n - 1).map(rest => [item, ...rest]));
const slot = (role: TeamRole, c: RoleCandidate): TeamSlot => {
  const effort = effortOf(c);
  return { role, modelId: c.modelId, ...(c.score !== undefined && { score: c.score }), ...(effort && { effort }) };
};

/** 검증된 오픈 웨이트 registry 의 base id 집합(근거 없는 항목은 넣지 않는다). */
export const loadOpenWeightKeys = (path: string = OPEN_WEIGHT_PATH): ReadonlySet<string> => {
  if (!existsSync(path)) return new Set();
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const models = (parsed as { models?: { modelId?: string; openWeights?: boolean }[] } | null)?.models;
    if (!Array.isArray(models)) return new Set();
    return new Set(models.filter(m => m?.openWeights === true).map(m => m?.modelId)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0));
  } catch { return new Set(); }
};

interface Plan { readonly o: readonly RoleCandidate[]; readonly r: readonly RoleCandidate[]; readonly w: readonly RoleCandidate[]; }

/** 전수 탐색으로 역할 합산 점수 최대 배정을 찾는다(그리디 소진 방지 · 동점은 먼저 나온 배정 채택). */
const bestPlan = (plan: Plan, counts: SlotCounts): { readonly slots: readonly TeamSlot[]; readonly total: number } | undefined => {
  let best: { readonly slots: readonly TeamSlot[]; readonly total: number } | undefined;
  for (const os of choose(plan.o, counts.orchestrator)) for (const rs of choose(plan.r, counts.reviewer))
    for (const ws of choose(plan.w, counts.worker)) {
      const picked = [...os, ...rs, ...ws], keys = picked.map(keyOf);
      if (new Set(keys).size !== keys.length) continue; // 조합 내 동일 실체 1회만
      const slots = [...os.map(c => slot('orchestrator', c)), ...rs.map(c => slot('reviewer', c)), ...ws.map(c => slot('worker', c))];
      const total = slots.reduce((sum, s) => sum + (s.score ?? 0), 0);
      if (!best || total > best.total) best = { slots, total };
    }
  return best;
};

const shortage = (plan: Plan, counts: SlotCounts): string | undefined => {
  const missing: string[] = [];
  if (plan.o.length < counts.orchestrator) missing.push(`오케 ${counts.orchestrator - plan.o.length}개 부족`);
  if (counts.reviewer > 0 && plan.r.length < counts.reviewer) missing.push(`리뷰어 ${counts.reviewer - plan.r.length}개 부족`);
  if (plan.w.length < counts.worker) missing.push(`워커 ${counts.worker - plan.w.length}개 부족`);
  return missing.length ? missing.join(' · ') : undefined;
};

const buildOne = (key: TeamCombinationKey, label: string, plan: Plan, shape: '1+1+3' | '1+2'): TeamCombination => {
  const counts = COUNTS[shape], best = bestPlan(plan, counts);
  if (best) return { key, label, slots: best.slots, totalScore: best.total, feasible: true };
  return { key, label, slots: [], totalScore: 0, feasible: false, reason: shortage(plan, counts) ?? '유효 조합 없음' };
};

/** 권장 조합 4개(가장 최선·오픈 웨이트 × 1+1+3·1+2). 점수·순위·가중치 변경 없음. */
export const buildTeamCombinations = (input: TeamCombinationInput): readonly TeamCombination[] => {
  const base: Plan = { o: sorted(input.top7.orchestrator), r: sorted(input.top7.reviewer), w: sorted(input.top7.worker) };
  const open = input.openWeightKeys ?? new Set<string>();
  const only = (list: readonly RoleCandidate[]): readonly RoleCandidate[] => list.filter(c => open.has(keyOf(c)));
  const openPlan: Plan = { o: only(base.o), r: only(base.r), w: only(base.w) };
  return [
    buildOne('best-1+1+3', '가장 최선 · 오케 1 + 리뷰 1 + 워커 3', base, '1+1+3'),
    buildOne('best-1+2', '가장 최선 · 오케 1 + 워커 2', base, '1+2'),
    buildOne('open-1+1+3', '오픈 웨이트 · 오케 1 + 리뷰 1 + 워커 3', openPlan, '1+1+3'),
    buildOne('open-1+2', '오픈 웨이트 · 오케 1 + 워커 2', openPlan, '1+2'),
  ];
};
