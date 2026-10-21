# Agent Arena 링크-only 참고 분배 (2026-10-21)

- 이슈: #226. 타당성 검토 결론(공식 API/ToS 미확인)에 따라 **자동 수집 없이 링크-only 참고**만 추가한다.
- 점수·순위·가중치·후보 수집·Free 표에는 반영하지 않는다. 수집 소스 수(배지)도 늘리지 않는다.

## 계약

- 레터 `출처 및 산출 공식` details 안에 참고 1줄을 추가한다.
  - 문구 예: `참고: Agent Arena 비용·Net Improvement — https://arena.ai/leaderboard/agent (자동 수집·점수 미반영, 2026-10-21 확인)`
- `SOURCE_LINES`(수집 출처 registry)에는 넣지 않는다. 별도 `ARENA_REFERENCE_LINE`으로 두고
  `### 참고` 블록에 표시한다. `sources N total` 배지는 그대로다.
- 2역할·3역할 레터 모두에 표시한다. 본문 표·댓글·점수에는 변화 없음.
- 외부 API·크롤링·실계정 호출·데이터 저장 없음.

## 소유

`src/insights/letter-markdown-format.ts`, `src/insights/letter-markdown.ts`,
관련 테스트(`tests/insights-markdown-legend.test.ts` 등), `docs/insights/arena-link-only-20261021.md`.

## 완료 기준

- [ ] details에 Agent Arena 참고 링크 1줄이 표시되고 "자동 수집·점수 미반영"이 명시된다.
- [ ] sources 배지 수·수집 출처 목록·점수·순위·Free 표가 불변이다.
- [ ] 2역할/3역할 경로 모두 링크가 표시된다.
- [ ] `pnpm run check`, validate-repo, diff-check, 독립 리뷰 PASS.
- [ ] 발행 후 #226을 close하고, 데이터 도입은 별도 정책 결정으로 남긴다.
