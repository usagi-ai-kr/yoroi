import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { packageRootFrom } from '../config/env-file.js';
import { normalizeModelName } from './letter-top10-rank.js';
import { ORCHESTRATOR_EFFORT_ORDER } from './letter-top10-score-policy.js';

/** #188: 환경·프로필별 effort 가용성. 모델 전역 상한이 아니라 명시적으로 선택한 관측 프로필이다. */
export interface EffortAvailabilityProfile {
  readonly observedAt?: string; readonly scope?: string;
  /** 관측으로 검증된 상한. 이 effort보다 높은 등급의 관측치는 점수·추천에서 제외된다. */
  readonly caps?: Readonly<Record<string, string>>;
  /** 근사 보고만 있고 미검증인 모델. 상한을 적용하지 않고 미확인 표기만 한다. */
  readonly unverifiedApproximate?: Readonly<Record<string, string>>;
  /** 표기 키(alias) → caps·unverifiedApproximate 키 매핑. 양쪽 모두 정규화된 이름으로 쓴다. */
  readonly aliases?: Readonly<Record<string, string>>;
}
export interface EffortAvailability { readonly activeProfile?: string; readonly profiles?: Readonly<Record<string, EffortAvailabilityProfile>>;
  /** 환경변수 미지정 시 활성화할 기본 프로필(설정 파일 선언). */
  readonly defaultProfile?: string }
export type AvailabilityMode = 'capped' | 'unverified' | 'unlisted';
export interface AvailabilityState { readonly mode: AvailabilityMode; readonly cap?: string; readonly profile?: string; readonly observedAt?: string }
export const EFFORT_AVAILABILITY_PATH = resolve(packageRootFrom(import.meta.url), 'config/effort-availability.json');
/** 점수 정책을 cap 없이 그대로 적용할 때 쓰는 명시적 무제한 가용성(활성 프로필 없음 → 모든 모델 unlisted). */
export const UNCONSTRAINED_AVAILABILITY: EffortAvailability = {};
/** 관측 프로필은 런타임 선택자(환경변수)로만 활성화한다. 설정 파일만으로는 다른 환경이 이 관측 cap을 상속하지 않는다. */
export const EFFORT_PROFILE_ENV = 'YOROI_EFFORT_PROFILE';
export const effortRank = (effort: string): number => ORCHESTRATOR_EFFORT_ORDER.indexOf(effort as typeof ORCHESTRATOR_EFFORT_ORDER[number]);
/** cap 미지(none)·순서 밖 effort(default 등 base 공유 근거)는 항상 cap 안으로 본다. */
export const effortWithinCap = (effort: string, cap?: string): boolean =>
  cap === undefined || effortRank(effort) < 0 || effortRank(effort) <= effortRank(cap);
/** effort별 값 맵을 cap 안으로 좁한다. cap이 없거나 맵이 없으면 원본을 그대로 쓴다. */
export const mapWithinCap = (m?: ReadonlyMap<string, number>, cap?: string): ReadonlyMap<string, number> | undefined =>
  cap === undefined || !m ? m : new Map([...m].filter(([e]) => effortWithinCap(e, cap)));

const effortKeyOf = (value: unknown, detail: string): string => {
  const effort = typeof value === 'string' ? value.trim() : '';
  if (effortRank(effort) < 0) throw new Error(`Invalid effort availability: ${detail} 값 '${String(value)}'는 ORCHESTRATOR_EFFORT_ORDER 밖이다`);
  return effort;
};
const keyOf = (raw: string, profile: EffortAvailabilityProfile): string => {
  const key = normalizeModelName(raw);
  return normalizeModelName(profile.aliases?.[key] ?? key);
};
/** 프로필 해석: capped(검증된 상한) > unverified(근사 보고, 미적용) > unlisted(프로필 밖). 프로필이 없으면 unlisted다. */
export function resolveAvailability(base: string, av?: EffortAvailability): AvailabilityState {
  const profile = av?.activeProfile ? av.profiles?.[av.activeProfile] : undefined;
  if (!profile) return { mode: 'unlisted' };
  const key = keyOf(base, profile), cap = profile.caps?.[key], meta = { ...(av?.activeProfile && { profile: av.activeProfile }), ...(profile.observedAt && { observedAt: profile.observedAt }) };
  if (cap !== undefined) return { mode: 'capped', cap: effortKeyOf(cap, `caps[${key}]`), ...meta };
  if (profile.unverifiedApproximate?.[key] !== undefined) return { mode: 'unverified', ...meta };
  return { mode: 'unlisted' };
}
export const capOfModel = (base: string, av?: EffortAvailability): string | undefined => resolveAvailability(base, av).cap;
/** 파일이 없으면 정책 자체가 없다(unlisted). 프로필 활성화는 EFFORT_PROFILE_ENV 런타임 선택자로만 한다.
 *  선택자가 파일에 없는 프로필을 가리키거나 어떤 프로필의 cap 값이 순서 밖이면 예외로 멈춘다. */
export function loadEffortAvailability(path: string = EFFORT_AVAILABILITY_PATH): EffortAvailability | undefined {
  if (!existsSync(path)) return undefined;
  const raw = JSON.parse(readFileSync(path, 'utf8')) as EffortAvailability;
  for (const profile of Object.values(raw.profiles ?? {}))
    for (const [model, cap] of Object.entries(profile.caps ?? {})) effortKeyOf(cap, `caps[${model}]`);
  // 환경변수(명시 선택)가 우선, 없으면 설정의 defaultProfile 을 활성화한다.
  const selected = process.env[EFFORT_PROFILE_ENV]?.trim() || raw.defaultProfile?.trim();
  if (!selected) return raw.profiles ? { profiles: raw.profiles } : {};
  if (raw.profiles?.[selected] === undefined) throw new Error(`Invalid effort availability: 프로필 '${selected}'가 ${path}에 없다`);
  return { activeProfile: selected, profiles: raw.profiles };
}
