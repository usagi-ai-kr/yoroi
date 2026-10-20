/** Reviewer 차원 정규화 (원시 스케일 비교 불가 → 실행 내 모집단 min-max).
 *  higher-is-better가 normalizeDim, lower-is-better(가격)가 invertDim.
 *  전부 동값이면 변별 신호가 없으므로 전부 1. 결측 처리는 호출자 몫 (0·날조 금지). */

export function normalizeDim(values: readonly number[]): readonly number[] {
  if (values.length === 0) return [];
  let min = values[0]!, max = values[0]!;
  for (const v of values) {
    if (!Number.isFinite(v)) throw new Error('normalizeDim: non-finite value');
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max === min) return values.map(() => 1);
  return values.map(v => (v - min) / (max - min));
}

export function invertDim(values: readonly number[]): readonly number[] {
  if (values.length === 0) return [];
  let min = values[0]!, max = values[0]!;
  for (const v of values) {
    if (!Number.isFinite(v)) throw new Error('invertDim: non-finite value');
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max === min) return values.map(() => 1);
  return values.map(v => (max - v) / (max - min));
}
