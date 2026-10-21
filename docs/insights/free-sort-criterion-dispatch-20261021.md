# Free 티어 정렬 기준 확정 분배 (2026-10-21)

- 이슈: #246. 사용자 요청: 실사용 가능한 Free 모델(deepseek·minimax·glm·mimo 등)이 위에 오도록 정렬 기준 확정.
- 유지: 리뷰어 0~100, jev 제외, 3역할/Free 8열, 실사용 표식, 점수·순위 계산.
- 표 행 순서만 변경한다.

## 확정 기준

1. 오케·리뷰어·워커 중 `passed`인 역할 수가 많을수록 위.
2. 역할 수가 같으면 세 역할 중 최고 표시 점수가 높을수록 위.
3. 완전 동률이면 모델 id 오름차순.
4. 점수가 하나도 없는 미측정 행은 맨 아래.

현재 데이터 예상: deepseek(3) → minimax(2) → glm(1, 66.1) → mimo(1, 59.8) → 미측정.
모델명 하드코딩 금지. `FreeRow`의 o/r/w `FreeCell`만 사용한다.

## 소유·검증

- `src/insights/letter-markdown-free-sort.ts`의 tier/정렬을 위 기준으로 바꾼다.
- `src/insights/letter-markdown-free.ts`의 Free 정렬 각주를 "역할 점수 보유 수↓ → 최고 점수↓ → 모델명"으로 갱신한다.
- 테스트: deepseek/minimax/glm/mimo/미측정 fixture, 동률, 점수 없는 행, 기존 Free 표/발행 회귀. 기존 테스트 기대 순서 갱신.
- `pnpm run check`, typecheck, validate-repo, diff-check, 파일 100줄 이하.
- w3 교차 리뷰 후 커밋·PR·오늘 재발행.

## 시각화 계획

- 이번 단위는 계획만. emoji 역할 표식 → mermaid quadrant/flowchart(details) → badges 순서로 검토.
- 외부 데이터·점수·순위·표 계약은 바꾸지 않는다.
