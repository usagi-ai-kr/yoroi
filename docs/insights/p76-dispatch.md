# p76 분배: 0.11.0 배포·레터 발행 (2026-10-14 사용자 지시 "처리 완료되면 커밋 + 배포 + 레터 발행", 범프 0.11.0 승인)

o(`w12:p13`)는 분배만 맡는다. 단계마다 앞 단계 보고를 o가 확인한 뒤 다른 워커에게 넘긴다(몰아주기 금지).
최종 요약: `scratch/reports/yoroi-p75-price-out-and-free-table.md`(o).

## 현재 (o 확인)

- dev = origin/main(`245d538`)에 없는 커밋 4건, 커밋 메시지 정정 완료(트리 동일 확인):
  `b408803` 오케 가성비 제거·잔재 정리 · `572e5c5` Free 한 표 · `639fb0f` 분배 원칙 · `77e657f` p73~p75 기록.
- main은 PR #139 머지 커밋만큼 앞서 있다(dev → main PR로 해소).
- 938/938, typecheck 0, validate PASS(6R·7K·7R 보고).
- 버전: 사용자 결정 0.11.0(기능 변경이라 minor).

## 단계

| 단계 | 워커 | 범위 | 보고 |
| --- | --- | --- | --- |
| B | w1 | `python3 scripts/version.py --bump minor --apply`(0.10.0→0.11.0), `docs/roadmap.md` 0.11.0 절(오케 가성비 제거 82/6/12·Free 한 표·잔재 정리), 마일스톤 0.11.0 존재 확인(없으면 생성), 범프 커밋 1건 + 이 문서 커밋 1건, push 금지 | yoroi-p76-w1b-report.json |
| P | w3 | 전체 검증 후 `git push origin dev`, dev → main PR 생성(본문: 범위·검증·마일스톤 링크, 마일스톤 연결) | yoroi-p76-w3p-report.json |
| V | w4 | PR 리뷰(범위·시크릿·scratch 혼입·100줄), CI 통과 확인, PASS면 `gh pr merge --merge` | yoroi-p76-w4v-report.json |
| G | w2 | main CI(`gh workflow run ci.yml --ref main`) 성공 확인, tag `v0.11.0`·Release, 마일스톤 close, 전역 CLI 갱신·`yoroi --version` 0.11.0 확인 | yoroi-p76-w2g-report.json |
| L | w1 | 전역 CLI 0.11.0으로 `yoroi insights once --markdown > scratch/reports/letter-2026-10-14-v0110.md`(`--refresh` 금지), 표시 확인 | yoroi-p76-w1l-report.json |
| X | w3 | #138 본문 갱신 + 댓글 한 줄(0.11.0 기준: 오케 82/6/12·가성비 없음·Free 한 표) | yoroi-p76-w3x-report.json |

## 공통 금지

main 직접 push, 모델·세션 변경, 실제 API 호출·`--refresh`, 시크릿·개인 사용량 원본 노출, 공유 트리 `git switch`, 파일당 100줄 초과.
사용자 결정이 필요하면 멈추고 보고한다.
