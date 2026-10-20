# PR #191 최종 검증 (w1, 2026-10-20)

## checker 수락

- 구현보고서 도착 확인. 적대적 수정분(정적 차단·완료 증거·tsc 통합)을
  재검증절에서 실측 대조했다. 이전 불합격 3종 해소 확인.
- 미확인 범위: `process.exit` 정적 패턴의 문구 우회는 토큰 증거가 받침.
  OS 격리가 아니다. 최종 PASS는 본 문서 판정절에서만 다룬다.

## store 상태

- w3 후속 보고서(`/tmp/yoroi-harness-review-store-followup-report.json`)
  대기 중. 도착하면 이전 반례(포트 허위 capable·파손 throw)를 재실행한다.
- 독립 리뷰(`calibration-storage-acceptance-review.md`)의 문제 2건이
  해소됐는지는 후속 보고서+실diff 대조 후 판정한다.

## 전체 check

- 본 패널 백그라운드 실행, 원 exit 1. tail이 아닌 로그 끝 `FINAL_EXIT=1`로 판정.
- 실패 지점: typecheck. `tests/insights-publish-recovery.test.ts:65,90`
  TS2322 2건(타 소유 진행분, 본인 범위 아님·미수정). unit·BDD·빌드는
  typecheck 게이트 뒤라 미실행. 실행 중 store 소스 변경 없음(md5 일치).
- store 후속 보고서 도착: 이전 반례 2종을 재실행해 해소 확인.
  위조 capable는 `totalScore mismatch`로 거부, 파손 violations_json 행도
  목록 복구(rows=1). 수락문서 결론을 해소 확인으로 정정했다.

## 판정

- checker: 수락(재검증 실측 해소 확인, 미확인 범위 명시).
- store: 독립 리뷰 문제 2건 해소 확인(후속 보고서 대조+반례 재실행). PASS.
- 전체: typecheck 타소유 2건으로 실패. 커밋 대상 상태 아님.
  실패 소스는 owner에게 수정 의뢰 예정.

## 추기 (playbook 허용문구 삭제 패킷)

- aliases 기대값 구체 보완 후 전체 `pnpm run check` 원 exit 0
  (typecheck clean·unit **1192/1192**·BDD 45/635·빌드 clean) — *이전 스냅샷*.
- playbook 48/49 허용문구 삭제. 제품 소스 변경 없으므로 전체 check를
  반복하지 않는다. 검증은 본 문서·위탁 기록의 판정을 유지한다.

## 최신 전체 check (w1 최종, 제품 소스 최종본)

- `pnpm run check` 원 exit 0: typecheck clean·**unit 1197/1197**·BDD 45/635·build clean.
  (`/tmp/yoroi-publisher-review-fix-report.json`)
- validate-repo.py PASS(859 files, 8 skills)·git diff --check clean·원격 CI는 push 후 확인.
- 위 1197 이후 제품 소스 변경 없음(파일 mtime 대조) → 전체 check 재실행 불필요.

## 퍼블리셔 최종 독립 리뷰 (w3, 최종판정 PASS)

- F1(create URL repo 게이트)·F2(기존 이슈 본문 정확일치 게이트) 해소 확인. `publisher-recovery-acceptance-review.md`.
- publish 집중 18/18 exit 0(기존 4 + 경계 5). F1·F2는 root 차단 항목에서 제외 가능.
- 미확인: 실제 GitHub API 동작(합성 러너만)·인증/OS 격리(별도 리뷰)·전체 check 재실행.

## 제품 코드 커밋 (dev, 단위별)

- `6235833` 캘리브레이션 env 경계·store v2 / `b5ad4c7` 퍼블리셔 복구 /
  `e33a019` MiniMax 카탈로그 / `a49628e` 대응·리뷰 문서.
- 잔여: 외부 CI 확인과 외부 재리뷰만. #168/#190 런타임 미구현·#180 open 유지.
