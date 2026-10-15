# 0.12.1 마감 (2026-10-15 사용자 머지 승인)

- 승인 대상 PR149, dev→main, head 70cb850a6743cb30eb66411234ed31775ac87c19.
- 단계1 w1: 최신 PR/CI/head 재확인, merge commit 머지(dev 보존), main CI 시작·run/SHA 보고.
- 단계1 w4: 0.12.1 기존 milestone 유무/상태·미완료 항목 확인, Zen 최종 감사 보고 대조.
- 단계2: main CI 성공을 확인한 뒤 다른 워커에게 v0.12.1 tag/Release 발행을 배정.
- 단계3: 정확한 main merge SHA로 격리 빌드·전역 CLI 갱신, 독립 버전/설치 검사.
- 0.13은 #147·기존 milestone 0.13.0 유지. 0.12 마감 후 다음 검증 단위를 분배.
- 신규 issue/milestone 생성 금지, main 직접 push 금지, 기존 사용자/로컬 조사 문서 보존.
- 토큰·설정 값·개인 사용량 원본을 출력하거나 커밋하지 않는다.
- 커밋/추가 push는 이 마감 패킷 범위에 넣지 않는다. 원격 릴리스만 승인 절차대로 처리한다.

## 단계1 결과

- PR149 merged: dd589e5a97ca9a980c1543aee46ca9dcddc8d953. origin/dev 70cb850 유지.
- main CI 자동 실행 없음 → workflow_dispatch 38680686665 시작; 단계2 w3가 성공 확인 후 발행.
- 0.12.1 milestone 미생성, 신규 생성하지 않음. 0.12.0 closed/open0, 0.13.0 open/#147 유지.
- Zen 완료 필드: w2는 V2 OpenAPI 근거를 제시했고 w3는 문서 페이지에서 미확인. 자료 범위 차이 재대조가 다음 검증 단위다.

## 단계2 결과·단계3

- main CI 38680686665 completed/success, head dd589e5a97ca9a980c1543aee46ca9dcddc8d953.
- v0.12.1 tag·Release 발행 완료, tag SHA=merge SHA.
- Release: https://github.com/qus0in/yoroi/releases/tag/v0.12.1
- 단계3 w4: 정확한 릴리스 SHA 격리 빌드로 전역 0.12.0→0.12.1 갱신·설정 보존·버전 비교.
- Opus 인계 문서는 w2 소유 docs/insights/opus-orchestrator-handoff-20261015.md.

## 단계3 완료·인계 전 검증

- w4: dd589e5 격리 빌드·전역 설치 완료. 버전0.12.1, update:global --check exit0.
- 활성 설치 dist와 해당 SHA 빌드가 일치하며 설정0600 사본 보존. 자기 생성 worktree/temp 정리 완료.
- 실제 갱신 전 버전도0.12.1(이전 로컬 빌드 설치분)이었다. 이번에는 main merge SHA 기준으로 재설치했다.
- w1이 독립 최종 버전/CI/tag/레포 검증 중. w2 인계 초안의 전역미완료·중복설치 지시는 갱신이 필요하다.
- 0.13 구현은 아직 시작하지 않았다. Opus 인수 후 작은 다음 검증 단위로 분배한다.

## 독립 검증·최종 인계

- w1 최종 검증: PR149 merged·main CI success·tag/Release SHA 일치·활성 CLI0.12.1/check exit0 확인.
- validate-repo PASS: 600 files, 7 skills. 소스 수정 없음, 미커밋 조사/인계 docs3건 보존.
- w2가 인계 문서의 오래된 전역미완료/설치재배정 문구를 정정했다. 전역 갱신 완료·중복 금지를 반영했다.
- 다음 오케스트레이터는 해당 인계 문서와 이 마감 기록을 먼저 읽고 coord status부터 확인한다.
