# Yoroi
> AI 사용량 모니터링

![작은 유령이 깃든 귀여운 중세 유럽 기사 갑옷](docs/assets/yoroi-haunted-armor.jpg)

## 전역 CLI 설치와 실행

어디서든 `yoroi` 명령을 호출하려면 전역 설치합니다. `install:global`이 빌드·전역 설치·`.env` 복사를 한 번에 수행합니다.

```bash
pnpm run install:global
yoroi --version
yoroi --help
yoroi once --pretty
yoroi watch --pretty
```

설치는 pnpm pack tarball로 레포와 독립된 사본을 만듭니다(디렉터리 직접 설치는 심볼릭 링크라 쓰지 않습니다).

## 전역 실행과 `.env`

- `pnpm run install:global`은 레포를 pnpm pack으로 묶어 레포와 독립된 사본으로 전역 설치하고, 설치 위치 루트에 레포 `.env`를 권한 600으로 복사합니다. `.env`가 없으면 조용히 건너뛰고, 재실행하면 재설치와 함께 복사본을 갱신합니다.
- 레포 `.env`를 바꾼 뒤에는 `pnpm run install:global`을 다시 실행해야 사본이 갱신됩니다.
- 실행 시 현재 작업 디렉터리의 `.env`를 먼저, 없으면 설치 위치의 복사본을 읽습니다. 기존 환경 변수는 덮어쓰지 않습니다.
- `YOROI_DEBUG=1`이면 읽은 `.env` 경로만 보여주고 값은 출력하지 않습니다.
- 제거는 `pnpm remove -g yoroi`이며, 설치 사본과 복사본 `.env`도 함께 삭제됩니다(실측). `.env`는 Git 커밋과 npm 패키지(`files`)에 포함되지 않습니다.
