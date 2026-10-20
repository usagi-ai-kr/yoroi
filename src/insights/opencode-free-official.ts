/** #196 Free 근거: 공식 페이지(명시적 Free 표기)가 free 판정의 유일한 권위.
 *  free = 공식 가격 표의 'Free' 행 또는 공식 free 목록에 명시된 항목뿐이다.
 *  CLI 이름 접미사·models.dev 0/0·공개 모델 id API 의 '존재' 는 free 근거가 아니다. */
import type { PlanCatalogEntry, PlanModelEntry } from './plan-catalog.js';

export const OFFICIAL_ZEN_SOURCE_URL = 'https://opencode.ai/v2/docs/console/models';
export const OFFICIAL_GO_SOURCE_URL = 'https://opencode.ai/v2/docs/console/go';
export const OFFICIAL_ZEN_MODELS_URL = 'https://opencode.ai/inference/v1/models';
export const OFFICIAL_GO_MODELS_URL = 'https://opencode.ai/inference/go/v1/models';
/** 마지막 정상 확인(공식 페이지 직접 확인) 날짜. 라이브 페이지 확인이 실패하면 이 값을 honest date 로 쓴다. */
export const OFFICIAL_LISTING_CHECKED_ON = '2026-10-20';

/** 공식 Console(=Zen) free 목록(2026-10-20 가격 표 Free 행 + Free models 절 확인분). */
export const OFFICIAL_ZEN_FREE_IDS: readonly string[] = ['big-pickle', 'glm-5.3-flash-free', 'deepseek-v4.1-flash-free',
  'minimax-m3.1-flash-free', 'beam-free', 'll-alpha-free', 'longcat-2.5-preview-free', 'exo-free', 'mimo-v2.6-flash-free',
  'mimo-v2.5-free', 'nemotron-3-ultra-free', 'nemotron-3.5-lightning-free', 'nemotron-3.5-super-vl-free', 'jev-1.13-free'];
/** 공식 Go free 목록(2026-10-20 확인). Step 5 Preview 는 유료($1.00)다. */
export const OFFICIAL_GO_FREE_IDS: readonly string[] = ['beam-free', 'longcat-2.5-preview-free', 'minimax-m3.1-flash-free'];

export type OfficialListingStatus = 'live' | 'mixed' | 'last-good';

export interface OfficialFreeListing {
  readonly zen: readonly string[];
  readonly go: readonly string[];
  readonly checkedOn: string;
  /** live = 두 페이지 모두 라이브 Free 표기 확인 / mixed = 한쪽만 / last-good = 정적 스냅샷(확인일 2026-10-20). */
  readonly status: OfficialListingStatus;
  readonly source: 'official-page' | 'official-snapshot';
  readonly sourceUrls: readonly string[];
  /** 공개 모델 API 에 id 가 존재한다는 사실만. free 판정 근거가 아니다(프로모 종료 후에도 id 는 남을 수 있다). */
  readonly apiPresence?: Readonly<Record<'zen' | 'go', readonly string[] | undefined>>;
}

/** 공개 모델 API 응답 → id 목록. 형식이 다르면 undefined(근거 없음). */
export function parseOfficialModelIds(payload: unknown): readonly string[] | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return undefined;
  const ids: string[] = [];
  for (const item of data) {
    const id = typeof item === 'object' && item !== null ? (item as { id?: unknown }).id : undefined;
    if (typeof id !== 'string' || !id.trim()) return undefined;
    ids.push(id.trim());
  }
  return ids;
}

/** 공식 페이지 HTML → 명시적 Free 행의 모델 id. 가격·free 표기가 없는 id 는 free 로 보지 않는다. */
export function parseOfficialFreeIdsFromPage(html: string): readonly string[] | undefined {
  const nameToId = new Map<string, string>();
  for (const m of html.matchAll(/<td[^>]*>\s*([^<]{2,60}?)\s*<\/td>\s*<td[^>]*>\s*([a-z0-9][a-z0-9._-]{2,60})\s*<\/td>/g)) nameToId.set(m[1]!, m[2]!);
  const ids = new Set<string>();
  for (const m of html.matchAll(/<td[^>]*>\s*([^<]{2,60}?)\s*<\/td>\s*<td[^>]*>\s*Free\s*<\/td>\s*<td[^>]*>\s*Free\s*<\/td>/g)) {
    const id = nameToId.get(m[1]!);
    if (id) ids.add(id);
  }
  return ids.size ? [...ids] : undefined;
}

/** 라이브 페이지 Free 표기(있으면)와 정적 스냅샷을 합친 근거 목록. API 존재 여부는 참고로만 함께 실는다. */
export function officialFreeListing(input: {
  readonly zenPage?: readonly string[]; readonly goPage?: readonly string[];
  readonly zenApi?: readonly string[]; readonly goApi?: readonly string[]; readonly checkedOn?: string;
  /** @deprecated 구 인자명(zen/go) — API 존재 목록으로만 취급(무료 판정 근거 아님). w1 기존 호출 호환용. */
  readonly zen?: readonly string[]; readonly go?: readonly string[];
} = {}): OfficialFreeListing {
  const zen = input.zenPage ?? OFFICIAL_ZEN_FREE_IDS, go = input.goPage ?? OFFICIAL_GO_FREE_IDS;
  const live = (input.zenPage !== undefined ? 1 : 0) + (input.goPage !== undefined ? 1 : 0);
  const status: OfficialListingStatus = live === 2 ? 'live' : live === 1 ? 'mixed' : 'last-good';
  const zenApi = input.zenApi ?? input.zen, goApi = input.goApi ?? input.go;
  return { zen, go, status, source: live > 0 ? 'official-page' : 'official-snapshot',
    checkedOn: live > 0 ? (input.checkedOn ?? OFFICIAL_LISTING_CHECKED_ON) : OFFICIAL_LISTING_CHECKED_ON,
    sourceUrls: [OFFICIAL_ZEN_SOURCE_URL, OFFICIAL_GO_SOURCE_URL],
    apiPresence: { zen: zenApi, go: goApi } };
}

/** 저장소 정규 id(점·대소차 정규화). Free 표의 ✓ 는 이 id 기준으로 판정된다. */
export const canonicalFreeId = (id: string): string =>
  id.trim().toLowerCase().replace(/-(?:preview|contributor)$/g, '').replace(/\./g, '-').replace(/[^a-z0-9-]+/g, '-');

/** 공식 free 목록 → free 플랜 카탈로그(검증됨). 출처 URL·확인 날짜를 그대로 실어는다. */
export function officialFreePlans(listing: OfficialFreeListing,
  originalIds: ReadonlyMap<string, string> = new Map()): readonly PlanCatalogEntry[] {
  const plan = (planId: string, planName: string, ids: readonly string[], sourceUrl: string): PlanCatalogEntry => ({
    planId, planName, tier: 'free', models: ids.map((id): PlanModelEntry => ({
      modelId: canonicalFreeId(id), displayName: id, ...(originalIds.has(id) && { originalId: originalIds.get(id)! }),
      sourceUrl, checkedOn: listing.checkedOn, verified: true, free: true })) });
  return [plan('opencode-zen-free', 'OpenCode Zen Free', listing.zen, OFFICIAL_ZEN_SOURCE_URL),
    plan('opencode-go-free', 'OpenCode Go Free', listing.go, OFFICIAL_GO_SOURCE_URL)];
}
