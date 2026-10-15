# 1.0 마무리 계획 (2026-10-15)

## 사용자 결정

- 문서를 갱신하고 1.0.0으로 승격하여 마무리한다.
- Muse 등 접근 가능한 effort 상한(xhigh) 반영은 1.1.0으로 이월한다.
- 새로운 기능 확장은 하지 않는다. 기존 미커밋 변경을 보존한다.

## 단계와 완료 기준

1. 현재 변경·1.0 milestone 완료 조건·문서 불일치를 확인한다.
2. main의 기존 동작을 기준으로 package.json을 1.0.0으로 변경하고 문서를 정리한다.
3. 구현자와 다른 워커가 diff·버전·범위·회귀 결과를 리뷰한다.
4. 검증된 변경과 릴리스 노트를 준비하여 사용자에게 보고한다.
5. 커밋·push 요청 시 dev → main PR로 제출한다. PR 머지는 사용자 승인 후 수행한다.
6. 승인된 머지 후 main CI 통과를 확인하고 tag·Release·전역 CLI를 일치시킨다.

- 발행 전에는 계획·준비 상태만 기록하고 완료를 선기록하지 않는다.
- 미발행 0.13.3의 병합 내용은 1.0에 포함한다. 별도 0.13.3 tag·Release는 생략한다.
- README.md·AGENTS.md는 변경하지 않는다. 파일당 100줄 제한을 유지한다.
- 작업 중단 요청 시 새 단계 없이 graceful-stop을 따른다.

## 1단계 분배 (각 5분 단위)

| 담당 | 범위 | 소유 파일·보고 |
| --- | --- | --- |
| w1 / p17 | 범위·문서 정정·milestone 완료 조건 확인 | `/tmp/yoroi-v1-scope-w1-report.json` |
| w2 / p18 | 기존 effort 수정 독립 검증·전체 check | `/tmp/yoroi-v1-readiness-w2-report.json` |

- 두 패킷은 보고서와 같은 접두어의 `-packet.json`. coord 전송 시작 확인.
- 이 단계는 읽기·검증 전용. 소유 파일 외 편집 금지. 본 계획은 오케스트레이터 소유.
- 다음 단계는 결과 확인 후 배정하며 소유 파일과 리뷰어를 분리한다.

## 검증 및 2단계 배정

- 미커밋 effort 포함 트리의 사전 검증: 1019/1019, BDD 45/45·632 step PASS. 1.0 대상 수치는 아래 격리 검증 참조.
- 기존 effort 미커밋분은 정책 문구와 구현 차이가 발견되어 1.1 검토 대상으로 보존한다.
- w2에 package.json만 1.0.0으로 승격하고 빌드 버전을 확인하도록 배정했다.
- 패킷 `/tmp/yoroi-v1-version-w2-packet.json`, 보고 `/tmp/yoroi-v1-version-w2-report.json`.
- w1 범위 보고 확인 후 문서 소유권을 지정하고 독립 리뷰를 교차 배정한다.

## 범위 확정

- 1.0 포함: main에 병합된 0.13.3까지의 동작, 1.0.0 버전 승격, 현재 운영 문서 정정.
- 1.1 이월: Muse xhigh 접근 상한 및 기존 워커 effort 정책·표시 수정의 확정과 재발행 판단.
- 미커밋 `letter-top10-score.ts`, `four-source-score.md`, 신규 effort 테스트는 보존하되 1.0 커밋에서 제외한다.
- `docs/orchestration.md` 타 주체 변경도 이번 승격 커밋에 임의로 포함하지 않는다.
- w2 버전 변경 완료: package.json 1.0.0, 빌드 CLI 1.0.0, validate·diff 검사 PASS.
- w1에 roadmap·development·versioning·release-status·tasks와 필요시 신규 이력 파일을 배정한다.
- 문서 보고 후 w2가 독립 리뷰하고, 1.0 대상만 격리한 검증으로 미커밋 영향과 구분한다.

## 소유권 및 독립 검증

- w1 문서 패킷: `/tmp/yoroi-v1-docs-w1-packet.json`, 보고 `/tmp/yoroi-v1-docs-w1-report.json`.
- w1 소유: roadmap·development·versioning·release-status·tasks, 필요시 tasks-pre100·release-history-pre100.
- w2 격리 패킷: `/tmp/yoroi-v1-isolated-w2-packet.json`, 보고 `/tmp/yoroi-v1-isolated-w2-report.json`.
- w2는 main `21405b0`을 임시 경로에 내보내고 버전만 1.0.0으로 바꿔 검증한다.
- 원본 미커밋 effort 변경은 되돌리거나 수정하지 않는다. 비밀값·DB는 격리본에 복사하지 않는다.

## 1.0 대상 격리 검증 결과

- 기준 SHA: `21405b0500b30cccfda2092c255366836acad704`(PR #156 병합).
- 기준 트리에서 버전만 1.0.0으로 바꾼 격리본: 단위·통합 1017/1017, BDD 45/45·632 step PASS.
- typecheck·build·CLI `yoroi 1.0.0`·validate-repo(623 files, 7 skills) PASS.
- 1.1 이월 effort 변경·신규 테스트·비밀값·DB는 격리본에 포함하지 않았다.
- 결과는 1.0 코드·버전 준비 검증이며 최종 문서 리뷰·PR CI·머지 후 CI를 대체하지 않는다.

## 문서 갱신 결과

- w1 문서 7개 갱신 완료, 각 100줄 이하. 과거 기록은 신규 이력 문서 2개로 이동·링크 보존.
- 버전 원본과 xAI 기본 포함 설명을 정정하고 D 완료·1.0 준비·1.1 이월을 구분했다.
- 0.13.3 병합·CI·전역 설치 완료와 미발행 사실을 분리했다(당시 1.0 발행은 계획).
- w1 validate-repo PASS(627 files, 7 skills), diff 검사·상대 링크·이동 기록 보존 검사 PASS.
- w2 독립 문서 리뷰 패킷: `/tmp/yoroi-v1-doc-review-w2-packet.json`.

## 최종 제출·발행 (완료)

- 문서 7개·package.json 독립 리뷰 APPROVE, 격리 검증 PASS.
- 제출 9파일(본 계획 포함). 인수 기록·effort 3파일·orchestration.md는 제외. 경로 지정 커밋(자동 스테이징 금지).
- [완료] PR #158 머지 `5111378cccf5f2436db0f1fae8c0715e76c94edb` → main CI [38744891994](https://github.com/qus0in/yoroi/actions/runs/38744891994) success → [Release v1.0.0](https://github.com/qus0in/yoroi/releases/tag/v1.0.0) publishedAt 2026-10-15T13:50:05Z, tag 동일 SHA → 전역 CLI 1.0.0 `--check` exit 0 → milestone 23 closed.

## 실행 분배 (완료)

- w1 확정 9파일 커밋·dev push: `/tmp/yoroi-v1-land-w1-packet.json`. 제외 변경 보존.
- w2 PR 본문·노트·원격 diff·PR·CI: `/tmp/yoroi-v1-pr-prep-w2-packet.json`. 머지는 사용자 승인 후.
- 전역: 최초 준비 0.13.3 → 설치 시 이미 1.0.0 dirty(effort 혼입) → clean SHA 재설치. 최종 1.0.0만 확정.
- 1.1 xhigh·effort 이월. 미커밋 5파일 보존.
