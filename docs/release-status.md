# 0.1.0 준비 상태 (2026-10-08)

- 버전 원본: `package.json` version `0.1.0`, private 유지.
- 원격 목표: [0.1.0 milestone](https://github.com/qus0in/yoroi/milestone/1), #1–27 연결.
- 범위: 5개 공급자 once/watch CLI, pnpm 실행·빌드·CI, 실계정 인증 검증.
- CLI `--version`은 package.json을 읽는다. 빌드도 같은 JSON을 산출물에 포함한다.
- tag·Release는 발행하지 않았다. 변경은 `dev → main` PR로 게시하며 해당 PR의 CI를 확인한다.

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
- 검증: pnpm check 75개 테스트·BDD 16시나리오/87step·타입·빌드 통과,
  레포 검사 106파일·3스킬 통과. pnpm dev 실제 API 조회와 빌드 `--version`도 확인했다.

## GitHub 조치

- main 보호 적용: PR·ci 필수, strict 최신 기준, 관리자 포함, force push·삭제 금지.
- #26·#27은 실제 조회 검증 완료지만 이슈 본문/hold/종료 변경은 자동 승인 검토에서 거부됐다.
  확인 요청을 이슈 상태 변경 허가로 볼 수 없다는 사유여서 원격 상태를 유지했다.
- 완료 기록은 PR에도 포함한다. milestone은 실제 릴리스 커밋 검증과 통합 시점에 맞춰 완료한다.

## 회고와 릴리스 기준

- 비공식 API의 참조 구현과 실제 응답은 다를 수 있다. 인증 후 필드·자료형만 확인하고
  실제 구조의 합성 fixture로 회귀 검증한다. 없는 quota·reset은 추정하지 않는다.
- 버전 파일을 추가하지 않고 manifest·CLI 출력·milestone·예정 tag를 같은 SemVer에 연결한다.
- 릴리스 시 해당 커밋의 타입·단위·BDD·빌드·레포 검사와 원격 CI를 확인한다.
  발행 요청 시에만 검증된 커밋에 tag와 Release를 연결한다.
