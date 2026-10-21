# 역할별 독립 선발 (2026-10-21, #252)

## 정책
- 교차 MECE 해제: o/r/w 각자 독립 선발, 역할 내부 identityKey 중복만 제거.
- 클로즈드·오픈·미확인 모두 역할 간 공유. 워커는 다른 역할에 영향 없음.
- Top15 = 독립 선발 결과 그대로(슬라이스). Top7은 접두와 일치.
- rankExtras(점수순 꼬리 채움)·교대 주석·분기 제거.

## 전후 차이 (합성 예)
- 전: `shared-c`(closed) → 오케만, 리뷰어 탈락. 후: 양쪽 1위.
- 전: Top15 = Top7 + 점수순 외부 후보. 후: 선발 순서 슬라이스.
- 불변: 내부 중복 제거·미확인 수집·가중치·정렬·파레토·리뷰어 정책.

## 검증
- 양쪽 1위·effort 공유·오픈/클로즈드/미확인·워커 독립·내부 제거·접두 일치.
- 기존 1/4/5/9 구성 회귀 + pipeline·output·composition green.
- typecheck·validate·diff clean, 전체 `pnpm run check`는 보고서 수치.

## #253 연계 위험
- Mermaid 시각화는 독립 선발 목록을 그대로 쓰면 됨(교차 배제 가정 금지).
- 댓글 Top15가 선발 슬라이스이므로 외부 후보가 끼지 않음.
- 미소유 구-MECE 단언 3건 동기화 완료: comment-contract F3,
  reviewer-composition 2건. role-selection 테스트는 신규 작성(독립 계약).
  전체 green은 보고서 수치.
