import { splitBaseAndEffort } from './letter-top10-group.js';
import type { Top10RecordInput } from './letter-top10-rank.js';
import { normalizeModelName } from './model-id.js';

export interface ModelAliasRule { readonly from: string; readonly to: string; readonly basis: string; readonly checkedOn: string; readonly sourceUrl?: string }
/** 검증된 명시 별칭만(p28 B 일부 + p30 URL 확인 3건, checkedOn 2026-10-13). 크기·변형 일반 규칙은 넣지 않는다.
 *  `to`는 normalizeModelName(A2 nvidia- 제거 포함) 후 키와 일치해야 한다. GA id가 AA에 생기면 resolveModelId가 무시한다. */
export const MODEL_ALIAS_RULES: readonly ModelAliasRule[] = [
  { from: 'muse-spark-1-3-contributor', to: 'muse-spark-1-3', basis: 'OR 날짜 2026-09-02 = AA 출시일 2026-09-02', checkedOn: '2026-10-13' },
  { from: 'mistral-large-4-0', to: 'mistral-large-4', basis: 'OR 날짜 2026-10-06 = AA 출시일 2026-10-06', checkedOn: '2026-10-13' },
  { from: 'nemotron-3-super', to: 'nemotron-3-super-120b-a12b', basis: 'Ollama 태그 전부 120b·120b-a12b 계열(12B active/120B total)',
    checkedOn: '2026-10-13', sourceUrl: 'https://ollama.com/library/nemotron-3-super/tags' },
  { from: 'nemotron-3-ultra', to: 'nemotron-3-ultra-550b-a55b', basis: 'Ollama 본문 550B total/55B active, 태그는 cloud 1개',
    checkedOn: '2026-10-13', sourceUrl: 'https://ollama.com/library/nemotron-3-ultra' },
  { from: 'gemini-3-1-pro', to: 'gemini-3-1-pro-preview', basis: 'Gemini API 정식판 ID 없이 preview뿐 · Antigravity 출시 2026-02-19 = AA 출시일',
    checkedOn: '2026-10-13', sourceUrl: 'https://ai.google.dev/gemini-api/docs/models' },
];

/** A1(p28): AA modelAlias의 괄호부(예: "(High)")를 떼어 normalize한 보조 키 → AA canonical.
 *  보조 키가 AA/catalog canonical과 겹치거나(universe) 여러 AA id가 같은 보조 키를 만들면 쓰지 않는다. */
export function buildCanonicalAliases(records: readonly Top10RecordInput[], universe: ReadonlySet<string>): ReadonlyMap<string, string> {
  const aux = new Map<string, Set<string>>();
  for (const r of records) {
    if (r.modelAlias === undefined) continue;
    const key = normalizeModelName(r.modelAlias.replace(/\([^)]*\)/g, ' ').trim().replace(/\s+/g, '-'));
    if (!key || universe.has(key)) continue;
    const canonical = normalizeModelName(splitBaseAndEffort(r.modelId).base);
    aux.set(key, (aux.get(key) ?? new Set()).add(canonical));
  }
  return new Map([...aux].filter(([, set]) => set.size === 1).map(([key, set]) => [key, [...set][0]!]));
}

/** 카탈로그·근거 매칭용 해석기(p29c): GA 판정 universe는 AA canonical만 쓴다(카탈로그 원본 id를 넣으면 차단됨).
 *  카탈로그 canonical과 evidence canonical을 같은 규칙으로 해석해 한 base로 합칠 수 있게 한다. */
export function buildCatalogAliasResolver(records: readonly Top10RecordInput[], catalogIds: readonly string[]):
  (canonical: string) => string {
  const aaUniverse = new Set(records.map(r => normalizeModelName(splitBaseAndEffort(r.modelId).base)));
  const aliases = buildCanonicalAliases(records, new Set([...aaUniverse, ...catalogIds.map(normalizeModelName)]));
  return canonical => resolveModelId(canonical, aliases, aaUniverse);
}

/** 별칭 적용: 입력 canonical이 universe(GA 판정은 AA canonical만 — 카탈로그 원본 id를 넣으면 별칭이 차단된다)에
 *  있으면 그대로 둔다(=GA가 AA에 생기면 별칭 무시). A1 보조 키 → 검증된 명시 별칭 순으로 한 번만 해석한다. */
export function resolveModelId(canonical: string, aliases: ReadonlyMap<string, string>, universe: ReadonlySet<string>): string {
  if (universe.has(canonical)) return canonical;
  const alias = aliases.get(canonical);
  if (alias !== undefined) return alias;
  const rule = MODEL_ALIAS_RULES.find(r => r.from === canonical);
  return rule === undefined ? canonical : rule.to;
}
