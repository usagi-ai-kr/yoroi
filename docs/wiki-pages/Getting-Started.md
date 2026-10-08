# 시작하기

## 요구 사항

- Node.js `24.13.1`
- pnpm `12.10.1` (`package.json`의 `packageManager` 기준)
- 필요한 공급자 CLI 설치와 해당 실행 계정의 인증

## 설치와 실행

레포를 받은 뒤 고정된 lockfile로 설치하고 도움말을 확인합니다.

```bash
pnpm install --frozen-lockfile
pnpm run dev --help
pnpm run dev once
pnpm run dev watch
```

개발 실행은 Node의 `--env-file-if-exists=.env`를 사용합니다. 이미 셸이나 서비스에 설정된 환경 변수가 `.env`보다 우선합니다. `.env`는 로컬 전용이며 Git에 추가하지 마세요.

## 공급자 선택

기본값은 다섯 공급자 전체입니다. 일부만 조회하려면 `YOROI_PROVIDERS`에 쉼표로 ID를 지정합니다.

```text
ollama-pro,opencode-go,codex,agy,claude
```

필요한 공급자 ID는 `ollama-pro`, `opencode-go`, `codex`, `agy`, `claude`입니다. 중복되거나 지원하지 않는 ID는 설정 오류입니다.

## 전역 CLI 설치와 제거

어디서든 `yoroi` 명령을 호출하려면 저장소 경로로 전역 설치합니다.

```bash
pnpm run build
pnpm add -g .
yoroi --version
yoroi --help
yoroi once --pretty
yoroi watch --pretty
```

전역 설치를 제거할 때는 다음 명령을 실행합니다.

```bash
pnpm remove -g yoroi
```

## 다음 단계

- 인증 환경 변수 이름과 프로필 선택은 [공급자와 인증](Providers-and-Authentication)을 확인합니다.
- 60초 `watch` 동작과 종료 방법은 [워커 운영](Worker-Operations)을 확인합니다.
- 실행 결과의 사용량 상태(`under`·`optimal`·`over`·`n/a`) 표시도 [워커 운영](Worker-Operations)에 정리했습니다.
- 개발 검증 명령은 [체크와 문제 해결](Checks-and-Troubleshooting)을 확인합니다.
