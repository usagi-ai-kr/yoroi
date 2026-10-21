# Free 점수 심층 감사 결과 (2026-10-21, 진단만)

## 핵심 규칙 (실측)
- `belowZone`는 표시 점수가 아니라 원시 AA 지수로 판정한다:
  `repVariant.value < max(같은 역할 대표 원값) × threshold`
  (worker 0.60, orchestrator 0.85). 합성 재현으로 확인.
- 워커는 원값 하한 33이 별도로 있어 그 아래는 목록에서 빠진다.
- Free 셀 ✗ = 해당 역할 목록에 belowZone으로 들어간 결과다.
  표시 점수(합성: 가격·사용량·속도가 끌어올림)와 별개라
  "점수는 있는데 ✗"가 정상적으로 발생한다.

## 3계열 표 (원시 AA 값은 미확인으로 표기)
| 모델 | 표시(워커) | Free | effort | ban | 원시값 | 탈락 위치 |
| --- | --- | --- | --- | --- | --- | --- |
| deepseek-v4-1-flash | 64.4 | ✗✗ | max | 없음 | 미확인 | 원값 컷 또는 indexMissing (둘 중 하나, 생데이터 없이 단정 불가) |
| mimo-v2-6-flash | 54.5 | ✗✗ | default | 없음 | 미확인 | 동상 |
| glm-5-3-flash | 53.2 | ✗✗ | default | 없음 | 미확인 | 동상 |

- 데이터 연결 끊김 없음 단정은 철회한다 (증명 부족). 합성 재현 패턴:
  AA index 레코드 부재 → indexMissing → belowZone 강제 + indexText `-`,
  가격·사용량·속도 근거로는 합성 점수 표시. #225 세 행과 일치한다.
- 별칭 후속 확인: 정규화(점·벤더·스냅샷)는 정상이나, `-free` 접미사 별칭 규칙은
  MiniMax 1건뿐이다. 실측 재현: 카탈로그 `-free` id 중 MiniMax만 AA id와 이어지고
  DeepSeek/GLM/MiMo는 탈락한다. Free 행의 AA `-`·✗ 패턴과 일치한다.
- ban 없음, effort는 표시값이다. 원시값 미확인 표기는 유지한다.

## 리뷰어–Free 미연결 (정정)
- 앞 보고서의 "의도된 범위" 단정은 근거 없음 — 철회한다.
- 현재 2열(오케·워커) 구조에서 미구현 상태가 맞다.

## 후속 제안 (구현 단위)
- Free 표 리뷰어 열 추가: `letter-markdown-free-table.ts` (열·헤더),
  `freeRowsFrom` 역할 순회 (같은 파일군), 회귀는 오케·워커 셀 불변 +
  리뷰어 셀 표시 테스트. 점수·가중치·threshold 변경 없음.
