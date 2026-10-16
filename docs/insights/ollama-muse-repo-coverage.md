# Ollama Muse Spark Open 레터 커버리지 조사 보고

- 대상 모델: `Muse Spark Open` (`muse-spark-open` / `muse-spark-open:cloud`)
- 조사 목적: 현재 Ollama에 추가된 Muse Spark Open의 레터 커버 여부 확인 (코드 읽기전용)
- 조사 결론: **현재 레터에서 전혀 커버되지 않음 (미반영·미노출)**

## 1. 모델 식별 및 유사 모델 혼동 방지
- `Muse Spark 1.3 Contributor` (`muse-spark-1-3`), `Muse Spark 1.2` (`muse-spark-1-2`)는 OpenCode Go Plus 플랜 소속으로, Ollama의 `Muse Spark Open`과 완전히 다른 모델이다.
- 이름 유사성만으로 동일 모델로 추정하지 않으며, 별칭이나 승계 관계도 연결되어 있지 않다.

## 2. 단계별 조사 결과 및 파일:행 근거

### 1) 지원됨 (Provider 및 CLI)
- 프로바이더 설정: `src/domain/usage.ts:1`에 `ollama-pro`가 기본 프로바이더로 포함되어 사용량 조회가 지원됨.
- 소스 연동: `src/infra/ollama-source.ts:9-11`에서 크레딧/활동량 파서 제공.
- 로컬 CLI: `ollama list` 확인 결과 모델 미등록(빈 목록). 로컬 pull/serve는 지침에 따라 금지 및 미수행.
- 공식 라이브러리: `ollama.com/library/muse-spark-open`에 cloud 전용으로 등록됨(w3 보고 참조).

### 2) 카탈로그 (plan-catalog 접근권 및 verified)
- 근거: `src/insights/plan-catalog.ts:67-74`
- 현황: `ollama-cloud-pro` 플랜 모델 18종에 `muse-spark-open`은 **미등록 (누락)**.
- 영향: `src/insights/letter-top10-candidates.ts:52`의 `accessible` 집합에 들어가지 못해 접근 가능 모델 판정 불가.

### 3) 정규화 및 별칭 (normalizeModelName & alias)
- 정규화: `src/insights/model-id.ts:42-46`의 `normalizeModelName('muse-spark-open')`은 `'muse-spark-open'` 그대로 유지.
- 별칭 규칙: `src/insights/model-aliases.ts:8-19`의 `MODEL_ALIAS_RULES`에 `muse-spark-open` 규칙 **없음 (누락)** (`muse-spark-1-3-contributor` → `muse-spark-1-3` 규칙만 존재).

### 4) 데이터 (collector provider / telemetry / fixture)
- 수집 소스: `src/insights/record.ts:1`, `src/insights/types.ts:56-59`에서 벤치마크 소스는 `artificial-analysis`, `openrouter`, `cognition`, `opencode-data` 4종으로 한정. Ollama는 벤치마크 수집 소스가 아님.
- 데이터/픽스처: 외부 수집 데이터 및 `tests/fixtures/` 전반에 `muse-spark-open` 관련 행 **전무 (누락)**.

### 5) 적격 후보 (role eligible / CandidatePool)
- 후보 풀: `src/insights/letter-top10-candidates.ts:49-65`의 `buildCandidatePool`에서 카탈로그 `accessible`과 `evidence`에 모두 없어 후보 풀 탈락 (**누락**).
- 역할 변형: `src/insights/letter-top10-candidates.ts:70-87`의 `buildRoleVariants`에서도 지표 및 근거 행 부재로 placeholder 생성 불가.

### 6) 실제 Top10 노출 (Top10 render path)
- 스코어링: `src/insights/letter-top10-unified.ts:74-93` (`computeRoleTop10`)에서 후보군이 아니므로 평가 대상 제외.
- 렌더링: `src/insights/letter-top10-render.ts:30-44, 52-87`에서 오케스트레이터, 워커, Free 섹션 모두 **미노출**.

## 3. 누락 단계 종합
1. `plan-catalog`: `ollama-cloud-pro` 모델 목록 누락.
2. `model-aliases`: 별칭 규칙 누락.
3. `collector/evidence`: AA/OpenRouter 등 외부 벤치마크 측정 데이터 부재.
4. `candidate-pool`: 접근권 및 근거 부재로 후보 진입 누락.
5. `top10-render`: 레터 발행 목록 전면 미노출.

## 4. 작업 및 보안 준수
- 읽기 전용 검증 완료, 레터 생성·발행 및 코드/설정 변경 없음.
- Git/GH 변이 없음, 비밀값/개인 사용량 접근 없음.
