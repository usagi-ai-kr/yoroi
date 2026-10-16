import { SOURCE_ATTRIBUTIONS } from './source-attribution.js';
import { DIMENSION_LABELS, ROLE_DIMENSION_WEIGHTS, ROLE_DIMENSIONS, WORKER_INTEL_FLOOR, type ScoreDimension } from './letter-top10-score.js';
import { WORKER_BONUS_CAP } from './letter-top10-score-weights.js';
import type { OptimalZoneRole } from './letter-top10-worker.js';

export const MARKDOWN_LIMIT = 65536;
export const OMISSION_MARK = '(이하 생략 — 전체는 `--full`)';
/** Attribution lines follow the source registry so a new source (e.g. OpenCode Data) cannot be missed. */
export const SOURCE_LINES: readonly string[] = SOURCE_ATTRIBUTIONS;

export function escapeShields(text: string): string {
  return encodeURIComponent(text.replace(/_/g, '__').replace(/-/g, '--')).replace(/%20/g, '_');
}

export function statusBadge(failed: readonly string[], partial: readonly string[]): string {
  const [text, color] = failed.length ? [`${failed.length} failed`, 'critical']
    : partial.length ? [`${partial.length} partial`, 'warning'] : ['all healthy', 'success'];
  return `![status](https://img.shields.io/badge/status-${escapeShields(text)}-${color})`;
}

/** 실패 소스 안내 본문: 실패를 먼저, 부분 수집을 그다음에, 둘 다 없을 때만 정상 문구를 쓴다. */
export function sourceStatusLines(failed: readonly string[], partial: readonly string[]): string[] {
  const lines = failed.map(s => `- ⚠️ ${s}`);
  if (partial.length) lines.push(`- ⚠️ 부분 수집 소스: ${partial.join(', ')} (일부 행 거절·결측)`);
  if (!failed.length && !partial.length) lines.push('- 모든 소스 정상 수집 완료');
  return lines;
}

/** Cuts at a code-point boundary first (surrogate pairs stay intact) and then at the last row
 *  boundary, so a table row or the <details> block is never split mid-row; the omitted tail is
 *  marked with a pointer to `--full`. */
export function truncateAtRowBoundary(text: string, limit = MARKDOWN_LIMIT): string {
  if ([...text].length <= limit) return text;
  const clipped = [...text].slice(0, limit).join('');
  const cut = clipped.lastIndexOf('\n');
  return `${cut > 0 ? clipped.slice(0, cut) : clipped}\n\n${OMISSION_MARK}`;
}

/** 표시·가중 차원: 역할 차원 중 가중치가 0보다 큰 것만이다(p85 워커는 사용량 0 → 성능/속도/가격, 사용량은 가산 입력). */
export const displayDimensions = (role: OptimalZoneRole): readonly ScoreDimension[] =>
  ROLE_DIMENSIONS[role].filter(d => (ROLE_DIMENSION_WEIGHTS[role][d] ?? 0) > 0);
/** 역할별 표시 라벨: 오케 price 차원은 가성비(R 1.0.2)다. core가 ROLE_DIMENSION_LABELS를 재export하면 이 지역 정의를 대체한다. */
export const ROLE_DIMENSION_LABELS: Readonly<Record<OptimalZoneRole, Readonly<Record<ScoreDimension, string>>>> = {
  orchestrator: { ...DIMENSION_LABELS, price: '가성비' }, worker: DIMENSION_LABELS };
/** 가중치 퍼센트(소수 1자리, 예: 0.05 → 5). config(ROLE_DIMENSION_WEIGHTS)가 단일 원본이다. */
export const weightPct = (role: OptimalZoneRole, d: ScoreDimension): number => Number(((ROLE_DIMENSION_WEIGHTS[role][d] ?? 0) * 100).toFixed(1));
/** 스코어 산출 공식 문구(p75: 오케 성능/사용량/속도, p85: 워커 성능/속도/가격+가산, 역할별 가중치). 상수는 letter-top10-score.ts에서 읽는다. */
const weightsText = (role: OptimalZoneRole): string =>
  displayDimensions(role).map(d => `${ROLE_DIMENSION_LABELS[role][d]} ${weightPct(role, d)}%`).join('·');
/** compact 가중치 표기: 표시 차원 순서의 퍼센트만(예: 70/5/10/15%). 숫자는 config에서 생성한다. */
const weightShares = (role: OptimalZoneRole): string => `${displayDimensions(role).map(d => weightPct(role, d)).join('/')}%`;
/** compact 차원 이름(표 순서): 가성비·가격은 역할별 라벨을 함께 적는다. */
const compactDimensionNames = (): string => displayDimensions('orchestrator')
  .map(d => d === 'price' ? `${ROLE_DIMENSION_LABELS.orchestrator.price}/${ROLE_DIMENSION_LABELS.worker.price}` : ROLE_DIMENSION_LABELS.orchestrator[d]).join('·');
export const SCORE_FORMULA_LINES: readonly string[] = [
  `- 스코어 = 100 × Σ(가중치 × 차원값), 결측 0점(재분배 없음), 동점 모델명`,
  `- 가중치: 오케·리뷰어 ${weightsText('orchestrator')} / 워커·메신저 ${weightsText('worker')}`,
  '- 성능: 오케 AA Int·Cog, 워커 AA Int; 사용량: OR/OCD log10(워커는 가산); 속도: 오케 AA·Cog, 워커 AA',
  '- 가성비: 오케 max(AA I/(P+.01)·USD/1M 정방향, Cog USD/task 역방향) 소스별 log min-max, 결측 0',
  `- 워커 가격 = cost_per_task·total_cost log 역방향 min-max 평균(없으면 혼합 단가 \`*\`); 가산 = ${WORKER_BONUS_CAP}×평균(Cog 정답률·사용량, 있는 것만)`,
  `- 워커 intel ≥${WORKER_INTEL_FLOOR}(결측 제외); 오케 E=전 변형 풀 표준화·P1 최고점(성능·가성비 고려, 동점 낮은 effort); AA 지수도 E값`,
  '- off-peak·파레토, score 원 API',
];
/** compact 전용 짧은 산출 공식: 가중치는 config에서 생성하고 출처를 짧게 둔다. 가성비·intel 기준은 범례(LEGEND_LINES)가 설명하며, 전체 공식은 SCORE_FORMULA_LINES다. */
export const COMPACT_FORMULA_LINES: readonly string[] = [
  '- 스코어 = 100 × Σ(가중치 × 차원값), 결측 0점·동점 모델명',
  `- 가중치(${compactDimensionNames()}): 오케 ${weightShares('orchestrator')}, 워커 ${weightShares('worker')}`,
  '- 출처: 성능·속도 오케 AA·Cog/워커 AA, 사용량 OR·OCD',
  `- 워커 가격 cpt·total 평균(혼합단가 *), 가산 ${WORKER_BONUS_CAP}×평균`,
  '- 오케 전변형 P1(동점 낮은 effort)',
  '- off-peak·파레토, score 원 API',
];
