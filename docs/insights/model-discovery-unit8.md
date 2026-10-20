# #168 단위8 — once 합성에 기본 꺼짐 감지 연결 (2026-10-20)

- 범위: 감지 러너(단위6)를 `runInsights` 합성에 **선택 옵션**으로 연결. **단위8이며 #168 전체 완료를 뜻하지 않는다.**
- 소유: `src/insights/model-discovery-once.ts`·`src/composition/insights.ts`·`tests/insights-model-discovery-once.test.ts`·본 문서.
- **감지는 켜지 않았다.** `InsightsRunOptions.discovery`가 없거나 `config.enabled !== true`면 완전한 no-op이다(어댑터·저장소·네트워크 호출 0).

## 계약

- `runOnceDiscovery(options?)` → 꺼짐이면 `undefined`, 켜짐이면 `{ notice, errors }`(diff 요약 1줄).
- `runInsights`는 정상 수집(`runInsightsOnce`·free 카탈로그) **뒤**에 호출하고, 결과가 있을 때만 `discoveryNotice`를 결과에 덧붙인다.
- 어댑터·저장소·러너 예외는 모두 잡아 notice(`failed: …`)로만 남기며 once를 실패시키지 않는다.
- 어댑터·저장소·시계는 호출자가 주입한다. 실제 호출부(CLI)에는 아직 연결하지 않았다.
- Q1~Q4 권장 기본값 유지: 자동 편입 off, diff-only, XDG baseDir, 공개/CLI 제공자만. API 키 제공자·카탈로그 자동 편입은 추가하지 않았다.

## 검증 (합성, 네트워크 0)

`tests/insights-model-discovery-once.test.ts` 5건: 기본 꺼짐 no-op·호출 0 / 켜짐 시 스냅샷 기록·notice / 어댑터 실패는 once 무해 /
저장소 예외 격리 / 감지 유무와 무관하게 기존 실행 결과(top10·카탈로그) 동일.

## 남은 범위

1. CLI(`once`)에서 실제 어댑터·저장소·설정 로드 연결 — 미구현(기본 꺼짐 유지).
2. notice 출력 위치(stdout 한 줄) 결정·연결 — 미구현.
