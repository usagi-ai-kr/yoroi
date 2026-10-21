# #266 블랙리스트 구현 결과 (w1, 2026-10-21)

- 대상: glm-5-3·kimi-k3 정확히 (별칭·effort·provider·free 접미 포함). flash·유사는 유지.
- 테이블·조합·차선·fallback·리뷰어 전 경로 제외. 점수 공식 불변. 커밋·PR·발행 없음.

## 1. 구현

- `config/letter-model-lists.json`: ban.common = ["glm-5-3", "kimi-k3"].
- `letter-model-lists.ts` (100줄): DEFAULT common 동기화, `commonBanSet`·`isCommonBanned`
  (base·정규화·별칭, `-free` 벗김, flash 제외). 테이블은 기존 banSetFor로 자동 제외.
- `letter-team-runners.ts` (64줄): `unionPool(..., bannedKeys?)` — 풀 진입 차단.
- `letter-team-combinations.ts` (100줄): `bannedKeys` — top15·union·fallback 정리.
- `letter-three-role-pipeline.ts` (100줄): 입력 전처리(역할·free·union) 후 selection.
- `composition/insights-three-role.ts` (99줄): 명시 목록·리뷰어·fallback·reviewerPool 정리.

## 2. 실제 출력 (표준 경로·#265 실측·공식 free 17)

> DELTA 이전(2밴·glm-5-3·kimi-k3만 밴, mimo-pro·Luna/Haiku O 밴 유지) 이력 값.
> 최신(DELTA) 결과는 §5 참조: 347.10·201.90·308.32·178.27, O mimo-pro→glm-5-3-flash.

- best-1+1+3: 347.10 (O claude-opus·R muse·W gpt-luna·haiku·minimax) 유지.
- best-1+2: 201.90 (O claude-opus·W gpt-luna·minimax) 유지.
- open-1+1+3: 309.69 (O mimo-pro·R muse·W minimax·deepseek·mimo) — DELTA 이전 값.
  glm-5-3 제외 후 전수 최적 재배치(O 강제 아님). 패킷 F-D 310.82는 수학적으로 불가.
  DELTA(3밴·O 해제) 후 308.32 (O glm-5-3-flash) — §5 참조.
- open-1+2: 178.27 (O deepseek·W minimax·muse) 유지. 전 조합 Free W≥1·unmeasured 0.

## 3. 검증

- `check` EXIT=0: 단위 1476/1476 · BDD 45/635 · typecheck·build 통과.
- `validate-repo.py` 위반 0건 · `diff --check` clean.
- 소유 테스트: blacklist 4/4 · model-lists 11/11 (ban 기대 갱신).
- 비소유 fallout 5건은 소유권 확대 후 목적 유지 교체로 해소
  (kimi-k3→kimi-k4·opus·grok-4-7·glm-flash, glm-5-3→glm-flash; 점수·카탈로그 동등).

## 4. 미결·인계

- F2(🆓 표시)·jev·F4문구는 r 보류 유지로 미구현. F-D 310.82↔308.32 차이는 r 판정.
- w2 감사·r 최종 리뷰 대기. 초안 `tmp/letter-20261021-union-free-draft.md` 전체 재생성済.

## 5. DELTA 검증 (3밴·O 해제, 실출력)

- 공통 3밴 + O 밴 해제 + 변형 커버(isCommonBanned -free·effort·provider, flash·유사 유지).
- 초안 전체 재생성: 표 O12·R13·W13, banned 0, flash 유지, triple-newline 해소.
- 4조합 실측: 347.10·201.90·308.32·178.27 (Free W≥1·unmeasured 0·Beam 강제 없음).
- #267: DeepSeek-O 고정 307.00 = 측정 최적(r 가설과 일치).
  Beam 강제 변형 257.63·unmeasured 1 (실험값일 때만 해당 표기).
  무제약 최적 308.32가 둘 다 상회 → 자연 최대 확정.
- `check` EXIT=0 (1476/1476·BDD 45/635), validate·diff-check 통과.

## 6. 재발행 결과 (2026-10-21)

- 수동 발행은 `YOROI_LETTER_THREE_ROLE=on`이 필요하다. 플래그 없이 발행한 #268은 2역할 레거시 형식이라 폐기하고 #269로 교체했다.
- #269(16:41 KST): O/R/W Top7 + 권장 조합 Mermaid 4 + 댓글 3(o15/r15/w15+Free). 3밴 0, glm-5-3-flash 9, 1+2 리뷰어 차선 없음, 열린 letter는 #269 하나.
- #265(원 레터)·#268(형식 누락)에는 #269 후속 링크를 남기고 close했다.
- #267 설명 댓글 1건 게시 후 close. #266 커밋 `78c6f91`·roster `9e011ed`, dev→main PR 대기.
