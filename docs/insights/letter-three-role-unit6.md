# #195 단위6 — 3역할 출력 opt-in 연결 (2026-10-20)

- 범위: unit5의 3역할 결과를 실제 레터 출력·발행 경로에 opt-in으로 연결. **단위6이며 #195 전체 완료를 뜻하지 않는다.**
- 계약: `/tmp/yoroi-letter-output-contract.md`(최소 scope·API·필요 파일·blocker).
- 소유: `src/config/letter-three-role.ts`(신규)·`src/composition/insights.ts`·`src/composition/insights-publish.ts`·
  `src/ui/cli/insights-command.ts`·`tests/insights-three-role-output.test.ts`(신규)·본 문서.

## 1. 계약

- 설정(신규 `src/config/letter-three-role.ts`): `YOROI_LETTER_THREE_ROLE=on|off`(기본 **off**)·`YOROI_LETTER_THREE_ROLE_DEPTH=7|15`.
  잘못된 값은 조용히 무시하지 않고 오류로 끝낸다(fail-closed).
- 합성(`insights.ts`): 설정 로더를 주입해 **켜졌을 때만** 3역할 파이프라인을 실행하고 depth를 반영한다.
- 발행(`insights-publish.ts`): `threeRoleSections` 옵션을 받아 **본문 경로 1개**로만 블록을 붙인다(댓글 3개 계약 유지).
- 출력(`insights-command.ts`): `view.threeRoleSections`를 stdout에 **1개 경로**로만 붙인다(전체 markdown 와 동시 사용 금지).
- **기본 꺼짐 유지**: opt-in 없이는 기존 2역할 출력·점수·catalog·발행 경로가 그대로다.

## 2. 리뷰어 가중치 취급

- 가중치의 **유일한 원본은 `config/reviewer-policy.json`**(w2 소유 policy 모듈)이며 이 단위에서 중복 로더를 만들지 않았다.
- 현재 합성 경로의 후보는 `top10.records`에서 오고 **performance/speed/price 차원 근거가 실려 있지 않다**.
  `computeReviewerScore`는 명시 `score`가 있으면 그 값을 우선하므로, 설정된 가중치가 기본 합성 경로에서 적용되지 않는다(무시 상태).
  **차원을 지어내 붙이지 않고 blocker로 남긴다**(계약 §3-2). 차원 근거 실으기는 별도 단위.

## 3. 전달 배선 완료 (소유 확장)

- `src/composition/insights-cli.ts` 소유가 이 워커로 확장되어 실제 경로에 연결했다.
  - publish: `insights-cli.ts:70-73` — `renderLetterPartsFromRecords` 결과 뒤 `outcome.threeRole?.sections`가 있으면
    `replaceLegacyRoleBlocks(parts.body, sections)`로 **본문 역할 블록을 대체**하고, 댓글은 `composeThreeRoleComments`로
    **같은 selection**에서 `[오케 Top15, 리뷰어 Top15, 워커 Top15 + Free]`로 매핑한다(기본 off면 댓글 3개 그대로).
  - once: `insights-cli.ts:91-96` — view에 `threeRoleSections`를 실어 `insights-command.ts:50`에서 stdout을 대체한다.

## 3-1. 이중출력 방지 설계 (기존 role block 대체)

- 본문 끝에 3역할을 append하면 오케·워커 모델이 기존 2역할 블록과 중복 출력된다.
- 그래서 `src/insights/letter-three-role-body.ts`(신규)가 **기존 2역할 블록을 잘라내고 그 자리에 3역할 블록을 넣는다**:
  `## 🧭 오케스트레이터·리뷰어…`·`## 🛠️ 워커·메신저…` 제목부터 다음 `## ` 직전까지를 제거하고
  `## 🧭 3역할 후보 (opt-in)` 블록(오케·리뷰어·워커 3섹션)을 삽입한다.
- 소비 경로는 **1개**: 본문은 3역할 블록(o/r/w) 하나만 쓴다(전체 markdown 동시 사용 금지).
  댓글은 opt-in 시 같은 selection에서 `[오케 Top15, 리뷰어 Top15, 워커 Top15 + Free]` 3개를 만들고,
  기본 off에서는 기존 댓글 3개(오케 Top15·워커 Top15·Free)를 그대로 둔다.
- 제목·표시 안내·Free 표시 규칙은 건드리지 않는다(댓글 수 3개 계약 유지).

## 3-2. 리뷰어 차원 근거 연동 완료 (blocker 해소)

- w1 candidate adapter(`letter-reviewer-candidates.ts`)와 w2 helper(`insights-reviewer-candidates.ts`·`insights-three-role.ts`) 구현 완료.
- `buildThreeRole`에서 `run.top10` 전체 풀을 기반으로 3차원(`performance`, `speed`, `price`) 정규화 증거를 생성하고,
  확정 50/20/30 가중치를 적용하여 순위를 산출한다.
- 3차원 근거가 없는 모델은 `excluded`로 분리되며, 임의 날조나 오케스트레이터 점수 passthrough 없이 결측 시 빈 목록과 `emptyCause`를 반환한다.

## 4. 검증 (합성, 네트워크 0)

- `tests/insights-three-role-output.test.ts` 3건: 설정 기본 off·잘못된 값 오류 / 기본 off 시 기존 블록 유지 / opt-in 시 2역할 블록 대체 1회 출력 및 댓글 3개 유지.
- `tests/insights-reviewer-composition.test.ts` 5건: 전체 풀 보존, 3차원 가중치 순위 변동, 결측 분리, `buildThreeRole` opt-in 통합 및 emptyCause 확인.
- 전체 typecheck 및 validate-repo 통과.

## 5. 댓글 매핑·품질 기준·운영 예시 (#195 후속)

- 댓글 매핑 (opt-in, 3개 계약 유지): `[c1 오케 Top15, c2 리뷰어 Top15, c3 워커 Top15 + Free]`.
  세 댓글은 **같은 selection**(`threeRole.selection.top15`)에서 뽑는다 — 본문 Top7은 같은 selection의 앞 7개라
  본문/댓글 선발 결과가 갈리지 않는다(#195 "본문/댓글에서 서로 다른 선발 결과를 사용하지 않는다").
  기본 off면 댓글 3개는 기존대로(오케 Top15·워커 Top15·Free) 둔다.
  계약 테스트: `tests/insights-reviewer-comment-contract.test.ts`(매핑·Free 원문·off 동일성·empty 사유).
- 품질 기준: blend는 3차원 완비 후보만 사용. 일부 결측은 `excluded`에 사유 표기,
  전부 결측은 빈 reviewer + `emptyCause`. score-only를 확정 가중치 결과로 전달 금지.
  가격은 반전 정규화 (저비용 고득점), 모집단은 실행 내 reviewer 집합.
- 운영 예시: `YOROI_LETTER_THREE_ROLE=on yoroi insights once --pretty` (미리보기),
  `YOROI_LETTER_THREE_ROLE_DEPTH=15` (Top15 섹션). 발행은 동일 env로
  `yoroi insights publish --dry-run` 확인 후 수행. 기본 off가 기본값이다.

## 6. 남은 범위

1. #195 최종 통합 검증(전체 `pnpm run check`) 및 w1 독립 리뷰 통과 후 dev 커밋.
2. 실제 Actions 자동 발행 전환(#194) 및 파일럿 운영은 사용자 지시/머지 후 단계에서 확인.
