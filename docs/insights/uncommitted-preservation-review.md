# 미커밋 변경 보존 분류 (2026-10-16, 읽기 전용)

- 기준: `docs/insights/active-worker-assignment-20261016.md`. 삭제·stage·commit·stash·reset 없음. DB/env/개인 usage 내용 미열람.

## A. 원래 사용자 dirty5 (1.1 worker 정책 — 보존, 1.0.2 제외)
| 파일 | 상태 | hash(16) | 근거 |
| --- | --- | --- | --- |
| `src/insights/letter-top10-score.ts` | M | `0f766be8db62d623` | p85 워커 effort fallback hunk |
| `docs/insights/four-source-score.md` | M | `14b2846ece361fe1` | 워커 성능행·워커 추천 effort dirty(가격 셀 R 수정은 커밋됨) |
| `tests/insights-worker-effort-source.test.ts` | ?? | `303ced254a2ee439` | 워커 effort 회귀 테스트 |
| `docs/orchestration.md` | M | `f6ff51558e337def` | 협업 구성 표(타 주체) |
| `docs/insights/orchestration-takeover-20261015.md` | ?? | `bcbb80d2afa483c2` | 오케 인수 기록 |

## B. 이번 #165 라벨 변경 (리뷰 PASS, 포함 미정)
| 파일 | 상태 | hash(16) |
| --- | --- | --- |
| `src/ui/cli/labels.ts` | M | `f96638b072e800a3` |
| `tests/window-labels.test.ts` | M | `b1cf94e3f441f8ca` |

## C. 타 워커 문서 (보존, 자동 포함 안 함)
- M `docs/insights/orchestrator-r-release-task.md` `28325fd442f1c721`.
- ?? `active-worker-assignment`·`antigravity-argon-assignment`·`antigravity-argon-label-progress`·`antigravity-argon-label-review`·`role-score-ci-final`·`role-score-completion-prep`·`role-score-global-final-review`·`role-score-global-review`·`role-score-merge-main-ci`.

## D. 내 소유
- `docs/insights/uncommitted-preservation-review.md`(이 문서).

## 최소 보존 목록 (삭제 금지)
- A 5종 전체 + B 2종 + C 문서 전부. source 수정은 A(score.ts)·B(labels.ts)뿐이며 다른 워커 source 변경 없음.
- version/tag/Release는 최신 지시상 발행 금지(조회 불필요). 실제 정리·Git/GH mutation 없음.
