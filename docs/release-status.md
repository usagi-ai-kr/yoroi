# 릴리스 상태와 발행 기록

- 0.4.0 이전 상세 발행 기록(v0.1.0 ~ v0.3.1) 및 과거 인증 검증 사실은 [release-history-pre040.md](release-history-pre040.md)에 보관한다.
- main 병합은 dev → main PR로만 진행한다(직접 push 금지).
- PR 머지 뒤 원격 CI 통과를 확인하고, 버전 갱신 시 `global-cli-update` 스킬과 [docs/global-install.md](global-install.md) 절차로 전역 CLI를 갱신하고 버전 일치를 확인한다.

## 0.4.0 머지 및 발행 상태 (2026-10-11)

- PR #91 병합 커밋 `4744fbc8280eab5a02ce42f28ed79555f318ea91`(main).
- main CI [run 38125929202](https://github.com/qus0in/yoroi/actions/runs/38125929202) success.
- 전역 CLI 동기화: `global 0.3.1 → 0.4.0` 갱신 완료 (`node scripts/update-global.mjs --check` exit 0, `yoroi --version` 0.4.0).
- **v0.4.0 Release 관측 및 유지**: 별도 작업에서 [v0.4.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.4.0)가 2026-10-11T08:53:27Z(17:53 KST) qus0in 계정으로 발행되었음이 확인됨(tag target: `4744fbc8280eab5a02ce42f28ed79555f318ea91`, git ls-remote 검증). 사용자 지시에 따라 v0.4.0 재발행이나 기존 tag/Release 변경을 금지한다.
- **실환경 detect 스모크 미실행**: 실환경 `yoroi detect` 스모크 1회는 별도 승인 대기이므로 [#89](https://github.com/qus0in/yoroi/issues/89) 및 Milestone 10(0.4.0)은 open 유지.

## 0.5.0 준비 상태 (2026-10-11)

- `package.json` 0.5.0. 미커밋 작업트리를 커밋한 뒤 dev → main PR을 준비 중이며 아직 머지·tag·Release는 없다.
- 검증 기준은 OpenRouter와 Cognition 2소스다(유효 metric 각 1,530건, Cognition 탈락 20행 부분 수집). 네 소스 E2E 완전 통과는 주장하지 않는다.
- Arena·Artificial Analysis는 단일 요청 예산(`maxRequests=1`)에서 페이지 완전성 실패였다. 4소스 코드 지원은 유지하고 [#92](https://github.com/qus0in/yoroi/issues/92)(Arena)·[#93](https://github.com/qus0in/yoroi/issues/93)(AA)로 분리했다.
- 완료 기준 5·6(Hermes 매일 실행·전달 검증, 운영 문서화)은 [#94](https://github.com/qus0in/yoroi/issues/94)로 분리하고 [#92](https://github.com/qus0in/yoroi/issues/92)·[#93](https://github.com/qus0in/yoroi/issues/93)과 함께 [0.5.1](https://github.com/qus0in/yoroi/milestone/11)에 배정했다(2026-10-11 사용자 결정). PR `Closes #70`으로 0.5.0을 마감한다.

## 버전 이력 요약

- **0.1.0**–**0.1.2** (2026-10-08): MVP, CLI 개선, .env 병합 로드 완료 및 발행.
- **0.2.0** (2026-10-10): OpenCode Zen Free 락([#72](https://github.com/qus0in/yoroi/issues/72)–[#76](https://github.com/qus0in/yoroi/issues/76)), [v0.2.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.2.0) 발행 완료(2026-10-10T10:38:55Z).
- **0.3.0** (2026-10-11): 60초 SQLite 캐시·이력([#71](https://github.com/qus0in/yoroi/issues/71)), watch 제거([#83](https://github.com/qus0in/yoroi/issues/83)). [v0.3.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.3.0) 발행 완료.
- **0.3.1** (2026-10-11): Zen Free 로드 표시([#77](https://github.com/qus0in/yoroi/issues/77)), 전역 0.3.1 동기화, [v0.3.1 Release](https://github.com/qus0in/yoroi/releases/tag/v0.3.1) 발행 완료. 실관측은 [#88](https://github.com/qus0in/yoroi/issues/88)로 분리.
- **0.4.0** (2026-10-11): 내장 10분 주기 감지기(#89) PR #91 머지 완료, 전역 0.4.0 동기화 완료. 외부 작업으로 [v0.4.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.4.0) 발행 완료 관측.
