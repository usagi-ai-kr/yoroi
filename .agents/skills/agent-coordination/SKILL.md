---
name: agent-coordination
description: 토큰 절약, 명시적 파일 소유권, 하위 worker 안정 위임, 공식 CLI 계약 사전 검증 및 결과 감사 프로토콜을 관리한다. Root-Worker 협업, 작업 패킷 분담, 컨텍스트 핸드오프 요청에 사용한다.
metadata:
  version: "1.2"
---

# 에이전트 협업 및 작업 분담

Root와 하위 Worker 간 토큰 소모를 최소화하고 안정적인 완결성을 확보하는 프로토콜이다.

## 1. 핵심 원칙

1. **배타적 파일 소유권**: 작업마다 Worker의 수정 가능 파일을 한정한다. 비소유 파일은 읽기 전용이다.
2. **10분 검증 단위**: 모든 작업은 10분 이내에 테스트/스크립트로 증명 가능한 단위로 쪼갠다.
3. **최소 컨텍스트 전달**: 전체 대화록 대신 작업 파일·인터페이스·제약만 패킷으로 전달한다.
4. **Worker 재사용과 세션 경계**: 무한정 컨텍스트를 늘리지 않고, 단위 작업 연속 시 기존 Worker를
   재사용하되 컨텍스트가 비대해지면 구조화된 요약 Handoff로 Fresh Session으로 전환한다.
5. **명령 계약 사전 검증 책임**: Root는 미검증 CLI 명령을 지시하지 않고, 공식 `--help`와 문서를
   사전 점검하여 올바른 인증 명령을 확정할 책임을 진다.
6. **실조회와 검증 구분**: 불필요한 중복 실조회와 모델 호출만 금지하며, 사용자 허가에 따른
   `once` 실행 검증은 정상 수행한다.
7. **무관용 보안**: 실계정 토큰 노출을 엄격히 금지하고 합성 픽스처와 가상 포트를 우선 활용한다.
8. **Worker 환경 불변**: worker의 모델·세션·권한은 사용자가 정한다. Root는 바꾸지 않는다.
   - 분담 전 실행 중인 worker 목록과 각 worker의 현재 모델을 확인하고 그 안에서 배정한다.
   - "X 위주로" 같은 지시는 이미 X로 실행 중인 worker를 고르라는 뜻이다. 해당 worker가 없으면 묻는다.
   - worker 종료·재시작·모델 변경·권한 프롬프트 승인은 사용자가 명시적으로 요청할 때만 한다.
   - 다른 에이전트에 키를 보내기 전 화면을 읽어 현재 상태를 확인한다. 막히면 사용자에게 보고한다.
   - 실수로 환경을 바꿨으면 스스로 복구하며 더 바꾸지 말고 즉시 보고한다.
   - worker 이름은 하네스 이름 그대로 쓴다(예: `agy`). 같은 하네스가 여럿일 때만 `opencode-1`처럼
     1부터 번호를 붙인다. 작업·모델명은 넣지 않고, 작업은 패킷 id로 구분한다. 그 외 이름·라벨은 건드리지 않는다.

## 2. 오케스트레이터 역할 (Root 부담 최소화)

Root는 직접 일하지 않고 **나누고 맡기고 확인**한다. 맥락은 root에 남기고 노동은 worker에 둔다.

| Root가 맡는다 | Worker에게 넘긴다 |
| --- | --- |
| 사용자 범위 확인, 작업 분해, 소유 파일 배정 | 구현, 단위 테스트, 리팩터링 |
| CLI 계약 사전 확인(`--help`·공식 문서) | 코드·로그·문서 조사와 요약 |
| 패킷 발행, 보고서 감사, `git diff` 대조 | 전체 검증 실행(test·build·lint)과 결과 보고 |
| 통합, 커밋·push·PR·이슈 등 외부 기록 | 문서 초안·회고 초안 |

1. 10분을 넘거나 3개 이상 파일을 고치는 작업은 root가 직접 하지 않고 패킷으로 나눈다.
   root의 직접 수정은 통합 충돌 해소와 한두 줄 정정으로 한정한다.
2. 패킷마다 단일 소유자를 둔다. 같은 파일을 두 worker에 동시에 배정하지 않는다.
3. Worker 보고는 `report_path`의 JSON 하나로 받는다. root는 긴 로그를 읽지 않고
   보고서·감사 결과·`git diff --stat`만 확인한다. 의심될 때만 해당 부분을 재실행한다.
4. Worker가 막히면 root가 대신 하지 않고 범위를 줄이거나 계약을 정정한 새 패킷을 발행한다.
5. 진행 중 worker 목록(패킷 id·pane·상태)을 root가 한 곳에 유지해 중단·재개 시 사용한다.
6. 중단 요청은 모든 worker에 전파한다. 절차는 `graceful-stop` 스킬을 따른다.
7. 배정이 길어지면 루프 감시를 시작한다. 스크립트는 [watch_workers.sh](scripts/watch_workers.sh)다.

   ```bash
   bash <skill-dir>/scripts/watch_workers.sh --reports <report>... --panes <pane>... [--interval 20] [--max-polls 120] [--limit-pattern <ERE>]
   ```

   보고서 생성·감시 대상 pane의 `blocked`·모델 한도 문구 중 하나가 보이면 종료하고 그 화면을
   함께 출력한다. 종료 코드는 감지 0, usage 오류 2, 변화 없음 3이라 root는 문자열을 보지 않고
   구분한다. 한도 문구는 구체 문구만 기본값으로 쓰고 필요할 때 `--limit-pattern`으로 덮어쓴다.

## 3. 작업 흐름

1. **작업 패킷 생성**:
   Root는 대상 Pane/Worker와 소유 파일, 검증 기준을 정하고 패킷을 검증한다:
   ```bash
   python3 <skill-dir>/scripts/task_packet.py create <task_id> <target_pane> <owned_files,...> <criteria,...> [report_path]
   ```
   패킷에는 `report_path`와 중단 규칙(`on_stop`)이 포함된다.
2. **Worker 완결 수행**:
   Worker는 구현, 단위 테스트, 검증, 보고서 작성을 끝까지 완결한다.
3. **결과 감사 및 프로비넌스 확인**:
   Root는 보고서의 `modified_files` 자기신고와 시크릿 노출 패턴을 검사한다.
   실제 파일 침범 여부 판단은 Root의 별도 `git diff`/`git status` 대조가 필요하다:
   ```bash
   python3 <skill-dir>/scripts/report_audit.py <task_packet.json> <report.json>
   ```

자세한 운영 지침과 CLI 계약 정정 사례는 [플레이북](references/playbook.md)을 참조한다.
관련 도구는 [task_packet.py](scripts/task_packet.py), [report_audit.py](scripts/report_audit.py),
[watch_workers.sh](scripts/watch_workers.sh)에 있다.
