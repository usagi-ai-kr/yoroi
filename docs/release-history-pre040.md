# 0.1.0 준비 상태 (2026-10-08)

- 버전 원본: `package.json`, private 유지. v0.1.0 발행 시점 `0.1.0`, 현재 `0.3.1`(v0.1.0·v0.1.1·v0.1.2·v0.2.0·v0.3.0 발행 완료, 0.3.1 준비).
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

- [#26 Ollama](https://github.com/qus0in/yoroi/issues/26): 사용자 서명 키 연결 확인, usage 집계·balance 파서 추가(7개 창 확인).
- [#27 OpenCode](https://github.com/qus0in/yoroi/issues/27): .env 설정으로 API 조회·rolling/weekly/monthly 3개 창 파싱 성공.
- Codex/AGY/Claude 실제 조회 성공. 개인 키·수치·응답 원문 미기록(합성 fixture 사용).

## pnpm 전환

- Node 24.13.1, `packageManager: pnpm@12.10.1` 고정. npm lock을 pnpm-lock.yaml로 변환.
- pnpm-workspace.yaml에 strict 설정과 esbuild 빌드 허용 기록, Node/Corepack shim 경로 우선 검증.
- [설치 지침](https://pnpm.io/installation)과 [공식 CI action](https://github.com/pnpm/setup) 확인.
- 최종 검증(freeze 당시): 단위·통합 128개, BDD 25 시나리오/144 step, 레포 검사 129파일·3스킬 PASS.

## GitHub 조치

- main 보호 적용: PR·ci 필수, strict 최신 기준, 관리자 포함, force push·삭제 금지.
- #26·#27은 사용자 명시 승인 후 검증 결과 기록 후 close. milestone은 릴리스 커밋 검증 시점 완료.
- 최초 게시 커밋 [원격 CI](https://github.com/qus0in/yoroi/actions/runs/37709346179) 통과, workflow_dispatch 실행.
  적격 이벤트 workflow run 확인 원칙 수립(수동 체크 단독으로 PR 통과 판단 금지).

## 회고와 릴리스 기준

- 비공식 API 차이는 인증 후 필드·자료형만 확인하고 합성 fixture로 회귀 검증.
- 버전 파일 추가 없이 manifest·CLI 출력·milestone·tag를 같은 SemVer에 연결.
- 릴리스 시 타입·단위·BDD·빌드·레포 검사와 원격 CI 확인(발행 요청 시에만 tag/Release 연결).
- Ollama 영향은 해당 공급자에 한정. PR 리뷰 조치·완료 기준은 [pr-28-review.md](pr-28-review.md).
- Claude 자동 수집은 OAuth 사용량 GET으로 보강([claude-readonly.md](claude-readonly.md)).

## 2026-10-08 v0.1.0 발행 (PR #62·#63, root 조치)

- PR #62 병합 `1b3b027`, PR #63 merge commit `6a6802a`(main), PR CI `37725084420` success.
- [v0.1.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.0) 발행(target `6a6802a`), Wiki master `a181ccb` 게시.
- 0.1.0 milestone close(31 closed). 0.1.1 milestone(#3)에 #13–#17·#29 이동. #58·#56 close.

## 2026-10-08 0.1.1 발행 완료 (root 조치)

- 버전: `package.json` `0.1.1`. [v0.1.1 Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.1) 발행(target: PR #65 머지 커밋 `7470250`).
- 머지 후 검증: workflow_dispatch [run 37735089637](https://github.com/qus0in/yoroi/actions/runs/37735089637) success.
- 포함 변경: PR #64 표시 개선, `f8ba205` 계약 대조(#13–#17), `94e06fa` 버전 갱신.
- #15–#17 closed. #13·#14·#29 open 유지 후 0.1.2 milestone(#4)으로 이동. milestone #3 close.

## 2026-10-08 0.1.2 발행 완료 (root 조치)

- 버전: `package.json` `0.1.2`. PR #66 병합 `4dfd4d7`(main, 2026-10-08T10:35:35Z), head `68bce2f`
  (.env 병합 로드 포함). PR CI `37763214238` success.
- 머지 후 검증: workflow_dispatch [run 37764517117](https://github.com/qus0in/yoroi/actions/runs/37764517117) success.
- tag `v0.1.2` → `4dfd4d7`. [v0.1.2 Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.2) 발행.
- milestone 0.1.2(#4) close(open 3 #13·#14·#29 유지·이관 없음).
- 0.2.0(#2) 보류 유지(사용자 결정 2026-10-08, 0.1.x 마무리 우선, milestone #2·#30–#55 open 유지).

## 2026-10-08 PR #67 머지 및 main 검증 (서브커맨드 도움말·문서 정리)

- PR #67 MERGED, merge commit `62ef080`(main, 2026-10-08T13:16:52Z), head `3dadf92`.
- CI 검증: PR CI [run 37780797515](https://github.com/qus0in/yoroi/actions/runs/37780797515) success, main workflow_dispatch CI [run 37783139920](https://github.com/qus0in/yoroi/actions/runs/37783139920) success.
- 포함 커밋: `ff3371c`(서브커맨드 도움말 `once/watch --help`·`-h`), `3dadf92`(문서 정리·global-install.md 분리).
- 당시 상태 요약: 0.1.x 마무리 완료·0.2.0 보류. 미완 #13·#14·#29 open 유지, milestone #2·#30–#55 open 유지(이후 2026-10-10 정리).
- 다음 후보: PR #67 변경을 담을 0.1.3 tag·Release 필요 여부는 사용자 결정.
  (주의: opencode worker는 무료 모델 소진 시 오래된 패킷을 재실행할 수 있어 주의 필요).

## 2026-10-10 0.2.0 PR 준비 (미발행)

- 버전: `package.json` `0.2.0`(`scripts/version.py --bump minor --apply`). 커밋·tag·Release는 아직 없다.
- milestone 표기(2026-10-10 사용자 결정): #6 `0.3.0`([#71](https://github.com/qus0in/yoroi/issues/71)), #7 `0.4.0`([#70](https://github.com/qus0in/yoroi/issues/70), 2026-10-11 재번호로 `0.5.0`),
  #8 `0.2.1`([#77](https://github.com/qus0in/yoroi/issues/77), 2026-10-11에 `0.3.1`로 변경). [#72](https://github.com/qus0in/yoroi/issues/72)는 이 PR에서 close 예정(아직 아님).
- 범위: [#72](https://github.com/qus0in/yoroi/issues/72)–[#76](https://github.com/qus0in/yoroi/issues/76) OpenCode Zen Free 락(전역 error 훅 → yoroi SQLite, `zen-free` CLI·`once` 상태 표시).
  [#70](https://github.com/qus0in/yoroi/issues/70) 인사이트 레터·[#71](https://github.com/qus0in/yoroi/issues/71) 캐시·이력 문서 초안은 이번 PR에서 제외한다.
- 검증(worker 보고): `pnpm run check` 254 tests·BDD 32 통과. p2 리뷰 결함 15건+교차 리뷰 결함 2건 수정.
- 미실행: 실제 OpenCode 로드, 한도 초과 이벤트 실측, 전역 설치(`~/.config/opencode/plugins/`). 0.3.1에서 검증한다
  — [#77](https://github.com/qus0in/yoroi/issues/77)이 로드 표시 패치, 실관측은 [#88](https://github.com/qus0in/yoroi/issues/88)로 분리(2026-10-11).
- 다음: 사용자 발행 요청 시 dev → main PR → CI → tag·Release 순서(versioning.md §릴리스 순서)를 따른다.

## 2026-10-11 0.3.0 발행 완료 (SQLite 캐시·관측 이력)

- 버전: `package.json` `0.3.0`. PR #85 병합 `ae4538e`(2026-10-10T13:16:21Z), PR #86 병합 `f12f55a`(main, 2026-10-11T00:36:55Z). 두 PR의 PR CI는 success다.
- tag `v0.3.0` → `f12f55a`. [v0.3.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.3.0) 게시(2026-10-11T01:36:52Z).
- 머지 후 검증: workflow_dispatch [run 38102185775](https://github.com/qus0in/yoroi/actions/runs/38102185775) success(head `f12f55a`).
- 포함: 60초 SQLite 캐시·관측 이력·Δ 표시([#71](https://github.com/qus0in/yoroi/issues/71)), watch 제거([#83](https://github.com/qus0in/yoroi/issues/83)), 계정 범위 격리·Keychain 인증 우선 캐시 키.
- 도구 결정 [#82](https://github.com/qus0in/yoroi/issues/82) (a): Keyv 대신 `node:sqlite` 자체 캐시. in-flight 병합은 watch 제거로 해당 없음.
- 사후 감사(2026-10-11): #71 수용 기준 7개 중 6개 충족, 이력 보존 정책 문서화만 미충족이었고 이 문서 보완으로 기록했다.
  #71·#83·milestone 0.3.0 close는 별도 조치다(이 기록 시점에 open).

## 2026-10-11 0.3.1 준비 (Zen Free 로드 표시)

- 버전: `package.json` `0.3.1`. main은 이미 v0.3.0(`f12f55a`)이므로 다음 patch를 0.3.1로 정했다.
- milestone #8을 `0.2.1` → `0.3.1`로 이름 변경(2026-10-11 사용자 결정). [#77](https://github.com/qus0in/yoroi/issues/77)은 로드 표시 패치,
  자연 발생 실관측은 [#88](https://github.com/qus0in/yoroi/issues/88)로 분리했다(둘 다 open). 커밋·tag·Release는 아직 없다.
- 다음: dev → main PR → CI → tag·Release 순서(versioning.md §릴리스 순서). 남은 정리: #77 제목이 `0.2.0`으로 남아 있고 #88은 milestone 미지정이다.
