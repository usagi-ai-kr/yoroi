# 역할 점수 통합 리뷰 및 인계 (w4)

- 판정: 보정 표시 계약 PASS. w1 통합 보고를 확인했고, 비유한 표시 문제를 unified.ts 표시 가드와 회귀 테스트로 고쳤다. source-core raw 점수 오염은 별도 문제로 두고 수정하지 않았다.
- 범위: 역할별 모집단·raw score 보존·legend·비유한 표시를 검토했다. w4는 unified.ts, calibration test, integration/review/handoff 문서를 수정했다. helper·source core·외부 연결은 수정하지 않았다.

## 확인한 계약

- computeRoleTop10은 역할별 대표 모델 점수 전체를 Top10 컷 전에 보정한다. 제외 모델은 보정 뒤 선발 직전에 빠져 밴 모집단 경계와 맞는다.
- raw 점수 순서·▽ 판정·대표 effort·차원 구성은 유지한다. scoreText는 보정 표시값, rawScore는 원점수이며 역할별 모집단을 분리한다.
- 범례는 표시 점수의 정규순위와 임계·차원·순위의 raw 기준을 구분하고 guide 개수 9를 유지한다.

## 발견 사항 및 처리

- 해결: 보정값이 finite일 때만 toFixed(1)을 호출하고, 그 외에는 -를 표시한다. helper는 NaN/±Inf를 통계에서 제외하고 원값을 보존한다. rawScore·순위·▽·components·representative·effort는 그대로 둔다.
- 원점수 오염은 기존 R source core 경로다. calcBlendedCost()는 finite 가격 입력 검증 뒤 (3*input+output)/4를 계산하므로 1e308에서 Infinity가 된다. collect()가 이를 aaPrice로 보관하고 I/(P+.01) → log10(0) 경로가 -Infinity를 만든 뒤 raw min-max에 전파되어 두 모델 점수가 NaN이 됨을 합성 입력으로 확인했다. 보정 통합에서 도입된 문제가 아니며 source-core 가격 계산 수정은 범위 밖이다.

## 검증 및 남은 조건

- w1 보고 /tmp/yoroi-normal-score-integrate-w1-report.json 확인: 통합 전용 테스트·예산·legend·typecheck·validate 통과를 기록했다. w4 새 테스트 5/5, compact 테스트 12/12, validate-repo.py 673 files / 위반 0 통과.
- pnpm typecheck는 서명 검증을 위한 registry fetch 실패로 완료하지 못했다. 로컬 node_modules/.bin/tsc -p tsconfig.json --noEmit은 통과했고, 수정 대상 git diff --check도 통과했다.
- source file 수정으로 패킷 요구에 따라 w3 독립 최소 diff 리뷰가 필요하다. 새 w1 작업·원격·Git 변경·실 API 호출은 하지 않았다.
