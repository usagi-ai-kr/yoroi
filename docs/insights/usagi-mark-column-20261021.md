# usagi 실사용 표식 컬럼 (2026-10-21, w3 · #232)

- 목표: 3/4역할 역할 표에 **정성 표식(◎/○/△/×)** 을 `실사용` 컬럼으로 표시 ✓ (점수 숫자 아님 ✓ · 표시 전용 ✓).
- 기준: `docs/insights/usagi-mark-column-dispatch-20261021.md` · 점수·순위·가중치·파레토·Free 표·댓글·publish 무변경 ✓.

## 1. 변경 파일

| 파일 | 변경 |
| --- | --- |
| `src/insights/model-role-fit.ts` (69줄) | `roleFitMark(modelId, role, file?)` 추가 — `config/model-role-fit.json` 의 역할별 `fit` 표식만 반환, 관찰 없음 `undefined` ✓ · `roleFitBaseId` 와 동일 정규화 ✓ · `ROLE_FIT_ROLES` 에 `messenger` 추가(관찰 없으면 비어 있음 ✓) |
| `src/insights/letter-three-role-render.ts` (93줄) | 역할 표를 6열로 확장: `| 순위 | 파레토 | 모델 | 스코어 | effort | 실사용 |` ✓ · `markCell` = `roleFitMark(...) ?? '-'` ✓ · 각주·스코어·순위·파레토 로직 불변 ✓ |
| `src/insights/letter-three-role-legend.ts` (24줄) | 안내 추가: `- 실사용 = usagi 정성 관찰 표식(점수 아님, 순위·가중치에 미사용)` ✓ |
| `tests/insights-model-role-fit.test.ts` (100줄) | `roleFitMark` 신규 1건(표식 그대로·Free id 정규화 동일·관찰 없음 undefined·메신저 미관찰 undefined) ✓ (기존 케이스 의미 보존 압축) |
| `tests/insights-letter-three-role-render.test.ts` (100줄) | 신규 2건(표식 표시·미확인 '-'·메신저 '-'/점수·순위·파레토 불변) ✓ |
| `tests/insights-three-role-body.test.ts` (97줄) | 신규 1건(2역할 표·댓글에 실사용 컬럼 없음 ✓ · 3역할 안내에는 실사용 설명 ✓) ✓ |
| `tests/insights-three-role-legend.test.ts` (28줄) | 안내 줄 단언 추가 ✓ |
| `docs/insights/usagi-mark-column-20261021.md` (신규) | 계약·변경·제외 결정·검증 ✓ |

미변경: `letter-three-role-body.ts`(본문 교체 로직 불변) · `letter-three-role-pipeline.ts`(슬라이스 제공으로 충분) · 점수·가중치·Free 표·댓글·publish·워크플로 ✓.

## 2. 표시 규칙

| 상황 | 표시 | 근거 |
| --- | --- | --- |
| 관찰 있음 | 그 `fit` 표식 그대로(`◎`/`○`/`△`/`×`) | 설정 값 그대로 ✓ · 숫자 매핑·점수 환산·새 표식 생성 없음 ✓ |
| 관찰 없음(모델·역할) | `-` | `roleFitMark` undefined → `'-'` ✓ |
| 메신저 | 관찰 없으면 `-` (워커 표식 **빌려오지 않음**) | `messenger` 키는 추가했으나 설정에 관찰 없음 ✓ · 역할 키 분리 ✓ |
| `-free` id | base 로 정규화 후 조회 | `roleFitBaseId` 동일 ✓ (`roleFitNote` 와 동일 정규화 ✓) |
| 기존 `fit`·`note`·각주 | 전부 보존 | 각주(`> 모델: usagi … · 의견`) 로직 불변 ✓ |

## 3. 제외 결정

- **Free 표는 이번 단위에서 미적용** ✓ — Free 표는 역할 혼합(오케·리뷰어·워커·메신저)이라 한 칸으로 정성 표식을 담으면 어느 역할의 관찰인지 모호 ✓
  (요구 문서 결정과 동일 ✓ · `letter-markdown-free*.ts` 무변경 ✓).
- **2역할 레거시 표도 컬럼 없음** ✓ — `letter-top10-render.ts` 무변경 ✓ → 2역할 본문·댓글 바이트 동일 ✓.
- **3역할 파이프라인 데이터 불변** ✓ — 표식은 렌더 시점에서만 계산 ✓ (선택·순위·점수 미영향 ✓).

## 4. 검증

| 항목 | 결과 |
| --- | --- |
| focused 테스트 | **95/95 통과** ✓ (role-fit·three-role render/body/legend/output·letter-three-role·pipeline·letter-parts·reviewer-comment-contract·free-reviewer table/publish/wiring·publish-comments) |
| `pnpm run check` | **단위 1451/1451 · BDD 45 시나리오/635 스텝 · typecheck·build EXIT=0** ✓ 로그 `tmp/yoroi-232-usagi-mark-check.log` |
| `pnpm run typecheck` | 오류 0건 ✓ |
| `python3 scripts/validate-repo.py` | 위반 0건 ✓ (각 파일 ≤100줄 ✓) |
| `git diff --check` | clean ✓ |
| 금지 준수 | 숫자 매핑 0 · 점수·가중치 변경 0 · 순위 변경 0 · Free 표 변경 0 · publish 계약 변경 0 · 워크플로 변경 0 · 점수 생성 0 · 소유 외 파일 수정 0 · 커밋·push·외부 쓰기 0 ✓ |

## 5. 남은 위험·후속

1. **설정↔문구 불일치** — 표식은 설정에서 읽지만 안내 문구는 고정 문자열 ✓ → 설정 표식 추가 시 안내는 불변 ✓(표식 종류 안내는 범례에 이미 있음 ✓).
2. **메신저 표식 부재** — 설정에 메신저 관찰이 없어 전부 `'-'` ✓ → 열 자체가 정보 없음으로 보일 수 있음 ✓(관찰 추가 시 자동 표시 ✓).
3. **표식 해석** — `◎/○/△/×` 의미는 usagi 출처(범례에 URL 포함 ✓)에 있음 ✓ → 본문만 읽는 사용자는 범례를 봐야 함 ✓.
4. **w1 진행분(#233 리뷰어 점수 0~100 통일)** 과 표식 컬럼이 같은 표에 나란히 표시됨 ✓ → 점수(0~100)와 표식(◎/○/△/×)의 혼동 가능 → 범례 문구로 구분 ✓.
