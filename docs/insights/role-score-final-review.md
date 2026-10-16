# 최종 독립리뷰·클린 감사 (w3, yoroi-normal-final-review-w3 / yoroi-normal-clean-audit-w3)

- 범위: 5분 clean 정적 비교. 수학·guard 재검증 없음(이전 20/20 PASS 인용). 수정 없음: ROOT 워킹트리·발행 후보·config·테스트·git·원격·API 모두 읽기 전용.
- 정정: 직전 리포트의 BLOCK 두 건(clean score.ts 워커 블록, four-source 워커 설명)은 **ROOT 워킹트리**를 origin/main과 비교한 결과였다. 워커 dirty hunk는 사용자 보존 대상이므로 정상이며 차단 사유가 아니다. 발행 판정은 발행 후보 경로만으로 한다.

## 1. 워킹트리(ROOT) — 보존 대상, 차단 아님
| 항목 | 상태 | 근거 |
|---|---|---|
| score.ts 워커 effort fallback | 보존(정상) | ROOT에 존재. 발행 후보에서는 제외됨 |
| four-source 성능 행 AA-only·Cog 가산 | 보존(정상) | ROOT에 존재. 발행 후보에서는 제외됨 |
| 원본 dirty5 해시 | 3/5 동일, 2/5 상이(정상) | 상이 2건은 백업 이후 R 편집 때문. 백업 대비 삭제 행은 R 치환 행(score.ts 4행 전수, four-source 11행 중 6행 표본) |
| dirty5 존재·삭제 | PASS | 5개 모두 존재, 삭제 0 |

## 2. 발행 후보 (/private/tmp/yoroi-normal-clean) — origin/main 대비 읽기 전용 diff
| 파일 | 판정 | 근거 |
|---|---|---|
| src/insights/letter-top10-score.ts | PASS | 차이는 R docstring(주석), 오케 PARTS price 2-leg(`orchValue`·`cogCost`, role orchestrator), PRICE_MISSING 주석뿐. 워커 PARTS 동일. `best(m)?.[0] ?? 'default'`(main 원문) 유지, `aaFallback` 없음. 워커 실행코드 변경 0 |
| docs/insights/four-source-score.md | 잔여 block 1건 | 성능 행은 diff 없음 → main과 동일(AA-only·Cog 가산 행 제외 확인). R 변경(제목·p75 문단·사용량 0.05·오케 가중·오케 가성비·표시 보정 문단)은 허용. 잔여: 가격 행 방향 칸 `워커 log10(v+.01) 낮을수록` → `log10` (main 1회, 후보 0회) |

## 3. 발행 후보 최종 판정
- src/insights/letter-top10-score.ts: **PASS**
- docs/insights/four-source-score.md: **잔여 block 1건** (가격 행 방향 칸 복원 필요, 문서 한 칸, 실행 영향 없음)
- 전체: 잔여 1건 복원 후 PASS. 후보 작성자(w2/w1) 소유이며, 이 감사는 후보를 수정하지 않았다.

## 4. coverage (현재 manifest 기준)
- manifest 78 항목. 패킷과 w2 보고의 "75"는 과거 수치다. 워킹트리 allowlist를 w2 규칙으로 재계산하면 78개이며 집합이 동일하다(누락 0, 초과 0).
- 발행 후보 파일 78/78 sha256 일치.
- rootplan = `docs/insights/orchestrator-r-release-task.md`: manifest·후보 모두 존재.
- 출시 docs `release-status.md`·`tasks.md`, ban 기록 `letter-ban-list-task.md`: 존재.
- oldR 5 tests(w2 목록): markdown·markdown-legend·top10-render·top10-price-policy는 manifest에 있다. render-top10(`tests/insights-render-top10.test.ts`)은 워킹트리 미변경이고, 후보 해시가 origin/main(72199d8b…)과 같아 기준 상속으로 커버된다.
- `docs/roadmap.md`: manifest 밖이며 패킷상 필수 조건이 아니다(xhigh 1.1 이월).

## 5. w2 클린 전체 검증 (인용, 재실행 안 함)
- `/private/tmp/yoroi-normal-clean-check-w2-report.json`: typecheck 0, unit 1041/1041, BDD 45·632, build PASS, dist 1.0.2. validate 후보 672 PASS, 원본 673 PASS.

## 6. 이전 검증 유지 (재실행 안 함)
- source guard(w4 unified `scoreText` '-' 처리, rawScore 보존, calibration 5번째 테스트): PASS, 가드 관련 20/20.
- 불변 항목(정렬 키 raw, ▽ raw, 대표·components 비변경): PASS (guard 한정).
- w2 테스트 표본: rawScore 단언 삭제 0건, 추가 29건.

## 7. 잔여 block 상태 (PR 초안 단계 갱신)
1. four-source 가격 칸(변환 열): 워커 `log10(v+.01) 낮을수록` 복원 완료. ROOT 워킹트리에 적용했고 미커밋이다. 패치는 `/tmp/yoroi-worker-price-doc.patch`다.
   - PR head c9fde22에는 아직 `log10`이 남아 있다. 후속 doc 커밋이 필요하다. 로컬 commit·push는 이 작업에서 허가되지 않았다.
2. PR 초안: https://github.com/qus0in/yoroi/pull/166 (draft, head c9fde22, label fix, 닫기 이슈 0건). 상세는 `role-score-pr-draft.md`.
- 이전 리포트의 "ROOT strip·manifest 재생성" 차단 해제 조건은 철회한다.
