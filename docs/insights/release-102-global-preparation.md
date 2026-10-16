# 1.0.2 Release·전역 갱신 준비 (w1, `yoroi-102-release-global-prep-w1`, 2026-10-16)

- 범위: **준비만** — 실제 env 읽기·설치·tag/Release·전역 갱신·Git/GH 변이는 이번 단계 금지. 사용자 Release 승인 범위의 사전 준비.
- 산출: 본 문서 · `/tmp/yoroi-102-final-release-notes.md`(초안) · `/tmp/yoroi-102-verify-installed.sh`(신규 helper). 기존 `/tmp/yoroi-102-update-global.sh`는 **수정하지 않음**(새 소유권 주장 안 함).

## 기존 검증 재확인 (2026-10-16 05:53Z)

- `/tmp/yoroi-102-update-global.sh`: 84줄, sha256 `0ab57c441ddee3d447dea1994aba313f7b341e13acf22cbbeb1b0252db94a011` 재계산 일치, `bash -n` OK.
- w2 독립 리뷰(`/tmp/yoroi-global-final-review-w2-report.json`): PASS — trap cleanup(실패 시 .env backup 보존·성공 시에만 삭제), env 0600 원자 복원, 출력 위생(경로·값 미출력), clean SHA archive, dist `diff -qr` 일치, R 가드(`orchValue`·가중치 70/5/10/15·`normalRankScores`·`aaFallback` 부재) 확인.
- 기존 스크립트는 **warn/argon/muse 마커를 확인하지 않음** → 아래 helper로 보완(대체 아님, 추가).

## 신규 helper: `/tmp/yoroi-102-verify-installed.sh` (owned)

- 사용: `bash /tmp/yoroi-102-verify-installed.sh <package-dir-containing-dist>` — 설치본/후보의 `dist/src`만 읽는다(env 파일·설치·네트워크 없음).
- 마커: `pace.js`의 `WARN_PERCENT=90` · `render-pretty-filter.js`의 `yellowBright` · `display.js`의 `usage_status=` · `plan-catalog.js`의 `gemini-4-argon`과 `muse-spark-open` · `model-aliases.js`의 `muse-spark-open:cloud` · `letter-top10-score.js`의 `aaFallback` **부재**(1.1 제외).
- 실패 시 exit 1, 사용법 오류 2. 자체 검증은 후보 `/tmp/yoroi-102-final-clean`에 실행해 확인(성공/실패 경로 모두).

## 갱신 순서 (main CI 성공 후에만)

1. dev→main PR 머지 → **main CI success 확인** → tag `v1.0.2`·Release(동일 SHA). **v1.0.2는 기존에 없음**을 발행 직전 다시 확인.
2. `bash /tmp/yoroi-102-update-global.sh <merge-SHA>` — clean archive만 사용. **버전이 같아도 source content가 다르면 갱신이 필요**하다(global-install.md 55행: 버전 동일이어도 dirty 1.1 혼입 방지를 위해 검증 SHA 트리에서 갱신).
3. `bash /tmp/yoroi-102-verify-installed.sh <설치 pkg dir>` — warn/argon/muse 마커 + 1.1 부재 확인.
4. 문제 시 롤백: `pnpm remove -g yoroi` 후 `pnpm run install:global`(docs/global-install.md 52행).

## env·보존 규칙 숙지 (기존 도구 그대로)

- 설치 전 전역 `.env`를 값·경로 출력 없이 0600 private 사본으로 백업, 설치 후 설치물 `.env` 부재+백업 존재일 때만 원자 복원(성공 시에만 사본 삭제) — `update-global.sh`의 `trap cleanup EXIT`가 담당.
- `.env` 값·개인 사용량 원본·토큰은 로그·문서·커밋에 남기지 않는다. npm publish 금지, 새 의존성 금지.

## 원본 dirty 제외 사실 (내부 기록)

- 커밋·전역 소스에서 제외: worker hunk 2파일(`src/insights/letter-top10-score.ts`·`docs/insights/four-source-score.md`) + `docs/orchestration.md` + `docs/insights/orchestration-takeover-20261015.md` + `tests/insights-worker-effort-source.test.ts`(테스트 1건). 전부 원본 워킹트리에 보존(해시는 commit record·report에 기록).
- 커밋 `44253ed`엔 1.1 흔적이 없음(`aaFallback`·worker 행 부재) — 전역 dist도 같은 소스에서 나온다.

## 릴리즈 노트·보안

- `/tmp/yoroi-102-final-release-notes.md`: R 가성비/가중치/정규 표시·warn(90~<98·밝은 노랑·plain/JSON)·Argon 유료 접근·Muse cloud 별칭·Top10 미보장·1.1 별도·검증 수치(1060/45·632) 포함. **PR URL placeholder 미사용**(확정 시 삽입).
- 자체 commit record(`release-102-commit-record.md`) 재검토: 공개 SHA·검증 수치만 있고 개인 수치·env·raw·비밀 없음.

## 후속

- 다음 단계: 머지·main CI → tag/Release → 위 2~3 실행 → 레터. 보고 후 메신저 지시 대기.
