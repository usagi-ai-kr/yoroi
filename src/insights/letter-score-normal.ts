/** 정규 순위 점수(순수 수학). 역할별 자격 모집단 점수를 정규분포 중심 50으로 표시 변환한다.
 *  입력 순서 유지, finite만 모집단. invalid(NaN/±Inf)는 원값 유지(출력 렌더에 쓰지 않는다).
 *  평균/SD는 유한 n·동점에서 정확히 50/10이 아니라 근사다(작은 n·동점 편향). */
export const NORMAL_SCORE_MEAN = 50;
export const NORMAL_SCORE_SD = 10;

/** 표준정규 CDF(0..1). Abramowitz–Stegun 7.1.26 계열 erf 근사, |오차|<1.5e-7. */
const cdf = (z: number): number => 0.5 * (1 + erf(z / Math.SQRT2));
function erf(x: number): number {
  const s = x < 0 ? -1 : 1, a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
/** 표준정규 역CDF(quantile). 근사 CDF에 대한 bisection: [-40,40]을 200회 이분해 구간 분해능은 부동소수점 수준(≈1e-15)이다.
 *  Φ⁻¹과의 실제 차이는 이 분해능이 아니라 CDF 근사오차(A&S erf, |오차|<1.5e-7)가 지배한다. 실측 |Δz|: 0.01≤p≤0.99 최대 1.4e-6, p=1e-6 2.5e-4, p=1e-9 5.8e-4. p는 (0,1). */
export function inverseNormal(p: number): number {
  let lo = -40, hi = 40;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (cdf(mid) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
const clamp = (v: number): number => v < 0 ? 0 : v > 100 ? 100 : v;

/** 정규 순위 변환: ascending → exact-score 동점 midrank → p=(midrank0based+0.5)/N → 50+10·Φ⁻¹(p), 0..100 clamp.
 *  finite가 0개면 입력 그대로. finite 1개 또는 전부 동점이면 finite 전부 50. */
export function normalRankScores(values: readonly number[]): number[] {
  const idx = values.map((v, i) => ({ v, i })).filter((x) => Number.isFinite(x.v));
  if (idx.length === 0) return [...values];
  if (idx.length === 1) return values.map((v, i) => (Number.isFinite(values[i]) ? NORMAL_SCORE_MEAN : v));
  const sorted = [...idx].sort((a, b) => a.v - b.v || a.i - b.i);
  const N = sorted.length, out = values.map((v) => v);
  let g = 0;
  while (g < N) {
    let h = g; while (h + 1 < N && sorted[h + 1]!.v === sorted[g]!.v) h++;
    const midrank0 = (g + h) / 2, p = (midrank0 + 0.5) / N;
    const score = clamp(NORMAL_SCORE_MEAN + NORMAL_SCORE_SD * inverseNormal(p));
    for (let k = g; k <= h; k++) out[sorted[k]!.i] = score;
    g = h + 1;
  }
  return out;
}
