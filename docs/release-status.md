# 0.1.0 준비 상태 (2026-10-08)

- 버전 원본: `package.json` version `0.1.0`, private 유지.
- 원격 목표: [0.1.0 milestone](https://github.com/qus0in/yoroi/milestone/1), #1–#12·#18–#28·#56–#61 연결.
  #13–#17·#29는 [0.1.1 milestone](https://github.com/qus0in/yoroi/milestone/3)으로 이동했다.
- 범위: 5개 공급자 once/watch CLI, pnpm 실행·빌드·CI, 실계정 인증 검증.
- CLI `--version`은 package.json을 읽는다. 빌드도 같은 JSON을 산출물에 포함한다.
- tag·Release는 미발행이다. PR #63 병합·main CI 통과 시 v0.1.0 tag·Release 발행과 0.1.0 close 예정이다(사용자 결정).
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
- 버전 파일을 추가하지 않고 manifest·CLI 출력·milestone·예정 tag를 같은 SemVer에 연결한다.
- 릴리스 시 해당 커밋의 타입·단위·BDD·빌드·레포 검사와 원격 CI를 확인한다.
  발행 요청 시에만 검증된 커밋에 tag와 Release를 연결한다.
- Ollama 인증/포맷 변경·네트워크·응답 크기 초과에서 다른 공급자의 결과가 유지되는지 검사한다.
  비공식 API의 영향은 해당 공급자에 한정하고 누락 수치를 생성하지 않는다.
- PR 리뷰 조치와 완료 기준은 [pr-28-review.md](pr-28-review.md)에 기록한다.
- Claude 자동 수집은 CLI print 경로를 제거하고 OAuth 사용량 GET으로 보강했다.
  최신 인증·조회 계약과 실행 검증은 [claude-readonly.md](claude-readonly.md)에 기록한다.

## 2026-10-08 문서·자동화 정리 (PR #62)

- PR #62 병합 `1b3b027`(head `b09ac71`). PR CI `37720540457`, push CI `37720536646` success.
- 버전: `package.json` 0.1.0 유지. tag·GitHub Release 미발행. `scripts/version.py`는 쓰기 작업을 하지 않는다.
- 검증 수치: TS 136 tests, BDD 25 시나리오/144 step, Python 19 tests PASS.
- 기록: 초기 README 이미지는 중세 유럽 기사 갑옷으로 교체 완료.

## 2026-10-08 0.1.1 이동과 #3 close (사용자 결정)

- 새 milestone 0.1.1(#3)을 만들고 #13–#17·#29를 0.1.0에서 이동했다(이슈마다 사유 댓글).
- #3은 샘플 red→green 실측 댓글 후 close했다.
- PR #63 병합·main CI 통과 시 v0.1.0 tag·Release 발행과 0.1.0 milestone close를 결정했다(아직 미발행).
- #58·#56은 병합 뒤 Wiki 게시·검증 후 root가 직접 close 예정이다.
