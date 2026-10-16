# 1.0.2 릴리스 리뷰 계획 (w3, 독립 검토 준비)

- 기준: `release-102-final-task.md`. 전체 diff 중복 검토 없이 체크리스트만.
- 상태 실측: dev `4b30f72`, version 1.0.2, tag·Release 없음, 최신 Release v1.0.1.
- 열린 PR 없음. #164·#165·#167 OPEN. source·Git·GH 변경 없음.

## Closes 라우팅 (letter 구분)

- #164 warn: 코드 완성, 레터 불필요 → 완료 시 PR `Closes` 가능.
- #167 muse: 후보 지원 완성, 레터 별도 흐름 → 완료 시 PR `Closes` 가능.
- #165 argon: 범위에 레터 포함 → PR `Closes` 금지, 레터 게시 후 직접 close.
- 공통: 미커밋·미병합이라 현재 open 유지.

## 1.0.2 patch 묶음 타당성

- R 가성비+정규 순위(main 내용) + warn/#165/#167 코드·검증·문서.
- warn은 표시 전용(점수 무영향). R 가드: 70/5/10/15·`normalRankScores`·1.1 fallback 부재.
- 1.0.1 선례(PR #159)와 동일 패턴. 신규 기능·milestone 없음.
- #168·#163·1.1 기능은 제외·open 유지.

## 권한 (포괄 승인 없음)

- 사용자 최신 승인: 커밋·릴리스·레터 진행, 기존 보류 해제.
- commit·dev push → PR → CI → 승인된 merge → main CI → tag/Release → global → 레터.
- 각 단계 패킷 확인. blanket merge 승인으로 확대 해석 금지. 기존 위임 유효 범위 유지.

## 승인 코드 / dirty5 분리

- 승인: R·warn·argon 라벨+카탈로그·muse 카탈로그+별칭·관련 테스트·문서.
- dirty5 보존(제외): `letter-top10-score.ts` worker effort, `four-source-score.md`,
- `orchestration.md`, takeover 문서, `worker-effort-source.test.ts`.
- 삭제·stash·reset 금지. main 직접 push 금지.

## 구체 체크리스트 (후속 리뷰용)

1. PR: dev→main, head SHA 기록, `Closes #164 #167`만 (#165 제외).
2. CI: `pull_request→main` 트리거, docs-only fast 구분, `check` 전부 통과.
3. main dispatch: merge SHA 검증은 `workflow_dispatch` 활용(수동 진단은 별도).
4. 머지: 승인된 merge commit, dev 삭제 없음.
5. main CI: merge SHA success 확인 (attempt·run id 기록).
6. tag·Release: `v1.0.2`, Release 동일 SHA (1.0.1 선례).
7. global: `/tmp/yoroi-102-update-global.sh <merge-SHA>` 재사용 가능.
- 전제: main CI success + tag/Release 확인 후만 실행. 버전 pin 1.0.2.
- env: `.env` 0600 백업·복원, 경로 비노출. stage·backup 정리 확인.
8. dist 일치·R 가중치·worker fallback 부재 가드 통과 확인.
9. 레터: 최종 출시 소스 사용, SHA·입력일·preview·게시 결과 기록. Release 후 게시.
10. 완료 기록·회고·validate 후 URL/SHA/잔여 보고.

## 후속 계획 (w1 manifest 도착 후)

- `handoff-integration-verification.md` 도착 확인済.
- 승인 코드·dirty5 분리 독립 리뷰 → commit·dev push 패킷.
- 재질문 없음. 보고 후 대기.
