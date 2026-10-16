# 1.0.3 전역 CLI 갱신 기록 (w3)

- 전: `yoroi 1.0.2` → 후: `yoroi 1.0.3`. `--check` 일치(exit 0).
- 스크립트: `/tmp/yoroi-103-update-global.sh ea381c6` (독립 PASS본).

## 전제 (직접 확인)

- Release 1.0.3 (06:31:13Z, target merge SHA) + main CI success 재확인.
- 로컬 객체 없어 `fetch origin main`만 (작업파일 불변).

## 검증 (스크립트 출력)

- archive 1.0.3, dist 전체 일치, R 가중치·normal 통과.
- argon·muse·warn 마커 통과. env 백업·복원(0600) 완료.
- 값·경로 미출력. npm publish 없음. clean archive 기반, 원본 보존.

## 금지 준수

- 레터 게시는 다음 단계. 보고 후 대기.
