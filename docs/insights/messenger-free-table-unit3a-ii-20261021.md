# 메신저 Free 표 U3a-ii — 4역할 열 (2026-10-21)

## 범위
- 머리: 모델·오케·리뷰어·워커·메신저·AA 지수·Zen·Go·비고
  (작업 가능성 조건부 10열). 가드는 헤더 목록으로 자동 허용.
- `freeMessengerFor`가 pipeline `messengerPool`(컷 전 전체)을
  exact Free ID로 병합. 원칙은 리뷰어와 동일:
  verified만·미지 id 제외·점수 생성 없음·모델당 1행.
- messenger 후보 id가 카탈로그형(`-free` 접미 가능)이라
  base 해석(`resolveFreeId`) 후 매칭한다.
- 정렬: 오케 통과 → 워커 통과 → 메신저 통과 → 나머지,
  각 스코어 내림차순·동점 모델명.
- 기존 o/w·o/r/w 표·compact·댓글·publish 계약 불변.

## 검증
- 4열·점수·별칭 4건·미확인·빈 pool·비활성·가드 허용/거부 회귀.
- typecheck·validate·diff clean, 전체 `pnpm run check`는 보고서 수치.

## 다음 (U3b)
- 댓글 4개·publish 계약. `top7/top15` 댓글 맵은 o/r/w 유지됨.
- 위험: 댓글 인덱스(c4 추가 위치)·가드 위치(comments[2] 가정).
