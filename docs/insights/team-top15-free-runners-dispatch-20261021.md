# 추천 조합 Top15·Free·차선 캡션 분배 (2026-10-21)

- 이슈: #257. #253 후속, #256 registry 정정 위에 구현.
- 유지: Top7/Top15 표·점수·순위, Free 표·실사용 열, 댓글 3개, publish 계약, 2역할 경로.

## 계약

1. **Top15 후보**: `selection.top15`를 조합 입력으로 사용한다. `TeamCombinationInput`의 `top7`을
   `top15`/`candidates`로 바꾸고 pipeline 호출부를 갱신한다. Top7 표는 그대로 둔다.
2. **Free fallback**: `run.top10.freeCatalog`의 verified Free 모델을 **워커 fallback** 후보로 전달한다.
   점수는 만들지 않고 `free/unmeasured`로 표시하며, 점수 있는 후보가 부족할 때만 채운다.
   오픈/Free 조합 라벨을 `오픈 웨이트·Free`로 바꾼다.
3. **차선 캡션**: 각 조합 Mermaid fence 아래에
   `- 차선: 오케스트레이터 <model> · 리뷰어 <model> · 워커 <model>`을 둔다.
   - 같은 정책 풀에서 조합에 없는 역할별 최고 후보(점수↓·identityKey↑) 1개씩.
   - 1+2는 리뷰어 슬롯이 없으므로 **리뷰어 차선을 캡션에 넣지 않는다**. 리뷰어가 있는 1+1+3에만 포함한다.
   - 후보 없으면 `-`. Mermaid 내부에 차선 노드 금지.
4. Mermaid 안전(고정 ID·라벨 이스케이프·펜스 주입 방지) 유지. Free 후보 라벨에 `Free` 표시.
5. 점수 없는 Free 후보를 0점으로 조용히 합산하지 말고, 표시/총점 계산에서 미측정으로 구분한다.
6. 테스트: Top15 사용, Free fallback, 차선 1개/역할·조합 내 제외, 1+2 리뷰어 차선, 캡션 fence 밖,
   부족/동점, Top7/Top15·Free·댓글 불변.
7. `pnpm run check`, typecheck, validate-repo, diff-check, 파일 100줄 이하. 100줄 초과 시 helper 분리.

## 소유

- w1: `letter-team-combinations.ts`, `letter-mermaid.ts`, `letter-three-role-pipeline.ts`,
  `letter-three-role-body.ts`, 필요 시 `letter-team-runners.ts`, Free catalog 전달 경로,
  관련 테스트·`docs/insights/team-top15-free-runners-20261021.md`.
- r: 구현 후 독립 리뷰.
