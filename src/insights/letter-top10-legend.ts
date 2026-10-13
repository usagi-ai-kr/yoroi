import type { RoleChange, RoleList } from './letter-top10-unified.js';

/** 변동·이탈·안내 표기의 단일 출처: 마크다운과 압축 렌더가 같은 이모지를 쓴다. */
export function formatChange(change: RoleChange): string {
  if (change === '유지') return '➖';
  if (change === '진입') return '🆕';
  if (change === '신규') return '🌱';
  return change;
}
export const exitLine = (modelId: string, previousRank: number): string => `🚪 이탈: ${modelId} (전일 ${previousRank}위)`;
export const LEGEND_HEADING = '## 📖 표시 안내';
export const LEGEND_LINES: readonly string[] = [
  LEGEND_HEADING,
  '- ⭐ 파레토 최적: 더 싸고 더 좋은 모델이 없는 상태(가성비 경계선)',
  '- ↔ 양쪽 목록 교집합: 오케스트레이터·워커 두 목록 모두에 오른 모델',
  '- ▲N / ▼N 전일 대비 순위 상승/하락, ➖ 유지, 🆕 신규 진입(전일 Top10 밖), 🌱 첫 집계(전일 기록 없음), 🚪 이탈',
  '- ▽ 하한 보충: 임계(오케 85%/워커 75%) 미달이지만 10개를 채우려 지수 순으로 넣은 모델',
  '- 지수 미측정(AA에 해당 역할 지수 없음, 지수 항목 0점)',
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
