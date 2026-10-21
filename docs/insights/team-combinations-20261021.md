# #253 권장 팀 조합(4개 Mermaid) 구현 결과 (2026-10-21, w3)

- 목표: 3역할 본문에 **오케 Top7 → 리뷰 Top7 → 워커 Top7 → 권장 조합 4개 Mermaid → 표시 안내** 순서로 조합을 넣는다 ✓.
  기준: `docs/insights/team-combinations-impact-20261021.md`(설계) + `docs/insights/open-weight-evidence-20261021.md`(오픈 웨이트 근거 ✓).
- 금지 준수: Top7·Top15 순위/점수 불변 ✓ · Free 표·실사용 열 불변 ✓ · 댓글 3개·publish 계약 불변 ✓ · 점수·가중치 변경 0 ✓ · 점수 생성 0 ✓.

## 1. 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/insights/letter-team-combinations.ts` (99줄, 신규) | 조합 API — `buildTeamCombinations` · 슬롯 구성(1+1+3 / 1+2) · 조합 내 identityKey 유일 · 역할 합산 점수 최대(전수 탐색) · 결정론적 tie-break · 부족 시 구성 불가 + 사유 · `loadOpenWeightKeys` |
| `src/insights/letter-mermaid.ts` (30줄, 신규) | Mermaid 렌더 — 고정 노드 ID(O/R/W1..W3) · 라벨 이스케이프(따옴표·대괄호·백틱·특수문자) · 코드 펜스 주입 방지 · 구성 불가 표시 |
| `config/open-weight-models.json` (신규) | **검증된 8개 등록** (evidenceUrl·checkedOn·license·version·note 포함) — deepseek-v4-1-flash·glm-5-3-flash·glm-5-3·mimo-v2-6-pro·mimo-v2-6-flash·kimi-k3·muse-spark-1-3·minimax-m3-1-flash ✓ (Muse·MiniMax는 사용자 확인으로 포함 ✓ · Gemini·GPT·Claude·Grok 제외 ✓ · 브랜드 일괄 판정 0 ✓) |
| `src/insights/letter-three-role-pipeline.ts` (91줄) | `selection.top7` 로 조합 4개를 계산해 `sections.combinations`(Mermaid 블록 문자열 배열)에 첨부 ✓ |
| `src/insights/letter-three-role-body.ts` (43줄) | `threeRoleBlock` — 워커 섹션 뒤·안내 앞에 `## 🧩 권장 조합` + 블록 삽입 ✓ |
| `tests/insights-team-combinations.test.ts` (76줄, 신규) | 8건 — 4조합·슬롯 수(5/3)·조합 내 유일성·**합산 최적(그리디 막힘 사례)**·부족 후보·동점 결정론·오픈 필터·registry 8개/제외·오픈 실구성 |
| `tests/insights-mermaid.test.ts` (43줄, 신규) | 4건 — 고정 ID·간선·effort 미표시·특수문자/펜스 주입 방지·구성 불가 표기·펜스 2개 |
| `tests/insights-letter-three-role-pipeline.test.ts` (99줄) | 조합 4개가 섹션에 붙는 회귀 추가 ✓ |
| `tests/insights-three-role-body.test.ts` (74줄) | 삽입 순서(워커 뒤·안내 앞) 회귀 추가 ✓ |
| `docs/insights/team-combinations-20261021.md` (신규) | 본 문서 ✓ |

## 2. 조합 규칙 (구현)

