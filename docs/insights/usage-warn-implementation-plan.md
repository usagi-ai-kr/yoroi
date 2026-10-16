# #164 사용률 warn 상태 설계 (w3, yoroi-164-warn-scope-w3)

- 이슈: [#164](https://github.com/qus0in/yoroi/issues/164) `feat: 사용률 90% 도달 시 warn 상태 추가` (feature, OPEN, milestone 없음).
- 상태: 설계 단위 보고. 구현·테스트·config 변경 없음. 메신저 지시 대기.
- 근거 문서: `docs/insights/usage-warn-issue-task.md`, `docs/insights/active-worker-assignment-20261016.md`, `docs/architecture.md:42`(현행 규칙 문서).

## 1. 현행 규칙 (코드·테스트 확인, 확정)
| 항목 | 규칙 | 근거 |
|---|---|---|
| 실제% | `percent` 우선, 없으면 `used/limit`(limit>0), 둘 다 없으면 unknown. `remaining`은 쓰지 않음 | `src/ui/cli/pace.ts:9-15` |
| limit | 실제% ≥ 98이면 exp와 무관하게 `limit`(exp 없어도) | `pace.ts:25`, `tests/pace.test.ts:58-76` |
| 98 미만 | exp 있으면 \|실제-exp\| ≤ 3이면 `optimal`(경계 포함), 차이 < -3 `under`, > +3 `over` | `pace.ts:26-31` |
| n/a | exp 없음 또는 실제% unknown | `pace.ts:27-28` |
| exp 대상 | 공급자당 1개(monthly 우선, 없으면 첫 weekly). agy는 모든 weekly | `src/ui/cli/expected.ts:20-30` |
| 표시 | pretty는 `ok <status>`; 기본 표는 limit/under/optimal/over만(n/a 숨김, xai weekly 예외), `--full`은 전부 | `render-pretty-filter.ts:6-14`, `render.ts:61-66` |
| 색 | optimal 녹색, under 청록, over 노랑, limit 빨강, n/a 무색 | `render-pretty-filter.ts:24-30` |
| plain | `usage_status=<status>` | `src/ui/cli/display.ts:24` |
| 입력 검증 | percent > 100 거부, 수치 음수 거부. used > limit은 허용되어 실제% > 100 가능 | `src/domain/usage.ts:34-43` |
| 표시 수치 | `formatNumber`는 소수 둘째 자리 올림. 비교는 원본값 | `src/ui/cli/format.ts:4`, `architecture.md:42` |
| 표시 대상 | ollama-pro는 OLLAMA_TARGETS 창만 보임. exp 선택은 보이는 창 목록 기준 | `src/ui/cli/labels.ts:12-16`, `display.ts:42` |

## 2. 확정 사양 (사용자 지시 원문)
- 사용률 90% 이상이면 `warn` 상태를 추가한다.
- 구현, 새 config 임계, 실제 사용량 조회, 버전 지정, milestone, 레터 발행은 범위 밖이다.
- 이슈 열린 질문 마지막 항목 "기존 100% 상태(limit)의 우선권 유지 설계를 우선 검토"는 검토 지시다. 확정이 아니므로 3절에 권고로만 둔다.

## 3. 90% warn과 현행 규칙의 관계 (설계안, 사용자 확인 전)
- 제안 우선순위: `limit(≥98)` > `warn(≥90, <98)` > `optimal/under/over`(기존 exp 규칙) > `n/a`. 권고, 미확정.
- 경계 (exp=50 가정, 현행 → 제안):

| 실제% | 현행 | 제안 | 비고 |
|---|---|---|---|
| 89.9 | over | over | 변화 없음 |
| 90 | over | warn | 경계 포함 |
| 97.9 | over | warn | |
| 98 | limit | limit | |
| 99.9 | limit | limit | |
| 100 | limit | limit | 100 전용 상태 없음, ≥98에 흡수 |
| unknown | n/a | n/a | |

- 주의 예: exp 88, 실제 90이면 현행은 `optimal`(\|2\| ≤ 3). warn이 optimal을 덮을지는 4절 1번.

## 4. 추가 사용자 선택 필요 사항 (확정 아님)
1. warn이 optimal/under/over를 덮어쓸지, 별도 표기 플래그로 둘지.
2. 주기별 조건: 모든 창에 같은 90%를 적용할지. 권고는 절대 임계로 두어 창 선택과 무관하게 하는 것(limit과 같은 패턴).
3. exp 없는 창(현행 n/a)에도 warn을 적용할지. 권고는 limit처럼 적용하는 것이나, 숨김 n/a 행이 warn으로 보이게 된다.
4. 다중 창 집계: 행별 상태(현행, 권고) 또는 공급자 단위 최악 상태.
5. 정규화: `percent > used/limit`(현행)을 유지할지, `remaining` 기반 계산을 추가할지. 현행은 remaining만 있는 창을 n/a로 둔다.
6. 비교 기준: 원본값(현행 문서) 또는 표시값(올림 2자리). 예: 원본 89.991은 표시 "90"이나 원본 비교면 warn이 아니다. 현행도 원본 97.991은 표시 "98"이나 status는 limit이 아니다(기존 불일치).
7. pretty 색과 기본 표 노출: warn 색(노랑은 over가 쓰는 중)과 SHOWN_STATUSES 포함 여부.
8. JSON·plain: `usage_status=warn` 추가 여부. 기존 소비자 테스트는 값 문자열에 의존한다.
9. 경계 테스트 값 확정: 89.9 / 90 / 97.9 / 98 / 99.9 / 100 / unknown.

## 5. 최소 수정 파일 (구현 단위 예고, 이번 단위 미실행)
- `src/ui/cli/pace.ts`: `UsageStatus`에 `warn` 추가, 상수 90, `usageStatus` 분기 1개.
- `src/ui/cli/render-pretty-filter.ts`: `SHOWN_STATUSES`와 `statusColors`에 `warn`. `Record` 타입 때문에 컴파일러가 누락을 잡는다.
- `src/ui/cli/display.ts`, `render.ts`: 변경 없음 예상. 값 문자열이 그대로 흐르므로 확인만 한다.
- `docs/architecture.md:42`: 규칙 문서 갱신(구현 승인 후).
- 기대값이 바뀌는 기존 테스트 4건: `tests/pace.test.ts:68,70`(97.99·97 → over에서 warn으로), `tests/usage-status-render.test.ts:30`(95 over), `tests/cli-pretty-full.test.ts:15`(95). `tests/detect-usage.test.ts`는 상태와 무관해 제외한다.

## 6. 합성 fixture·테스트 계획 (이번 단위 미작성)
- 합성 window: percent 89.9·90·97.9·98·99.9·100, used/limit 9/10·98/100·120/100, 모든 값 없음(unknown), resetAt 유무, weekly+monthly+five-hour, agy 다중 weekly, ollama-pro 가시성.
- 행렬: 경계 7값 × exp 유무 × 공급자(opencode-go, agy, ollama-pro, xai)로 상태·가시성·색·key=value를 검증한다.
- 회귀: `pace.test` 전체, `usage-status-render`, `pretty-hide`, `cli-pretty-full`, `cli-render`. 기대 변경 목록은 5절과 같다.

## 7. 보고 경계
- 이번 단위: 설계와 조사만. source·tests·config·기존 docs 미수정.
- 신규 issue, 라벨, milestone, commit, push, PR, merge, Release, 전역 CLI, 레터, 모델·세션 변경 없음.
- 다음 단계: 4절 항목을 사용자가 확정한 뒤 구현 패킷을 발행한다. 그 전까지 메신저 지시를 기다린다.
