# p64 분배 (2026-10-14 사용자 확정)

요구 원문만 적는다. 구현·재계산·리뷰는 이 문서를 읽는 워커가 한다. o는 제품을 수정하지 않았다.

## 사용자 결정

- effort 상한 폐기. `docs/insights/orch-effort-cap.md`의 max 제외(high 이하)는 구현하지 않는다.
- 속도·가성비를 실질 반영해 max가 기본 대표가 되지 않게 한다. Cognition 성능·비용·작업시간을 참고한다.
- 중점은 medium·high. 저가·무료(id에 flash/free, free 접근, 혼합단가 ≤0.50 USD/1M)의 max는 허용.
- 워커 역할 가중치·점수·Top10은 변경하지 않는다.
- 가성비 정의(I²/혼합단가 vs Cognition 작업당 비용)는 사용자가 정한다. 정의를 골라 제품에 넣지 말고 차이만 보고한다.
- 커밋·stage·push 금지. 기존 변경 보존. 실 API 금지. 파일 100줄. 모델·세션 변경 금지.

## 적용 계약 (구현·검산 공통)

- 오케 가중치 성능/사용량/속도/가성비 = 70/0/15/15. 95/2.5/2.5는 속도·가성비가 대표 effort를 바꾸지 못한다.
- 상한 상수 금지. max·xhigh 후보 유지. 동점이면 낮은 effort.
- 오케 price에 Cognition 비용을 소스별 min-max(낮을수록 좋음)로 넣고, AA I²/P 정규화값과 차원 max로 합친다. USD/task와 USD/1M 원값은 섞지 않는다.
- Cog 정답률은 성능, Cog 소요 시간은 속도. 워커 소스는 그대로.

## 담당

| 라벨 | 역할 | 하지 말 것 |
| --- | --- | --- |
| w2 | 제품 구현·단위 테스트 | 주 보고 수정, 자기 리뷰 |
| w1 | DB 재계산·grok 검증·주 보고 append | 제품 파일 수정 |
| w3 | 토큰 절약 digest (p62 연장) | coord.py 등 p62 파일 수정, 주 보고 수정 |
| w4 | w2·w3 리뷰 (구현자와 다른 에이전트) | 재구현, 주 보고 수정 |

주 보고 `scratch/reports/yoroi-worker-cognition-openrouter.md`는 w1만 append. 100줄 초과 시 분리 파일과 포인터.
DB는 `src/infra/sqlite/data-dir.ts` 순(YOROI_DATA_DIR → XDG → ~/.local/share/yoroi/yoroi.db). 시크릿·사용량 원본은 로그에 쓰지 않는다.
