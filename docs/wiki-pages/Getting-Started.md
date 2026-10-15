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
```

개발 실행은 Node의 `--env-file-if-exists=.env`를 사용합니다. 이미 셸이나 서비스에 설정된 환경 변수가 `.env`보다 우선합니다. `.env`는 로컬 전용이며 Git에 추가하지 마세요.

## 공급자 선택

기본값은 다섯 공급자 전체(`ollama-pro,opencode-go,codex,agy,claude`)입니다. xAI는 기본에서 제외되며 명시 opt-in해야 조회합니다. 일부만 조회하거나 xAI를 포함하려면 `YOROI_PROVIDERS`에 쉼표로 ID를 지정합니다.

```text
ollama-pro,opencode-go,codex,agy,claude
ollama-pro,opencode-go,codex,agy,claude,xai
```

지원 공급자 ID는 `ollama-pro`, `opencode-go`, `codex`, `agy`, `claude`, `xai`입니다. 중복되거나 지원하지 않는 ID는 설정 오류입니다.

## 전역 CLI 설치와 제거

어디서든 `yoroi` 명령을 호출하려면 전역 설치합니다. `install:global`이 빌드·전역 설치·`.env` 복사를 한 번에 수행합니다.

```bash
pnpm run install:global
yoroi --version
yoroi --help
yoroi once --pretty
yoroi once --pretty --full
```

전역 설치 후 `yo`(`yoroi once --pretty`), `yo2`(`yoroi once --pretty --full`) 별칭을 사용할 수 있습니다.

전역 설치를 제거할 때는 다음 명령을 실행합니다. 설치 사본과 복사본 `.env`도 함께 삭제됩니다(실측).

```bash
pnpm remove -g yoroi
```

버전 변경을 반영해 빌드·재설치하고 설치 버전을 검증할 때는 `pnpm run update:global`을 실행합니다. 읽기 전용 비교는 `pnpm run update:global --check`입니다.

## 전역 실행과 `.env`

- `pnpm run install:global`은 레포를 pnpm pack으로 묶어 레포와 독립된 사본으로 전역 설치하고(디렉터리 직접 설치는 심볼릭 링크라 쓰지 않음), 설치 위치 루트에 레포 `.env`를 권한 600으로 복사합니다. `.env`가 없으면 조용히 건너뛰고, 재실행하면 재설치와 함께 복사본을 갱신합니다.
- 레포 `.env`를 바꾼 뒤에는 `pnpm run install:global`을 다시 실행해야 사본이 갱신됩니다.
- 실행 시 현재 작업 디렉터리의 `.env`와 설치 위치의 복사본을 모두 읽어 키 단위로 병합합니다. 적용 순서는 실제 환경 변수 > cwd `.env` > 설치 사본이며, cwd `.env`가 설치 사본을 통째로 대체하지 않습니다. 둘 다 없으면 조용히 건너뛰고, 존재하는 `.env`의 로드 실패는 종료 코드 2로 멈춥니다(경로·오류 코드만 표시, 변수 목록은 [.env.example](https://github.com/qus0in/yoroi/blob/main/.env.example)).
- `YOROI_DEBUG=1`이면 읽은 `.env` 경로만 보여주고 값은 출력하지 않습니다.
- `.env`는 Git 커밋과 npm 패키지(`files`)에 포함되지 않습니다.

## 다음 단계

- 인증 환경 변수 이름과 프로필 선택은 [공급자와 인증](Providers-and-Authentication)을 확인합니다.
- 반복 실행용 `watch`는 제거됐습니다. 주기 실행이 필요하면 외부 스케줄러로 `yoroi once`를 호출합니다.
- 사용량 캐시·`--refresh`·`--pretty` 변화량과 Zen Free 상태는 [사용량 캐시와 Zen Free](Usage-Cache-and-Zen-Free)를 확인합니다.
- 개발 검증 명령은 [체크와 문제 해결](Checks-and-Troubleshooting)을 확인합니다.
