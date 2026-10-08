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

종료 코드는 `0`(성공·부분 성공), `1`(선택 공급자 전체 실패), `2`(인자·설정 오류)입니다. 자세한 대응은 [체크와 문제 해결](https://github.com/qus0in/yoroi/blob/main/docs/wiki-pages/Checks-and-Troubleshooting.md)을 참고합니다.

## 도움말

```bash
yoroi --help
yoroi -h
yoroi once --help
yoroi watch --help
```

- 최상위 도움말(`yoroi --help`·`yoroi -h`): 전체 사용법·옵션·예시를 stdout으로 출력하고 종료 코드 0으로 끝납니다.
- 서브커맨드 도움말(`once --help`·`once -h`·`watch --help`·`watch -h`): 해당 명령의 옵션과 사용법을 stdout으로 출력하고 종료 코드 0으로 끝납니다(다른 옵션과 함께 지정해도 help 우선).
- 알 수 없는 커맨드나 잘못된 인자·플래그(예: `once --bogus`): 종료 코드 2와 사용법이 stderr로 출력됩니다.

## 전역 실행과 `.env`

- `pnpm run install:global`은 레포를 pnpm pack으로 묶어 레포와 독립된 사본으로 전역 설치하고, 설치 위치 루트에 레포 `.env`를 권한 600으로 복사합니다. `.env`가 없으면 조용히 건너뛰고, 재실행하면 재설치와 함께 복사본을 갱신합니다.
- 레포 `.env`를 바꾼 뒤에는 `pnpm run install:global`을 다시 실행해야 사본이 갱신됩니다.
- 실행 시 현재 작업 디렉터리의 `.env`와 설치 위치의 복사본을 모두 읽어 키 단위로 병합합니다. 적용 순서는 실제 환경 변수 > cwd `.env` > 설치 사본이며, cwd `.env`가 설치 사본을 통째로 대체하지 않습니다. 둘 다 없으면 조용히 건너뛰고, 존재하는 `.env`의 로드 실패는 종료 코드 2로 멈춥니다(경로·오류 코드만 표시).
- `YOROI_DEBUG=1`이면 파일별 경로와 적용된 키 이름만 보여주고 값은 출력하지 않습니다.
- 변수 목록은 [.env.example](.env.example)에 정리했습니다(값 없음).
- 제거는 `pnpm remove -g yoroi`이며, 설치 사본과 복사본 `.env`도 함께 삭제됩니다(실측). `.env`는 Git 커밋과 npm 패키지(`files`)에 포함되지 않습니다.
