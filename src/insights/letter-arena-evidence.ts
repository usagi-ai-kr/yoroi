import type { ArenaCodingRecord } from './arena-coding-model.js';
import { ARENA_CODING_DATASET_URL, ARENA_CODING_SOURCE_ID } from './sources-arena-coding-port.js';
import { buildCandidatePool, type CandidatePool } from './letter-top10-candidates.js';
import type { LetterModelLists } from './letter-model-lists.js';
import type { PlanCatalogEntry } from './plan-catalog.js';
import type { Top10RecordInput } from './letter-top10-rank.js';
import { EVIDENCE_METRICS } from './top10-policy.js';
import type { ValidatedInsightRecord } from './validation.js';

/** #190 단위E: Arena 코딩을 선택적 추가 근거로 쓰는 어댑터. 기본 꺼짐(기존 후보 풀·출력 불변). */
export const ARENA_EVIDENCE_METRICS = ['arena_coding_rating', 'arena_coding_score'] as const;

export interface ArenaEvidenceOptions {
  /** 명시적으로 켤 때만 후보 경로에 반영한다(기본 false). */
  readonly enabled?: boolean;
  /** 기존 근거 행(AA·OpenRouter·OpenCode Data·Cognition). 덮어쓰지 않고 뒤에 붙인다. */
  readonly existingEvidence?: readonly Top10RecordInput[];
  readonly maxRows?: number;
}

export interface ArenaEvidenceBundle {
  readonly enabled: boolean;
  /** 정책이 이 지표를 근거로 인정하지 않으면 반영하지 않는다(fail-closed). */
  readonly policyReady: boolean;
  readonly rows: readonly ArenaCodingRecord[];
  readonly attribution: readonly string[];
  /** 복합 식별키(subset·category·날짜 한정자). 같은 이름도 다른 항목은 다른 키다. */
  readonly identities: readonly string[];
  readonly blockedReason?: string;
}

/** Arena 행을 근거 행으로 변환한다. 출처·지표·복합 식별 근거를 그대로 보존한다. */
export function toArenaEvidenceRow(record: ArenaCodingRecord): ArenaCodingRecord {
  return { ...record };
}

/** 복합 식별키: subset·category·모델·날짜 한정자. 같은 이름이라도 다른 항목은 다른 키다(병합 금지). */
const identityOf = (record: ArenaCodingRecord): string =>
  [record.arenaSubset ?? '-', record.arenaCategory ?? '-', record.modelId, record.effortQualifier ?? '-'].join('|');

/** 근거 번들을 만든다. 꺼짐이면 아무것도 바꾸지 않는다(빈 행·빈 출처). */
export function buildArenaEvidenceBundle(records: readonly ArenaCodingRecord[], options: ArenaEvidenceOptions = {}): ArenaEvidenceBundle {
  const enabled = options.enabled === true;
  if (!enabled) return { enabled: false, policyReady: false, rows: [], attribution: [], identities: [] };
  const limit = options.maxRows ?? records.length;
  const rows = records.map(toArenaEvidenceRow).slice(0, limit);
  const policyReady = rows.every(row => (ARENA_EVIDENCE_METRICS as readonly string[]).includes(row.metric ?? '')) &&
    ARENA_EVIDENCE_METRICS.every(metric => (EVIDENCE_METRICS as readonly string[]).includes(metric));
  return {
    enabled: true, policyReady, rows,
    attribution: [`출처: Arena Coding (HF Leaderboard) (CC-BY-4.0 · ${ARENA_CODING_DATASET_URL} · source ${ARENA_CODING_SOURCE_ID})`],
    identities: rows.map(identityOf),
    ...(policyReady ? {} : { blockedReason: 'arena evidence metric is not registered in the evidence policy' }),
  };
}

/** 기존 근거 행을 보존한 채 arena 근거만 뒤에 붙인다(덮어쓰기·병합 없음). */
export function mergeArenaEvidence(existing: readonly Top10RecordInput[], bundle: ArenaEvidenceBundle): readonly Top10RecordInput[] {
  if (!bundle.enabled || !bundle.policyReady || !bundle.rows.length) return existing;
  return [...existing, ...bundle.rows];
}

/** 후보 경로에 arena 근거를 넣는다. 꺼짐이면 기존 호출과 완전히 동일하다. */
export function buildCandidatePoolWithArena(records: readonly Top10RecordInput[], catalog: readonly PlanCatalogEntry[],
  existingEvidence: readonly Top10RecordInput[], lists: LetterModelLists, bundle: ArenaEvidenceBundle): CandidatePool {
  return buildCandidatePool(records, catalog, mergeArenaEvidence(existingEvidence, bundle), lists);
}

/** 레터 노트용 1줄 요약: 출처를 분리해 밝히고 '점수 미반영'과 정책 게이트 상태를 함께 알린다. */
export function arenaEvidenceNote(bundle: ArenaEvidenceBundle): string | undefined {
  if (!bundle.enabled || !bundle.rows.length) return undefined;
  const subsets = [...new Set(bundle.rows.map(row => row.arenaSubset ?? '-'))];
  const top = bundle.rows.slice(0, 3).map(row => `${row.modelId} ${row.value ?? '-'}`);
  const gate = bundle.policyReady ? '후보군 반영 가능(가중치 미정)' : `후보군 반영 보류(${bundle.blockedReason ?? 'policy'})`;
  return `Arena 코딩 근거(성능 추가 근거·점수 미반영, ${gate}): ${subsets.join('·')} ${bundle.rows.length}행` +
    `${top.length ? ` — ${top.join(', ')}` : ''} · ${bundle.attribution.join(' / ')}`;
}

export interface ArenaEvidenceOutcome { readonly note?: string; readonly rowCount: number }

/** 수집된 arena 행 → 근거 번들 + 출처 분리 노트. 점수 계산 경로와 완전히 분리한다(#190). */
export function arenaEvidenceOutcome(records: readonly ValidatedInsightRecord[]): ArenaEvidenceOutcome {
  const rows: ArenaCodingRecord[] = records.map(value => ({ modelId: value.record.modelId, metric: value.record.metric, value: value.record.value,
    ...(typeof value.record.metadata?.effortQualifier === 'string' && { effortQualifier: value.record.metadata.effortQualifier }),
    ...(typeof value.record.metadata?.subset === 'string' && { arenaSubset: value.record.metadata.subset }),
    ...(typeof value.record.metadata?.category === 'string' && { arenaCategory: value.record.metadata.category }) }));
  const bundle = buildArenaEvidenceBundle(rows, { enabled: true });
  const note = arenaEvidenceNote(bundle);
  return { rowCount: bundle.rows.length, ...(note !== undefined && { note }) };
}
