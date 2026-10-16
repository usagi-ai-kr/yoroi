# 1.1 레터 모델 허용·제외 목록 (2026-10-16)

범위(사용자 확정): #163 밴 목록 + 하위버전 화이트리스트 고도화만. #168·#141·effort 상한은 1.1 범위 밖이다.

## 사용자 요구

> 하위버전은 자동 배제하되 허용하는 경우(grok 4.6, sol 6)는 화이트리스트로. 반대로 요청 시 제외할 블랙리스트로.

## 설계 (o 확정)

단일 설정 원본은 `config/letter-model-lists.json`이다. 파일이 없거나 키가 없으면 아래 기본값을 쓴다. 기본값은 현재 하드코딩과 같다.

```json
{
  "allowOlder": ["grok-4-6", "gpt-6-sol"],
  "excludePatterns": ["fable", "astra"],
  "ban": { "common": [], "orchestrator": [], "worker": [] }
}
```

- **화이트리스트 `allowOlder`**: 하위버전 자동 배제의 예외 목록이다. 목록의 모델은 세대 비교(`olderGenerationModelIds`)와 후속 규칙(successorOf) 어느 쪽으로도 superseded가 되지 않는다. 기존 `SEPARATE_PAIRS` 하드코딩은 제거한다. 그 밖의 하위버전은 지금처럼 자동 배제한다.
- **`excludePatterns`**: 기존 `EXCLUDED_PATTERNS`를 설정으로 옮긴 것이다. 의미(후보 풀 제외)는 그대로다.
- **블랙리스트 `ban`**: #163 명세를 따른다. 적용 대상은 공통 ∪ 역할 목록이고, **Top10 선발과 ▽ 보충 단계에서만** 제외한다. 점수와 역할별 분포(모집단)에는 그대로 포함하고, 반대 역할에는 영향이 없다.
- 모든 ID는 `normalizeModelName`과 alias 해석을 거친 뒤 비교한다.
- 레터 표시 UI는 이번에 바꾸지 않는다.

## 인터페이스 (구현·테스트 공통 계약)

`src/insights/letter-model-lists.ts`:
- `type LetterModelLists = { allowOlder: string[]; excludePatterns: string[]; ban: { common: string[]; orchestrator: string[]; worker: string[] } }`
- `DEFAULT_LETTER_MODEL_LISTS`, `loadLetterModelLists(path?: string): LetterModelLists`(누락 키는 기본값, 파싱 실패는 throw)
- `banSetFor(lists, role: 'orchestrator' | 'worker'): ReadonlySet<string>`(정규화된 공통 ∪ 역할)
- `olderGenerationModelIds(modelIds, allowOlder = 기본값)`, `isExcludedModel(id, patterns = 기본값)`: 기존 시그니처에 선택 인자를 추가한다.

## 분배

| 담당 | 범위 | 소유 |
| --- | --- | --- |
| w3 (p19) | 구현: 로더·config·filter/candidates/unified 연결, `four-source-score.md` 규칙 문구 | `src/insights/letter-model-lists.ts`, `config/letter-model-lists.json`, `src/insights/letter-top10-{filter,candidates,unified}.ts`, `docs/insights/four-source-score.md` |
| w1 (p17) | 테스트(계약 기준, 구현과 병렬). 구현 뒤 w3 코드 리뷰 | `tests/letter-model-lists.test.ts` |
| w2 (p18) | 잡무: milestone `1.1.0` 생성 및 #163 할당, #163에 이번 고도화 범위 댓글, roadmap 1.1 절 갱신 | `docs/roadmap.md`(1.1 절만) |

## 완료 기준

- 빈 `ban`과 기본 `allowOlder`에서 현재 레터 Top10이 그대로다(기존 테스트 전부 PASS).
- 화이트리스트: grok-4-6과 gpt-6-sol은 유지되고, 목록에 없는 하위버전은 배제된다. 목록에서 빼면 배제된다.
- 블랙리스트: ban on/off에서 점수와 분포는 그대로이고 Top10만 바뀐다. ▽ 보충으로 재진입하지 않는다. 반대 역할에는 영향이 없다.
- `pnpm typecheck`, unit 테스트, `validate-repo` PASS. 파일당 100줄 이하.
- 커밋·push·버전 bump·PR·릴리스는 o가 통합한다.

## 1.1.1 사용자 설정 경로 (2026-10-16 사용자 확정)

- 밴은 오케·워커별로 둔다. 기본 파일은 `ban.orchestrator`·`ban.worker`만 보여주고, `ban.common`은 선택 키로 계속 받는다(하위 호환). 버전 허용 `allowOlder`는 두 역할 공통이다.
- 전역 CLI는 패키지에 `config`가 없으므로 아래 순서로 읽는다.
  1. `YOROI_LETTER_MODEL_LISTS`(명시 경로)
  2. `${XDG_CONFIG_HOME:-~/.config}/yoroi/letter-model-lists.json`
  3. 레포 `config/letter-model-lists.json`
  4. 기본값
- 존재하는 첫 파일만 읽는다. 누락 키는 기본값으로 채운다.
- 파싱 실패 시 stderr에 `[yoroi] letter-model-lists 파싱 실패: <path> — 기본값 사용` 한 줄을 남기고 기본값을 쓴다(조용히 넘기지 않는다).
- 인터페이스: `resolveLetterModelListsPath(env = process.env, exists = existsSync): string | undefined`를 추가한다. `activeLetterModelLists()`는 이 경로를 쓴다.
- 문서: `docs/global-install.md`에 사용자 설정 경로와 예시를 적는다(≤10줄 추가).

| 담당 | 범위 | 소유 |
| --- | --- | --- |
| w3 | 구현·config 기본 파일·global-install 문서 | `src/insights/letter-model-lists.ts`, `config/letter-model-lists.json`, `docs/global-install.md` |
| w1 | 테스트(경로 우선순위·XDG·env·파싱 실패 경고·common 하위호환) → w3 리뷰 | `tests/letter-model-lists-path.test.ts` |
| w2 | 잡무: milestone `1.1.1` 생성, 추적 이슈 1건 생성(milestone 연결), roadmap 1.1.1 한 줄 | `docs/roadmap.md` |
