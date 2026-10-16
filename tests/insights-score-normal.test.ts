import assert from 'node:assert/strict';
import test from 'node:test';
import { normalRankScores, inverseNormal, NORMAL_SCORE_MEAN, NORMAL_SCORE_SD } from '../src/insights/letter-score-normal.js';

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const QUANTILE_EPS = 1e-5; // A&S erf 근사(|오차|<1.5e-7) → 역변환 z 오차 ~1e-6
const SCORE_EPS = 1e-4; // 점수 단위. 실측 A&S 기인 오차 ≤4e-6점, 표시 기준(0.05)의 1/500 이하

test('inverseNormal matches known quantiles and is monotone, symmetric, 0.5→0', () => {
  near(inverseNormal(0.5), 0, 1e-9);
  near(inverseNormal(0.975), 1.959963985, QUANTILE_EPS);
  near(inverseNormal(0.025), -1.959963985, QUANTILE_EPS);
  near(inverseNormal(0.84), 0.994457883, QUANTILE_EPS);
  near(inverseNormal(0.16) + inverseNormal(0.84), 0, QUANTILE_EPS);
  assert.ok(inverseNormal(0.1) < inverseNormal(0.9));
});

test('empty and all-invalid inputs return input unchanged', () => {
  assert.deepEqual(normalRankScores([]), []);
  assert.deepEqual(normalRankScores([NaN, Infinity, -Infinity]), [NaN, Infinity, -Infinity]);
});

test('single finite value or all ties → 50 for finite entries; invalid preserved', () => {
  assert.deepEqual(normalRankScores([7]), [50]);
  assert.deepEqual(normalRankScores([5, 5, 5, 5]), [50, 50, 50, 50]);
  const mixed = normalRankScores([NaN, 3, 3]);
  assert.deepEqual([mixed[0], mixed[1], mixed[2]], [NaN, 50, 50]);
});

test('output keeps input order and uses midrank for exact ties', () => {
  const out = normalRankScores([30, 10, 20]);
  assert.equal(out.length, 3);
  assert.ok(out[1]! < out[2]! && out[2]! < out[0]!, 'ascending ranks map to ascending scores by value');
  // 동점 두 개는 같은 값(midrank): [10,20,20,30] → 20의 midrank0=1.5 → p=0.5 → z=0 → 50.
  const tie = normalRankScores([10, 20, 20, 30]);
  near(tie[1]!, tie[2]!);
  near(tie[1]!, NORMAL_SCORE_MEAN, 1e-9);
  // 고정 기준(Python statistics.NormalDist, 모듈 미호출): [0,0,0,0,100]의 0 묶음 midrank p=(1.5+0.5)/5=0.4, 100은 p=0.9
  const q = normalRankScores([0, 0, 0, 0, 100]);
  near(q[0]!, 47.466528969, SCORE_EPS);
  near(q[4]!, 62.815515655, SCORE_EPS);
});

test('scores are clamped to 0..100 and stay within range for extreme skew', () => {
  const out = normalRankScores([0, 0, 0, 0, 100]);
  for (const v of out) assert.ok(v >= 0 && v <= 100, `${v}`);
});

test('zero is a valid population member (not treated as missing)', () => {
  const out = normalRankScores([0, 50, 100]);
  // 고정 기준(Python statistics.NormalDist, 모듈 미호출): p=(0+0.5)/3=1/6 → 50+10·Φ⁻¹(1/6), p=(2+0.5)/3=5/6 → 50+10·Φ⁻¹(5/6)
  near(out[0]!, 40.325784339, SCORE_EPS);
  near(out[2]!, 59.674215661, SCORE_EPS);
  assert.ok(out[1]! > out[0]! && out[2]! > out[1]!);
});

test('permuting duplicates yields the same score multiset and same value maps to same score', () => {
  const a = normalRankScores([10, 20, 20, 30, 40]);
  const b = normalRankScores([40, 10, 30, 20, 20]);
  assert.deepEqual([...a].sort((x, y) => x - y), [...b].sort((x, y) => x - y));
  const scoreByValue = new Map([[10, a[0]!], [20, a[1]!], [30, a[3]!], [40, a[4]!]]);
  const vals = [40, 10, 30, 20, 20];
  for (let i = 0; i < b.length; i++) near(scoreByValue.get(vals[i]!)!, b[i]!, 1e-9);
});

test('constants are exported from one place', () => {
  assert.equal(NORMAL_SCORE_MEAN, 50);
  assert.equal(NORMAL_SCORE_SD, 10);
});
