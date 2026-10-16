# 전역 갱신 스크립트 최종 독립 리뷰 (1.0.2)

- 대상 `/tmp/yoroi-102-update-global.sh` (84줄, sha256 `0ab57c44…`). w4 보고 `/tmp/yoroi-global-update-review-w4-report.json` 대조.
- `bash -n` PASS. 읽기 전용 검토만(real env/global/Git/remote mutation 0).

## 판정: PASS
- **clean SHA 빌드**: 40hex 인자 → `git archive <sha>` → stage. archive version 1.0.2 강제. `diff -qr stage/dist installed/dist`로 설치본=소스 빌드 확인.
- **실패 trap·env 복원**: `trap cleanup EXIT`. 실패 시 backup 보존, 성공 시에만 삭제. 복원은 HAD_ENV=1·backup 존재·설치 `.env` 부재·비링크일 때만 0600+`cmp` 확인 후 atomic.
- **출력 위생**: stage·IPATH·BACKUP 경로/값 미출력(문구는 "path withheld"/"restored (0600)"). 실 env 파일 read·printenv 없음.
- **검증 guard**: `orchValue`(R 가성비)·가중치 70/5/10/15·`normalRankScores`·`aaFallback` 부재.
- **skill/docs 준수**: `update:global`→build→install→버전 비교, `--check` 0 요구, `.env` 사본 정책 불변, npm publish/tag/Release 없음.

## 참고(결함 아님)
- 줄 수 84(w4 83 표기, 개행 차이).
- pnpm은 ambient PATH/기존 캐시 사용(네트워크·시스템 설정 변경 없음). w4 synthetic mock에서 `PNPM_STORE_DIR` 임시 고정으로 검증됨.
- 전역 설치·실행은 main CI success·tag/Release 확인 후 별도 단계.
