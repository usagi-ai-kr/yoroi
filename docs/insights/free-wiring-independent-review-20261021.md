# Free 배선 독립 리뷰 (2026-10-21, w1)

## w3 D 배선 판정: 조건부 PASS (수정 1건은 본인 소유에서 해결)
- 스레딩 PASS: publish·once-markdown 모두 spread 전달, off 2열 유지.
- BLOCK이었음 → 해결 확인: `freeReviewerFor`가 full eligible reviewer를 쓴다.
  단, Free 행 키(base형)와 리뷰어 id(-free형) 사이 공백을 본인 sorter에서 메움.
- passed:true 고정은 증거 전제라 용인한다.

## sorter 수정 (본인 소유)
- `-free` 리뷰어 근거를 base형 행에 합친다 (정확 일치 우선).
- 모르는 id는 행을 만들지 않는다 (회귀 유지).

## 별칭 전제
- w1 별칭 3건 + MiniMax 기존 규칙이 있어야 4개 모델이 이어진다.
  규칙-미보유 id는 계속 탈락한다 (날조 없음).
