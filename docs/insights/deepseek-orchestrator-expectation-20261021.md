# DeepSeek O 기대와 오픈·Free 조합 최적화 (#267, 2026-10-21)

계산 기준: #265 레터 Top7 값과 현재 작업 트리의 `runThreeRolePipeline`/`buildTeamCombinations` 경로. 코드·점수·순위는 변경하지 않았다.

## 1. #265 값과 #251 값 일치

#265 Top7 점수는 #251과 동일하다. DeepSeek O 62.94, R 73.90, W 57.55; Muse R 80.80; MiniMax W 59.35; mimo-flash W 54.54; glm-5-3 W 53.19.
최신 정책(공통 밴 glm-5-3·kimi-k3·mimo-v2-6-pro, Luna/Haiku O 허용) 반영 후 open-1+1+3의 O는 glm-5-3-flash로 바뀌었다.

## 2. 실제 코드 출력 (tsx, open 정책)

| 조합 | 슬롯 | 합산 |
|---|---|---:|
| best-1+1+3 | O claude-opus 72.95, R muse 80.80, W gpt-luna 69.60, haiku 64.40, minimax 59.35 | 347.10 |
| best-1+2 | O claude-opus 72.95, W gpt-luna 69.60, minimax 59.35 | 201.90 |
| open-1+1+3 | O glm-5-3-flash 56.08, R muse 80.80, W minimax 59.35, deepseek 57.55, mimo-flash 54.54 | 308.32 |
| open-1+2 | O deepseek 62.94, W minimax 59.35, muse 55.98 | 178.27 |

## 3. 확정 정책 비교 (워커 1자리 Free 우선, 최소 1, Beam 강제 없음)

| 시나리오 | 1+1+3 결과 | 합산 | GLM5.3 | Beam |
|---|---|---:|---|---|
| 기준선(자연) | O deepseek, R muse, W minimax+mimo-flash+glm-5-3 | 310.82 | 유지 | 미진입 |
| Free 최소 1슬롯 | 동일(이미 Free 2슬롯) | 310.82 | 유지 | 미진입 |
| Free 정확히 1슬롯 | O deepseek, R muse, W minimax+glm-5-3+mimo-pro | 301.74 | 유지 | 미진입 |
| Beam 강제 1슬롯 | O deepseek, R muse, W minimax+mimo-flash+beam | 257.63 | 제외 | 진입(unmeasured 1) |

확정 정책(best-1+2) 실출력은 **201.90**(O claude-opus 72.95 + W gpt-luna 69.60 + minimax 59.35)으로 확정되었다. 기준선 206.95는 Free 워커 없는 이전 출력이다. 증거: w1 보고서 `tmp/yoroi-266-letter-final-draft-w1-report.json`.

## 4. 선택 이유

- 최신 정책 전: DeepSeek O, R muse, W minimax+mimo-flash+glm-5-3 = 310.82.
- 최신 정책 후: 공통 밴에 mimo-v2-6-pro 추가, Luna/Haiku O 허용. O glm-5-3-flash 56.08, R muse 80.80, W minimax 59.35, deepseek 57.55, mimo-flash 54.54 = 308.32.
- DeepSeek O 고정안은 307.00이다.
- DeepSeek이 O가 아닌 이유는 W3의 측정 후보를 보존하기 위한 전역 최적화 때문이다. Beam 강제 실험값(257.63)은 일반 대안이 아니다.
- GLM5.3: Free 2슬롯(minimax, mimo-flash) 뒤 남은 최고 측정 후보(53.19)라 W3에 들어간다. Beam 강제 시에만 제외된다.
- MiniMax: 모든 시나리오에서 W에 등장한다.
- Beam: 미측정(score undefined, 합산 미포함)이라 측정 후보가 충분하면 선택되지 않는다. 강제 시 unmeasured 1과 합산 257.63으로 떨어진다.
- "기존 가성비 우선"은 워커 점수의 가격 가중치(40%)가 이미 반영된 기준선으로 본다.

## 5. 상태

- 사용자 확정: 두 정책 모두 워커 1자리 Free 우선, 최소 1, 나머지 Free 허용, Beam 강제 없음.
- 초안: `tmp/letter-20261021-union-free-draft.md` (#265 본문 보존, 권장 조합만 현재 생성 출력으로 교체).
- 최신 정책 실출력 근거: `tmp/yoroi-266-blacklist-w1-report.json` (open-1+1+3 308.32).
- r/w2 직접 리뷰 요청 대기. #267 외부 쓰기는 r 검증 후에만 한다.
- 레터는 계속 진행한다. 0.3.x·Postgres 작업만 중지한다. 코드 변경 없음.
