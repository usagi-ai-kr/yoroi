# Reviewer 후보 증거 adapter (2026-10-20)

- 근거: `/tmp/yoroi-reviewer-evidence-contract.md` (BLOCK 회수).
  주입 계약: `/tmp/yoroi-reviewer-candidate-adapter-contract.md`.
- w2/w3 기존 파일 무수정. 본 adapter 신규 2파일 + 테스트 1파일이다.

## 왜 필요한가

- `buildThreeRole`의 `toCand`는 `{modelId, score}`만 만든다.
  `computeReviewerScore`가 전부 결측 → legacy score passthrough,
  확정 50/20/30이 기본 경로에서 발동하지 않았다.
- adapter가 `ModelVariant` 전체 풀에서 정규 증거를 붙여야 blend가 산다.

## 사용법 (w3 주입점)

```ts
import { buildVariants } from './letter-top10-rank.js';
import { toReviewerCandidates } from './letter-reviewer-candidates.js';
import { applyReviewerPolicy } from './letter-reviewer-policy.js';
import { REVIEWER_WEIGHTS } from '../config/reviewer-policy.js';

const variants = buildVariants(records, metric, opts); // 전체 풀, 자르지 않는다
const { candidates, excluded } = toReviewerCandidates(variants);
const reviewer = applyReviewerPolicy(candidates, { weights: REVIEWER_WEIGHTS });
```

- `excluded`는 출력·문서에 결측 사유로 명시 가능하다.
- 후보 0명: 빈 reviewer + `emptyCause`. 프로세스 실패 없음.

## 규칙

- 정규화는 실행 내 모집단 min-max, 가격은 반전. 원시 스케일 혼합 금지.
- 결측에 0·날조 금지. 부분 재정규화 미사용 (50/20/30 의미 변경되므로).
- score-only를 확정결과로 전달 금지. 오케·워커 불변. adapter에 숫자 없음.
