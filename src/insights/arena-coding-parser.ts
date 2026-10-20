import { ORCHESTRATOR_EFFORT_ORDER } from './letter-top10-score-policy.js';
import {
  ARENA_CODING_RATING_METRIC,
  ARENA_CODING_SCORE_METRIC,
  ARENA_CODING_SUBSETS,
  type ArenaCodingSubset,
  type ParsedArenaCodingModel,
} from './arena-coding-types.js';

/** 허용 서브셋만 통과. 비코딩(text·vision·search·document·media)과 미확인 신호는 버린다.
 *  원문 HF 행에는 subset 열이 없다. 서브셋은 transport의 dataset config로
 *  별도 전달/주입한다(행 스키마와 파서 계약을 구분). */
export function isCodingSubset(subset: unknown): subset is ArenaCodingSubset {
  return typeof subset === 'string' && (ARENA_CODING_SUBSETS as readonly string[]).includes(subset);
}
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const text = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

/** 뒤에서부터 연속한 괄호 묶음을 모두 뽑는다(예: '(High) (0813)' → ['(High)','(0813)']). */
function trailingGroups(modelName: string): string[] {
  const groups: string[] = [];
  let rest = modelName.trim();
  for (;;) {
    const match = /\(([^()]*)\)\s*$/.exec(rest);
    if (!match) break;
    groups.unshift(match[1]!.trim());
    rest = rest.slice(0, match.index).trim();
  }
  return groups;
}

/** 한정자로 인정하는 토큰: 숫자가 섞인 표기(날짜·32K 등)와 관측된 하네스·추론 표기. */
const QUALIFIER_TOKENS = new Set(['thinking', 'non-thinking', 'reasoning', 'codex', 'harness', 'codex harness', 'preview']);
const isQualifierToken = (token: string): boolean => /\d/.test(token) || QUALIFIER_TOKENS.has(token);

/** effort 토큰은 정책 순서 집합만 인정한다. effort 토큰이 없으면 effort=default 이고 관측된
 *  한정자(날짜·하네스)만 남긴다 — '(High, 20260813)'·'(0902)'·'(Thinking)' 행을 버리지 않는다.
 *  effort 가 아닌 미지의 표기('Ultra')는 거부한다(지원 effort 를 default 로 잘못 표기하지 않음). */
export function parseEffortToken(modelName: string): { effort: string; qualifier?: string } | undefined {
  const groups = trailingGroups(modelName);
  if (!groups.length) return { effort: 'default' };
  const tokens = groups.flatMap(group => group.split(',').map(token => token.trim().toLowerCase()).filter(Boolean));
  const effort = tokens.find(token => (ORCHESTRATOR_EFFORT_ORDER as readonly string[]).includes(token));
  const rest = tokens.filter(token => token !== effort);
  if (rest.some(token => !isQualifierToken(token))) return undefined;
  const qualifier = rest.join(',');
  if (effort === undefined) return { effort: 'default', ...(qualifier && { qualifier }) };
  return qualifier ? { effort, qualifier } : { effort };
}

/** 표시명 → kebab base id. 괄호 묶음은 전부 제거한다(날짜 접미사는 그대로 둔다 = 자동 병합 금지). */
export function toBaseId(displayName: string): string {
  const noParen = trailingGroups(displayName).reduce((text, _group) => text.replace(/\s*\([^()]*\)\s*$/, ''), displayName.trim());
  const trimmed = noParen.trim().toLowerCase();
  return trimmed.replace(/[\s_]+/g, '-').replace(/(?<=\d)\.(?=\d)/g, '-').replace(/-+/g, '-');
}

/** HF 행 1건을 파싱한다. 서브셋은 행이 아니라 transport config로 주입한다.
 *  허용 밖·형식 오류·값 결측은 undefined. IPS 음수를 포함한 수치는 그대로 보존한다. */
export function parseArenaCodingRow(input: unknown, subset: unknown): ParsedArenaCodingModel | undefined {
  if (typeof input !== 'object' || input === null) return undefined;
  if (!isCodingSubset(subset)) return undefined;
  const row = input as Record<string, unknown>;
  const displayName = text(row.model_name);
  const parsed = displayName ? parseEffortToken(displayName) : undefined;
  if (!displayName || !parsed) return undefined;
  const baseId = toBaseId(displayName);
  if (!baseId) return undefined;
  const category = text(row.category) ?? 'overall';
  const rank = num(row.rank);
  const publishDate = text(row.leaderboard_publish_date);
  const agent = (subset as string).startsWith('agent_');
  const value = agent ? num(row.score) : num(row.rating);
  if (value === undefined) return undefined;
  return {
    subset, category, displayName, baseId, effort: parsed.effort,
    ...(parsed.qualifier !== undefined && { effortQualifier: parsed.qualifier }),
    metric: agent ? ARENA_CODING_SCORE_METRIC : ARENA_CODING_RATING_METRIC, value,
    ...(num(agent ? row.score_ci_lower : row.rating_lower) !== undefined &&
      { ciLower: num(agent ? row.score_ci_lower : row.rating_lower)! }),
    ...(num(agent ? row.score_ci_upper : row.rating_upper) !== undefined &&
      { ciUpper: num(agent ? row.score_ci_upper : row.rating_upper)! }),
    ...(num(agent ? row.observation_count : row.vote_count) !== undefined &&
      { observations: num(agent ? row.observation_count : row.vote_count)! }),
    ...(rank !== undefined && { rank }),
    ...(publishDate !== undefined && { publishDate }),
  };
}
