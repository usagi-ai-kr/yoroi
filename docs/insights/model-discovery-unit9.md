# #168 9단위: 감지 → 카탈로그 → 후보 연결 (기본 off)

- 저장: CLI 관측분(verified:false 포함)을 구조 검증만 거쳐 스냅샷에 둔다.
  러너는 `requireVerified:false`로 저장하고 verified를 합성하지 않는다.
- 등록: 공식 목록 교차로만 verified를 승격한다. 합성 verified 금지.
  교차는 p4 공식 API로 한다: 페이지 HTML → id 목록 → 공식 목록 →
  CLI 관측 id와 경로 키로 대조 → 공식 메타 그대로 + effort default.
- CLI에만 있고 공식에 없으면 `not-officially-listed`로 거부하고 미측정 유지.
- 공식 URL allowlist 방식은 폐기했다 (목록 교차가 유일한 근거).
- autoEnroll 명시 true일 때만 카탈로그에 병합한다. 그 외 기존과 동일.
- ban·excludePatterns·allowOlder는 하류 풀에서 그대로 적용된다.
- 실패·부재는 last-good: 스냅샷을 지우지 않고 빈 목록으로 둔다. 날조 없음.
- 스냅샷이 없어도 렌더는 정상 동작한다.
- 수집 배선은 `src/composition/insights.ts`의 `discoveryOptionsFrom`으로 연결되어 있다(collect 기본 off).
