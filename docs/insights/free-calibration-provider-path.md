# Free 캘리브레이션 실행 경로 사전 확인 (#180)

구현 착수 전 확인 기록이다. live 실행·모델 호출 없이 코드만 읽었다.
관측 범위는 이 저장소 작업 트리(v1.3.0, dev)이며 사용자 환경 일반화가 아니다.

## 오늘 Free 모델을 실행하는 경로는 없다

- Free 발견의 유일한 모델 접촉면은 목록 조회다.
  `src/insights/opencode-free-models.ts:20-33`은 `opencode models`
  (`--standalone`는 v2) 실행 후 `-free` 접미사 ID만 파싱한다(30초 타임아웃).
  모델 추론·채팅·에이전트 실행 호출은 없다.
- `src/composition/insights.ts:50-55`는 위 조회를 지표 수집과 병렬로
  실행해 `buildFreeCatalog`으로 런타임 freeCatalog을 만들 뿐이다.
- Free는 접근 근거·표시에만 쓰인다.
  `src/insights/letter-top10-unified.ts:76-78`(verified 행 접근 근거),
  `src/insights/letter-markdown-free.ts:20-22,45-54`(Free 섹션 렌더).
- `once`·publish 경로에 모델 실행 호출은 없다. insights 내
  chat/completion/generate/subagent 계열 호출은 존재하지 않는다(grep 확인).
  실행 프로브는 `ps` 읽기 전용이다(`src/infra/opencode-process.ts:3-12).

## 캘리브레이션에 필요한 신규 경로

- 명시적 opt-in 명령(`insights calibrate free --model <id>` 등)은
  새로 만들어야 한다. 기존 포트·run-once 흐름을 재사용하지 않는다.
- 라우팅 식별자는 정규화 `modelId`가 아니라
  `originalId`(`opencode/<provider>/<id>-free` 원형,
  `opencode-free-models.ts:5-7,15-17`)를 써야 한다.
- 격리(임시 디렉터리·허용 파일 외 접근 차단·Git/네트워크 차단)와
  상한(과제 5분·턴 2회·출력 1024 토큰·재시도 없음)은 실행기 자체가
  강제해야 한다. #180 가드레일과 동일 조건이다.
- in-repo 유일 후보는 `ProcessRunner` 경유 OpenCode CLI 실행이다.
  직접 HTTP 모델 호출은 신규 코드·신규 자격 범위가 된다.

## 쿼터·비용 가시성: 지금 되는 것과 live 확인분

되는 것(정적 근거):

- Free 플랜 신원·검증 상태·확인일·출처 URL(freeCatalog 항목).
- 정적 한도 메모만: Zen "수치 한도 미공개",
  Go "Unlimited·기간 한정·클라이언트 세션 한정"
  (`letter-markdown-free.ts:13-16`).
- 카탈로그 유일 수치 한도는 Plus 플랜 kimi-k3 440/5h
  (`plan-catalog.ts:78`)로 Free가 아니다.

live 실행·제공자 공개로만 확인 가능:

- Free 숫자 잔여량·모델별 rate limit·Free 토큰 비용.
- 세션 한정(Go Free) 강제 방식, zero-retention 동작,
  실제 지연·재시도 특성.
- 저장소에 OpenCode용 billing/쿼터 클라이언트는 없다
  (xai-billing·ollama-balance는 타 제공자 전용).

## 미해결(사용자 확인 필요)

- Free 실행 주체: OpenCode CLI 직접 실행인가, 별도 에이전트 경로인가.
- Go Free 세션 한정이 격리 실행기와 충돌하지 않는지 live 확인.
- Zen 수치 한도 미공개 상태에서 상한 표시·확인 절차 합의.
