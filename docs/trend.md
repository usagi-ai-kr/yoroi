# yoroi trend 명세 (0.6.0)

사용량 실측 이력(`observation_samples`)을 기반으로 기간별 추세·변화율을 조회하는 읽기 전용 명령이다.

## 명령 구문 및 옵션

```bash
yoroi trend [--provider <id>] [--window <id>] [--since 24h|7d|30d] [--pretty|--json]
```

- `--provider <id>`: 특정 공급자 필터링. 허용값은 ProviderId enum 그대로 `ollama-pro`, `opencode-go`, `codex`, `agy`, `claude`.
- `--window <id>`: 특정 윈도우 식별자 필터링 (예: 5h, 1d 등).
- `--since 24h|7d|30d`: 조회 기간 단일 지정. 생략 시 기본값으로 `24h`와 `7d`를 병행 조회/표시.
- `--pretty`: `cli-table3` 기반 표 형식 출력. 24h/7d 열 묶음 및 7d sparkline 포함.
- percent 창(unit `percent`/`%`)의 delta·rate는 퍼센트포인트 `%p`로 표기한다(JSON은 숫자와 unit 그대로). 측정 갭 합이 기간 절반 이상이면 `gap=warning`을 병기한다(값·보간 불변).
- `--json`: JSONL 형식 출력. 시리즈당 1줄 출력.

## 데이터 원천 및 격리 규칙

- **데이터 원천**: SQLite `$YOROI_DATA_DIR/yoroi.db`의 `observation_samples` 테이블 실측치만 사용.
- **캐시 제외 및 외부 수집 0**: 캐시 hit 레코드는 배제하며, 네트워크 요청이나 외부 수집을 일절 수행하지 않는다.
- **읽기 전용 연결**: trend는 `node:sqlite` readOnly 연결로만 DB를 열어 WAL 전환·마이그레이션·prune·chmod를 하지 않는다(존재 확인은 CLI가 하며, 파일이 없으면 "이력 없음" exit 0).
- **Raw 샘플 원칙**: 실제 기록된 샘플만 계산에 사용하며 결측치 보간(interpolation)은 엄격히 금지.
- **시리즈 분리 및 독립성**:
  - `(provider, window_id, unit, contract_version, account_scope)`를 독립 시리즈로 취급.
  - 공급자 간 합산 절대 금지.
  - `reset_at`, `unit`, `contract_version` 변경 시 구간을 분리하며, 구간 간 delta 및 속도 계산 금지.
  - 전 시리즈 표시 원칙을 따르며, 구간 내 샘플 수가 2개 미만인 경우 "샘플 부족"으로 표시.

## 출력 형식

### 1. 기본 평문 (시각: KST)

시리즈당 1행으로 출력한다.

- 기본(병행): `[provider:window] 24h: delta=+12.5% rate=+0.52%/h samples=24 | 7d: delta=+45.0% rate=+0.27%/h samples=168 resets=1 gaps=0`
- `--since` 지정 시: 해당 기간의 요약 블록 1개만 표시.
- 샘플 부족 시: `[provider:window] 24h: samples=1 (샘플 부족)` 형태로 출력.

### 2. --pretty 표 (cli-table3)

- 24h 및 7d 메트릭을 열 묶음으로 배치.
- 7d 구간에 대해 sparkline(추세 문자열) 컬럼 제공.

### 3. --json (JSONL, 시각: UTC ISO 8601 원문)

시리즈당 1줄의 JSON 객체로 출력한다.

```json
{"provider":"claude","windowId":"5h","unit":"percent","contractVersion":"1","periods":{"24h":{"delta":12.5,"ratePerHour":0.52,"samples":24},"7d":{"delta":45.0,"ratePerHour":0.27,"samples":168,"resets":1,"gaps":0}}}
```

## 에러 처리 및 종료 코드

- **0 (정상)**: 데이터 정상 조회 및 출력. DB 파일이 없거나 샘플이 전혀 없는 경우 "이력 없음" 안내 후 0으로 정상 종료.
- **1 (저장소/런타임 오류)**: SQLite busy(조회 중 잠금 포함, 별도 `trend: storage busy`), DB 파일 손상, 권한 오류, 저장소가 `queryObservations`를 지원하지 않는 경우(`trend: history query unsupported`).
- **2 (인자 오류)**: 잘못된 플래그, 지원하지 않는 `--since` 값 등.
- **보안 및 민감 정보 보호**: DB 절대 경로, `account_scope`, 토큰, 키 등 민감 정보는 stdout/stderr 어디에도 출력하지 않음.
