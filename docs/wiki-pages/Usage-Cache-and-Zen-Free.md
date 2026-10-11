# 사용량 캐시와 Zen Free

## 캐시와 변화량 (0.3.0부터)

0.3.0부터 `yoroi once`는 로컬 SQLite 캐시를 사용합니다. 성공한 조회는 60초 동안 재사용하며 캐시 응답은 원래 실측 시각을 유지합니다.

```bash
yoroi once
yoroi once --refresh
yoroi once --pretty
```

- `--refresh`는 캐시를 건너뛰고 공급자에서 새 사용량을 조회합니다.
- `--pretty`에는 캐시 적중 경과 시간과 직전 실측 대비 변화량(Δ)이 표시됩니다. 평문 출력은 기존 형식을 유지합니다.
- 변화량은 같은 공급자·계정 범위·사용량 창의 최신 실측에서 직전 실측을 뺍니다. 캐시 적중은 새 이력으로 기록하지 않습니다.
- 캐시와 실측 이력은 로컬 `yoroi.db`에 저장합니다. 인증값이나 공급자 응답 원문은 저장하지 않습니다.
- 실측 이력은 `once` 종료 시 90일이 지난 기록과 같은 창의 1000건 초과분을 삭제합니다. 이 값은 고정이며 설정할 수 없습니다.
- 백업과 내보내기 기능은 없습니다. 필요하면 `yoroi.db` 파일을 직접 복사하세요.
- macOS에서 Keychain을 쓰는 Claude는 캐시가 적중해도 계정 확인을 위해 Keychain을 1회 읽습니다(HTTP 요청은 없습니다).

## OpenCode Zen Free 상태

`zen-free`는 OpenCode Zen 무료 사용량 상태를 로컬 저장소에서 읽고 보고합니다. 네트워크 요청은 하지 않습니다. `once` 결과에도 `opencode-zen-free` 상태 행이 표시됩니다.

```bash
yoroi zen-free status
yoroi zen-free status --json
yoroi zen-free report --exceeded --model opencode/model-id --retry-in 3600
yoroi zen-free report --exceeded --retry-at 2026-10-11T09:00:00Z
yoroi zen-free report --ok
```

- `status`는 `locked`, `clear`, `unknown` 상태를 표시합니다. `--json`은 `state`, `model`, `retryAt`, `retryPassed`, `updatedAt`을 출력합니다.
- `report --exceeded`는 잠금 상태를 기록합니다. 필요하면 `--model`, `--reason`, `--retry-in <초>` 또는 `--retry-at <ISO 시각>`을 지정할 수 있으며 두 재시도 옵션은 함께 쓸 수 없습니다.
- `report --ok`는 잠금을 해제합니다. 재시도 시각이 지나도 상태를 자동 해제하지 않으며 `retry passed (unverified)`로 알려줍니다.
- `status`는 읽기 전용입니다. 상태가 없으면 `unknown`을 반환하고 데이터베이스를 새로 만들지 않습니다.

저장소 오류나 `--json` 오류 계약은 [체크와 문제 해결](Checks-and-Troubleshooting)을 확인하세요.

주기 감지(Zen 락 전이·사용량 이상)는 [Detect](Detect) 페이지를 참고하세요.
