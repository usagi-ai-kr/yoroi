# 환경별 effort 가용성 정책 (#188)

## 목적

추천 effort가 사용자의 실제 실행 경로에서 선택 가능한 상한을 넘지 않게 한다. 모델 ID만으로 전역 상한을 단정하지 않고,
**명시적으로 선택한 환경 프로필**의 관측 근거로만 제한한다. 벤치마크 최적 effort와 현재 환경에서 실행 가능한 추천 effort는 구분하며,
가용성이 검증되지 않으면 검증되지 않음으로 표시한다.

## 설정

- 경로: `config/effort-availability.json` (패키지 설치본에 파일이 없으면 정책 없음 — 모든 관측 effort가 후보, 기존 동작 유지)
- `defaultProfile`: (2026-10-20 추가) 환경변수 미지정 시 활성화할 프로필. **환경변수가 있으면 그 값이 우선**한다.
- `profiles`: 프로필 모음. 활성화는 `YOROI_EFFORT_PROFILE` 환경변수 → 없으면 `defaultProfile` 순서로 결정한다.
  선택자가 파일에 없는 프로필을 가리키면 예외로 멈춘다.
- `caps`: 관측으로 검증된 상한. 이 effort보다 높은 등급의 관측치는 점수·추천에서 제외된다.
- `unverifiedApproximate`: 근사 보고만 있는 모델. **상한을 적용하지 않고** 표기만 한다.
- `aliases`: 표기 키 → 정규화 모델 키 매핑. 키는 `normalizeModelName` 결과로 쓴다.
- cap 값은 `ORCHESTRATOR_EFFORT_ORDER`(`minimal…max`) 안의 값이어야 하며, 오류는 예외로 멈춘다.

## 적용 규칙 (점수와 표시의 일치)

1. 오케: `orchestratorVariants`가 cap 안의 관측 effort만 변형 후보로 남긴다. cap 안 관측이 없으면 default 단일 변형.
2. 워커: 대표 effort 선택과 속도·가격 극값, Cog fallback best가 cap 안 관측치로만 모인다
   (`pickEffortValues(..., cap)`). cap 밖 관측값(예: max 500 tok/s)은 점수에 들어가지 않는다.
3. 워커 성능 원값(aaPerf·cogCorrect)과 성능 소스 선택 기준, 워커 Cog 속도 fallback 표준화도 cap 안 관측치로 좁힌다
   (`capWorkerPerf`, `workerCognitionSpeed(..., caps)`).
4. 가용성 기본 해석은 `computeRoleTop10` 한 곳(env 게이트)에서 하므로 현재 목록·previousRanks·compact·markdown·Free가 같은 프로필을 쓴다.
   run-once는 스냅샷을 한 번 읽어 `buildPreviousRanks`와 `InsightTop10Data.effortAvailability`로 돌려 현재·전일·렌더가 같은 스냅샷임을 보인다.
5. 점수: 활성 프로필이 있으면 **cap 이 없는(unlisted) 모델은 `default` effort 만 쓴다**(상위 effort 추천·점수 제외).
   벤치마크 계산(`UNCONSTRAINED_AVAILABILITY`)은 기존처럼 cap 없이 유지된다.
6. 표기(2026-10-20 변경): effort 칸은 **plain 값만**(`high`·`xhigh`·`default`)을 쓴다. `(미확인)`·`?`·`(상한)`·
   compact effort 범례를 출력에서 제거한다. 3역할 비고의 `미확인`·`가중치 미확정`도 제거한다(내부 값은 유지).
   3역할 모델 열은 `baseModelId`(있으면) 또는 effort 접미사를 뗀 base 를 쓴다. Free 표 모델 열은 표시용으로 `-free` 접미사를 뺀다(내부 id 유지).

## 2026-10-19 관측 범위

- `muse-spark-1-3`: 현재 사용자 환경에서 `xhigh`까지 사용 가능, `max`는 불가 → `caps`에 반영(`xhigh`).
  2026-10-19 관측이며 이후 환경 변화 시 갱신 대상이다.
- 관측 경로: 현재 작업 공간 패널(w1)에서 **OpenCode Go의 Muse Spark 1.3 Contributor가 xhigh로 표시**된 것이 근거다.
  이는 해당 라우트 관측일 뿐 다른 플랜·제공 경로까지 일반화하지 않는다.
- `claude-sonnet-5-5`: 2026-10-20 기준 `high`까지 관측되어 `caps`에 반영했다. 관측 경로의 옵션 집합은
  여전히 제공 경로별로 미검증이므로, 다른 경로의 상한을 부정하지 않는다(사용자 환경 기록이지 전역 상한이 아님).
- 이 관측치는 **사용자 환경 기록**이지 모델의 전역·공식 지원 상한이 아니다. 다른 환경의 모델 능력을 부정하지 않는다.
- 계정·플랜 세부·토큰 등 민감한 환경 정보는 이 파일·설정·문서에 적지 않는다.

## 미해결·한계

- Sonnet 제공 경로별 실제 옵션 집합은 미검증(#168형 가용성 감지 후속 작업). **Sonnet 경로는 미해결로 남긴다.**
- `benchmarkEffort`는 같은 점수 정책의 cap 없는 대표 effort라 계산이 한 번 더 필요하고, 무cap 풀 표준화를 다시 수행한다.
- 프로필 미활성(프로필 없는 환경)에서는 cap 없이 기존 effort 추천이 유지되고, 표시도 plain 이다.
- 수기 RoleEntry(가용성 모드 없음) 표기 비대칭: 생산 파이프라인은 항상
  모드를 명시하므로 compact·markdown이 일치하지만, 모드 없는 수기 입력은
  compact가 원문 effort를 유지하고 markdown 표는 미확인으로 둔다. 동작 변경
  없이 문서로만 기록한다.
