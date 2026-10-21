# #253 권장 조합(Mermaid) 구현 지도 (2026-10-21, w3 · 읽기 전용 설계)

- 범위: **설계·영향 분석 전용** — 코드·테스트·워크플로 미수정 ✓ · 외부 쓰기·발행·커밋·push 0건 ✓.
- 입력: 이슈 #253(요구사항 전문 확인 ✓) · 현재 3역할 본문/파이프라인/렌더 경로 확인 ✓ · #252(역할 독립 선발) 경계 ✓.

## 1. 현재 경로 (확인한 위치)

| 지점 | 파일·라인 | 내용 |
| --- | --- | --- |
| 본문 조립 | `letter-three-role-body.ts:21-22` `threeRoleBlock` | `[orchestrator, '', reviewer, '', worker]` → 레거시 블록 위치에 삽입 ✓ |
| 안내 교체 | `letter-three-role-body.ts:36,39` + `letter-three-role-legend.ts` `replaceLetterGuide` | 본문 안내 블록을 3역할 안내로 교체 ✓ → **조합은 worker 섹션 뒤·안내 앞**에 넣어야 함 ✓ |
| 역할 후보 | `letter-role-selection.ts:39-45` `selectRole`(#252) | 역할별 독립 선발·역할 내부 identityKey 중복 제거 ✓ |
| identity | `letter-role-selection.ts:33-37` `resolveIdentityKey` | 조합 내 유일성 기준 ✓ |
| 섹션 생성 | `letter-three-role-pipeline.ts` `runThreeRolePipeline` | `sections`·`selection`(top7/top15) ✓ |
| 렌더 | `letter-three-role-render.ts` `renderThreeRoleSection` | 역할 표(5열/6열) ✓ |
| 길이 | `letter-markdown-format.ts:6,34` | `MARKDOWN_LIMIT = 65536` · `truncateAtRowBoundary` ✓ |

## 2. 조합 API 설계 (제안)

```ts
export type TeamRole = 'orchestrator' | 'reviewer' | 'worker';
export interface TeamSlot { readonly role: TeamRole; readonly modelId: string; readonly score?: number; readonly effort?: string; }
export interface TeamCombination {
  readonly key: 'best-1+1+3' | 'best-1+2' | 'open-1+1+3' | 'open-1+2';
  readonly label: string;                 // 예: '가장 최선 · 오케 1 + 리뷰 1 + 워커 3'
  readonly slots: readonly TeamSlot[];    // 5개(1+1+3) 또는 3개(1+2)
  readonly totalScore: number;            // 역할 합산 점수
  readonly feasible: boolean;             // false 면 '구성 불가' + 부족 슬롯·사유
  readonly reason?: string;               // 부족 후보 사유(선택)
}
export interface TeamCombinationInput {
  readonly top7: { readonly orchestrator: readonly RoleCandidate[]; readonly reviewer: readonly RoleCandidate[]; readonly worker: readonly RoleCandidate[] };
  readonly openWeightKeys?: ReadonlySet<string>;  // 검증된 오픈 웨이트 registry(base id)
}
export const buildTeamCombinations = (input: TeamCombinationInput): readonly TeamCombination[];
```

- **후보 풀** = 각 역할 **Top7**(현재 레터의 검증된 후보·점수·품질 하한 그대로 ✓) · 슬롯 ① 오케 1 + ② 리뷰 1 + ③ 워커 3 / ① 오케 1 + ② 워커 2 ✓.
- **조합 내 유일성** = `resolveIdentityKey` 기준(별칭·effort 변형·제공 경로가 달라도 동일 실체면 1회 ✓) · 서로 다른 세대·Flash/Pro 는 병합 금지 ✓.
- **최적화** = 역할 합산 점수 최대 ✓ · 공간이 작으므로 전수 탐색 가능(1+1+3: 7×7×C(7,3)=1,715 / 1+2: 7×C(7,2)=147 ✓) → greedy 소진 문제를 회피 ✓.
- **결정론적 tie-break** = ① 역할 우선순위(오케 > 리뷰어 > 워커) ② 슬롯별 점수 사전순 비교 ③ identityKey 사전순 ✓ (동점이어도 동일 출력 ✓).
- **부족 후보** = 다른 모델을 조작해 채우지 않고 `feasible:false` + 부족 슬롯·사유 표기 ✓ (Mermaid 에 가짜 모델 금지 ✓).
- **오픈 웨이트 정책** = `openWeightKeys` 에 **검증된** base id 만 포함 ✓ · 미확인(분류 미확인) 모델은 제외 ✓ · 브랜드명 자동 판정 금지 ✓ (근거·확인일 기반 ✓).
- **#252 경계** = 조합은 이미 독립 선발된 Top7 을 소비 ✓ → 교차 배제 규칙을 역할 선발에 다시 넣지 않는다 ✓ (조합 내부 유일성은 '조합 단위' 제약 ✓).

## 3. Mermaid 렌더 안전성

| 위험 | countermeasures |
| --- | --- |
| 코드 펜스 주입(` ``` `) | 라벨에서 백틱·`"`·`[`·`]`·`{`·`}`·줄바꿈 제거/치환 ✓ · 본문은 ` ```mermaid ` 펜스로만 감쌈 ✓ |
| 노드 ID 충돌·문법 오류 | **고정 ID** `O`/`R`/`W1`/`W2`/`W3` ✓ (모델명 미사용 ✓) · 라벨은 `["…"]` 한 줄 ✓ |
| 라벨이 Mermaid 문법을 깨뜨림 | `;`·`#`·`&` 등 특수문자 이스케이프 ✓ · 모델명만 표기(effort 미표시 ✓ #253 요구 3 ✓) |
| 본문 길이 초과 | 조합 블록은 worker Top7 뒤(안내·details 앞 ✓) → 절단 시 마지막이 잘리는 구조 ✓ · 4블록 추가량 ≈ 1.5–2KB ✓ · `truncateAtRowBoundary` 가 펜스를 자를 위험 → **조합 블록을 절단 경계 위(앞쪽)에 배치** ✓ |
| GitHub 이슈 본문 한도(65,536) | 레터 자체 `MARKDOWN_LIMIT` 과 동일 ✓ · 조합 추가로 상한 근접 시 details(산출 공식)부터 잘림 ✓ |

## 4. 불변 확인 항목

- **Top7/Top15 순위·점수 불변** ✓ (조합은 별도 블록 ✓ · 역할 선발 로직 미변경 ✓)
- **댓글 3개·본문 3섹션·Free 8열·실사용 열 불변** ✓ (조합은 본문 전용 ✓)
- **publish 계약·워크플로 불변** ✓ (본문 문자열만 추가 ✓ · dry-run/중복/복구 무관 ✓)

## 5. 제안 파일·소유

| 파일 | 용도 | 소유 제안 |
| --- | --- | --- |
| `src/insights/letter-team-combinations.ts` (신규) | 조합 API·전수 최적화·tie-break ✓ | w1 |
| `src/insights/letter-mermaid.ts` (신규) | 안전한 Mermaid 렌더(고정 ID·이스케이프·펜스) ✓ | w1 |
| `config/open-weight-models.json` (신규) | 검증된 오픈 웨이트 registry(base id·근거·확인일·URL) ✓ | w4(조사) → w1(적재) |
| `src/insights/letter-three-role-pipeline.ts` | 조합 계산 연결(선택 top7 기준 ✓) | w1 |
| `src/insights/letter-three-role-body.ts` | `threeRoleBlock` 뒤에 조합 블록 삽입(안내 위 ✓) | w1 |
| `tests/insights-team-combinations.test.ts` (신규) | 슬롯 수·유일성·합산 최적(greedy 역전 케이스)·부족 시 구성 불가·동점 결정론 ✓ | w1 |
| `tests/insights-mermaid.test.ts` (신규) | 펜스 주입·특수문자·고정 ID·구성 불가 표기 ✓ | w1 |
| `docs/insights/team-combinations-20261021.md` (신규) | 결과 문서 ✓ | w1 |

## 6. 구현 순서 (#252 완료 후)

1. **w4** 오픈 웨이트 근거 조사(확인일·출처) → registry 초안 ✓
2. **조합 API + 테스트** (Mermaid 없이 순서·유일성·최적성만) ✓
3. **Mermaid 렌더 + 테스트**(안전성) ✓
4. **파이프라인·본문 연결** (worker Top7 뒤·안내 앞 ✓) + e2e(본문 순서·댓글 불변) ✓
5. **독립 리뷰 → 커밋·PR → 재발행** ✓

## 7. 위험

1. **오픈 웨이트 registry 부재** → 2개 조합이 계속 '구성 불가' ✓ (구현 가능하지만 무의미 ✗) → 근거 조치가 선행 ✓.
2. **점수 차원 비교 가능성** — 역할별 점수 스케일(오케 0~100 ✓ · 리뷰어 0~100 ✓ · 워커 0~100 ✓)이 달라 '합산 점수' 정의가 정책 선택 ✓ → **단위 스케일 명시 필요** ✓(#253 요구 ✓).
3. **본문 길이** — 4블록이 상한 근접이면 details 가 잘릴 수 있음 ✓ → 배치 순서로 완화 ✓.
4. **조합과 역할 표의 해석 혼동** → 조합은 '대안'이며 동시 투입 아님 ✓ → 라벨에 명시 ✓.
5. **#252 미완료 시** Top7 자체가 바뀌어 조합 입력이 흔들림 ✓ → 순서 제약 ✓.
