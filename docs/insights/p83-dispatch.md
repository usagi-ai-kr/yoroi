# p83 분배: `yo`(yoroi once --pretty) 출력에서 n/a·optimal 행 생략 (2026-10-14 사용자 지시)

o는 분배만 맡는다. 결과: `scratch/reports/yoroi-p83-pretty-hide.md`(o). 커밋·push 금지.
대상은 `src/ui/cli/render.ts` `renderPretty`(호출 `bootstrap.ts:34`)다. `scripts/usage-hourly-report.sh`(cron)는 별개이므로 건드리지 않는다.

## 단계

| 단계 | 워커 | 범위 | 보고 |
| --- | --- | --- | --- |
| I | w1 | 구현·테스트(아래) | yoroi-p83-w1i-report.json |
| T | w4(w3 작업 중이라 재배정) | 기존 테스트 3건 갱신: w1 보고 `blocking_for_o.proposed_patches_verified` 그대로 적용 | yoroi-p83-w3t-report.json |
| R | w2 | 리뷰(I+T, 읽기 전용)·전체 검증·픽스처 출력 예시 대조 | yoroi-p83-w2r-report.json |

I 결과(w1): 구현·신규 6건 PASS, typecheck 0, validate PASS. 공급자 창이 모두 생략되면 블록을 제거하고, 열 폭은 상수라 그대로다.
실행은 `once --pretty`가 공급자를 실제 호출해서(`bootstrap.ts` runOnce) 생략했고 픽스처 예시로 대신했다.
소유 밖 기존 테스트 3건(window-order·pretty-render·ollama-monthly-display)이 새 동작 때문에 실패한다 → T 단계.

## I 요구 (w1)

- pretty 표에서 상태가 `n/a`·`optimal`인 창 행을 생략한다(`pace.ts:4`). `under`·`over`·`limit`과 한도 임박 표시 행은 유지한다.
- 모든 창이 생략되면 표 대신 `표시할 항목 없음` 한 줄을 낸다. 빈 표나 빈 출력은 내지 않는다.
- 열 너비·구분선·정렬은 남은 행 기준으로 다시 계산하고 기존 서식을 유지한다. 공급자 요약 행 등 다른 구조는 바꾸지 않는다.
- 공급자 단위로 남은 행이 0이면 그 공급자 블록을 어떻게 할지(제거 또는 요약 유지)는 현 구조를 보고 제안하고, 테스트로 고정한다.
- 테스트:
  - `n/a`·`optimal` 제거
  - `limit`·`over`·`under` 유지
  - 전부 생략 시 한 줄
  - 열 폭 재계산
- 검증: `pnpm run typecheck`, `pnpm test` 전체 실패 0, `validate-repo.py`.
- 실행 확인: 레포 `pnpm -s run dev once --pretty`는 네트워크 없이 캐시로만 동작할 때만 실행한다(동작 방식을 코드로 먼저 확인).
  네트워크 호출이 필요하면 실행하지 않고, 저장 캐시나 테스트 픽스처로 렌더한 예시를 붙인다.
  전역 `yoroi`는 0.10.0 스냅샷이라 이번 변경이 반영되지 않는다.
- 소유: `src/ui/cli/render.ts`, 필요 시 `src/ui/cli/` 신규 서식 헬퍼, `tests/usage-status-render.test.ts` 또는 신규 pretty 테스트. 파일당 100줄.

## 공통 금지

커밋·push, 실제 API·네트워크 호출, `scripts/usage-hourly-report.sh` 수정, p79~p82 파일, 모델·세션 변경.
