# U3b 독립 리뷰 — 메신저 4번째 댓글 (2026-10-21)

- 대상: w3 구현(`messenger-comment4-20261021.md`). 방법: git diff 대조.
- 판정: **PASS**. 코드·테스트 변경 없음(본 문서만 신규).

## 항목별 근거

- 2역할 불변: `freeSection === comments[2]` 동일 문자열(테스트 고정) ·
  기존 2역할·3역할 스위트 전체 green · `ROLE_HEADINGS` 레거시 제목 무변경.
- 3+메신저 없음 → 3댓글(o15/r15/w15+Free) 폴백 · 있음 → 4댓글(o15/r15/w15/m15+Free).
  분기 조건은 `top15.messenger` 존재·비어있음(파이프라인은 있을 때만 제공).
- 제목 분리: 워커 `🛠️ 워커 Top15`·메신저 `✉️ 메신저 Top15`,
  조립 출력에 `워커·메신저` 없음(테스트 고정). Free는 마지막 댓글에만.
- publish: 3|4 허용·5 거부(테스트) · 2 거부는 게이트식으로 자명하나 테스트 없음(경미).
  Free 동적 탐색(`FREE_HEADING` 포함 댓글) · 없음 → `free section missing` 차단(테스트).
- dry-run `comments=${comments.length}`(테스트) · 복구·중복게이트·close 로직 diff 없음.
- 무변경 확인: 점수·가중치·Free 열·워크플로·`letter-free-guard.ts`·recovery diff 없음.
  Free 3파일 줄 수(U3a-ii 기록과 동일 89/82/84).
- 줄 수: 12/98/94/100/92/50/82/88 전부 100 이하 · 비밀값 스캔 clean.

## 자기신고와 다른 점 (차단 아님)

- `publish-comments` 88줄(신고 93줄) · 전체 1442(신고 1440, 병행 추가분, 전부 green).
- BDD 45/635 · typecheck·build 통과를 재실행 로그로 확인.

## U4 발행 영향

- U4 체크리스트의 NO-GO 근거(U3b 미구현)가 해소되어 **4역할 발행 GO로 전환**.
  발행 시 본문 4섹션 + 댓글 4개 + Free 마지막 댓글 + `#229` close·후속링크 절차는
  U4 체크리스트(`messenger-republish-checklist-20261021.md`) 그대로 따른다.
