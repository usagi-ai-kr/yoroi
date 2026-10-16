# R 후보 릴리스 사전조사 (1.0.2 patch 가능 확인)

## 지시 문서
- `orchestrator-r-release-task.md`가 레포·/tmp 어디에도 없어 패킷 기준 + study 문서로 조사했다.

## 원격 실측
- origin/main `69889876` (c7 이후 이동, 별도 머지 있음). origin/dev = 로컬 dev `3fd5549`.
- dev→main 열린 PR 없음. tags v1.0.0/v1.0.1은 기존 SHA 유지.
- 주의: R 릴리스 base를 c7로 둘지 현 main으로 둘지 오케스트레이터 결정 필요.

## dirty 5 보존
- `/tmp/yoroi-r-preflight-backup/`에 5파일 사본 + SHA256 목록. 값 미노출.

## 최소 복구 파일 (b408803 대비, sim 검증됨)
- `score-policy.ts`: `valueForMoney` + 오케 price 소스.
- `score-raw.ts`: `Raw.orchValue` + 변형별 연동 1줄.
- `score.ts`: 오케 price 2 leg.
- `score-weights.ts` + `config/score-weights.json`: price 키·합 1 (R 70/5/10/15).
- worker effort hunk와 행 분리 — restore는 오케 분기만 건드린다.

## clean 릴리스 계획·가능 여부
- patch 1.0.2 가능: version bump + 위 5종 + 렌더·라벨 문구. worker·Grok 정책 불변.
- 원천: 공개 스냅샷 + Free 동결 입력 존재. 새 수집 불필요.

## 후속 소유 파일 제안
- 코드·config: w-impl (filter 제외, restore 5종 + 테스트).
- 검증: w-verify (격리 full 1019·BDD·CLI 1.0.2).
- 문서·릴리스: w-docs (위 5종 + 노트·PR).
