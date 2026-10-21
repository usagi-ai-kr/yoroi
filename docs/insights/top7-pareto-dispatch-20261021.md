# Top7 파레토 열 제거 분배 (2026-10-21)

- 이슈: #245. 사용자 요청: Top7 역할 표에서 파레토 열 제거.
- 유지: Top15 댓글의 파레토 열, Free 표 `비고`의 `👍 파레토`, 점수·순위·파레토 계산.
- 기준: main `5534c73`, 최종 레터 #244. 표시 전용 변경.

## 구현 (w1)

### 3역할 렌더

- `renderThreeRoleSection(key, entries, depth)`에서 `depth === 15`일 때만 파레토 열을 넣는다.
- Top7(depth 7)은 `순위 | 모델 | 스코어 | effort | 실사용` 5열.
- Top15(depth 15)은 기존 `순위 | 파레토 | 모델 | 스코어 | effort | 실사용` 6열.
- `rowFor`·`tableHead`를 조건부로 바꾸고, 기존 `isPareto` 데이터는 유지한다.

### 2역할 렌더

- `letter-markdown-tables.ts`의 `columns`/`renderRoleTable`에 `withPareto` 조건을 추가한다.
- 본문 Top7 호출(`renderRoleTable(..., 7, false)`)은 파레토 열을 빼고,
  Top15 댓글 호출(기본)은 유지한다.
- 2역할/3역할 모두 동일 규칙.

## 검증

- 본문 Top7 표에 `파레토`/`👍` 셀이 없고, Top15 댓글에는 남아 있다.
- Free 표 `👍 파레토`·점수·순위·댓글 수·Free 열 불변.
- `pnpm run check`, typecheck, validate-repo, diff-check, 파일 100줄 이하.
- 테스트: 3역할 depth 7/15, 2역할 body/comment, BDD 제목·표 헤더, Free 불변.
- w3 교차 리뷰 PASS 후 커밋·PR·오늘 재발행.

## 소유

- w1: 위 렌더·테스트·문서.
- w3: 읽기 전용 교차 리뷰.
- r: 쿼터로 사용 불가(사용자 결정 전).
