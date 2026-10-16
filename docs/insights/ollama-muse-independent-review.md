# #167 Ollama Muse Spark Open 구현 독립 리뷰 (w2)

- 대상 작업: w3의 #167 구현 (`/tmp/yoroi-167-catalog-implementation-w3-report.json`, `docs/insights/ollama-muse-implementation.md`)
- 검토 범위: `plan-catalog.ts`, `model-aliases.ts`, `tests/insights-ollama-muse-open.test.ts`, `tests/insights-model-aliases.test.ts`
- 검토 결론: **적합 (Acceptance 기준 충족, 소유 테스트 정정 완료, w1 비소유 테스트 인계 대기)**

## 1. 세부 검토 항목 및 판정

1. **공식 접근권 및 verified (`plan-catalog.ts:76`)**:
   - `ollama-cloud-pro`에 `muse-spark-open` 정상 등재.
   - `sourceUrl: 'https://ollama.com/library/muse-spark-open'`, `checkedOn: '2026-10-16'`, `verified: true` 확인.
   - 공식 pricing 페이지 미등재 상태이므로 library 직접 확인 URL을 출처로 삼은 판단 적절.

2. **`:cloud` 별칭 필요성 실측 및 반영 (`model-aliases.ts:19-20`)**:
   - `normalizeModelName`은 `:free`/`:beta`만 제거하며 `:cloud`는 보존되므로 canonical 연결을 위한 별칭 규칙 필수.
   - `from: 'muse-spark-open:cloud'`, `to: 'muse-spark-open'`, `checkedOn: '2026-10-16'`, 출처 태그 URL 명시 확인.

3. **Muse Spark 1.3과의 분리**:
   - OpenCode Go Plus의 `muse-spark-1-3`과 교차 별칭 및 동일성 추정 없음.
   - 플랜 소속 및 canonical ID 상호 독립성 유지 확인 (`tests/insights-ollama-muse-open.test.ts:37-45`).

4. **증거 부재 시 Top10 미진입 원칙 준수**:
   - 카탈로그 등재만으로 후보 풀에 자동 진입하지 않음.
   - AA 지표 또는 OR/OCD 근거 행 부재 시 Top10 풀에서 제외됨을 합성 테스트로 실증 (`tests/insights-ollama-muse-open.test.ts:47-55`).

## 2. 테스트 갱신 및 비소유 영역 상태

- **소유 파일 갱신**: `tests/insights-model-aliases.test.ts:38`의 `checkedOn` 허용 목록에 `'2026-10-16'` 최소 추가 완료 (`11/11 PASS`).
- **비소유 테스트 상태**: `tests/insights-plan-catalog.test.ts`는 w1의 보완 작업(Argon 10개, Muse 19개 모델 카운트 및 checkedOn) 영역으로 비소유 수정 원칙에 따라 읽기 전용 유지 (현재 2건 실패 상태 기록).

## 3. 후속 절차 및 준수
- #167 이슈: 사용자 지시로 정상 생성되었으며 최종 머지/승인 전까지 `OPEN` 유지.
- #164 warn 구현: 자기 리뷰 배제 원칙 준수 (w3가 전담 리뷰).
- Git/GH 변이, 커밋/PR/머지/태그/릴리스/레터 발행 없음.
