# #168 모델 자동 감지 설계 — 첫 구현 단위(2026-10-20)

- 담당 w3(w18:p4). 소유: 이 파일만. 본 단위는 설계만 — 코드 수정·모델호출·외부인프라 없음.
- 근거: 이슈 #168 본문 + 2026-10-19 확정 결정(댓글 1건). 아래는 그 결정의 구체화이며 결정 변경 없음.

## 1. 확정 결정 → 단위1 적용 형태

| 확정 결정(요지) | 단위1 적용 |
| --- | --- |
| 자동 감지는 레지스트리 diff 기록·stdout 알림까지 한정 | 합성 fixture만(수집 없음). diff 계산·1줄 렌더만 |
| 후보 풀 자동 편입은 공식 메타데이터(sourceUrl·checkedOn·verified·티어·effort) 충족 시에만 | 편입 게이트 함수로 분리. 미충족은 편입 0건 |
| 수집 실패 시 fail-closed, 직전 last-good 보존 | 실패 시 세대 교체 없음 → 노출 목록 불변 |
| override는 `config/letter-model-lists.json` ban·allowOlder 구조 확장, 새 설정 파일 금지 | 같은 파일에 `discovery` 섹션 신설(§6) |
| last-good 스냅샷 1세대, 롤백 대신 스냅샷 보존 | 스냅샷 store 인터페이스만(구현체는 후속 단위). 30일 상수 |
| 알림은 새 인프라 없이 stdout 1줄(detect 스타일) | `renderDetectEvent` 형식 준수(§7) |
| 유사명 병합·verified 위조·지표 위조 금지 | id 정확 일치만·공식 근거 없으면 verified=false·지표 미생성 |

## 2. 현재 흐름 대조 (코드 위치)

- catalog: `src/insights/plan-catalog.ts:58` `PLAN_CATALOG`(99줄 TS 하드코딩). `PlanModelEntry`에 effort 지원 필드 없음.
- 후보 게이트: `src/insights/letter-top10-candidates.ts:50-53` — `accessible`·`catalogIds`는 `verified === true` 항목만. verified가 접근 가능성의 유일 게이트. 플랜 라벨은 `letter-top10-plans.ts`, `plansForCatalogModel`(`letter-top10-candidates.ts:90`).
- 목록 설정: `config/letter-model-lists.json` + `letter-model-lists.ts:27-48`(누락 키→기본값, 파싱 실패→stderr 1줄+기본값). 경로 우선순위 `YOROI_LETTER_MODEL_LISTS`→XDG→레포→기본값.
- 1줄 알림 스타일: `src/ui/cli/detect-render.ts:10-27` — `<time> <source> <what> <details>`, 크리덴셜·경로·자유문자열 금지, 외부 id는 제어문자 제거·64자 제한.
- 소스 어댑터 계약: `src/insights/source-port.ts:7-21` — fetch/parse 분리, 실패는 throw가 아니라 결과 반환. letter 지표 소스(`InsightSource`)와 **별개 네임스페이스**로 둔다.

## 3. registry diff (확정)

- 비교 단위는 provider별 `DiscoveredModel` 집합. 정규화 id **정확 일치**만(유사명 병합 없음).
- `added`: 신규 id. `changed`: 기존 id 중 표시명·티어·free·efforts·sourceUrl·checkedOn 변경(변경 필드명만 기록). `removed`: 직전 세대에는 있고 이번 수집에 없는 id — **즉시 삭제 금지, 표기만**.

## 4. last-good 1세대 + 30일 (확정)

- 보관: current 세대 + last-good 세대 1개. 롤백 절차 대신 last-good 승격으로 복구.
- 30일(상수, config 노출 금지): 스냅샷 `observedAt`이 30일 지난 경우 last-good으로 재사용하지 않고 재수집을 요구하며 폐지 결론 근거로 쓰지 않는다.
- fail-closed: 수집 실패는 세대를 교체하지 않는다(신규 편입 0건).

## 5. 후보 편입 조건 (확정)

`isCandidateEligible(m)` = 아래 5개 모두 충족, 각 항목 공식 출처 기반.
1. `sourceUrl` — 공식 제공자 URL 존재. 2. `checkedOn` — ISO 날짜. 3. `verified === true` — 공식 근거 확인분.
4. 티어 — `planIds[]` 비어 있지 않음(접근 플랜 식별). 5. effort 지원 — `efforts[]` 비어 있지 않음(공식 확인 지원 effort).
- 미충족은 후보 편입 금지. 코드가 `verified`를 true로 승격하지 않는다. 게이트 통과 후에도 기존 제외패턴·세대제외·밴·alias 규칙이 그대로 적용(우회 없음).

## 6. 설정 확장 (확정) — `config/letter-model-lists.json`

```json
"discovery": { "pinned": [], "excluded": [], "sources": [] }
```
- `excluded`: 정규화 id 정확 일치 제외. `pinned`: 고정 — 게이트를 우회하지 않는다. `sources`: 감지 대상 provider 화이트리스트(선택). 충돌은 `excluded` 우선(fail-closed).
- `ban`(역할별 Top10 배제)과 `excluded`(감지→편입 차단)는 의미가 달라 분리 문서화. `discovery` 키가 없어도 파싱 성공(기본값 빈 배열), 파싱 실패 동작은 현행 유지.

