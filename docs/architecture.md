# CLI MVP 아키텍처 (#1)

- 목표: `once` 단발 조회와 `watch` 즉시 조회 후 기본 60초 반복 조회.
- 대상: Ollama Pro(비공식 서명 API)·OpenCode Go(공식 API), Codex·AGY(로컬 CLI),
  Claude(내부 OAuth 사용량 GET). Claude 자동 수집은 CLI·모델 요청을 실행하지 않으며 macOS Keychain은 읽기 전용으로만 조회한다.
- 웹 UI·DB/히스토리 저장·알림은 MVP 후속 범위다.

## 계층과 의존 방향

| 위치 | 책임 | 허용 의존 |
| --- | --- | --- |
| `src/domain` | 공급자·사용량 창·관측 시각·불변조건 | 표준 언어 기능만 |
| `src/app` | UsageSource 포트·오류·단발/반복 수집 | domain 및 app |
| `src/infra` | HTTP·프로세스·scheduler·공급자 변환 | app/domain 및 런타임 |
| `src/ui/cli` | 명령·렌더링·signal 처리 | app/domain |
| `src/composition-root.ts`, `src/composition/` | 설정 해석·구체 구현 조립 | 모든 계층 |
| `src/main.ts` | 실행 진입 | composition root |

- ui/app/domain은 infra 구현을 import하지 않는다.
- 향후 웹 UI도 같은 app/domain 포트를 사용하며 별도 composition root에서 조립한다.
- 외부 조회와 스크립트 실행은 서버/호스트 측 수집 경계에서 수행한다.
  브라우저가 CLI를 실행하거나 인증 키를 받는 구조는 사용하지 않는다.
- 공급자 실패는 공급자별 오류로 격리한다. 원본 stderr·헤더·credential은 UI에 전달하지 않는다.
- 테스트는 외부 HTTP/process/clock 대신 fake를 주입한다.
- 계약이 확인되지 않은 공급자는 수치를 추정하지 않고 제약을 표시한다.

## 구현 순서

1. #1 설계 → #2–3 실행·검증 기반 → #4–5 domain/source 포트.
2. #6–12 process·설정·수집·watch·CLI·HTTP 경계.
3. #13–17 조회 계약 확인 → #18–22 어댑터. 비공식 경로는 사용자 허가와 근거를 기록한다.
4. #23 조립 → #24 BDD → #25 실제 검증 결과 기반 문서 동기화.

## CLI 출력 형식 (표시 계층)

- 숫자 metric(percent·used·limit·remaining)은 표시 계층에서만 소수점 둘째 자리까지 올림한다. 원본 값은 유지한다.
- plain 출력의 window 줄에 `reset_in=6d18h`처럼 observedAt 기준 남은 시간을 붙인다. 1시간 미만은 `45m`, 지난 리셋은 `0m`이다.
- pretty 출력의 Reset (KST) 열은 시각 뒤에 `(6d 18h)`를 붙인다. 리셋 시각이 없으면 `-`다.
- 예상 균등 사용량 비율(exp)은 기본 공급자당 1개(월간 우선, 없으면 주간)의 가장 긴 창에 표시한다. agy만 예외로 `g-w`·`c-w` 두 주간 창 모두에 표시하며, 계산식·시작점 검증 불가(resetAt·periodStart 누락 등) 시에는 같은 숨김 규칙을 따른다. 계산은 `(창 길이 - 남은 시간) / 창 길이 × 100`(주간 7일, 월간은 리셋 1개월 전 역산)이며 소수점 둘째 자리까지 올림한다. plain은 `expected=42.86`, pretty는 `Usage` 열 뒤에 `(exp 42.86%)`로 붙인다.
- 창 행 정렬은 표시 단계에서만 한다: 등급 `m`→`w`→`5h`(접두어 표기도 `g-w`·`c-5h` 같은 등급)→등급 없는 내부 id 행은 맨 뒤. 같은 등급은 수집 순서를 유지한다.
- 사용량 상태 표시(표시 전용, 수집·저장 불변): exp가 있는 행은 실제%와 exp를 원본값으로 비교해 판정한다. 실제%는 `percent` 필드를 우선하고 없으면 `used/limit`로 계산한다. `|실제 - exp| ≤ 3%p`면 `optimal`(경계 포함), 차이가 `-3%p` 미만이면 `under`, `+3%p` 초과면 `over`, exp나 실제%를 구하지 못한 행은 `n/a`다. 표시 수치는 소수점 둘째 자리로 올리고 비교에는 원본값을 쓴다. 형식은 pretty가 Status 열에 `ok over`처럼 `ok`를 유지한 채 부가 표기만 더하고(열 폭 불변), plain은 window 줄에 `usage_status=<상태>`를 붙인다.
- ollama-pro 표시: `monthly`·`credits:included`(월간 인정, period.until 리셋)만 plain·pretty에 표시하고 `activity:*`·`session`·`weekly`는 숨긴다. `credits:purchased`는 계속 수집하지만 기본 출력(pretty·plain)에서는 제외해 기본 표시는 월간 `m`(`credits:included`)만 남는다. 표시 대상이 0개면 창 0개에 plain `windows=0 (N windows hidden)`·pretty `(none)` 행으로 안내하고 전체 폴백은 하지 않는다.
- 표시 표기: 길이 확정 창만 `5h`·`w`·`m`으로 줄이고(그 외 내부 id 그대로), codex는 kind 첫 글자(`p-5h`)→버킷+kind(`cp-5h`)→내부 id 3단계로만 승격한다. 내부 id·수집 데이터·계산은 바뀌지 않는다.
- `credits:included` 예상 비율은 `period.from`(periodStart) 시작점 기준이며, 없거나 무효·reset 이후면 숨긴다. opencode·legacy monthly는 응답에 시작 필드가 없어 기존 역산을 유지한다.
- README에는 출력 예시를 두지 않았다(README 변경은 사용자 요청 범위).

## 수집 이벤트 계약 (app 계층, #31 첫 단위)

- `src/app/collection-events.ts`의 순수 함수 `buildCollectionEvents`가 collectOnce 결과에서
  `usage.collected`(전체 성공 1건)·`usage.partial`(실패 있음 1건)·`auth.expired`(공급자별 인증 만료)·
  `usage.resetChanged`(이전 스냅샷 대비 resetAt 변경, 양쪽 정의 시만) 목록을 만든다.
- 이벤트에는 이름·공급자·시각·오류 코드·변경된 resetAt만 담고 스냅샷·수치·추정치·비밀값을 담지 않는다.
  rolling window 추정치도 발행하지 않는다.
- 의존 방향: app은 domain·app만 import한다(infra·ui import 금지, tests/architecture.test.ts로 검증).
  0.2.0 저장·WS·Zod 연결은 다음 단위 범위다.
