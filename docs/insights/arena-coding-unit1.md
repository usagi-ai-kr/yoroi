# Arena 코딩 단위A 기록 (#190)

순수 파서/정규화 + 합성 fixture 검증까지. once·DB·가중치·실데이터 저장 없음.
기존 공통파일 수정 없음. 전체 이슈 완료가 아니다.

## 출처 (직접 확인분만)

- 출처 URL: `https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset`.
  확인일 2026-10-20(총괄 직접 조회). webdev=Code Arena,
  agent_bash_recovery_steps 등 per-signal 나열을 확인.
- 직접 본 스키마 필드: model_name·organization·license·
  rating 계열(rating_lower/upper·variance·vote_count)·
  agent score 계열(score_ci_lower/upper·observation_count·session_count)·
  rank·category·leaderboard_publish_date. 원문 행에 subset 열은 없다.
- reliability 계열 확인 시점:
  - 총괄 초기 카드 대조 시점: 카드 본문에 없어 미확인으로 기록.
  - w3 후속 뷰어 조회 시점: 뷰어 `Subset (24)` 목록에서 실재(263/213행) 확인.
  - 다만 코딩 적격 여부 및 개별 행 스키마는 미확인이므로 allowlist 제외 유지.
- 미확인: bash 하위 서브셋 개별 필드 구성(agent계 스키마로 추론만 함),
  agent 카테고리 값 집합, 발행 주기, tool_hallucination 코딩 해당 여부.
  정책외 effort 토큰은 버린다.

## 계약

- 신규 source id: `arena-coding` (기존 overall 계통과 분리, 전일 비교선 보존).
- 허용 서브셋: webdev·agent_bash_recovery_steps만. 일반 agent aggregate와
  reliability 계열은 거부한다(회귀검증 포함).
- 이름: `이름 (Effort)` → base kebab + effort. 날짜형 `(High, 20260813)`은
  한정자 분리 보관, 자동 병합 금지. effort 토큰은 정책 순서 집합만 인정.
- 지표: webdev `arena_coding_rating`, bash `arena_coding_score`.
  IPS 음수를 포함한 수치는 그대로 보존하고 성공률 정규화·클램프 금지.
- 식별: 날짜 qualifier·subset·category는 `arenaCodingIdentityKey` 복합키로
  보존한다. 실제 DB 연결 전에 복합 식별 검증이 별도로 필요하다.

## 검증 및 리뷰

- `node --import tsx --test tests/insights-arena-coding-parser.test.ts` 7/7 pass.
- `pnpm run typecheck` clean. `python3 scripts/validate-repo.py` PASS.
- 리뷰 결과: 초기 중간리뷰 BLOCK 해소 후, w3의 최종 독립 리뷰
  ([arena-final-review-20261020.md](arena-final-review-20261020.md)) **PASS** (차단 없음).
- 작성 파일 모두 100줄 이하. 커밋·push·PR 없음.
