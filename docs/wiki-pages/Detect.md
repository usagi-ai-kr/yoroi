# yoroi detect (내장 10분 감지)

`yoroi detect`는 yoroi 안에서 10분마다 도는 감지기입니다. 이벤트가 있을 때만 stdout에 한 줄씩 알리고, 외부 cron이나 다른 서비스에 의존하지 않습니다.
`yoroi watch`는 여전히 제거되어 있으며(`yoroi watch`는 오류 코드 2) 이 기능은 감지 목적에만 반복 실행을 허용합니다.

## 실행

```bash
yoroi detect             # 포그라운드 루프(Ctrl+C·SIGTERM으로 정상 종료)
yoroi detect --once      # 한 사이클만 실행
yoroi detect --json      # 이벤트를 JSON 한 줄씩 출력
yoroi detect status      # 마지막 하트비트와 실행 여부
```

- 알림은 stdout 한 줄씩이고 진단은 stderr에 코드로만 나옵니다. 경로·인증값은 출력하지 않습니다.
- 스스로 데몬이 되지 않습니다. 계속 켜 두려면 pm2 같은 프로세스 관리자를 사용합니다. 예시 설정은 저장소의 `integrations/pm2/yoroi-detect.config.cjs`이며 직접 등록해야 합니다.

## 무엇을 감지하나

- OpenCode Zen 무료 한도: 초과·해제 기록, 재시도 시각 경과, 플러그인 로드 정체
- 공급자 사용량: 한도 소진·해제, 급증, 샘플 정체

감지 사이클은 10분마다 돌지만 공급자 API 호출은 15~30분 예산을 지킵니다. 예산 안에서는 이미 저장된 최근 샘플을 재사용하고, 429 등이 오면 쿨다운합니다.
이 기능은 한도를 유발하지 않으며 자연 발생한 이벤트만 알립니다.

## 상태 확인

- `running`: 감지기가 살아 있음(마지막 하트비트가 20분 이내)
- `stopped`: 하트비트가 20분 넘게 없음. 프로세스 관리자 로그를 확인합니다.
- `no active detector`: 기록이 없거나 정상 종료했음

자세한 운영 방법은 [저장소 문서 detect.md](https://github.com/qus0in/yoroi/blob/main/docs/detect.md)를 참고하세요.
