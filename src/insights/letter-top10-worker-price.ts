import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { packageRootFrom } from '../config/env-file.js';
import { PLAN_CATALOG, type PlanCatalogEntry } from './plan-catalog.js';
import { isWorkerLike, WORKER_HELD_PLAN_IDS_DEFAULT, WORKER_HELD_PRICE_QUANTILE, WORKER_MIXED_PRICE_CAP_USD_PER_M } from './letter-top10-score-policy.js';

export const WORKER_HELD_PLAN_IDS_PATH = resolve(packageRootFrom(import.meta.url), 'config/held-plans.json');
/** 파일이 없으면 패키지 기본값, 있으면 계약 검증 뒤 파일 값을 쓴다. */
export function loadWorkerHeldPlanIds(path: string = WORKER_HELD_PLAN_IDS_PATH): readonly string[] {
  if (!existsSync(path)) return WORKER_HELD_PLAN_IDS_DEFAULT;
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new Error('Invalid held plans: root must be an object');
  const ids = (raw as { heldPlanIds?: unknown }).heldPlanIds;
  if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string'))
    throw new Error('Invalid held plans: heldPlanIds must be a string array');
  return ids;
}
export const WORKER_HELD_PLAN_IDS = loadWorkerHeldPlanIds();

/** Raise verified models in held plans to at least the candidate-pool price-dimension quantile. */
export function upliftHeldPlanPriceDimensions(modelIds: readonly string[], dimensions: readonly (number | undefined)[],
  heldPlanIds: readonly string[] = WORKER_HELD_PLAN_IDS, catalog: readonly PlanCatalogEntry[] = PLAN_CATALOG): (number | undefined)[] {
  if (modelIds.length !== dimensions.length) throw new Error('modelIds and price dimensions must have equal length');
  const plans = new Set(heldPlanIds), heldModels = new Set(catalog.filter(p => plans.has(p.planId))
    .flatMap(p => p.models.filter(m => m.verified).map(m => m.modelId)));
  const known = dimensions.filter((v): v is number => Number.isFinite(v));
  if (!known.length) return [...dimensions];
  const sorted = [...known].sort((a, b) => a - b), position = (sorted.length - 1) * WORKER_HELD_PRICE_QUANTILE;
  const low = Math.floor(position), high = Math.ceil(position), floor = sorted[low]! + (sorted[high]! - sorted[low]!) * (position - low);
  return dimensions.map((value, i) => Number.isFinite(value) && heldModels.has(modelIds[i]!) ? Math.max(value!, floor) : value);
}

/** score 경로의 blendedCost(활성 off-peak 덮어쓰기 포함)가 cap 초과면 below-zone 처리한다.
 *  U2: 메신저는 워커와 같은 cap 경로를 쓴다. 오케 동작은 불변이다. */
export function applyMixedPriceCap<T extends { readonly belowZone: boolean }>(role: 'worker' | 'orchestrator' | 'messenger',
  candidates: readonly T[], mixedUsdPerM: readonly (number | undefined)[]): T[] {
  if (candidates.length !== mixedUsdPerM.length) throw new Error('candidate and mixed-price arrays must have equal length');
  return candidates.map((candidate, i) => isWorkerLike(role) && Number.isFinite(mixedUsdPerM[i]) &&
    mixedUsdPerM[i]! > WORKER_MIXED_PRICE_CAP_USD_PER_M ? { ...candidate, belowZone: true } : candidate);
}
