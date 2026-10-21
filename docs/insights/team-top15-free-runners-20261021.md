# 추천 조합 Top15·Free·차선 (2026-10-21, #257)

## 범위
- 조합 입력 `top7`→`top15`. Top7 표·순위 불변.
- verified Free를 워커 fallback으로(점수 없음·`free` 표시).
  점수 후보가 부족할 때만 채운다. 총점은 점수 후보만 합산.
- `letter-team-runners.ts` 분리: 같은 풀에서 조합 밖 최고 1개씩.
- 캡션은 fence 밖: `- 차선: 오케스트레이터 X · 리뷰어 Y · 워커 Z`
  (없으면 `-`, 1+2 리뷰어 포함, Mermaid 내부 노드 금지).
- 오픈 조합 라벨 `오픈 웨이트·Free`. Mermaid 안전·Free 표시 유지.

## 검증
- Top15 수용·fallback·차선·1+2·fence 밖·부족/동점·불변 회귀.
- 후속 block-fix: totalScore 측정합산·unmeasured 노출·비교 순서·
  구성불가 '-' 캡션·캡션 이스케이프.
- typecheck·validate·diff clean, 전체 `pnpm run check`는 보고서 수치.

## w3 block-fix: 차선 캡션은 조합에 실제로 있는 역할만 (2026-10-21)

- **문제**: 캡션이 항상 3역할 차선을 표시 → 1+2 조합(리뷰어 슬롯 없음)에도 리뷰어 차선이 붙음 ✗.
- **수정**:
  - `letter-team-runners.ts` — `runnersUp(pool, picked, roles?)` 가 **조합에 실제로 있는 역할만** 차선 후보를 냄 ✓
    (`RoleRunnersUp.roles` 로 조합 역할 집합을 함께 전달 ✓).
  - `letter-team-combinations.ts` — 조합의 슬롯 역할 배열(`best.slots.map(s => s.role)`)을 차선에 전달 ✓.
  - `letter-mermaid.ts` — `runnersUpCaption` 은 `runners.roles` 기준으로 차선을 만들고(중복 역할 1회 ✓),
    후보가 없으면 `-` ✓ · 차선이 없으면 캡션 전체가 `-` ✓(구성 불가 = 가짜 후보 0 ✓).
- **결과**: `best-1+1+3` → `- 차선: 오케스트레이터 o2 · 리뷰어 - · 워커 -` ✓ (3역할 차선 ✓),
  `best-1+2` → `- 차선: 오케스트레이터 o2 · 워커 w3` ✓ (**리뷰어 차선 없음** ✓), `open-1+2` 동일 ✓,
  구성 불가 → `-` ✓.
- **불변**: Top15 후보·Free fallback·totalScore/unmeasured·Mermaid 안전·Top7/Top15·Free·댓글·publish 무변경 ✓.

## 재발행 위험
- 조합 블록이 길어지면 본문 상한 확인(앞쪽 배치 유지).
- 차선은 참고용이며 슬롯과 겹치지 않음을 캡션으로 확인.
