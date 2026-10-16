# #163 설정 기반 레터 밴 구현 설계 초안

- 상태: 구현 전 읽기 전용 설계. 이 문서는 코드·설정 변경을 포함하지 않는다.
- 요구 기준: 공통·오케스트레이터·워커 목록, 공통 ∪ 역할 밴은 점수·정규화 모집단에 포함하고 Top10 선정·보충에서만 제외한다. 빈 설정은 현행과 같아야 한다.
- 확인 문서: 활성 워커 배정, [#163 기능 기록](letter-ban-list-task.md), 역할별 모집단 계약.
- 확인 코드: config loader와 composition, `letter-top10-render-options`, compact/markdown render, candidates/score/normal/unified, model id·alias 처리 및 config/fill/calibration 테스트.
- 외부 #163 조회나 API 호출은 하지 않았다. 로컬 이슈 기록에 사용자 확정 범위가 정리돼 있다.

## 현재 흐름과 삽입 지점

1. `composition-root.ts`는 `insights`를 일반 `loadConfig()` 호출보다 먼저 `runInsightsCli`에 보낸다. `runInsightsCli`는 현재 `opencodeTarget()`만 검증하며 수집 결과를 compact와 markdown 렌더에 전달한다.
2. `computeRoleTop10()`이 후보 풀을 만들고 `scoreRoleCandidatesFromSources()`가 역할별 적격 후보를 점수화한다. 그 전체 점수를 `normalRankScores()`로 보정한 뒤 `buildList()`가 존 우선 정렬 결과에서 밴을 거르고 Top10을 자른다.
3. `Top10Options.excludeModelIds`와 `buildList()` 제외 필터가 이미 있으나 단일 공통 목록이다. 새 공통/역할 정책을 이 필드에 합쳐 의미를 바꾸지 않는다.
4. 새 밴은 현재 `buildList()`의 마지막 선택 필터에 공통 ∪ 현재 역할 목록으로 추가한다. `slice(0, TOP_N)` 전에 적용하므로 존 통과/▽ 보충 어느 위치의 밴도 재진입하지 않고 다음 비밴 후보가 채운다.
5. `buildCandidatePool`, `filterCandidates`, `scoreRoleCandidatesFromSources`, `normalRankScores`, `EXCLUDED_PATTERNS`에는 사용자 밴을 넣지 않는다. 특히 기존 Fable/Astra 후보 정책은 별개이며 설정 밴을 하드코딩 목록에 추가하지 않는다.
6. 과거 `previousCohort`와 저장 이력은 그대로 둔다. 현재 설정을 과거 순위 재계산에 적용하지 않아 밴된 과거 Top10 항목은 필요 시 현재 목록의 exit로 나타나게 한다.

## 최소 설정 스키마 후보

현 config는 환경 변수에서 읽고 `.env`도 지원한다. 후보는 단일 JSON 환경 변수로 세 범위를 한 번에 관리하는 방식이다.

    YOROI_LETTER_BANS='{"common":[],"orchestrator":[],"worker":[]}'

unset 또는 세 빈 배열은 빈 밴 집합이며 결과가 현행과 정확히 같아야 한다. 키 누락은 빈 배열로 취급하고, 알 수 없는 키·잘못된 JSON·비문자열/공백 ID는 설정 오류로 거부하는 안을 권한다. 파싱 오류는 원 설정값을 에러·로그에 포함하지 않는다. 잘 형성됐지만 현재 후보에 없는 ID는 보관해 해당 모델이 나타날 때 적용하고, fuzzy/prefix 일치는 하지 않는다.

`loadConfig()`만 고치는 것으로는 충분하지 않다. 현재 insights 경로는 그 함수를 거치지 않으므로, 공통 파서를 `runInsightsCli`에서 수집 전에 한 번 호출하고 같은 값을 compact·markdown·publish 경로에 전달해야 한다.

## ID 정규화와 역할 범위

- 밴은 effort 변형이 아닌 모델 base 단위로 적용하는 안을 권한다. `splitBaseAndEffort()`로 effort 접미사를 떼고 `normalizeModelName()`을 적용한다.
- provider 경로/대소문자/검증된 말단 태그 등 현재 정규화 규칙을 사용한다. 별칭은 후보 풀의 `buildCatalogAliasResolver()` / `resolveModelId()`와 같은 컨텍스트에서 양쪽 ID를 canonical base로 해석한 뒤 정확히 비교한다.
- 미확인 별칭은 fuzzy 검색하지 않는다. 별칭 동치 범위는 검증된 catalog·record alias·명시 alias 규칙으로 한정한다.
- 역할별 집합은 `common ∪ orchestrator` 또는 `common ∪ worker`로 각각 만든다. 한 역할 전용 밴은 반대 역할의 선발·표시·분포에 영향이 없어야 한다.

## 합성 회귀 조건

- 모집단 불변은 Top10 출력만으로 추정하지 않는다. 같은 합성 후보의 전체 `scoreRoleCandidatesFromSources()` 결과와 `normalRankScores()` 배열을 밴 on/off 조건에서 직접 비교하고, 별도 Top10 결과에서는 비밴 행의 raw/표시 점수·성분이 불변인지 확인한다.
- 상위 존 모델과 하위 ▽ 보충 후보를 각각 밴하고, 밴 모델이 보충에서 재진입하지 않는지 확인한다.
- 공통·오케 전용·워커 전용·중복 목록을 함께 검증해 합집합 및 역할 격리를 확인한다.
- 빈 설정은 기존 결과와 deep-equal이어야 한다. 원 입력 레코드와 history/previous cohort는 변경되지 않아야 한다.
- 합성 modelAlias, namespace, 대소문자, `:free` 태그, effort 접미사로 설정 ID와 후보 ID가 같은 canonical base로 매칭되는지 확인한다.
- malformed 설정은 fake 수집기가 한 번도 실행되지 않고 안전한 설정 오류로 끝나는지 검증한다. 실제 API·실제 모델 목록은 쓰지 않는다.

## 후속 구현 파일 후보와 보류 결정

- 구현 후보: `src/config/load-config.ts` 및 `tests/config.test.ts`; `src/composition/insights-cli.ts`; `src/insights/letter-top10-render-options.ts`와 `letter-top10-rank.ts`; `src/insights/letter-top10-unified.ts` 또는 작은 전용 helper; 합성 Top10 회귀 테스트. env 안내가 확정되면 `docs/development.md`도 갱신한다.
- 사용자 결정 필요: 단일 JSON env 설정을 채택할지 별도 파일을 원하는지; 레터에 밴 설정/제외 개수를 표시할지(현 문서는 표시 방식 미정); 현재 후보에 없는 유효 ID를 조용히 보관할지 경고할지.
- 권고: env JSON 한 곳, 레터 출력은 별도 표시 없이 결과만 반영, 미등장 ID는 보관하고 실행은 계속. 형식 오류만 수집 전에 거부한다.
- 이번 단위에서는 소스·config·tests·기존 문서를 수정하지 않았다. 다음 구현 패킷과 사용자 결정 전까지 설계만 유지한다.

