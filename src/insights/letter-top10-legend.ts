import { OPTIMAL_ZONE_THRESHOLDS } from './letter-top10-worker.js';
import { DIMENSION_LABELS, PRICE_MISSING_VALUE, ROLE_SOURCES, WORKER_INTEL_FLOOR } from './letter-top10-score.js';
import type { ScoreDimension } from './letter-top10-score.js';
import { WORKER_BONUS_CAP } from './letter-top10-score-weights.js';
import { displayDimensions } from './letter-markdown-format.js';
import { SECTION_HEADINGS, type RoleChange, type RoleEntry, type RoleList } from './letter-top10-unified.js';
import type { OptimalZoneRole } from './letter-top10-worker.js';

/** 변동·이탈·안내 표기의 단일 출처: 마크다운과 압축 렌더가 같은 이모지를 쓴다. */
export function formatChange(change: RoleChange): string {
  if (change === '유지') return '➖';
  if (change === '진입') return '🆕';
  if (change === '신규') return '🌱';
  return change;
}
export const exitLine = (modelId: string, previousRank: number): string => `🚪 이탈: ${modelId} (전일 ${previousRank}위)`;
/** p75: 오케·리뷰어 성능/사용량/속도 3차원, p85: 워커·메신저 성능/속도/가격 3차원+가산 열, 가중치는 역할별. 역할 제목은 SECTION_HEADINGS 하나로 쓴다. */
export const ROLE_HEADINGS = SECTION_HEADINGS;
export const ROLE_LABELS = { orchestrator: '오케스트레이터·리뷰어', worker: '워커·메신저' } as const;
export const ZONE_TEXT = `스코어 ≥ 후보 최고 스코어 × ${OPTIMAL_ZONE_THRESHOLDS.orchestrator * 100}%(오케스트레이터·리뷰어)/${OPTIMAL_ZONE_THRESHOLDS.worker * 100}%(워커·메신저)`;
const SOURCE_LABELS = { aa: 'AA', cognition: 'Cog', openrouter: 'OR', opencode: 'OCD' } as const;
const sourceText = (role: OptimalZoneRole, dimension: ScoreDimension): string =>
  ROLE_SOURCES[role][dimension].map(source => SOURCE_LABELS[source]).join('·') || '—';
export const dimensionsLabel = (role: OptimalZoneRole): string =>
  displayDimensions(role).map(d => DIMENSION_LABELS[d]).join('/');
/** 역할별 차원 표준화 값(0~100, 결측 '-'). 오케 `92/77/100`(성능/사용량/속도), 워커 `92/77/100`(성능/속도/가격). 가격이 혼합 단가 대체면 `100*`. */
export const dimensionsText = (e: RoleEntry, role: OptimalZoneRole): string => {
  const c = e.scoreComponents, from = c?.dimensionSources;
  if (!c || !from) return '-';
  const value = { performance: c.index, usage: c.usage, speed: c.speed, price: c.cost };
  return displayDimensions(role).map(d => from[d] === undefined ? '-' : `${Math.round(value[d] * 100)}${d === 'price' && c.priceFallback ? '*' : ''}`).join('/');
};
/** 워커 가산(점): 마크다운은 `가산` 열, 압축 렌더는 행 끝 접미. 없거나 오케면 '-'/''. */
export const bonusText = (e: RoleEntry, role: OptimalZoneRole): string =>
  role === 'worker' && e.scoreComponents?.bonus !== undefined ? `+${e.scoreComponents.bonus.toFixed(1)}` : '-';
export const bonusSuffix = (e: RoleEntry, role: OptimalZoneRole): string => bonusText(e, role) === '-' ? '' : ` 가산 ${bonusText(e, role)}`;
export const leadText = (e?: RoleEntry): string => e ? `${e.modelId} (스코어 ${e.scoreText ?? '-'})` : '자료 부족';
/** 파레토 최적 표지(👍). 마크다운은 독립 열, 압축 렌더는 행 끝 참고 표지로 쓴다. */
export const PARETO_MARK = '👍';
export const LEGEND_HEADING = '## 📖 표시 안내';
export const LEGEND_LINES: readonly string[] = [
  LEGEND_HEADING,
  '- 👍 파레토 최적(파레토 열): 더 싸고 더 좋은 모델이 없는 상태(단가 대비 스코어 경계선)',
  '- ▲N / ▼N 전일 대비 순위 상승/하락, ➖ 유지, 🆕 신규 진입(전일 Top10 밖), 🌱 첫 집계(전일 기록 없음), 🚪 이탈',
  `- ▽ 하한 보충: 임계(스코어 최고의 ${OPTIMAL_ZONE_THRESHOLDS.orchestrator * 100}%/${OPTIMAL_ZONE_THRESHOLDS.worker * 100}%) 미달이어도 후보를 스코어 순으로 보충; 워커는 AA intel ≥${WORKER_INTEL_FLOOR}만`,
  `- 0~100 차원: 오케 성능/사용량/속도, 워커 성능/속도/가격; 워커 intel<${WORKER_INTEL_FLOOR}·결측 제외`,
  `- 사용량: OR/OCD(오케 6%·워커는 가산); 속도: 오케 ${sourceText('orchestrator', 'speed')}, 워커 ${sourceText('worker', 'speed')}; '-'=근거 없음`,
  `- 워커 \`*\`=가격을 혼합 단가로 대체, ${Math.round(PRICE_MISSING_VALUE * 100)}=근거 없음; +N=가산(최대 ${WORKER_BONUS_CAP}점); AA 지수 '-'는 미측정; off-peak는 표시·파레토 단가`,
  '- ⚠️ 한도·주의(추정 한도, 실측 제한 등), 🔒 접근 제한(지역·조건), 🆓 무료(🆓 Free 티어 섹션 표시)',
];
export function changeNote(label: string, list: RoleList): string {
  const items = list.entries;
  const changed = items.filter(e => e.change !== '유지' && e.change !== '신규').length;
  const entered = items.filter(e => e.change === '진입').length;
  if (!items.length) return `${label} 자료 부족`;
  if (items.every(e => e.change === '신규')) return `🌱 ${label} 첫 집계: 전일 기록 없음`;
  return `${label} 상위권 ${items.length}개 중 ${changed}개 순위·진입 변동${entered ? ` (🆕 ${entered}개)` : ''}, 🚪 ${list.exits.length}개`;
}
