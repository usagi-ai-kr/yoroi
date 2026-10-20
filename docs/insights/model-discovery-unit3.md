# #168 모델 탐지 단위3 — 스냅샷 파일 저장소 (2026-10-20)

- 범위: `ModelRegistrySnapshotStore` 계약의 파일 기반 구현. **단위3이며 #168 전체 완료를 뜻하지 않는다.**
- 소유: `src/insights/model-discovery-file-store.ts`·`tests/insights-model-discovery-file-store.test.ts`·본 문서.
- 범위 밖: config·catalog·once·레터 연결 없음. **사용자 저장 위치 결정도 하지 않는다**(baseDir은 주입된다).

## 1. 계약

```ts
read(providerId: string): Promise<ModelRegistrySnapshot | undefined>;
write(snapshot: ModelRegistrySnapshot): Promise<void>;
```

- 구현: `FileModelRegistrySnapshotStore(baseDir)` — provider별 파일 1개(`<안전화 id>-<sha256 16자>.json`).
- 경로 주입: `baseDir`만 호출자가 정한다. 저장소 안에서 절대경로·사용자 홈 경로를 만들지 않는다.

## 2. 안전·무결성 규칙

- **providerId 검증**: 공백만 있거나 `/`·`\`·`..`·제어문자를 포함하면 `ModelRegistryStoreError`로 거부한다.
  providerId는 경로 조각이 아닌 슬러그여야 한다(거절이 저장소 경로 이탈의 마지막 방어선).
- **파일명 안전화**: 허용 문자만 남기고 해시 접미를 붙인다. 두 id가 같은 파일로 합쳐지지 않는다.
- **원자적 쓰기**: 같은 디렉터리에 임시 파일(`.tmp-…-<pid>-<uuid>`)을 만든 뒤 `rename`으로 교체한다.
  실패 시 임시 파일을 지운다(남은 임시 파일 없음). 디렉터리는 `0700`, 파일은 `0600`로 만든다.
- **fail-closed**: 없는 파일만 `undefined`. **파손 JSON·형식 위반은 `undefined`가 아니라 throw**한다(조용한 빈 값 금지).
  쓰기 경로 오류(디렉터리 생성 실패·임시 파일 쓰기·이름 변경)도 모두 `ModelRegistryStoreError`로 감싸 읽기 경로와 대칭이다.
- **형식 검증(읽기·쓰기 공통)**: `generation` 정수 ≥1, `observedAt` 비어 있지 않은 문자열, `providerId` 비어 있지 않은 문자열,
  `models` 배열. 읽을 때 요청한 providerId와 파일의 providerId가 다르면 throw.
- **정규화 금지**: 모델 id·표시명·순서를 바꾸지 않고 그대로 저장·복원한다. 모델 병합·재정렬도 하지 않는다.

## 3. 동시성·한계(문서화)

- **last-write-wins**: 같은 provider에 두 쓰기가 겹치면 나중 쓰기가 이긴다. 교차 프로세스 잠금은 없다.
- 파일 잠금·트랜잭션·백업은 없다. 읽는 동안 다른 프로세스가 쓴 파일은 rename 교체라 부분 상태가 보이지 않는다.
- 저장소 스냅샷 세대 선택(last-good 1세대·30일)은 `model-discovery-snapshot.ts`의 책임이며, 이 저장소는 파일 I/O만 한다.

## 4. 검증 (합성·tmp 디렉터리, 네트워크·모델 호출 0)

- `node --import ./tests/harness-setup.mjs --import tsx --test tests/insights-model-discovery-file-store.test.ts` → **6 pass / 0 fail, exit 0**
  - 왕복(모델 순서·내용 보존) · 없는 파일 → undefined · 파손 JSON·형식 4종 → throw · 위험 id 6종 거부·경로 이탈 없음 ·
    원자적 쓰기 후 임시 파일 없음 · 권한을 바꿔도 읽기 성공(권한에 의존하지 않음)
- `pnpm run typecheck` → exit 0 · `python3 scripts/validate-repo.py` → PASS · `git diff --check` → clean.
- 작성 파일 100줄 이하.

## 5. #168 남은 범위(본 단위가 끝내지 않음)

1. **사용자 저장 위치 결정**(XDG 상태 디렉터리 등)과 경로 주입 지점 — 미결.
2. provider 수집 어댑터·소스 목록과 수집 주기 — 미구현.
3. 등록·대상 provider 목록과 `letter-model-lists.json`(`discovery` 섹션) 연동 — 미구현.
4. catalog·once·레터 연결 — 미구현(단위2 계약은 순수).
5. 스냅샷 보존 기간·정리 정책(30일 게이트는 단위2에 있음, 파일 정리 없음) — 미결.
6. 후보 편입은 공식 메타데이터 충족 시에만(단위2 게이트) — 런타임 연결 없음.
