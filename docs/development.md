# 개발과 검증

Yoroi는 AI 사용량 모니터링 프로젝트다. 기술 스택· 수집 방식·실행 명령은 아직 미정이다.
빌드 도구는 구현을 시작할 때 결정하고 명령을 이 문서에 추가한다.

## 기본 검증

필요 도구: Git, Python 3, Bash, macOS/Linux 기본 유틸리티.

```bash
python3 scripts/validate-repo.py
bash .agents/skills/skill-authoring/scripts/validate.sh .agents/skills/github-workflow 100
```

- 추적 파일과 ignore되지 않은 신규 파일을 검사한다. staging은 필요 없다.
- Git 초기화 전에는 임시 Git 디렉터리로 파일 목록만 조회하며 저장소를 변경하지 않는다.
- 스킬 필수 필드·이름·상대 링크, 전체 파일 줄 수·심볼릭 링크를 검증한다.
- CI는 문서·스킬 변경에도 같은 검증을 실행한다. 앱 빌드·테스트는 아직 없다.
- 빌드·테스트가 생기면 `.github/workflows/ci.yml`의 `ci` job에 추가한다.
- 외부 패키지 설치나 네트워크 접속 없이 검증할 수 있다.

## 파일 크기 예외

- 잠금 파일: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `uv.lock`,
  `poetry.lock`, `Cargo.lock`, `Gemfile.lock`, `go.sum`.
- 생성된 Gradle wrapper: `gradlew`, `gradlew.bat`.
- 바이너리는 줄 수 검사에서 제외한다.
- 예외 추가 시 이 문서와 검증 스크립트를 함께 갱신한다.
