# 메신저 분리 1단계 분배 (2026-10-21)

- 이슈: #227. 요청: 메신저를 워커와 분리한 새 섹션, 속도·비용 가중 강화.
- 이번 단위(U1)는 **점수·역할 모델과 단일 역할 계산 경로**만 다룬다.
  렌더러·댓글·발행 계약은 U2/U3에서 별도 소유로 진행한다.
- 기준: main `61cdea9`(PR #228 머지), dev `9d2bc56`. 재발행 레터 #229 발행 완료.

## U1 계약 (w1)

- `messenger` 역할을 점수 모델에 추가한다.
  권고 가중치: performance 0.20 / usage 0.10 / speed 0.30 / price 0.40.
  존 임계는 0.60, 가격 결측 보정은 워커와 같은 0.99를 쓴다.
- 워커·오케·리뷰어의 기존 가중치·점수·순위는 **바꾸지 않는다**.
- 메신저는 데이터 배관(cap·대표 effort·속도·가격·가산·intel 하한)에서 워커와 같은 경로를 쓴다.
  `role === 'worker'` 분기는 공용 helper(`isWorkerLike`)로 묶고, 메신저만 다른 가중치·임계를 적용한다.
- 단일 역할 계산 경로를 추가한다. 예: `computeRoleList(records, 'messenger', opts)` 또는
  `computeMessengerTop10`. 기존 `computeRoleTop10`의 오케·워커 출력은 그대로 둔다.
- 3역할 파이프라인·마크다운·Free 표·댓글·publish에는 아직 연결하지 않는다.
  U1 완료 시 제품 출력은 기존과 동일해야 한다.

## 소유 파일

`config/score-weights.json`, `src/insights/letter-top10-score-weights.ts`,
`letter-top10-worker.ts`, `letter-top10-score-policy.ts`, `letter-top10-score.ts`,
`letter-top10-worker-price.ts`, `letter-model-lists.ts`, `letter-top10-unified.ts`,
관련 `tests/insights-*.test.ts`, 소유 문서 `docs/insights/messenger-score-unit1-20261021.md`.

## 완료 기준

1. messenger 가중치·임계·정책 값이 config/타입/default에 일관되게 존재하고 합=1 검증을 통과한다.
2. 워커 가중치·오케 가중치·기존 `computeRoleTop10` 출력이 불변이다(회귀 테스트).
3. 합성 fixture에서 속도·비용이 높은 모델이 메신저 점수에서 워커 점수보다 더 앞서는 사례를 고정한다.
   가격 결측·index 결측·cap·동점·미확인 모델에서 점수를 날조하지 않는다.
4. `pnpm run typecheck`, 소유 테스트, `python3 scripts/validate-repo.py`, `git diff --check` 통과.
5. 문서 100줄 이하, 소유 외 파일 수정 0건, 커밋·push·외부 쓰기 0건.
6. 보고서에 변경 파일·가중치·테스트 수·남은 U2/U3 위험을 기록한다.

## U2 계약 (w1, U1 registry 위에 이어서)

- `OptimalZoneRole`에 `messenger`를 **원자적으로** 추가한다.
  `Record<OptimalZoneRole, …>`·switch·renderer 타입을 한 번에 채우고,
  기존 오케·워커 출력은 바이트 동일하게 보존한다.
- `isWorkerLike`를 실제 분기에 적용한다: `letter-top10-score.ts`, `letter-top10-worker.ts`,
  `letter-model-lists.ts`, `letter-top10-worker-price.ts`, `letter-top10-unified.ts`.
- `computeRoleList(records, 'messenger', opts)`(또는 동등한 단일 역할 경로)를 추가한다.
  가중치 .20/.10/.30/.40, 임계 .60, priceMissing .99, intel 하한 33을 쓴다.
- 3역할 파이프라인·마크다운·Free 표·댓글·publish에는 아직 연결하지 않는다.
- 검증: 합성 fixture(속도·비용 우위, 결측, cap, 동점, 미확인), 기존 오케·워커 불변,
  `pnpm run check`, typecheck, validate, diff-check.
- 소유: 위 점수 모듈·config·관련 테스트·`docs/insights/messenger-score-unit2-20261021.md`.

## U3a-i 계약 (w1, 파이프라인·본문)

- `messenger`를 네 번째 **독립 역할**로 파이프라인·본문·렌더에 추가한다.
  섹션 순서: 오케스트레이터 → 리뷰어 → 워커 → 메신저. 라벨은 `✉️ 메신저`.
- 메신저는 기존 오케·리뷰어·워커의 MECE 교대 배정에 참여하지 않는다.
  같은 모델이 워커와 메신저에 동시에 나올 수 있고, 기존 o/r/w 출력은 불변이다.
- composition은 `computeRoleList(records, 'messenger', …)`로 목록을 만들고,
  명시적 messenger 입력이 있으면それを 우선한다. 후보가 없으면 섹션을 생략한다.
- Free 표·댓글 수·publish·워크플로는 이 단위에서 수정하지 않는다.
- 검증: 4역할 본문/렌더/파이프라인 테스트, 3역할 비활성 2역할 출력 불변,
  빈 메신저, 기존 o/r/w 불변, `pnpm run check`, typecheck, validate, diff-check.
- 소유: 위 three-role 모듈·composition·관련 테스트·`docs/insights/messenger-ui-unit3a-20261021.md`.

## 금지

- Free 표·댓글 수·publish 계약·워크플로 수정.
- 기존 역할 점수/순위 변경, 점수 생성·추정, 기준 완화.
- 실계정/API 호출, 레터 재발행.
