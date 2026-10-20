# #168 모델 자동감지 확정 제공자 어댑터 (Unit 5, 2026-10-20)

## 1. 개요
Issue #168 (신규 모델·플랜 가용성 자동감지)의 **Unit 5: 확정 제공자 어댑터** 구현 명세다. Unit 4 설계에서 검증된 3대 확정 제공자(OpenCode, OpenRouter, Ollama)에 대한 비침습적·선택적 어댑터와 파서를 구현하였다.

> [!IMPORTANT]
> **기존 파이프라인 불변**: 본 어댑터는 기본 비활성(default-off) 상태이며, 카탈로그(`plan-catalog.ts`), 수집 사이클(`once`), 레터 렌더러, 설정 파일(`letter-model-lists.json`)에 일체 연결하지 않는다.

## 2. 어댑터 인터페이스 및 레지스트리 (`src/insights/model-discovery-adapters.ts`)
- `DiscoveryContext`: `checkedOn`, `verified?`, `fetchText?`, `fetchJson?`, `runCommand?`, `signal?`
- `ProviderDiscoveryAdapter`: `providerId`, `discover(ctx: DiscoveryContext): Promise<readonly DiscoveredModel[]>`
- `DISCOVERY_ADAPTERS`: `opencode`, `openrouter`, `ollama` 어댑터 등록

## 3. 구현된 확정 제공자
1. **OpenCode (CLI)**:
   - `parseOpenCodeFreeModels` 재사용 (`src/insights/opencode-free-models.ts`).
   - 플랜 ID(`opencode-zen-free`, `opencode-go-free`) 및 `free: true` 공식 매핑.
2. **OpenRouter (공개 API)**:
   - `GET https://openrouter.ai/api/v1/models` 응답 파싱.
   - 슬래시 ID 경계 정규화: OpenRouter 원본 ID의 `/`는 어댑터 경계에서 `:`로 변환된다(예: `openai/gpt-4o` → `openai:gpt-4o`). 이를 통해 보안 패턴 완화 없이 `isValidModelId`를 충족하며 제공자 접두어와 고유성을 온전히 보존한다.
   - `sourceUrl` 부여, 플랜(`planIds: []`) 및 effort(`efforts: undefined`)는 미확인으로 안전하게 유지.
3. **Ollama (로컬 API)**:
   - `GET http://localhost:11434/api/tags` 로컬 응답 파싱.
   - 로컬 모델 태그 식별자 보존.

## 4. 메타데이터 신뢰 경계 및 불변 원칙
- **verified 기본값 false**: 호출자/설정에서 명시적으로 `verified: true`를 주입하지 않는 한 절대 자동 승격하지 않는다.
- **유사 이름 무병합**: `muse-spark-1.3` vs `muse-spark-open`, `llama3.2:3b` vs `llama3.2:latest` 등 서로 다른 모델은 별도 ID로 보존.
- **티어·effort 미날조**: 공식 확인되지 않은 플랜이나 effort 옵션은 임의 생성하지 않는다 (`planIds: []`, `efforts: undefined`).
- **결측·오류 행 배제**: 식별자 누락, 빈 문자열 등 파손된 행은 무시하고 정상 행만 수집.

## 5. 검증 결과 (`tests/insights-model-discovery-adapters.test.ts`)
합성 픽스처 기반 8개 단위 테스트 통과 (실제 네트워크 호출 0건):
1. `OpenCode provider mapping with planIds and free flag`
2. `OpenRouter provider mapping normalizes slash to colon and leaves efforts absent`
3. `Ollama local provider mapping leaves efforts absent`
4. `verified defaults to false and is never auto-promoted`
5. `malformed rows are dropped cleanly`
6. `similar names with slash are normalized to colon and not merged`
7. `deterministic repeat across runs`
8. `adapter discover via injected context and no-fetcher returns empty array`

> [!NOTE]
> 본 단위는 확정 제공자 어댑터 구현(Unit 5)이며, 설정/once/카탈로그 연결 및 Q1~Q4 정책 결정 전까지 #168 전체 완료를 의미하지 않는다.
