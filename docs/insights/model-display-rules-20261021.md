# 모델 표시 규칙(#260) 구현 결과 (2026-10-21, w3)

- 목표: **표시 전용** 모델 id 정규화 규칙을 config 로 두고 여러 표시 지점이 같은 helper 를 쓰게 한다 ✓.
  내부 id·점수·순위·후보·Free 값은 불변 ✓.
- 금지 준수: 점수·가중치 0 · 순위 변경 0 · Free 표 **값** 변경 0 · publish 계약 0 · 내부 id 변경 0 · 소유 외 수정 0 · 커밋·push·외부 쓰기 0 ✓.

## 1. 변경 파일

| 파일 | 내용 |
| --- | --- |
| `config/model-display-rules.json` (신규) | 기본 규칙 2건 — `-free$` 제거 · `-(minimal\|low\|medium\|high\|xhigh\|max)$` 제거 (위→아래 순서) ✓ |
| `src/insights/model-display.ts` (45줄, 신규) | `loadModelDisplayRules`(파일 없음·비배열·파싱 실패 → 규칙 0개) · `applyModelDisplayRules`(위→아래, 잘못된 정규식은 건너뛰고 raw 유지, 접미 중첩은 최대 4회 반복) · `displayModelId` ✓ |
| `src/insights/letter-mermaid.ts` (51줄) | **노드 라벨**·**차선 캡션**의 모델 id 를 `displayModelId` 로 정규화 ✓ (Free 표기는 유지 ✓) |
| `src/insights/letter-three-role-render.ts` (94줄) | 3역할 **모델 셀**을 공통 helper 로 교체(기존 수동 정규식 제거 ✓) ✓ |
| `src/insights/letter-markdown-free-table.ts` (76줄) | `freeDisplayId` → 공통 helper (값·열·정렬 불변 ✓) ✓ |
| 2역할 표(`letter-markdown-tables.ts`) | **미적용** — 기존 계약상 원시 id 표시를 유지(기존 테스트 기대 `m-free` ✓). '적용 가능하면 적용' 조건에 해당 ✓ |
| `tests/model-display.test.ts` (신규 50줄) | 6건 — 기본 규칙·다중 접미·미지 id·규칙 순서·잘못된 정규식·비배열·파일 누락·내부 id 불변 ✓ |
| `tests/insights-mermaid.test.ts` (94줄) | 라벨·캡션 정규화 케이스 추가 ✓ |
| `tests/insights-letter-three-role-render.test.ts` (93줄) | 3역할 모델 셀 정규화 케이스 ✓ |
| `tests/insights-free-reviewer-table.test.ts` (87줄) | Free 표시명 정규화 케이스 ✓ |
| `docs/insights/model-display-rules-20261021.md` (신규) | 본 문서 ✓ |

## 2. 규칙·동작

- `deepseek-v4-1-flash-free` → `deepseek-v4-1-flash` ✓ · `beam-free` → `beam` ✓ · `muse-spark-1-3-xhigh` → `muse-spark-1-3` ✓
- 다중 접미(`muse-spark-1-3-free-high`)도 규칙 반복(최대 4회)으로 정규화 ✓
- 미지 id·접미 없는 id 는 그대로 ✓ · 규칙 파일 없음·비배열·파싱 실패 → 규칙 0개 = raw id ✓ · 잘못된 정규식 규칙은 건너뛰고 raw 유지 ✓
- 내부 id 는 변경하지 않는다(표시 전용 ✓) — 점수·순위·후보·Free 값·publish 계약 불변 ✓

## 3. 검증

| 항목 | 결과 |
| --- | --- |
| 신규/수정 테스트 | `model-display` 6건 신규 + mermaid/render/free-table 각 1건 추가 · **37/37 통과** ✓ |
| 전체 check | **단위 1459/1459 · BDD 45 시나리오/635 스텝 · typecheck·build EXIT=0** ✓ (로그 `tmp/yoroi-260-model-display-check.log`) |

| `pnpm run typecheck` | 오류 0건 ✓ |
| `python3 scripts/validate-repo.py` | 위반 0건 ✓ (각 파일 ≤100줄 ✓) |
| `git diff --check` | clean ✓ |

## 4. 재발행 위험

1. **2역할 표는 미적용**으로 두었다 ✓ (기존 계약 유지 ✓) → 추후 2역할 표에도 적용하려면 해당 테스트 계약을 함께 갱신해야 한다 ✓.
2. **Free 표 표시명** 정규화 ✓ — 값(점수·AA 지수·Zen/Go·비고)은 불변 ✓ → 셀 정합 확인 ✓.
3. **Mermaid 라벨·차선 캡션** 정규화 ✓ — 펜스·노드 ID 안전성 유지 ✓ → 렌더 확인 ✓.
4. 규칙 파일이 없으면 **전량 raw id 표시**로 되돌아감(조용한 폴백 ✓) → 배포 시 config 포함 여부 확인 ✓.
5. 규칙 추가 시 **표시 전용**이라는 성격을 유지할 것(내부 id 를 바꾸면 점수·매칭이 흔들림 ✓) → 규칙 추가 시 id 변경 금지 ✓.