## 7. stdout 1줄 (확정)

- 형식: `<observedAt> discovery registry-diff providers=N added=N removed=N changed=N`. 변경이 있을 때만 1줄, 없으면 무출력.
- 제약: 크리덴셜·경로·자유문자열 금지, id는 제어문자 제거·64자 제한. 새 알림 채널·새 인프라 없음.

## 8. 첫 구현 단위 제안 (Unit 1, 코드 미작성)

- `src/insights/model-discovery-types.ts` — 아래 타입. `src/insights/model-discovery-diff.ts` — `diffRegistry`·`isCandidateEligible`·`selectSnapshot`(last-good 승격)·`renderDiscoveryDiffLine`.
- `src/insights/model-discovery-config.ts` — `discovery` 섹션 타입·파서. `letter-model-lists.ts`는 현재 90줄이라 100줄 초과 위험 → 별도 파일 + 호출부 1~2줄.
- `tests/insights-model-discovery.test.ts` — 합성 fixture 테스트. `config/letter-model-lists.json` — `discovery` 기본 섹션(선택).
- `plan-catalog.ts`·후보풀·레터 렌더는 Unit 1에서 미변경(레지스트리는 별도 산출물).

```ts
/** 감지 1건. id는 정규화 값, 1 id = 1 model(유사명 병합 금지). effort·티어 없이는 편입 불가. */
export interface DiscoveredModel { readonly modelId: string; readonly displayName: string;
  readonly sourceUrl: string; readonly checkedOn: string; readonly verified: boolean;
  readonly planIds: readonly string[]; readonly free?: boolean; readonly efforts?: readonly string[]; }
/** 기준 대비 차이. removed는 '이번 수집 부재' 표기이며 즉시 삭제하지 않는다. */
export interface ModelDiscoveryDiff { readonly providerId: string; readonly observedAt: string;
  readonly added: readonly DiscoveredModel[]; readonly removed: readonly string[];
  readonly changed: readonly { readonly modelId: string; readonly fields: readonly string[] }[]; }
/** 세대 스냅샷(롤백 대신 last-good 1세대 승격) + 저장소 계약(구현체는 후속 단위). */
export interface ModelRegistrySnapshot { readonly generation: number; readonly observedAt: string;
  readonly providerId: string; readonly models: readonly DiscoveredModel[]; }
export interface ModelRegistrySnapshotStore { read(providerId: string): Promise<ModelRegistrySnapshot | undefined>;
  write(snapshot: ModelRegistrySnapshot): Promise<void>; }
```

## 9. Unit 1 완료 기준(AC)

1. 합성 fixture 신규 모델 → diff.added 1건·stdout 1줄. 2. 공식 근거 없는 모델은 편입 0건(verified 강제 금지).
3. 유사명(muse-spark-1-3 vs muse-spark-open) 병합 0건 — id 정확 일치만. 4. 수집 실패 → last-good 유지·신규 편입 0건.
5. 30일 지난 스냅샷은 last-good 재사용 불가. 6. 폐지는 표기만(즉시 제거 없음). 7. 회귀: 기존 레터 Top10·후보 결과 불변.
8. `pnpm typecheck`·단위테스트·`python3 scripts/validate-repo.py`·`git diff --check` PASS, 파일당 100줄 이하.

## 10. 미확인 제공자 경로 (공식 스키마 미확보)

- 공개·문서화된 공식 JSON 모델목록은 현재 확인되지 않음: Ollama Cloud library·OpenCode go/docs·Antigravity docs·OpenAI·Anthropic·Google·xAI·Cursor는 HTML 문서(파서 미검증), 공식 API(`api.*/v1/models`)는 주요 상용 클라우드 벤더의 경우 인증 필요(로컬/오픈 엔드포인트는 별도 확인 필요). OpenRouter `api/v1/models`·models.dev는 벤더가 아닌 집계 출처 → 편입 근거 부적합.
- 결론: Unit 1은 제공자 어댑터 미구현(스키마 비의존)·실제 수집 0건. 어댑터는 공식 URL 확인 후 후속 단위에서 추가.

## 11. 확인 필요 항목(사용자·총괄)

- effort 게이트 해석: 공식 effort 목록 미공개 제공자는 자동 편입 불가(fail-closed 문자 그대로). effort를 선택 조건으로 볼지 확인 필요.
- 폐지 grace(연속 부재 횟수)는 결정문에 없어 제안만: 2세대 연속 부재 시 폐지 표기(사용자 확인 대기). 스냅샷 저장 위치(레포 파일 vs XDG state vs 기존 SQLite)도 미결 — store 인터페이스로만 정의.

## 12. 검증·금지 준수

- 산출물은 본 문서 1개뿐(코드·설정·테스트 미작성). 커밋·push·PR·이슈 수정 없음, 외부 호출·모델 호출 0건. `python3 scripts/validate-repo.py`·`git diff --check`로 100줄·공백만 확인.
