# 0.1.0 준비 상태 (2026-10-08)

- 버전 원본: `package.json`, private 유지. v0.1.0 발행 시점 `0.1.0`, 현재 `0.1.2` 준비(아래 0.1.2 준비 참조. v0.1.0·v0.1.1 발행 완료).
- 원격 목표: [0.1.0 milestone](https://github.com/qus0in/yoroi/milestone/1), #1–#12·#18–#28·#56–#61 연결.
  #13–#17·#29는 [0.1.1 milestone](https://github.com/qus0in/yoroi/milestone/3)으로 이동했다.
- 범위: 5개 공급자 once/watch CLI, pnpm 실행·빌드·CI, 실계정 인증 검증.
- CLI `--version`은 package.json을 읽는다. 빌드도 같은 JSON을 산출물에 포함한다.
- tag·Release는 발행 완료다. PR #63 merge commit `6a6802a`(main),
  PR head `e6ffd2e`, PR CI `37725084420` success(main 트리 동일, ci.yml main push 트리거 없음).
  [v0.1.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.0) 발행(target `6a6802a`).
  변경은 `dev → main` PR로 게시하며 해당 PR의 CI를 확인한다.
- [PR #28](https://github.com/qus0in/yoroi/pull/28)에 첫 CLI MVP와 버전·pnpm 전환을 게시했다.

## 인증 검증

- [#26 Ollama](https://github.com/qus0in/yoroi/issues/26): 사용자 서명 키 연결 확인.
  인증 성공 후 참조 구현과 실제 응답의 차이를 발견했다.
  현재 usage 집계·balance 크레딧 응답 파서를 추가해 총 7개 창을 확인했다.
- [#27 OpenCode](https://github.com/qus0in/yoroi/issues/27): 사용자 제공 .env 설정으로
  실제 API 조회·rolling/weekly/monthly 3개 창 파싱 성공.
- Codex/AGY/Claude 실제 조회는 앞선 작업에서 성공했다.
- 개인 키·수치·응답 원문은 기록하지 않았다. 현재 응답 fixture는 합성값만 사용한다.

## pnpm 전환

- Node 24.13.1 유지, `packageManager: pnpm@12.10.1` 고정.
- npm lock을 pnpm-lock.yaml로 변환했다. CI는 frozen install과 pnpm check를 사용한다.
- pnpm-workspace.yaml에 strict 설정과 esbuild 빌드 허용을 기록한다.
- dev는 `.env`를 Node 기본 옵션으로 읽는다. 이미 설정된 환경 변수가 우선한다.
- [설치 지침](https://pnpm.io/installation)과 [공식 CI action](https://github.com/pnpm/setup)을 확인했다.
- 로컬 PATH의 기존 pnpm 11이 충돌해 Node/Corepack shim 경로를 우선하여 검증했다.
- 검증(당시): pnpm check 75개 테스트·BDD 16시나리오/87step 통과. pnpm dev 실제 API 조회와 빌드 `--version`도 확인했다.
- 최종 검증(freeze): 단위·통합 128개 통과, BDD 25 시나리오/144 step 통과, 레포 검사 129파일·3스킬 PASS.

## GitHub 조치

- main 보호 적용: PR·ci 필수, strict 최신 기준, 관리자 포함, force push·삭제 금지.
- #26·#27은 사용자 명시 승인 후 검증 결과를 기록하고 hold 해제·종료했다.
- 완료 기록은 PR에도 포함한다. milestone은 실제 릴리스 커밋 검증과 통합 시점에 맞춰 완료한다.
- 최초 게시 커밋의 [원격 CI](https://github.com/qus0in/yoroi/actions/runs/37709346179)가 통과했다.
  자동 실행이 보고되지 않아 동일 head의 workflow_dispatch를 실행했다.
  이후 리뷰에서 수동 실행 체크가 PR 필수 조건에 반영되지 않는 것을 확인했다.
  [GitHub 근거](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks):
  적격 이벤트의 workflow run을 확인해야 하며 수동 체크 성공으로 PR 통과를 판단하지 않는다.

## 회고와 릴리스 기준

- 비공식 API의 참조 구현과 실제 응답은 다를 수 있다. 인증 후 필드·자료형만 확인하고
  실제 구조의 합성 fixture로 회귀 검증한다. 없는 quota·reset은 추정하지 않는다.
- 버전 파일을 추가하지 않고 manifest·CLI 출력·milestone·tag를 같은 SemVer에 연결한다.
- 릴리스 시 해당 커밋의 타입·단위·BDD·빌드·레포 검사와 원격 CI를 확인한다.
  발행 요청 시에만 검증된 커밋에 tag와 Release를 연결한다.
- Ollama 인증/포맷 변경·네트워크·응답 크기 초과에서 다른 공급자의 결과가 유지되는지 검사한다.
  비공식 API의 영향은 해당 공급자에 한정하고 누락 수치를 생성하지 않는다.
- PR 리뷰 조치와 완료 기준은 [pr-28-review.md](pr-28-review.md)에 기록한다.
- Claude 자동 수집은 CLI print 경로를 제거하고 OAuth 사용량 GET으로 보강했다.
  최신 인증·조회 계약과 실행 검증은 [claude-readonly.md](claude-readonly.md)에 기록한다.

## 2026-10-08 문서·자동화 정리 (PR #62)

- PR #62 병합 `1b3b027`(head `b09ac71`). PR CI `37720540457`, push CI `37720536646` success.
- 버전: `package.json` `0.1.0`(당시). tag·GitHub Release는 이 시점엔 미발행이었다(현재 v0.1.0·v0.1.1 발행 완료). `scripts/version.py`는 쓰기 작업을 하지 않는다.
- 검증 수치: TS 136 tests, BDD 25 시나리오/144 step, Python 19 tests PASS.
- 기록: 초기 README 이미지는 중세 유럽 기사 갑옷으로 교체 완료.

## 2026-10-08 0.1.1 이동과 #3 close (사용자 결정)

- 새 milestone 0.1.1(#3)을 만들고 #13–#17·#29를 0.1.0에서 이동했다(이슈마다 사유 댓글).
- #3은 샘플 red→green 실측 댓글 후 close했다.
- PR #63 병합·PR CI 통과 후 v0.1.0 tag·Release를 발행하고 0.1.0 milestone을 close했다.
- #58·#56은 Wiki 게시·검증 후 root가 직접 close했다.

## 2026-10-08 v0.1.0 발행·Wiki 게시·마일스톤 close (root 조치)

- PR #63 merge commit `6a6802a`(main). PR head `e6ffd2e`,
- [PR CI](https://github.com/qus0in/yoroi/actions/runs/37725084420) success(main 트리 동일, ci.yml main push 트리거 없음).
- [v0.1.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.0) 발행(target `6a6802a`).
- Wiki 원격 master `a181ccb` 게시, 새 clone으로 6페이지 main 소스와 동일 확인.
- #58·#56 close, 0.1.0 milestone close(31 closed, open 0).
- 0.1.1 milestone에 #13–#17·#29 open.
- 0.2.0 준비 설계 문서는 로컬 브랜치 `next-0.2.0` worktree
- (`/Users/young-mini/Workspace/yoroi-0.2.0`)의 `docs/v0.2.0/`에 있고 아직 커밋 전.

## 2026-10-08 0.1.1 발행 완료 (root 조치)

- 버전: `package.json` `0.1.1`. [v0.1.1 Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.1)
  발행(target: PR #65 머지 커밋 `7470250`).
- 머지 후 검증: main에 push CI 트리거가 없어 workflow_dispatch로
  [run 37735089637](https://github.com/qus0in/yoroi/actions/runs/37735089637) 실행 success.
- 포함 변경 `v0.1.0..7470250`: PR #64 표시 개선(`4b16213`·`5d6a5de`·`1ad5240`·`cd82c9a`),
  `f8ba205` 계약 대조·fixture 보강(#13–#17), `94e06fa` 버전 증가·릴리스 준비 기록.
- 이슈: #15·#16·#17 closed. #13(429 rate limit·Retry-After 미실측)·#14(balance fallback 미실측)·
  #29(`hold`) open 유지.
- milestone #3(0.1.1) close: open 3(#13·#14·#29)·closed 4. close 시점에는 open 이슈를 옮기지 않았고, 이후 사용자 결정으로 [0.1.2](https://github.com/qus0in/yoroi/milestone/4)로 이동했다.

## 2026-10-08 0.1.2 준비 (버전 증가, 미발행)

- 버전 `0.1.2`(사용자 결정 2026-10-08). dev → main PR 예정이며 tag·Release는 미발행(별도 승인).
- 포함 변경 `v0.1.1..origin/dev`: 전역 설치·.env 복사(418812b·7c5fc18), 정렬 m→w→h·agy 주간 exp(79fe08b), credits:purchased 숨김(1979c08), under/optimal/over(0883ccb·3a9daa4), Status 열 이동(86fe5a6), #31 이벤트 계약 착수(3925460).
- milestone 0.1.2의 #13·#14·#29는 이번 PR로 닫지 않고 open 유지한다.
