# 정규 순위 보정 릴리스 준비 (1.0.2)

- 확정 범위: R 가성비 4차원 복구 + 역할별 전체 적격 대표 모집단 normal midrank→Φ⁻¹→50+10z 표시 보정.
- raw 가중합·worker bonus·대표 effort·Grok 자격·▽ 원정책 유지. 표시 점수만 50중심·SD 약10.
- 릴리스 문서 갱신: release-status·tasks·PR body. 이전 "worker 점수 완전 불변" → **raw 불변/표시 보정**으로 명확화.
- 검증 구분: R 단계 clean 1027 PASS / 표시 보정 통합 검증 진행(clean 신규 구성으로 validate 672·calibration/score-normal/dimension-contract 24/24).
- 이슈 #163 ban·#164 warn은 등록만. #160/#162 레터 미수정·미재발행. 새 milestone 없음.
- **clean 구성**: builder `/tmp/yoroi-normal-build-clean.py` → `/tmp/yoroi-normal-clean`(origin/main `698898767` + 75 allowlist, worker hunk 제거), manifest `/tmp/yoroi-normal-clean-manifest.json`. full check PASS(1041/45·632/build·1.0.2).
- **커밋·push 완료**: commit `c9fde22a10fd96b313d3172e054d06246719d160`(tree `3911db0c…`, parent `698898767…`), dev push `3fd5549..c9fde22`(non-force). origin/dev = c9fde22, origin/main = 6988987 불변.
- 커밋 방식: temp index(`/tmp/yoroi-normal-final-stage-index/index`)+`GIT_WORK_TREE=/tmp/yoroi-normal-clean` → `git commit -F`, 이후 real index는 `git read-tree HEAD`로만 동기화(working 파일 쓰기 0).
- working 잔여: dirty5 보존(4종 동일·four-source 변경 유지), 타 워커 docs 2(`role-score-final-review`·`role-score-release-prep`)는 후속 커밋 경계.
- 아직 금지: main merge·tag·release·global·레터 발행. PR는 후속 draft 예정.
- **global 갱신 스크립트 준비**: `/tmp/yoroi-102-update-global.sh`(48줄, `bash -n` OK). source SHA 인자 → clean archive build → `update:global`/`--check`/`yoroi --version 1.0.2` → 설치 dist 검증(`orchValue` R 가중·`normalRankScores` helper·`aaFallback` 1.1 hunk 부재). `.env` 0600 private backup → 교체 후 부재+backup 존재 시에만 atomic restore, 값·경로 미출력.
- **실행 시점**: main CI success·tag/Release 확인 후 별도 패킷. 지금은 설치·전역·git/원격·레터 쓰기 없음. main CI gate 무기한 대기 금지.
- staging: 기존 stale `/tmp/yoroi-r-stage-index` 사용 금지. real index staged 0(동기화 후).
