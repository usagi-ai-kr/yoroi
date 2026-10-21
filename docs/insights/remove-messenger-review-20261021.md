# 메신저 제거(#242) 정리·독립 리뷰 (2026-10-21, w3)

- 범위: w1 의 #242 구현(메신저 섹션·언급 제거, 3역할 복원)을 **실제 diff·실행으로 독립 리뷰** ✓.
  잔여 `messenger`/`메신저` 문자열은 소유 범위에서 정리 완료 ✓ · `git revert` 미사용(수동 정리 ✓).
- **종합 판정: PASS** (BLOCK 0건) — 3역할 복원·문자열 0·유지 항목(0~100·정렬 각주·jev·실사용·Arena 링크) 모두 확인 ✓.

## 1. 항목별 결과

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 3역할(오케·리뷰어·워커)·본문 3섹션 | PASS | `THREE_ROLE_TITLES` 3개 ✓ · 본문 교체 후 레거시 블록 잔존 0(실측 ✓) |
| 댓글 3개(o15/r15/w15+Free) | PASS | `composeThreeRoleComments` 3개 ✓ · 실측 `parts.comments.length = 3` ✓ |
| Free 8열(3역할) | PASS | `| 모델 | 오케 | 리뷰어 | 워커 | AA 지수 | Zen | Go | 비고 |` ✓ (테스트 `insights-free-reviewer-table` ✓) |
| 메신저 출력 0 | PASS | 소스·테스트·features 전수 grep **0건** ✓ (아래 §3) |
| 잔여 참조 제거 | PASS | `letter-three-role-body.ts` 의 `LEGACY_WORKER`·`normalizeThreeRoleLabels` 제거 ✓ · `model-role-fit.ts` 의 `ROLE_FIT_ROLES` messenger 키 제거 ✓ · 관련 테스트 문자열 정리 ✓ |
| 2역할: '워커' 라벨·3댓글 | PASS | 실측 `## 🛠️ 워커 Top` ✓ · `워커·메신저` 0 ✓ · 댓글 3개 ✓ |
| #233 유지(0~100·정렬 각주·jev) | PASS | 리뷰어 점수 `(…)*100` 유지 ✓(`letter-reviewer-policy.ts:51`) · Free 정렬 각주 존재 ✓ · `jev-1-13` 후보 제외 확인 ✓(실측 본문에 미포함 ✓) |
| #232 유지(실사용 표식) | PASS | 3역할 표 `| … | effort | 실사용 |` ✓ · 표식 ◎/○/△ 그대로 · 미확인 '-' ✓ (테스트 `insights-letter-three-role-render` ✓) |
| #226 유지(Agent Arena 링크) | PASS | details `### 참고` + 링크 1줄 ✓ (실측 ✓) · sources 배지 5 유지 ✓ |
| 문자열 0(src/config/tests/features) | PASS | grep `messenger|메신저|워커·메신저` → **0** ✓ |
| 전체 check | PASS | **단위 1431/1431 · BDD 45 시나리오/635 스텝 · typecheck·build EXIT=0** ✓ (로그 `tmp/yoroi-242-cleanup-review-check.log`) · validate-repo exit 0 ✓ · diff-check clean ✓ · 파일 100줄 이하 ✓ |

## 2. 내가 정리한 잔여(소유 범위) — 변경 내용

| 파일 | 정리 |
| --- | --- |
| `src/insights/letter-three-role-body.ts` | `LEGACY_WORKER`(= '## 🛠️ 워커·메신저') 상수 제거 → 2역할 워커 제목 판정은 `isWorkerBlockHead`(괄호 부제 `(실행·코딩·전달)` 포함)로 통일 ✓ · `hasLegacyRoleBlocks` 도 같은 판정 사용 ✓ (3역할 섹션 제목과 구분 ✓) · 죽은 `normalizeThreeRoleLabels`('워커·메신저'→'워커' 치환) 제거 ✓ |
| `src/insights/model-role-fit.ts` | `ROLE_FIT_ROLES` 에서 `messenger` 키 제거(o/r/w) ✓ · 실사용 표식·각주·legend 불변 ✓ |
| `tests/insights-three-role-body.test.ts` | 2역할 픽스처 제목을 실제 산출물(`## 🛠️ 워커 Top7 (실행·코딩·전달)`)로 ✓ · '워커·메신저' 문자열 제거 ✓ · 3역할 섹션 제목이 레거시로 오인되지 않음을 추가 ✓ |
| `tests/insights-letter-three-role-render.test.ts` | messenger 렌더 케이스 → o/r/w 3역할 표식 검증으로 대체 ✓ |
| `tests/insights-model-role-fit.test.ts` | messenger 역할 단언 → 관찰 없는 역할 단언으로 대체 ✓ |
| `tests/insights-free-guard.test.ts` | 픽스처의 '워커·메신저' → '워커' ✓ |
| `tests/insights-composition.test.ts` | '✉️ 메신저' 부재 단언 제거(3섹션 단언 유지) ✓ |

> **주의(보고)**: `hasLegacyRoleBlocks` 는 2역할 본문에는 true(오케스트레이터 블록 ✓), 3역할 본문에는 false ✓ 를 유지해야 한다 ✓.
> 워커 제목 판정을 '워커' 로만 바꾸면 3역할 섹션 제목과 겹쳐 true 가 되므로, 괄호 부제 조건을 유지했다 ✓ (회귀 테스트로 고정 ✓).

## 3. 문자열 0 확인

```
grep -rn "messenger|메신저|워커·메신저" src/ config/ tests/ features/  →  0건
```
- 과거 커밋·docs 이력은 보존(Dispatch '제거 6' ✓) ✓ · 이번엔 소스·테스트·features·config 범위만 ✓.

## 4. 소유 외 수정·예외 목록

- **소유 외 수정 0건** ✓ (위 §2 는 모두 패킷 소유 파일 7건 안 ✓) · 커밋·push·외부 쓰기·발행 0건 ✓.
- 참고: w1 이 이미 `features/insights.feature` 의 워커 제목 기대값을 갱신 ✓ (BDD 45/45 통과 ✓).

## 5. 재발행 위험

1. **본문 3섹션 + 댓글 3개 + Free 8열 + 실사용 열** 이 함께 나가는지 확인 ✓ (4개 축 동시 검증 ✓).
2. **2역할 경로**(3역할 off)는 3댓글·Free 7열(리뷰어 열 없음 ✓ = 기존 2역할 동작 ✓) → 8열 기대가 아니라 실제 2역할 동작을 확인 ✓.
3. **리뷰어 점수 0~100**(#233)·정렬 각주·jev 제외가 그대로인지 ✓ (위 §1 ✓).
4. **Agent Arena 링크**가 details 에 남았는지 ✓ · `sources N total` 배지가 늘지 않았는지 ✓.
5. 정리 과정에서 2역할 워커 제목 판정을 괄호 부제 조건에 묶었으므로, **2역할 제목 문구가 바뀌면 교체 탐지가 깨진다** ✓ → 제목 변경 시 함께 갱신 필요 ✓.
