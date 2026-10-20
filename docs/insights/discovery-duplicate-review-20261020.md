# #168 중복 id diff 최소수정 최종 검토 (2026-10-20)

- 검토: w3(w18:p4). 요구: `docs/insights/issue-followup-20261020.md` + 패킷.
- 대상: w1 중복 diff 최소수정(`src/insights/model-discovery-diff.ts`·`tests/insights-model-discovery.test.ts`·
  `docs/insights/model-discovery-review-20261020.md`)과 보고서 `/tmp/yoroi-20261020-discovery-duplicate-fix-report.json`.
- **판정: PASS — 차단 없음. 소스 수정 0건.** 본 검토는 코드·테스트를 건드리지 않고 문서만 갱신했다.

## 1. 지적 사항과 해소 확인

- 총괄 실제재현 차단: `diffRegistry(p,t,[m],[m,m])` → `removed:[m.id]`. 중복 id는 '부재'가 아니므로 허위 폐지 신호 금지.
  역방향(`[m,m]`→`[m]`)도 허위 신규 신호를 만들면 안 된다. → **해소 확인** (§2 실측).
- w1 수정 방식: `indexById`가 중복 id 집합을 함께 돌려주고, `diffRegistry`는 **양쪽 목록 중 하나라도 중복인 id를
  added·removed·changed 전부에서 보류**한다(`ambiguousIds`). eligibility의 중복 거부·정확 id 비교·provider 격리는 유지.
- 공개 API·런타임 연결 변경 없음. 순수함수 범위 최소수정(신규 정책 없음). 파일 90/100/65줄(≤100).

## 2. 독립 재현 (직접 실행한 프로브 결과)

| 케이스 | 결과 | 판정 |
| --- | --- | --- |
| `diffRegistry([m],[m,m])` | added 0·removed 0·changed 0 | 허위 removed 없음 ✓ |
| `diffRegistry([m,m],[m])` | added 0·removed 0·changed 0 | 반대방향 허위 added 없음 ✓ |
| `diffRegistry([m],[m])` | 전부 0 | 정상 무변경 ✓ |
| `[m,old-1]` → `[m,dup,new-1]` | added ['new-1']·removed ['old-1']·changed [] | 다른 정상 id 변경 보존 ✓ |
| `[m]` → `[m(표시명 변경), dup]` | 전부 0 | 중복 id 자체는 보류(보수적 fail-closed, 의도된 동작) |
| `[m,old-1]` → `[m]` (중복 없음) | removed ['old-1'] | 정상 폐지 표기 유지 ✓ |
| eligibility `[m, dup]` | 양쪽 모두 `duplicate-model-id` | 중복 거부 유지 ✓ |
| provider 분리(`pa`/`pb` 동일 id) | pa: removed / pb: added | 경계 혼입 없음 ✓ |

- 수정 전에는 `indexById`가 중복 id를 인덱스에서만 빼서 `[m]`→`[m,m]`에서 `removed:[m.id]`가 발생했다(총괄 재현과 동일).
  보류 방식은 "id가 어긋난 경우 조용히 사라지게" 하지 않고 **신호를 내지 않는** 방향이라 fail-closed 원칙과 일치한다.

## 3. 회귀 유지 확인

- 일반 diff: 추가·부재·변경 3분류 유지(테스트 'diff는 추가·부재·변경을 분리한다' 통과).
- provider 분리: `diffProviderSnapshots`가 providerId별로만 비교하고 모델이 경계를 넘지 않음(위 표 마지막 행).
- eligibility: 5개 메타데이터 게이트·중복 거부·날짜/URL 검증 그대로. snapshot: 30일 게이트·provider 격리·nowMs 유한성·
  무효 previous 세대 승계 금지 그대로. types·render 무변경.
- 집중 discovery 테스트 **24건 PASS / 0 fail**(신규 중복 회귀 1건 포함, discovery 9 + snapshot 7 + snapshot-invalid 6 + snapshot-generation 2).

## 4. 검증 명령·exit (실측)

- `node --import ./tests/harness-setup.mjs --import tsx --test "tests/insights-model-discovery*.test.ts"` → **24 pass / 0 fail, exit 0**
- `pnpm run typecheck` → **exit 0** · `python3 scripts/validate-repo.py` → **PASS, exit 0** · `git diff --check` → **exit 0**
- 전체 `pnpm run check`는 **중복 실행하지 않았다**(총괄이 최종 1회 실행). 기존 SQLite 시간테스트 이력
  (1회차 1165/1166 실패 → 단독 3회 6/6 통과 → 재실행 1166/1166 + BDD 45/635)은 원래 사실로 보존했다.

## 5. 개수·메타데이터 갱신 (실행 이력 보존)

- `model-discovery-unit2.md` §7: 21건 → **24건**(4파일). §2 신뢰경계·§3 snapshot 규칙·§6 AC 매핑·§6-1 지적 반영표에
  중복 id 보류 규칙과 신규 회귀 2건을 반영. §8 미확인 항목은 유지.
- `docs/tasks.md`: 23/23 → **24/24**. `issue-units-summary-20261020.md`: 23/23 → **24/24** + 최종 리뷰 링크.
- 파일 수는 4개로 변동 없음. 과거 실행 기록(23/23 시점 등)은 삭제하지 않고 현재 실측값으로 갱신했다.
- 메타데이터 구분: **#168 순수 핵심(타입·diff·게이트·snapshot·render) 완료 / 수집 통합 미완료**(provider 어댑터·저장소 구현체·
  `letter-model-lists.json` 확장·catalog/once/레터 연결) — 종합 요약 §1·§3에 그대로 명시.

## 6. 미연결 한계 (이번 판정의 범위 밖)

- 수집·어댑터·저장소·config·catalog/once/레터 연결이 없다 → 후보 편입·지표 가중치·레터 회귀는 판정 대상이 아니다.
- 폐지 grace·effort 게이트 해석·스냅샷 저장 위치는 미결 정책(단위1 §11·단위2 §8 그대로).
- 중복 id 보류는 "그 id에 대한 신호를 내지 않는다"는 결정이며, 어떤 신호를 내야 하는지는 수집 단위에서 정할 사안이다.
- 원격 쓰기·커밋·push·PR 없음. 실모델·실제공자 호출 0건.
