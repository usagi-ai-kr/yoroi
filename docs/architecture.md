# CLI MVP 아키텍처 (#1)

- 목표: `once` 단발 조회와 `watch` 즉시 조회 후 기본 60초 반복 조회.
- 대상: Ollama Pro(비공식 서명 API)·OpenCode Go(공식 API), Codex·AGY(로컬 CLI),
  Claude(내부 OAuth 사용량 GET). Claude 자동 수집은 CLI·모델 요청을 실행하지 않으며 macOS Keychain은 읽기 전용으로만 조회한다.
- 웹 UI·DB/히스토리 저장·알림은 MVP 후속 범위다.

## 계층과 의존 방향

| 위치 | 책임 | 허용 의존 |
| --- | --- | --- |
| `src/domain` | 공급자·사용량 창·관측 시각·불변조건 | 표준 언어 기능만 |
| `src/app` | UsageSource 포트·오류·단발/반복 수집 | domain 및 app |
| `src/infra` | HTTP·프로세스·scheduler·공급자 변환 | app/domain 및 런타임 |
| `src/ui/cli` | 명령·렌더링·signal 처리 | app/domain |
| `src/composition-root.ts`, `src/composition/` | 설정 해석·구체 구현 조립 | 모든 계층 |
| `src/main.ts` | 실행 진입 | composition root |

- ui/app/domain은 infra 구현을 import하지 않는다.
- 향후 웹 UI도 같은 app/domain 포트를 사용하며 별도 composition root에서 조립한다.
- 외부 조회와 스크립트 실행은 서버/호스트 측 수집 경계에서 수행한다.
  브라우저가 CLI를 실행하거나 인증 키를 받는 구조는 사용하지 않는다.
- 공급자 실패는 공급자별 오류로 격리한다. 원본 stderr·헤더·credential은 UI에 전달하지 않는다.
- 테스트는 외부 HTTP/process/clock 대신 fake를 주입한다.
- 계약이 확인되지 않은 공급자는 수치를 추정하지 않고 제약을 표시한다.

## 구현 순서

1. #1 설계 → #2–3 실행·검증 기반 → #4–5 domain/source 포트.
2. #6–12 process·설정·수집·watch·CLI·HTTP 경계.
3. #13–17 조회 계약 확인 → #18–22 어댑터. 비공식 경로는 사용자 허가와 근거를 기록한다.
4. #23 조립 → #24 BDD → #25 실제 검증 결과 기반 문서 동기화.
