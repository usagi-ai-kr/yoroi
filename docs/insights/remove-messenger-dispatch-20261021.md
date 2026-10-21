# 메신저 섹션·언급 제거 분배 (2026-10-21)

- 이슈: #242. 사용자 결정: 메신저 섹션·언급 제거, 3역할 복원.
- 기준: main `3110da4`, dev `e3a3029`. 최종 레터 #241(메신저 포함).
- **`git revert` 금지**: #233/#232의 0~100·정렬 각주·jev 제외·실사용 표식은 보존하고,
  messenger 관련 부분만 수동 제거한다.

## 유지

- 오케스트레이터·리뷰어·워커 3역할.
- 리뷰어 스코어 0~100, Free 정렬 각주, jev 제외.
- 역할 표 `실사용` 컬럼(◎/○/△/×, 숫자 매핑 없음) — o/r/w만.
- Free 표 8열(모델·오케·리뷰어·워커·AA·Zen·Go·비고).
- 2역할 경로: `워커` 라벨, 3댓글, 8열.

## 제거

1. 점수·config: `messenger` 가중치·임계·타입·helper·`letter-top10-messenger.ts`·`computeRoleList`·`isWorkerLike`·`MESSENGER_THRESHOLD`·`RoleWithMessenger`.
2. 파이프라인: messenger 입력/출력/sections/top7/top15/pool, 선택 로직.
3. 렌더·본문: messenger 섹션·라벨·가중치 줄·4역할 분기.
4. Free: messenger 열·`freeMessenger`·`freeMessengerFor`·정렬 tier.
5. 댓글·발행: 4번째 댓글 분기, `LetterParts`의 4댓글 전제, 동적 Free 탐색은 3댓글에도 안전하면 유지 가능(메신저 문자열 없음).
6. 현재 코드·테스트의 `메신저`/`워커·메신저` 문자열. 과거 커밋·docs 이력은 보존.

## 검증

- 새 3역할 본문·댓글·Free 표·안내에 `메신저` 문자열 0.
- 본문 3섹션 각 7행, 댓글 3개(o15/r15/w15+Free), Free 8열.
- 리뷰어 0~100, 정렬 각주, jev 제외, 실사용 표식 o/r/w 유지.
- 2역할 경로도 3댓글·8열·`워커` 라벨.
- `pnpm run check`, typecheck, validate-repo, diff-check, 파일 100줄 이하.
- r(w18:p6) 독립 리뷰 PASS 후 커밋·PR·오늘 재발행.

## 소유

- w1: 위 코드·테스트 전체(단일 소유로 충돌 방지).
- w3: 읽기 전용 검증 체크리스트.
- r: 구현 후 독립 리뷰.
