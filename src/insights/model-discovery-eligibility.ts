import { normalizeDiscoveryModelId, type DiscoveredModel } from './model-discovery-types.js';

/** 후보 편입을 막는 사유. 모든 사유는 fail-closed(하나라도 걸리면 편입 불가). */
export type EligibilityReason =
  | 'invalid-model-id'
  | 'duplicate-model-id'
  | 'unverified'
  | 'invalid-source-url'
  | 'invalid-checked-on'
  | 'missing-tier'
  | 'missing-effort';

export interface RejectedModel { readonly modelId: string; readonly reasons: readonly EligibilityReason[]; }
export interface EligibilityReport {
  readonly eligible: readonly DiscoveredModel[];
  readonly rejected: readonly RejectedModel[];
}

const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._:+-]{0,127}$/;
const CHECKED_ON_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 정규화 id가 식별자로 쓸 수 있는지. 제어문자·공백·과도한 길이는 거부한다. */
export function isValidModelId(modelId: string): boolean {
  return MODEL_ID_PATTERN.test(normalizeDiscoveryModelId(modelId));
}

/** URL 모양 검증(https + host). 공식성 판단이 아니다 — 공식성은 verified 사실로만 온다. */
export function isValidSourceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

/** YYYY-MM-DD 달력 날짜. 존재하지 않는 날짜(2026-02-30 등)은 거부한다. */
export function isValidCheckedOn(value: string): boolean {
  const match = CHECKED_ON_PATTERN.exec(value);
  if (match === null) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3]);
}

/** 모델 1건의 편입 사유 목록. verified는 입력값을 읽기만 하고 바꾸지 않는다. */
export function modelEligibilityReasons(model: DiscoveredModel): readonly EligibilityReason[] {
  const reasons: EligibilityReason[] = [];
  if (!isValidModelId(model.modelId)) reasons.push('invalid-model-id');
  if (model.verified !== true) reasons.push('unverified');
  if (!isValidSourceUrl(model.sourceUrl)) reasons.push('invalid-source-url');
  if (!isValidCheckedOn(model.checkedOn)) reasons.push('invalid-checked-on');
  if (model.planIds.length === 0 || model.planIds.some(plan => plan.trim() === '')) reasons.push('missing-tier');
  const efforts = model.efforts ?? [];
  if (efforts.length === 0 || efforts.some(effort => effort.trim() === '')) reasons.push('missing-effort');
  return reasons;
}

/** provider 목록을 편입 가능·거부로 나눈다. 같은 id가 둘 이상이면 그 id 전체를 거부한다(모호 fail-closed). */
export function checkEligibility(models: readonly DiscoveredModel[]): EligibilityReport {
  const counts = new Map<string, number>();
  for (const model of models) {
    const key = normalizeDiscoveryModelId(model.modelId);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const eligible: DiscoveredModel[] = [], rejected: RejectedModel[] = [];
  for (const model of models) {
    const key = normalizeDiscoveryModelId(model.modelId);
    const reasons = [...modelEligibilityReasons(model)];
    if ((counts.get(key) ?? 0) > 1) reasons.push('duplicate-model-id');
    if (reasons.length === 0) eligible.push(model);
    else rejected.push({ modelId: model.modelId, reasons });
  }
  return { eligible, rejected };
}

/** 단건 편입 여부. 중복 판정은 목록 단위(checkEligibility)에서만 한다. */
export function isEligibleModel(model: DiscoveredModel): boolean {
  return modelEligibilityReasons(model).length === 0;
}
