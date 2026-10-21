/** #253: 권장 팀 조합 — 역할별 Top15 후보에서 슬롯(1+1+3 / 1+2) · identityKey 유일 · 합산 점수 최대 · 결정론적 tie-break. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { packageRootFrom } from '../config/env-file.js';
import type { RoleCandidate } from './letter-role-selection.js';
import { keyOf, runnersUp, sorted, type RoleRunnersUp, type TeamPlan } from './letter-team-runners.js';

export type TeamRole = 'orchestrator' | 'reviewer' | 'worker';
export type TeamCombinationKey = 'best-1+1+3' | 'best-1+2' | 'open-1+1+3' | 'open-1+2';
export interface TeamSlot { readonly role: TeamRole; readonly modelId: string; readonly score?: number; readonly effort?: string; readonly free?: boolean }
export interface TeamCombination {
  readonly key: TeamCombinationKey;
  readonly label: string;
  readonly slots: readonly TeamSlot[];
  readonly runnersUp: RoleRunnersUp;
  readonly totalScore: number;
  /** 측정된 슬롯만 합산한 totalScore에 들어가지 못한 미측정 슬롯 */
  readonly unmeasured: number;
  readonly feasible: boolean;
  readonly reason?: string;
}
export interface TeamCombinationInput {
  readonly top15: {
    readonly orchestrator: readonly RoleCandidate[];
    readonly reviewer: readonly RoleCandidate[];
    readonly worker: readonly RoleCandidate[];
  };
  /** 검증된 오픈 웨이트 base id 집합(비어 있으면 오픈 조합은 구성 불가 — 브랜드명 자동 판정 금지). */
  readonly openWeightKeys?: ReadonlySet<string>;
  /** 점수 없는 Free 워커 fallback({ modelId, free: true }). 점수 후보가 부족할 때만 채운다. */
  readonly freeWorkerFallback?: readonly RoleCandidate[];
}
export interface SlotCounts { readonly orchestrator: number; readonly reviewer: number; readonly worker: number; }

const COUNTS: Record<'1+1+3' | '1+2', SlotCounts> = {
  '1+1+3': { orchestrator: 1, reviewer: 1, worker: 3 }, '1+2': { orchestrator: 1, reviewer: 0, worker: 2 } };
export const OPEN_WEIGHT_PATH = resolve(packageRootFrom(import.meta.url), 'config/open-weight-models.json');
const effortOf = (c: RoleCandidate): string | undefined => (typeof c.effort === 'string' ? c.effort : undefined);
const slot = (role: TeamRole, c: RoleCandidate): TeamSlot => {
  const effort = effortOf(c);
  return { role, modelId: c.modelId, ...(c.score !== undefined && { score: c.score }), ...(effort && { effort }),
    ...((c as { readonly free?: unknown }).free === true && { free: true }) };
};
const choose = <T>(items: readonly T[], n: number): readonly (readonly T[])[] =>
  n === 0 ? [[]] : items.flatMap((item, i) => choose(items.slice(i + 1), n - 1).map(rest => [item, ...rest]));

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

/** 전수 탐색 최대 배정(그리디 방지·동점 선착). 비교: 측정 총점 desc → unmeasured asc → 선착. */
const bestPlan = (plan: TeamPlan, counts: SlotCounts): { readonly slots: readonly TeamSlot[]; readonly total: number; readonly unmeasured: number; readonly picked: ReadonlySet<string> } | undefined => {
  let best: { readonly slots: readonly TeamSlot[]; readonly total: number; readonly unmeasured: number; readonly picked: ReadonlySet<string> } | undefined;
  for (const os of choose(plan.o, counts.orchestrator)) for (const rs of choose(plan.r, counts.reviewer))
    for (const ws of choose(plan.w, counts.worker)) {
      const picked = [...os, ...rs, ...ws], keys = picked.map(keyOf);
      if (new Set(keys).size !== keys.length) continue; // 조합 내 동일 실체 1회만
      const slots = [...os.map(c => slot('orchestrator', c)), ...rs.map(c => slot('reviewer', c)), ...ws.map(c => slot('worker', c))];
      const total = slots.reduce((sum, s) => s.score === undefined ? sum : sum + s.score, 0), unmeasured = slots.filter(s => s.score === undefined).length;
      if (!best || total > best.total || (total === best.total && unmeasured < best.unmeasured)) best = { slots, total, unmeasured, picked: new Set(keys) };
    }
  return best;
};

const shortage = (plan: TeamPlan, counts: SlotCounts): string | undefined => {
  const lack = (have: number, need: number, role: string): string => `${role} ${need - have}개 부족`;
  const missing = [...(plan.o.length < counts.orchestrator ? [lack(plan.o.length, counts.orchestrator, '오케')] : []),
    ...(counts.reviewer > 0 && plan.r.length < counts.reviewer ? [lack(plan.r.length, counts.reviewer, '리뷰어')] : []),
    ...(plan.w.length < counts.worker ? [lack(plan.w.length, counts.worker, '워커')] : [])];
  return missing.length ? missing.join(' · ') : undefined;
};

const buildOne = (key: TeamCombinationKey, label: string, plan: TeamPlan, shape: '1+1+3' | '1+2'): TeamCombination => {
  const counts = COUNTS[shape], best = bestPlan(plan, counts);
  if (best) return { key, label, slots: best.slots,
    runnersUp: runnersUp(plan, best.picked, best.slots.map(s => s.role)), totalScore: best.total, unmeasured: best.unmeasured, feasible: true };
  return { key, label, slots: [], runnersUp: {}, totalScore: 0, unmeasured: 0, feasible: false, reason: shortage(plan, counts) ?? '유효 조합 없음' };
};

/** 권장 조합 4개(최선·오픈·Free × 1+1+3·1+2). */
export const buildTeamCombinations = (input: TeamCombinationInput): readonly TeamCombination[] => {
  const free = input.freeWorkerFallback ?? [];
  const freshFree = (list: readonly RoleCandidate[]): readonly RoleCandidate[] => free.filter(f => !list.some(c => keyOf(c) === keyOf(f)));
  const sw = sorted(input.top15.worker), base: TeamPlan = { o: sorted(input.top15.orchestrator), r: sorted(input.top15.reviewer), w: [...sw, ...freshFree(sw)] };
  const open = input.openWeightKeys ?? new Set<string>();
  const only = (list: readonly RoleCandidate[]): readonly RoleCandidate[] => list.filter(c => open.has(keyOf(c)));
  const ow = only(base.w), openPlan: TeamPlan = { o: only(base.o), r: only(base.r), w: [...ow, ...freshFree(ow)] };
  return [
    buildOne('best-1+1+3', '가장 최선 · 오케 1 + 리뷰 1 + 워커 3', base, '1+1+3'), buildOne('best-1+2', '가장 최선 · 오케 1 + 워커 2', base, '1+2'),
    buildOne('open-1+1+3', '오픈 웨이트·Free · 오케 1 + 리뷰 1 + 워커 3', openPlan, '1+1+3'), buildOne('open-1+2', '오픈 웨이트·Free · 오케 1 + 워커 2', openPlan, '1+2'),
  ];
};
