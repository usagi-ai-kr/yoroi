---
name: agent-coordination
description: 토큰 절약, 명시적 파일 소유권, 하위 worker 안정 위임, 공식 CLI 계약 사전 검증 및 결과 감사 프로토콜을 관리한다. Root-Worker 협업, 작업 패킷 분담, 컨텍스트 핸드오프 요청에 사용한다.
metadata:
  version: "1.0"
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
   `once`/`watch` 실행 검증은 정상 수행한다.
7. **무관용 보안**: 실계정 토큰 노출을 엄격히 금지하고 합성 픽스처와 가상 포트를 우선 활용한다.

## 2. 작업 흐름

1. **작업 패킷 생성**:
   Root는 대상 Pane/Worker와 소유 파일, 검증 기준을 정하고 패킷을 검증한다:
   ```bash
   python3 <skill-dir>/scripts/task_packet.py create <task_id> <target_pane> <owned_files,...> <criteria,...>
   ```
2. **Worker 완결 수행**:
   Worker는 구현, 단위 테스트, 검증, 보고서 작성을 끝까지 완결한다.
3. **결과 감사 및 프로비넌스 확인**:
   Root는 보고서의 `modified_files` 자기신고와 시크릿 노출 패턴을 검사한다.
   실제 파일 침범 여부 판단은 Root의 별도 `git diff`/`git status` 대조가 필요하다:
   ```bash
   python3 <skill-dir>/scripts/report_audit.py <task_packet.json> <report.json>
   ```

자세한 운영 지침과 CLI 계약 정정 사례는 [플레이북](references/playbook.md)을 참조한다.
관련 도구는 [task_packet.py](scripts/task_packet.py) 및 [report_audit.py](scripts/report_audit.py)에 있다.
