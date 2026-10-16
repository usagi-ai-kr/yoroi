# #164 사용률 90% warn 상태 구현 보고

- 작업 ID: `yoroi-164-warn-implementation-w2`
- 관련 이슈: [#164](https://github.com/qus0in/yoroi/issues/164) `feat: 사용률 90% 도달 시 warn 상태 추가`

## 1. 9개 설계 권고안 번호별 처리 내역

1. **상태 우선순위**: 권고대로 처리. `limit(≥98)` > `warn(≥90, <98)` > `optimal/under/over` > `n/a` 우선순위 확정.
2. **주기별 조건**: 권고대로 처리. 모든 창(weekly, monthly, 5h 등)에 동일한 절대 90% 임계치 적용.
3. **exp 없는 창**: 권고대로 처리. resetAt/exp가 없는 창도 실제 사용률 90% 이상이면 `warn` 적용(limit과 동일 패턴).
4. **다중 창 집계**: 권고대로 처리. 공급자별 집계가 아닌 행별(window별) 독립 계산 및 상태 유지.
5. **정규화 우선순위**: 권고대로 처리. `percent > used/limit` 현행 유지, `remaining` 전용 계산 추가 없음(exp 유무 무관 n/a 유지 전용 회귀 검증 완료).
6. **비교 기준**: 권고대로 처리. 원본값(부동소수점) 기준으로 판정(예: 원본 89.991은 표시 90이어도 warn 미적용).
7. **pretty 색상 및 표 노출**: 권고대로 처리. over의 노랑(`pc.yellow`, 33)과 구별되는 밝은 노랑(`pc.yellowBright`, ANSI 93) 선택, 기본 `SHOWN_STATUSES`에 `warn`을 포함하여 기본 표에 즉시 노출.
8. **JSON / plain 출력**: 권고대로 처리. plain 출력의 `usage_status=warn` 반영 확인 및 4개 공급자 검증 완료. JSON은 전 상태 공통으로 상태 필드를 담지 않는 raw 스냅샷 계약(불변)을 따르며, 임의 필드 추가 없이 기존 contract 유지(검증 테스트 포함).
9. **경계 테스트 값**: 권고대로 처리. 89.9 / 90 / 97.9 / 98 / 99.9 / 100 / unknown 및 raw 89.991, used/limit 전체 합성 검증 완료.

## 2. 코드 및 문서 변경 사항

- `src/ui/cli/pace.ts`: `UsageStatus`에 `"warn"` 추가, `WARN_PERCENT = 90` 정의, 분기 추가.
- `src/ui/cli/render-pretty-filter.ts`: `SHOWN_STATUSES`에 `"warn"` 추가, `statusColors.warn`에 `pc.yellowBright` 매핑.
- `src/ui/cli/display.ts`, `render.ts`: 변경 불필요 확인 (상태 문자열 및 필터 흐름이 자동으로 통과).
- `docs/architecture.md:42`: 90% warn 규칙 반영.
- `tests/pace.test.ts`: 97.99·97 기대값 warn 갱신 및 used/limit 9/10 warn 검증.
- `tests/usage-status-render.test.ts`: 95% 기대값 warn 갱신 및 formatStatus 루프 확장.
- `tests/cli-pretty-full.test.ts`: `isShownStatus` 및 pretty 렌더링에 warn 상태 반영.
- `tests/usage-warn-boundaries.test.ts` (신규): 7개 경계값 x exp 유무 x 4개 공급자 행렬, raw 89.991, 다중 window 검증.
- `tests/usage-warn-render.test.ts` (신규): yellowBright(93) 색상, 폭 불변, 4개 공급자 렌더링 검증.

## 3. 검증 결과

- `npx tsc --noEmit`: 오류 0건 통과.
- `tests/pace.test.ts`, `usage-status-render.test.ts`, `cli-pretty-full.test.ts`, `pretty-hide.test.ts`, `cli-render.test.ts`, `usage-warn-boundaries.test.ts`, `usage-warn-render.test.ts`: 전원 통과.
- 파일당 100줄 제한 전 파일 준수.
