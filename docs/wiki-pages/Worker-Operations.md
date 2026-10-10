# 워커 운영

## 단발 조회

```bash
yoroi once
yoroi once --pretty
```

단발 실행은 선택된 공급자를 한 번 조회합니다. 일부 공급자만 실패하면 성공 결과를 함께 반환하며, 실패 공급자는 별도 오류로 표시됩니다.

## 주기 실행

`watch`는 0.3.0에서 제거됐습니다. 주기 실행이 필요하면 외부 스케줄러로 `yoroi once`를 실행합니다(마이그레이션).

## 도움말

```bash
yoroi --help
yoroi -h
```

도움말은 서브커맨드 없이 최상위에서만 처리되며 종료 코드는 0입니다. `once --help`처럼 서브커맨드 뒤에 붙이면 미지원 인자로 분류되어 종료 코드 2와 사용법이 stderr로 출력됩니다(실측).

## Pretty 출력 선택

pretty 표 출력은 once에서 선택할 수 있습니다.

```bash
yoroi once --pretty
```

표는 `Provider`, `Status`, `Window`, `Usage`, `Reset (KST)` 순서의 열을 사용합니다(Status 내용·각 열 폭은 이전과 같음). `Reset (KST)` 값은 시각 뒤에 남은 시간을 `(6d 18h)`처럼 덧붙이고, reset 시각이 없으면 `-`입니다. 없는 값은 `-`, 오류는 `Status`에 표시합니다. 표 렌더링에는 `cli-table3` 0.6.5와 `picocolors` 1.1.1을 사용합니다.

`--pretty`가 없으면 각 window 줄에 `reset_in=6d18h`처럼 관측 시각 기준 남은 시간을 표시합니다. 큰 단위 두 개로 표시하며 1시간 미만은 분만, 이미 지난 reset은 `0m`입니다. 숫자 metric(`percent`, `used`, `limit`, `remaining`)은 plain·pretty 출력에서만 소수점 둘째 자리까지 올림하고 원본 값은 바꾸지 않습니다.

예상 균등 사용량 비율(exp)은 기본 공급자당 1개의 가장 긴 창(월간이 있으면 월간, 없으면 주간)에 표시합니다. agy만 예외로 `g-w`·`c-w` 두 주간 창 모두에 표시하며, 계산식·시작점 검증 불가 시에는 다른 공급자와 같은 숨김 규칙을 따릅니다. 계산은 `(창 길이 - 남은 시간) / 창 길이 × 100`(주간 7일, 월간은 리셋 한 달 전부터)이며 소수점 둘째 자리까지 올림합니다. pretty 출력은 `Usage` 열 뒤에 `(exp 42.86%)`처럼 덧붙이고, plain 출력은 해당 창 줄에 `expected=42.86`으로 표시합니다.

창 행 정렬은 표시 단계에서만 수행합니다: `m`→`w`→`5h`(접두어 표기도 `g-w`·`c-5h` 같은 등급)→등급 없는 내부 id 행은 맨 뒤이며, 같은 등급은 수집 순서를 유지합니다.

사용량 상태 표시(표시 전용): exp가 있는 행은 실제%(`percent` 우선, 없으면 `used/limit`)와 exp를 원본값으로 비교해 `|차이| ≤ 3%p`면 `optimal`(경계 포함), `-3%p` 미만이면 `under`, `+3%p` 초과면 `over`, exp나 실제%를 구하지 못한 행은 `n/a`입니다. 표시 수치는 소수점 둘째 자리로 올리고 비교에는 원본값을 씁니다. plain 출력은 공급자 줄 `provider: ok observed=… windows=N`을 유지하고, 창 행은 라벨·단위 바로 뒤 첫 지표로 `usage_status=over`를 붙입니다. pretty는 `Status` 열이 `ok over`처럼 `ok`를 유지한 채 부가 표기만 더합니다(열 폭 불변). 수집·저장 데이터는 바뀌지 않습니다.

ollama-pro는 plain·pretty 모두 `monthly`·`credits:included`(월간 인정)만 표시하고, `credits:purchased`는 계속 수집하지만 기본 출력에서는 제외합니다. 그래서 기본 표시는 월간 `m`(`credits:included`)만 남고, `activity:*`·`session`·`weekly`도 숨깁니다. 표시 대상이 0개면 창 0개에 `windows=0 (N windows hidden)`처럼 안내하고 전체를 대신 보여주지 않습니다. 수집 데이터는 바뀌지 않습니다.

창 표기는 길이가 확정된 것만 `5h`·`w`·`m`으로 줄이고(그 외 내부 id 그대로), codex는 kind 첫 글자(`p-5h`)→버킷+kind(`cp-5h`)→내부 id 순으로만 승격합니다. `credits:included` 예상 비율은 `period.from` 시작점 기준이며, 없으면 숨깁니다. 계산에는 내부 id를 그대로 씁니다.

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
