# 전역 설치와 .env 운영

어디서든 `yoroi` 명령을 호출하기 위한 전역 설치, 환경 변수(`.env`) 로드 규칙 및 검증 절차다.

## 설치·실행·제거

```bash
pnpm run install:global
yoroi --version
yoroi --help
yoroi once --pretty
pnpm remove -g yoroi
```

- 서브커맨드 도움말(`yoroi once --help`·`-h`)은 각 명령의 사용법과 옵션을 stdout에 출력하고 exit 0으로 종료한다(다른 플래그보다 우선). 제거된 `watch`는 실행 시 안내와 함께 exit 2다.

## 전역 .env 병합 규칙

- 전역 실행의 `.env` 로드는 cwd `.env`와 설치 위치 복사본을 모두 읽어 키 단위로 병합한다(실제 환경 변수 > cwd `.env` > 설치 사본). 둘 다 없으면 조용히 건너뛴다.
- `YOROI_DEBUG=1`이면 파일별 경로와 적용된 키 이름만 stderr에 표시한다(값 미출력).
- 존재하는 `.env`의 로드 실패는 `yoroi: env file load failed <경로> (<코드>)`만 남기고 종료 코드 2로 멈춘다.

## 레터 모델 목록 사용자 설정

- 전역 패키지에는 `config`가 없으므로 `YOROI_LETTER_MODEL_LISTS`(명시 경로) → `${XDG_CONFIG_HOME:-~/.config}/yoroi/letter-model-lists.json` → 레포 `config/letter-model-lists.json` → 기본값 순으로 존재하는 첫 파일을 읽는다.
- 예시(`~/.config/yoroi/letter-model-lists.json`, 밴만 지정): `{"ban": {"orchestrator": ["longcat-2-5"], "worker": []}}`. 적은 키는 목록 전체를 교체하므로 `allowOlder`·`excludePatterns`는 바꿀 때만 전체 목록으로 적는다.
- 파싱 실패 시 `[yoroi] letter-model-lists 파싱 실패: <path> — 기본값 사용` 한 줄을 stderr에 남기고 기본값을 쓴다.

## 전역 설치 동작 원리

- `install:global`은 pnpm pack tarball로 레포와 독립된 사본을 전역 설치한다(디렉터리 설치는 심볼릭 링크라 쓰지 않음).
- `scripts/copy-env.mjs`가 레포 `.env`를 0600 원자 생성·교체로 설치 위치에 복사한다(umask 무관·심볼릭 링크 미추종).
- 레포 `.env` 변경 후에는 `install:global`을 재실행해야 설치 위치 사본이 갱신된다.
- 제거(`pnpm remove -g yoroi`)는 사본과 복사본을 함께 삭제한다(실측).
- `package.json`의 `files`는 `dist`뿐이라 npm publish 대상에 `.env`는 없다.

## 전역 설치 검증 절차

`pnpm run install:global` 재실행(설치 경로만 확인) 뒤 두 케이스를 `YOROI_DEBUG=1 yoroi once --pretty`로 1회씩 확인한다.
1. 빈 `mktemp -d`: 설치 사본 줄 하나 출력.
2. 합성 `.env` 한 줄만 둔 디렉터리: cwd·설치 사본 줄 둘 출력, 설치 사본은 남은 키만 적용.

경로·키 이름·공급자 Status 첫 단어·종료 코드만 기록하고 값·수치는 남기지 않는다. 확인 뒤 임시 디렉터리를 지운다.

## 전역 CLI 갱신 절차 (버전 변경 후)

버전이 바뀐 변경이 main에 머지된 후 다음 절차를 수행한다.

```bash
pnpm run update:global
```

- `update:global`은 빌드 → 기존 `install:global` 재사용 → `yoroi --version`이 `package.json`과 같은지 확인하며,
  다르면 exit 1로 종료한다.
- 읽기 전용 비교는 `pnpm run update:global --check`를 사용한다. 같으면 0, 다르면 1, 미설치면 2다.
- 경고 옵션 `--strict`로 엄모드 사용 가능(경고를 오류로 취급).
- 버전 확인: `yoroi --version` 출력이 레포 `package.json` 버전과 일치해야 한다.
- 롤백: `pnpm remove -g yoroi` 후 `pnpm run install:global`로 재설치.
- `.env` 사본: 레포 `.env` 변경 시 `install:global` 재실행이 필요하며, `update:global`도 같은 경로를 재사용한다.
- origin 미연결 시 `update:global`은 원격 버전 비교 불가 경고를 출력하고 로컬 버전만 확인한다.
- 버전 문자열이 같아도 dirty 워킹트리의 1.1 effort가 전역 dist에 섞일 수 있다. 갱신은 검증된 clean SHA 트리에서 한다(1.0.0: `5111378cccf5f2436db0f1fae8c0715e76c94edb`).
- `pnpm add -g` 교체 후 기존 전역 `.env`가 사라질 수 있다. archive에 `.env`가 없어 `copyEnv`가 noop인 것만으로 보존을 단정하지 않는다.
- 설치 전 기존 전역 `.env`를 값·경로 출력 없이 0600 private 임시사본으로 보호하고, 설치 후 설치물 `.env` 부재와 백업 존재가 동시에 확인될 때만 원자 복원한 뒤 임시사본을 삭제한다.
