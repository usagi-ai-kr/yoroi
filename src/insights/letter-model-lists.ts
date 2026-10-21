import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeModelName } from './model-id.js'; import { resolveModelId } from './model-aliases.js';
import { splitBaseAndEffort } from './letter-top10-group.js';

export interface LetterRoleLists { readonly common: string[]; readonly orchestrator: string[]; readonly worker: string[] }
export interface LetterModelListsDiscovery { readonly autoEnroll?: boolean; readonly collect?: boolean }
export interface LetterModelLists {
  readonly allowOlder: string[];
  readonly excludePatterns: string[];
  readonly ban: LetterRoleLists;
  readonly discovery?: LetterModelListsDiscovery;
}
export const DEFAULT_LETTER_MODEL_LISTS: LetterModelLists = {
  allowOlder: ['gpt-6-sol'], excludePatterns: ['fable', 'astra'],
  ban: { common: ['glm-5-3', 'kimi-k3', 'mimo-v2-6-pro'], orchestrator: [], worker: [] },
};
const EMPTY_ALIASES = new Map<string, string>(), EMPTY_UNIVERSE = new Set<string>();
/** 비교 키: 정규화 + 정적 별칭 해석. */
export const listKeyOf = (id: string): string =>
  resolveModelId(normalizeModelName(id), EMPTY_ALIASES, EMPTY_UNIVERSE);
const CONFIG_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'config', 'letter-model-lists.json');
const strList = (value: unknown): string[] =>
  (Array.isArray(value) ? value : []).filter((x): x is string => typeof x === 'string');
/** 설정 로드: 파일이 없으면 기본값, 키 누락은 항목별 기본값, 파싱 실패는 throw. */
export function loadLetterModelLists(path: string = CONFIG_PATH): LetterModelLists {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return DEFAULT_LETTER_MODEL_LISTS;
    throw error;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error(`invalid model lists: ${path}`);
  const record = raw as Record<string, unknown>, def = DEFAULT_LETTER_MODEL_LISTS;
  const banRaw = (typeof record.ban === 'object' && record.ban !== null ? record.ban : {}) as Record<string, unknown>;
  const discRaw = (typeof record.discovery === 'object' && record.discovery !== null ? record.discovery : {}) as Record<string, unknown>;
  // ban 하위 키 생략 시 빈 배열이 아니라 기본값(사본)을 쓴다 — 기본 밴이 설정 파일로 유지되게 한다.
  return {
    allowOlder: 'allowOlder' in record ? strList(record.allowOlder) : [...def.allowOlder],
    excludePatterns: 'excludePatterns' in record ? strList(record.excludePatterns) : [...def.excludePatterns],
    ...('discovery' in record ? { discovery: {
      ...(discRaw.autoEnroll === true ? { autoEnroll: true } : {}),
      ...(discRaw.collect === true ? { collect: true } : {}) } } : {}),
    ban: {
      common: 'common' in banRaw ? strList(banRaw.common) : [...def.ban.common],
      orchestrator: 'orchestrator' in banRaw ? strList(banRaw.orchestrator) : [...def.ban.orchestrator],
      worker: 'worker' in banRaw ? strList(banRaw.worker) : [...def.ban.worker],
    },
  };
}
/** 캐시된 활성 목록(파일 우선, 실패 시 기본값). */
let cached: LetterModelLists | undefined;
/** 설정 경로 해석: 명시 env → XDG → 레포 파일. 존재하는 첫 경로만 돌려준다. */
export function resolveLetterModelListsPath(env: NodeJS.ProcessEnv = process.env,
  exists: (path: string) => boolean = existsSync): string | undefined {
  const explicit = env.YOROI_LETTER_MODEL_LISTS?.trim();
  if (explicit && exists(explicit)) return explicit;
  const home = env.HOME?.trim() || homedir();
  const xdg = env.XDG_CONFIG_HOME?.trim() || join(home, '.config');
  const userPath = join(xdg, 'yoroi', 'letter-model-lists.json');
  if (exists(userPath)) return userPath;
  if (exists(CONFIG_PATH)) return CONFIG_PATH;
  return undefined;
}
export function activeLetterModelLists(env?: NodeJS.ProcessEnv): LetterModelLists {
  if (cached === undefined) {
    const path = resolveLetterModelListsPath(env ?? process.env);
    if (path === undefined) {
      cached = DEFAULT_LETTER_MODEL_LISTS;
    } else {
      try {
        cached = loadLetterModelLists(path);
      } catch {
        console.error(`[yoroi] letter-model-lists 파싱 실패: ${path} — 기본값 사용`);
        cached = DEFAULT_LETTER_MODEL_LISTS;
      }
    }
  }
  return cached;
}
/** 공통 blacklist 집합(정규화). 역할별 밴과 합치려면 banSetFor를 쓴다. */
export function commonBanSet(lists: LetterModelLists = activeLetterModelLists()): ReadonlySet<string> { return new Set(lists.ban.common.map(listKeyOf)); }
/** 공통 blacklist 적중 — base·정규화·별칭 기준(effort·provider·free 접미 포함, flash 등 유사 id 제외). */
export function isCommonBanned(modelId: string, banned: ReadonlySet<string> = commonBanSet()): boolean {
  const base = splitBaseAndEffort(modelId).base;
  const unfree = base.toLowerCase().endsWith('-free') ? base.slice(0, -'-free'.length) : base;
  return banned.has(listKeyOf(splitBaseAndEffort(unfree).base));
}
/** 밴 집합: 정규화된 공통 ∪ 역할. Top10 선발·보충에서 쓴다. */
export function banSetFor(lists: LetterModelLists, role: 'orchestrator' | 'worker'): ReadonlySet<string> {
  return new Set([...lists.ban.common, ...lists.ban[role]].map(listKeyOf));
}
/** 화이트리스트 쌍: 목록 모델이 한쪽에 있으면 세대·후속 분리를 건너뛴다(하드코딩 쌍 대체). */
export function isProtectedPair(a: string, b: string, allowOlder: readonly string[] = DEFAULT_LETTER_MODEL_LISTS.allowOlder): boolean {
  const ids = [normalizeModelName(a), normalizeModelName(b)], allow = new Set(allowOlder.map(normalizeModelName));
  return new Set(ids).size === 2 && ids.some(id => allow.has(id));
}