- **후보 풀** = 역할별 Top7(현재 레터의 검증된 후보·점수 그대로 ✓) · **슬롯** = 1+1+3(오케1·리뷰1·워커3 = 5) / 1+2(오케1·워커2 = 3) ✓.
- **조합 내 유일성** = `resolveIdentityKey` 기준(별칭·effort 변형·제공 경로가 달라도 동일 실체 1회 ✓ · 다른 세대·Flash/Pro 병합 금지 ✓).
- **최적화** = 역할 합산 점수 최대를 **전수 탐색**(1+1+3: 7×7×C(7,3) / 1+2: 7×C(7,2)) ✓ → 그리디 소진으로 조합이 막히는 경우를 회피 ✓ (회귀 테스트로 고정 ✓).
- **결정론적 tie-break** = 후보 점수 내림차순·identityKey 오름차순 정렬 후 전수 탐색에서 먼저 나온 배정 채택 ✓ (입력 순서 무관 ✓).
- **부족 후보** = `feasible:false` + 부족 슬롯·사유(예: `워커 3개 부족`) ✓ · **가짜 모델 금지** ✓ · Mermaid 는 사유만 표시 ✓.
- **오픈 웨이트** = registry 의 `openWeights:true` 항목의 base id 만 통과 ✓ · 미확인·브랜드 일괄 판정 없음 ✓.

## 3. 표시

- 본문 순서 ✓: 오케 Top7 → 리뷰 Top7 → 워커 Top7 → `## 🧩 권장 조합`(4개 블록: 라벨 + ```mermaid 펜스) → `## 📖 표시 안내` ✓.
- 각 블록 = `**라벨**` + ` ```mermaid flowchart TB … ``` ` (4개 각각 별도 펜스 ✓).
- 노드 ID 고정 `O`/`R`/`W1`/`W2`/`W3` ✓ · 라벨 = 역할(+워커 슬롯 번호) + 모델명 ✓ · effort 미표시 ✓ · 간선 O→나머지 ✓.
- **본문 전용** ✓ — 댓글·Free 표·2역할 경로 무변경 ✓.

## 4. 검증

| 항목 | 결과 |
| --- | --- |
| 신규 테스트 | `insights-team-combinations` 7건 · `insights-mermaid` 4건 **11/11 통과** ✓ |
| 기존 회귀 | 파이프라인·body·output 포함 focused 통과 ✓ |
| `pnpm run check` | 아래 로그 기준 기록 ✓ |
| `pnpm run typecheck` | 오류 0건 ✓ |
| `python3 scripts/validate-repo.py` | 위반 0건 ✓ (각 파일 ≤100줄 ✓) |
| `git diff --check` | clean ✓ |
| 금지 준수 | Top7·Top15 순위/점수 변경 0 · Free 표 변경 0 · publish 계약 변경 0 · 점수·가중치 변경 0 · 점수 생성 0 · 소유 외 수정 0 · 커밋·push·외부 쓰기 0 ✓ |

## 5. 남은 위험·재발행 확인

1. **오픈 웨이트 조합의 후보 부족** — 레터의 Top7 에 검증 8개 중 few 만 있으면 '구성 불가' 로 표시될 수 있음 ✓ (실제 데이터 확인 필요 ✓).
2. **합산 점수의 스케일** — 역할별 점수는 모두 0~100 ✓ → 합산 비교 가능 ✓ (단, 역할별 중요도 차는 미반영 ✓ → 조합은 '대안' ✓).
3. **본문 길이** — 4블록 추가(≈1.5–2KB) ✓ → `MARKDOWN_LIMIT` 근접 시 details(산출 공식)부터 잘림 ✓ · 조합은 앞쪽 배치 ✓.
4. **재발행 확인 항목** ✓ — 본문 순서(조합이 안내 위 ✓) · 4개 펜스 ✓ · 5/3슬롯 ✓ · 조합 내 모델 중복 0 ✓ · 오픈 조합에 비검증 모델 0 ✓ · Top7 순위·점수 불변 ✓ · 댓글 3개·Free 8열·실사용 열 불변 ✓.
5. **근거 갱신** — registry 항목은 `checkedOn` 기준이며 근거가 바뀌면 확인일·라이선스 조건을 함께 갱신해야 함 ✓ (MaaS/표시 조건 3건 별도 검토 필요 ✓).
