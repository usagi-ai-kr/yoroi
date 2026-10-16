# coord_completion 독립 코드 리뷰 및 개선 보고서

- 일시: 2026-10-16
- 대상: w1 구현 완료 보고 (`coord_completion.py`) 및 watch 완료 판정 로직
- 검토자: w2 (`w12:p18`)

## 1. w1 구현 검토 및 식별된 결함

1. **호스트 5분 규칙 위반 (1800초 과다 예산)**:
   - w1은 기본 watch budget을 1800초(30분)로 설정하여 호스트 작업 단위 규칙(5분 이내 검증)과 불일치.
   - 단일 작업 감시가 300초를 초과하여 표류할 위험 존재.
2. **watch 도중 `working -> done` 전이 시 지연 sleep 결함**:
   - w1은 preflight에서만 즉시 평가를 수행하고, 이후 polling을 레거시 `watch_workers.sh`에 위임함.
   - `watch_workers.sh`는 파일 존재 여부만 검사하므로, 워커가 작업 도중 보고서 없이 `done`으로 전이되어도 이를 즉시 감지하지 못하고 지정된 timeout까지 계속 sleep함.

## 2. 개선 및 재발방지 조치

1. **상태 평가 모듈 분리 (`coord_completion_state.py`)**:
   - 100줄 규칙을 준수하며 평가 로직을 단일 책임으로 캡슐화.
   - `WATCH_BUDGET_S = 300.0` (호스트 5분 규칙 준수).
   - `assess()`: herdr 상태(`agent_status`)와 보고서 파일 존재 여부를 결합하여 단일 진실 판정.
2. **독립 폴링 루프 구현 (`coord_completion.py`)**:
   - `watch_workers.sh` 외부 위임을 제거하고 파이썬 기반 폴링 루프로 일원화.
   - 매 폴링 간격마다 `assess()`를 호출하여 `working -> done` 전이 발생 시 다음 폴링에서 즉시 `REPORT_MISSING reconcile_now` (exit 4) 반환.
   - 최초 send 시각 앵커를 활용해 재호출 간 누적 시간 보존 및 300초 초과 시 `WATCH_DEADLINE` (exit 5) 반환.
   - stale send 앵커(1시간 이상 경과) 감지 시 `WATCH_STALE` (exit 6) 반환.
3. **회귀 검증 테스트 작성 (`tests/coord-completion.test.ts`)**:
   - 가짜 herdr와 mock 시간 주입을 통해 5종 시나리오 전수 검증:
     - `working -> done` 전이 시 <2s 즉시 exit 4 반환.
     - 300초 예산 초과 시 즉시 exit 5 반환 및 재호출 간 예산 비리셋 검증.
     - task 불일치 및 send 기록 부재 시 즉시 exit 6 반환.

## 3. 검증 결과

- `tests/coord-completion.test.ts`: 5 tests passed (node --test)
- 기존 coord 단위 테스트 4종 (`test_coord.py` 등): 전수 PASS
- 파일 크기: `coord_completion.py` (53줄), `coord_completion_state.py` (75줄), `tests/coord-completion.test.ts` (82줄) 모두 100줄 이하 유지.
