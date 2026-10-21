# usagi 실사용 표식 컬럼 분배 (2026-10-21)

- 이슈: #232. 사용자 결정: **점수 숫자가 아니라 기존 정성 표식(◎/○/△/×)을 컬럼으로 표시**.
- 기준: main `eef0430`, dev `61e6c7d`. 최종 레터 #238.
- 표시 전용: 정렬·tie-break·가중치·추천·필터에 쓰지 않는다.

## 계약 (w3)

- 3/4역할 역할 표(오케·리뷰어·워커·메신저)에 `실사용` 컬럼을 추가한다.
  예: `순위 | 파레토 | 모델 | 스코어 | effort | 실사용`.
- 값은 `config/model-role-fit.json`의 역할별 `fit` 표식 그대로다.
  `◎`, `○`, `△`, `×`, 관찰 없음 `-`.
- 숫자 매핑·점수 환산·새 표식 생성 금지. 기존 `fit`·`note`·각주 보존.
- 메신저는 `model-role-fit.json`에 메신저 관찰이 있을 때만 표시하고, 없으면 `-`.
  워커 표식을 빌려오지 않는다. `messenger` 역할 키는 추가하되 관찰이 없으면 비워 둔다.
- 안내: "실사용 = usagi 정성 관찰 표식(점수 아님, 순위·가중치에 미사용)".
- Free 표에는 이번 단위에서 추가하지 않는다(역할 혼합 모호). 2역할 레거시 표도 컬럼 없이 유지.
- `roleFitMark(modelId, role)` 같은 조회 helper를 두고 `roleFitNote`와 같은 정규화를 쓴다.

## 소유 파일

`src/insights/model-role-fit.ts`, `src/insights/letter-three-role-render.ts`,
`src/insights/letter-three-role-body.ts`, `src/insights/letter-three-role-legend.ts`,
필요 시 `src/insights/letter-three-role-pipeline.ts`, 관련 테스트,
`docs/insights/usagi-mark-column-20261021.md`.

## 검증·리뷰

- 표식이 있는 모델·역할은 표식, 없는 모델·메신저는 `-`.
- 점수·순위·가중치·파레토·Free 표·댓글·publish 불변.
- 2역할 경로 컬럼 없음, 3/4역할 컬럼 존재.
- `pnpm run check`, typecheck, validate-repo, diff-check, 파일 100줄 이하.
- r(w18:p6) 독립 리뷰 PASS 후 커밋. 커밋·push는 오케스트레이터.
