# 남은 작업 분배 — #225 재발행·#226 검토 (2026-10-21)

- 요청: 남은 작업을 중요도 순으로 분배·진행하고, 갱신 로직으로 레터를 재발행한다.
  종료된 이슈는 더 이상 추적하지 않는다.
- 기준: dev `9d2bc56`, origin/dev `9aca555`보다 3커밋 앞섬(미push), package 1.7.7.
  PM2 `yoroi-letter`는 stopped 확인(중복 발행 없음).
- 가용: w1(w18:p2, Muse Spark xhigh), w3(w18:p4, MiniMax max). w2/r missing, 새 세션 금지.

## P1 — 레터 재발행 (오케스트레이터 직접)

1. dev 3커밋 push → dev→main PR → PR CI·main CI 성공 후 머지.
2. `workflow_dispatch(dry_run=true)`: 렌더·Free 가드·duplicate/close 대상을 확인한다.
3. #225를 close(본문·댓글 이력 보존)한 뒤 `dry_run=false`로 발행한다.
   발행이 생성 전에 실패하면 #225를 재오픈한다.
4. 새 이슈의 본문·댓글 3개·Free 3역할 표(리뷰어 열)를 확인하고,
   #225에 후속 레터 링크 댓글을 남긴다.

- `closePreviousLetters`는 `letter` 라벨만 닫으므로 #226은 영향받지 않는다.
- 금지: PM2 재가동, 버전 변경, 무단 실계정/API 호출.

## P2 — #226 Arena 비용·Net Improvement 타당성 (w1)

- 소유: `docs/insights/arena-cost-pareto-feasibility-20261021.md`
- 순서: 공식 접근 경로·ToS·재배포 범위 확인 → #190 HF 데이터와 별도 계통 검증 →
  최소 필드(model·effort·category·asOf·netImprovement·costPerEligibleTaskP50)·CI·기간 →
  역할별 출력 형태와 기존 스코어 분리 → 데이터 계약·실패 처리 → 합성 테스트 계획.
- 접근·재배포가 불가하면 자동 수집 없이 원문 링크·수동 참고로 종결하는 안을 제시한다.
- 금지: 크롤링·API 자동화·외부 쓰기·점수/가중치 변경·레터 수정·실계정 호출.
- 검증: `python3 scripts/validate-repo.py`, `git diff --check`, 문서 100줄 이하.
- 보고: `tmp/yoroi-226-arena-feasibility-report.json`

## P3 — 재발행 기준·검증 체크리스트 (w3)

- 소유: `docs/insights/letter-225-republish-baseline-20261021.md`
- 현재 #225의 본문·댓글 3개를 읽기 전용으로 기록하고, 새 로직(`d4176b9`)의 기대 변화와 대조한다.
  재발행 후 확인할 체크리스트(본문/댓글 수, Free 3역할·리뷰어 열, 별칭 4건, 미확인 행·점수 생성 없음,
  안내/각주, partial·출처, 비밀값 없음)를 만든다.
- 금지: #225 close/수정, 재발행, 외부 쓰기. 새 이슈 번호는 발행 후 오케스트레이터가 전달한다.
- 검증: `python3 scripts/validate-repo.py`, `git diff --check`, 문서 100줄 이하.
- 보고: `tmp/yoroi-225-republish-baseline-report.json`

## 공통

- 5분 이내 단위로 진행하고, 소유 외 파일은 수정하지 않는다.
- 모델·세션 변경, 커밋·push 금지(오케스트레이터만 수행).
- 종료 이슈(#168/#180/#190/#194/#195 등)는 재조사·재개하지 않는다.
