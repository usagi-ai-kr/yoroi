# Actions 전환 기록 (2026-10-20, #194)

- 위임: 사용자 명시 허가로 Secrets 담당 이슈 처리. 신규 handle 이슈가 아니라 기존 검증 이슈 #194를 갱신·지정했다. memo 쓰기 없음.
- 담당: `qus0in` (`gh api user` 실측). 실패 시 타인을 임의 지정하지 않는 조건은 해당 없음.
- URL: https://github.com/usagi-ai-kr/yoroi/issues/194 (댓글 6284013220에 현상 반영).

## 실측 PASS

- Secrets 이름·존재만 확인 (값 미조회·미표시): `YOROI_AA_API_KEY`·`YOROI_OPENROUTER_API_KEY` 모두 존재. `GITHUB_TOKEN`은 내장. 부족분 없음 → 재등록 이슈 미생성.
- 워크플로: schedule `0 23 * * *` (UTC 23:00 = KST 08:00), `workflow_dispatch` dry_run 기본 true, secret 참조 2건 + 내장 토큰.
- 최신 실행: `letter-publish` dispatch 성공 (run 39371356308, dev `647299f`). 기본 브랜치 main.
- Free 목록: 런타임 `opencode models --standalone` 경로 유지. 중복 방지: canonical 저장소 조회 유지.
- PM2 읽기만: `yoroi-letter` stopped, 변경 없음.

## 실행 로그 판정 (run 39371356308, dev `647299f`)

- 단계: checkout·deps·build·opencode-install·dry-run 전부 success, Publish 스텝 skipped (dry_run 입력 true).
- dry-run 출력: 수집 실행 (opencode-data pastWeek/pastDay), 중복체크 실행 → `duplicate=yes close=#192 comments=3`.
- 구분: already-published gate 조기skip이 아니다. KST 게이트 통과 (13:46 KST) 후 정상 dry-run 경로이며, 오늘 #192 존재로 생성 생략 경로를 탔다.
- 미실행 남음: 렌더·Free 가드·실제 발행 경로는 duplicate 경로라 검증되지 않았다. Secrets는 마스킹(`***`) 확인, 원문 없음.

## main 워크플로 상태

- origin/main에 `letter-publish.yml` 존재, Actions 상태 active (disable 아님).
- schedule 실행 기록 없음 (다음 UTC 23:00이 첫 live 후보). dispatch 실행은 dev 브랜치에서만 수행됐다.

## 미실행 (다음 검증 단위)

- dry-run dispatch 성공 1건 있으나 duplicate 경로만 검증됨. live 발행 0, PM2 변경 0. Secrets 부족 시 PM2를 먼저 멈추지 않는 조건은 해당 없음 (부족 없음).
- commit·push·dispatch는 다음 검증 단위에서. 전환은 검증 후 승인된 상태이므로 재승인 대기로 적지 않는다.

## 실제 잔건

- 다음 검증 단위의 dry-run 성공 확인, 실제 발행 전환, PM2 `yoroi-letter` 정리 여부 결정.
- v1.5.0 PR 본문 초안: `/tmp/yoroi-v150-pr-body.md` (draft, 적용·발행 없음).

## 전환 롤백 다음 패킷 초안

- `yoroi-194-cutover-verify`: dry-run dispatch 실측 + 실패 시 롤백 (Actions 워크플로 비활성화, PM2 `yoroi-letter` 재가동).
- 최종 전환 패킷 초안: `/tmp/yoroi-194-final-cutover-packet.json` (미전송).
