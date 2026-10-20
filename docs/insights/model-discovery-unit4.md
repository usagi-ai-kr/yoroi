# #168 모델 자동감지 어댑터 및 통합 설계 (Unit 4, 2026-10-20)

## 1. 개요
Issue #168 (신규 모델·플랜 가용성 자동감지)의 **Unit 4 설계 전용 문서**다. 코드 수정·실제 API 호출 없이 provider 어댑터 인터페이스, 지원 가능 provider 분류, 통합 지점 및 사용자 결정 사항을 정의한다.

## 2. Provider 어댑터 인터페이스 제안
Unit 2 (`model-discovery-types.ts`)의 `DiscoveredModel` 순수 계약을 재사용한다.
```ts
export interface ModelDiscoveryAdapter {
  readonly providerId: string;
  fetchList(ctx: { client?: HttpClient; runner?: ProcessRunner; signal?: AbortSignal }): Promise<DiscoveredModel[]>;
}
```
- **계약**: `verified === true`, `sourceUrl`, `checkedOn`, `planIds[]`, `efforts[]` 5대 요건 충족 시에만 편입 검증 통과 (`model-discovery-eligibility.ts`의 `isEligibleModel` / `checkEligibility`). 미충족 모델은 코드가 `verified`를 승격하지 않고 fail-closed 유지.

## 3. 지원 가능 Provider 후보 (근거 경로 및 실측 일자)
### A. 즉시 지원 가능 후보 (확인된 공개 경로 / 기존 레포 코드)
1. **OpenCode (Zen/Go)**: `src/insights/opencode-free-models.ts` (`opencode models` CLI runner, 근거: `docs/insights/sources-opencode-data.md` 2026-10-12 사용자 확정).
   - 상태: 이미 CLI 파서와 런타임 카탈로그 빌더 존재. 어댑터 인터페이스 래핑만으로 즉시 연동 가능.
2. **OpenRouter**: `https://openrouter.ai/api/v1/models` (공개 HTTP GET).
   - 상태: 공개 엔드포인트 존재 (`openrouter-parser.ts` 계통). 모델 ID·가격·컨텍스트 제공. 단, 사용자 요금제(planIds) 및 effort 지원 여부는 별도 매핑 필요.
3. **Ollama (Local)**: `http://localhost:11434/api/tags` (로컬 공개 HTTP GET).
   - 상태: 로컬 인스턴스 실행 시 인증 없이 태그 목록 즉시 수집 가능.

### B. 추가 검증 필요 / 미확인 후보 (공식 API 존재하나 메타데이터 부족)
1. **OpenAI** (`GET https://api.openai.com/v1/models`): API 키 필요. ChatGPT Plus/Pro 플랜 가용성 및 reasoning effort 메타데이터 미제공.
2. **Anthropic** (`GET https://api.anthropic.com/v1/models`): API 키 필요. Claude Pro/Max 플랜 가용성 미제공.
3. **Google Gemini** (`GET https://generativelanguage.googleapis.com/v1beta/models`): API 키 필요. Antigravity/Google One AI 플랜 매핑 부재.
4. **Antigravity IDE / Cursor**: 공개 API 없음. 웹 문서(`https://antigravity.google/docs/models`, `cursor.com/pricing`) 수동 확인에 의존.

## 4. 설정 스키마 및 저장소 위치
- **설정 확장** (`config/letter-model-lists.json` 내 `discovery` 섹션):
  ```json
  "discovery": { "sources": ["opencode", "openrouter"], "pinned": [], "excluded": [] }
  ```
  - `excluded`는 정규화 ID 기준 차단(fail-closed, `pinned`보다 우선).
- **스냅샷 파일 저장소 위치 후보** (`baseDir` 주입):
  - **후보 1 (권장)**: `~/.config/yoroi/discovery/` (XDG 상태 디렉터리, 사용자별 분리)
  - **후보 2**: 레포 내부 `cache/discovery-snapshots/` (.gitignore 대상)

## 5. 파이프라인 통합 지점 및 실패 동작
1. **수집 주기 (`once`)**: 기존 daily once 사이클 말미에 등록된 provider 어댑터 순회.
2. **Diff 감지 및 알림**: `diffRegistry` 실행 후 변경 시 stdout 1줄 알림 (`<time> discovery registry-diff providers=N added=N removed=N changed=N`), 무변경 시 무출력.
3. **카탈로그 통합**: `buildCandidatePool` 시 `PLAN_CATALOG`에 검증 완료된 `DiscoveredModel`을 런타임 플랜으로 합성.
4. **실패 동작**: fail-closed. 수집 실패 시 세대 교체 없이 직전 유효 last-good(30일 한도) 보존.

## 6. 사용자 결정 목록 (Decision List)
- **Q1. 자동 편입 범위**: stdout diff 알림만 유지(현재 합의) vs 5대 요건 충족 시 레터 후보 풀 자동 등재 허용?
- **Q2. 폐지 유예 정책 (Deprecation Grace)**: 수집에서 모델이 미발견(`removed`)되었을 때 즉시 삭제 vs N회 연속 부재 시까지 보존?
- **Q3. 스냅샷 저장 경로**: XDG `~/.config/yoroi/discovery/` vs 레포 내부 cache?
- **Q4. 외부 API 키 및 약관 확인**: API 키가 필요한 제공자(OpenAI/Anthropic) 수집 허용 여부 및 자동 수집에 대한 제공자 약관·동의 준수 확인 vs 공개/CLI 제공자만 수집?
