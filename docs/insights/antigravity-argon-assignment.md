# #165 배정 (2026-10-16)

- 기존 이슈: https://github.com/qus0in/yoroi/issues/165
- 확정 사양: https://github.com/qus0in/yoroi/issues/165#issuecomment-6206154424
- 새 이슈 생성 지시는 소진됨. 이슈·라벨·마일스톤 생성 없음.
- 이번 재개 범위는 #165 배정과 해당 워커 단위뿐. 이전 릴리스 흐름 자동 재개 금지.

## 라벨 선행 단위
- 구현: w1-claude p17, 실측 MiMo-V2.6-Flash Free, idle 확인.
- 소유: src/ui/cli/labels.ts, tests/window-labels.test.ts, 구현 보고 docs.
- gemini-models:weekly-limit-remaining → g-w
- gemini-models:five-hour-limit-remaining → g-5h
- claude-and-gpt-models:weekly-limit-remaining → c-w
- gemini-4-argon:gemini-4-argon-weekly-limit → g-w-a
- 원본 ID는 parser에서 유지. 기존 라벨 회귀·동시 충돌·입력 순서 독립성 검증.
- 기존 사용자 변경 보존, 관련 단위 검증과 validate-repo 실행.
- 커밋·push·PR·머지·발행·전역 설치 없음.

## 독립 리뷰 후행 단위
- 리뷰 담당 예약: w2-codex p18, 실측 LongCat2.5Preview Free.
- 현재 working이므로 즉시 전송하지 않음. 100회 재시도·무한 대기 없음.
- 구현 보고와 idle 확인 뒤 별도 지시로 리뷰 패킷 전달.
- 리뷰는 구현 파일 읽기 전용, 별도 보고 문서만 소유.

## argon 레터 포함 별도 단위
- 라벨 수정 → 독립 리뷰 → 레터 후보 정책 확정·별도 구현 순서.
- AA 결측 + OR 근거 후보 포함/AA 측정 대기 중 사용자 선택 필요.
- Arena 이력은 현 소스로 복구하지 않음. 결측을 측정값으로 가장하지 않음.
- 성능 결측 표시·후보 자격·정규화 모집단 영향은 후속 검증 대상으로 남김.
- 레터 재발행 금지.

## 별개 보존 범위
- R 70/5/10/15와 I/(P+0.01), 정규 점수 작업과 충돌하지 않게 분리.
- 버전/tag/Release 불일치 점검·정리는 이번 배정에 포함하지 않음.
- 과거 실측 버전·미커밋 개수는 현재 사실로 단정하지 않음.
- 구 w3/w4는 사용자가 지정한 이번 두 좌석 배정에 사용하지 않음.
- 모델·세션·패널 변경 없음. 개인 사용량 원본·비밀값 기록 없음.

## 활성 두 좌석 배정 갱신
- 최신 사용자 지시: w1·w2 모두 사용, 이번 단위 뒤 자동 후속 금지.
- w1 라벨 구현 보고 도착: 테스트10·타입·validate PASS(독립 리뷰 전).
- w2(done 확인): 라벨 독립 리뷰 패킷 즉시 전달. 구현 소스는 읽기 전용.
- w1: argon 카탈로그·AA 결측 후보 경로 조사만 병렬 배정.
- AA 결측 정책 답변 전 catalog/source 수정·레터 발행 금지.
- #163·#164는 이번 두 단위 뒤 별도 지시 대상으로 유지.
- v1.0.2 tag·Release 발행은 사용자 확인 전 금지. 머지 승인 확장 없음.
- 실측 w2 화면은 LongCat2.5Preview Free로 표시됨; 모델 변경하지 않음.
