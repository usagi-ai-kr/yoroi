# 워커 운영

## 단발 조회

```bash
pnpm run dev once
```

단발 실행은 선택된 공급자를 한 번 조회합니다. 일부 공급자만 실패하면 성공 결과를 함께 반환하며, 실패 공급자는 별도 오류로 표시됩니다.

## 주기 조회

```bash
pnpm run dev watch
pnpm run dev watch --interval 30
```

- `watch`는 시작 직후 한 번 조회합니다.
- 기본 대기는 **각 수집이 완료된 뒤 60초**입니다. 따라서 시작 간격은 조회 시간+60초이며 요청이 겹치지 않습니다.
- `--interval`은 초 단위 대기 시간을 바꿉니다. 환경 변수 `YOROI_INTERVAL_SECONDS`의 기본값도 60초입니다.
- 한 주기에서 일부 공급자가 실패해도 다음 주기는 계속됩니다.

## Pretty 출력 선택

pretty 표 출력은 once와 watch에서 선택할 수 있습니다.

```bash
pnpm --silent run dev once --pretty
pnpm --silent run dev watch --pretty
pnpm --silent run dev watch --interval 30 --pretty
```

표는 `Provider`, `Window`, `Usage`, `Reset (KST)`, `Status` 열을 사용합니다. `Reset (KST)` 값은 시각 뒤에 남은 시간을 `(6d 18h)`처럼 덧붙이고, reset 시각이 없으면 `-`입니다. 없는 값은 `-`, 오류는 `Status`에 표시합니다. 표 렌더링에는 `cli-table3` 0.6.5와 `picocolors` 1.1.1을 사용합니다.

`--pretty`가 없으면 각 window 줄에 `reset_in=6d18h`처럼 관측 시각 기준 남은 시간을 표시합니다. 큰 단위 두 개로 표시하며 1시간 미만은 분만, 이미 지난 reset은 `0m`입니다. 숫자 metric(`percent`, `used`, `limit`, `remaining`)은 plain·pretty 출력에서만 소수점 둘째 자리까지 올림하고 원본 값은 바꾸지 않습니다.

공급자마다 월간이 있으면 월간, 없으면 주간 창 하나(가장 긴 창)에 예상 균등 사용량 비율을 표시합니다. 계산은 `(창 길이 - 남은 시간) / 창 길이 × 100`(주간 7일, 월간은 리셋 한 달 전부터)이며 소수점 둘째 자리까지 올림합니다. pretty 출력은 `Usage` 열 뒤에 `(exp 42.86%)`처럼 덧붙이고, plain 출력은 해당 창 줄에 `expected=42.86`으로 표시합니다.

ollama-pro는 plain·pretty 모두 `monthly`·`credits:included`(월간 인정)·`credits:purchased`만 표시하고, `activity:*`·`session`·`weekly`는 숨깁니다. 표시 대상이 없으면 전체를 보여주고, 헤더 `windows=`는 표시된 창 수입니다. 수집 데이터는 바뀌지 않습니다.

창 표기는 길이가 확정된 것만 `5h`·`w`·`m`으로 줄이고(그 외 내부 id 그대로), 같은 표기가 겹칠 때만 `g-5h`처럼 접두어를 붙입니다. 계산에는 내부 id를 그대로 씁니다.

## 중지와 데이터

- Ctrl+C 또는 SIGTERM은 진행 중 수집을 취소하고 자식 프로세스와 timer를 정리합니다.
- CLI는 사용량 이력을 DB에 저장하지 않습니다. 결과는 현재 실행의 표준 출력에만 표시합니다.
- 오류를 공유할 때는 공급자 상태 코드만 사용하고 인증값·응답 원문은 포함하지 마세요.

## 프로필 운영

서비스나 서버에서 실행할 때도 설치된 공급자 CLI와 인증 저장소는 Yoroi 실행 계정 기준입니다. 대화형 로그인이 필요한 경우 별도 터미널에서 해당 공급자 절차를 완료한 뒤 `once`로 확인합니다.

## 워커 협업 패킷과 보고 감사

`agent-coordination` skill은 파일 소유권·완료 기준·10분 이내 작업 단위를 지정하고 결과 보고를 검사합니다.

```bash
python3 .agents/skills/agent-coordination/scripts/task_packet.py create "task-1" "pane-id" "src/example.ts" "typecheck passes" > /tmp/task_packet.json
python3 .agents/skills/agent-coordination/scripts/task_packet.py validate /tmp/task_packet.json
python3 .agents/skills/agent-coordination/scripts/report_audit.py /tmp/task_packet.json /tmp/report.json
python3 .agents/skills/agent-coordination/scripts/test_coordination.py
```

- 패킷은 소유 파일·완료 기준을 필수로 하며 timeout은 1–10분입니다. secret-pattern 검사를 통과하지 못하면 거부합니다.
- `report_audit.py`는 수정 파일 자기보고, 검증 결과, provenance, secret-pattern을 확인합니다. 실제 Git diff와 대조하지는 않습니다.
- 작업·보고 JSON에는 credential이나 개인 사용량을 넣지 않습니다. Skill 상세는 [agent-coordination](https://github.com/qus0in/yoroi/blob/main/.agents/skills/agent-coordination/SKILL.md)을 참고합니다.
