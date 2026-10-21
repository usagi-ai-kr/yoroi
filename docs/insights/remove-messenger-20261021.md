# 메신저 제거 기록 (2026-10-21, #242)

- 방법: 수동 제거(`git revert` 금지). #233(0~100·각주·jev) ·
  #232(실사용 표식) 보존. 과거 커밋·docs 이력은 유지.
- 점수/config: messenger 가중치·`computeRoleList`·`isWorkerLike`·
  임계·타입·`letter-top10-messenger.ts`(삭제) 제거.
- 파이프라인: messenger 입출력·섹션·pool·top7/top15 조건부 제거.
- 렌더·본문: 4번째 섹션·라벨·가중치 줄 제거. 3역할 본문의
  2역할 라벨은 `- ` 목록줄에서 `워커`로 분리 유지.
- Free: messenger 열·helper·tier 제거. 리뷰어 0~100·각주·jev 유지.
  정렬 각주는 복원된 순서(o→w→나머지)에 맞춰 문구 수정.
- 댓글·발행: 4분기 제거, 3댓글 복원. 동적 Free 탐색·개수 표기는 유지
  (3댓글에서 동일 동작, 문자열에 메신저 없음).
- 2역할 Top10 compact 제목은 `워커`로 변경(소유 상수).
- 미소유 잔재(후속 소유 필요): 2역할 렌더 문자열
  `letter-top10-legend.ts:17,20,22,23,24`·`letter-markdown-format.ts:59`.
  #227 이전부터 있던 문구로, 복원 범위 밖 추가 정리다.
- 후속 U3c-title-sync에서 legend.ts 5줄 정리 + 테스트 4종 동기화.
  `format.ts:59` 산식줄은 병행 작업자가 정리함(트리 확인).
  `markdown.test.ts:52` 구 제목 단언 1건 잔류(소유 미지정).
- 미소유 잔재(후속 소유 필요): 2역할 렌더 문자열
  `letter-top10-legend.ts:17,20,22,23,24`·`letter-markdown-format.ts:59`.
  #227 이전부터 있던 문구로, 복원 범위 밖 추가 정리다.

## 검증
- 3섹션·3댓글·8열·문자열 0(3역할 출력 기준) 회귀.
- typecheck·validate·diff clean, 전체 `pnpm run check`는 보고서 수치.
- 후속 title-sync 완료: legend 2역할 제목·라벨·ZONE 정리 +
  테스트 5종 동기화(top10-render·render-top10·letter-top10·cli·source-policy).
  `format.ts:59` 산식줄은 병행 작업자가 정리함(트리 확인).
- 후속 title-sync 완료: legend 정리 + 테스트 6종 동기화.
  BDD feature 3줄 동기화로 전체 green(아래).

## 재발행 위험
- 2역할 본문에 구 라벨이 남는다(위 잔재) — 재발행 전 후속 정리 또는 고지.
- 기존 3댓글 이슈 복구 절차는 그대로(본문 불일치 시 close→신규).
