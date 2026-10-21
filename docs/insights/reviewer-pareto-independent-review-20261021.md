# 리뷰어 파레토 독립 리뷰 (2026-10-21, w1)

- 판정: PASS. 원가 방향(원시 비용, 정규 price 미사용), 지배 규칙
  (score≥·cost≤ + 한쪽 strict, 동점 비지배), 결측 비파레토를 확인.
- 계산 위치: cap·dedupe 후 전체 적격 풀, 컷 전. 입력 순서 무관, score·cost 보존.
- 전달: composition → 파이프라인(RoleCandidate 인덱스) → 렌더 isPareto 지원.
- 순위 불변 (플래그만 추가). w3 테스트 7건 + composition 단언 녹색 확인.
