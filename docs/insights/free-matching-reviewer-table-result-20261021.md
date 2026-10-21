# Free 매칭·리뷰어 표 결과 (2026-10-21)

## A: 검증 Free 별칭
- DeepSeek/GLM/MiMo `-free` → AA base 별칭 3건 추가 (공식 목록 근거, 날짜·URL 포함).
- MiniMax 기존 동작 유지. 미확인 id는 그대로 둔다 (승격 없음).
- unrelated 병합 없음. paid/Free AA 증거는 그대로 사용한다.

## B: Free 리뷰어 표
- `FreeReviewerEntry` 계약 + 스레딩 (Input/Data → 섹션 렌더).
- freeReviewer 없으면 기존 2역할 표와 바이트 동일.
- 있을 때만 오케/리뷰어/워커 3역할 표. 리뷰어 근거 없음은 `-`.
- 검증 Free 행에만 병합 (composition이 사전 선별).
- 모델당 1행, Free 경로·calibration 기존 유지, 허용 헤더에 리뷰어형 2종 추가.

## 검증
- 신규 5 + 기존 Free/발행 19 통과, typecheck·validate 통과.
