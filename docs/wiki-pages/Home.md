Welcome to the yoroi wiki!

# Yoroi

![Yoroi 마스코트](https://github.com/qus0in/yoroi/blob/main/docs/assets/yoroi-haunted-armor.jpg?raw=1)

Yoroi는 다섯 공급자의 사용량을 한 번 조회하거나 주기적으로 표시하는 로컬 CLI입니다.

- 현재 버전: `0.1.0` (아직 공개 Release 없음)
- 기본 공급자: Ollama Pro, OpenCode Go, Codex, AGY, Claude
- 공급자별 조회 실패는 분리하며 다른 공급자 조회를 계속합니다.
- 사용량 이력 데이터베이스나 웹 UI는 현재 범위에 포함되지 않습니다.

## 시작

1. [시작하기](Getting-Started)에서 Node/pnpm과 실행 방법을 확인합니다.
2. [공급자와 인증](Providers-and-Authentication)에서 필요한 인증 경로를 설정합니다.
3. [워커 운영](Worker-Operations)에서 `once`와 `watch` 동작을 확인합니다.
4. [체크와 문제 해결](Checks-and-Troubleshooting)에서 검증·오류 대응을 확인합니다.

## 데이터와 보안

- 인증 정보는 실행 호스트의 환경 또는 공급자별 기존 인증 저장소를 사용합니다.
- 개인 사용량 원문·토큰은 Wiki, 로그, 이슈에 기록하지 않습니다.
- Claude OAuth 조회는 내부 경로를 사용하며 공개·장기 호환 API 계약이 아닙니다.

## 자세한 계약

- [개발 및 검증](https://github.com/qus0in/yoroi/blob/main/docs/development.md)
- [GitHub 운영](https://github.com/qus0in/yoroi/blob/main/docs/github.md)
- [공급자 계약 문서](https://github.com/qus0in/yoroi/tree/main/docs)
