Welcome to the yoroi wiki!

# Yoroi

![Yoroi 마스코트](https://github.com/qus0in/yoroi/blob/main/docs/assets/yoroi-haunted-armor.jpg?raw=1)

Yoroi는 AI 사용량을 모니터링하고 인사이트 레터를 만드는 로컬 CLI입니다. 여섯 공급자의 사용량을 한 번 조회하고, 일일 추천 레터를 발행할 수 있습니다.

- 기본 공급자: Ollama Pro, OpenCode Go, Codex, AGY, Claude, xAI
- 공급자별 조회 실패는 분리하며 다른 공급자 조회를 계속합니다.
- 반복 실행용 `watch` 명령은 제거됐습니다. 주기 실행은 외부 스케줄러로 `yoroi once`를 호출합니다.
- 주요 흐름: `once`(조회) · `trend`(변화 추이) · `insights`(AI 인사이트 레터) · `detect`(10분 감지).

## 시작

전역 설치 후 어디서든 다음 명령을 실행합니다.

```bash
yoroi --help
yoroi once --pretty
yoroi zen-free status
```

1. [시작하기](Getting-Started)에서 Node/pnpm과 실행 방법을 확인합니다.
2. [공급자와 인증](Providers-and-Authentication)에서 필요한 인증 경로를 설정합니다.
3. [사용량 캐시와 Zen Free](Usage-Cache-and-Zen-Free)에서 캐시·변화량과 로컬 Zen 상태를 확인합니다.
4. [인사이트 레터](Insights-Letter)에서 일일 추천과 발행 흐름을 확인합니다.
5. [체크와 문제 해결](Checks-and-Troubleshooting)에서 검증·오류 대응을 확인합니다.

## 데이터와 보안

- 인증 정보는 실행 호스트의 환경 또는 공급자별 기존 인증 저장소를 사용합니다.
- 개인 사용량 원문·토큰은 Wiki, 로그, 이슈에 기록하지 않습니다.
- Claude OAuth 조회는 내부 경로를 사용하며 공개·장기 호환 API 계약이 아닙니다.

## 자세한 계약

- [개발 및 검증](https://github.com/qus0in/yoroi/blob/main/docs/development.md)
- [GitHub 운영](https://github.com/qus0in/yoroi/blob/main/docs/github.md)
- [공급자 계약 문서](https://github.com/qus0in/yoroi/tree/main/docs)
