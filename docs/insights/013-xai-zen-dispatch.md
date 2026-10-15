# 0.13 xAI #147·Zen Free 분배 (2026-10-15, o-opus 인수 후)

선행: 0.12.1 머지·main CI·tag/Release·전역 CLI 검증 완료. 릴리스·전역 설치 재배정 금지.
근거 문서: [xai-013-zen-preflight.md](xai-013-zen-preflight.md), [release-0121-close.md](release-0121-close.md),
[opus-orchestrator-handoff-20261015.md](opus-orchestrator-handoff-20261015.md). 이 3건은 미커밋 보존(수정·삭제 금지).

## 공통 제약

- 신규 issue·milestone 생성 금지. #147·milestone 0.13.0 유지. main 직접 push·PR 머지 금지.
- 로컬 opencode stats 누계를 구독 사용량 근거로 쓰지 않는다.
- 토큰·auth 원문·응답 수치 원본·개인 경로를 보고·로그·docs에 쓰지 않는다. 키 이름·타입·범위 판정만 쓴다.
- 실계정 호출은 패킷이 허가한 1회 읽기만. 전체 `yoroi once`로 모든 공급자를 중복 조회하지 않는다.
- 커밋·push·모델/세션 변경 금지. 비소유 파일은 읽기 전용.

## 단계1 (5분 단위, 보고서만)

| 담당 | 작업 | 보고 |
| --- | --- | --- |
| w1-claude (`w12:p12`) | xAI billing 후보 경로의 OpenCode OAuth 인증 수락·응답 schema 1회 읽기 검증 | `scratch/reports/yoroi-013-xai-auth-w1.json` |
| w4-opencode (`w12:p16`) | Zen 완료 신호: w2 OpenAPI 근거 vs w3 문서 페이지 조사 재대조 | `scratch/reports/yoroi-013-zen-contract-w4.json` |

- xAI 후보: `GET https://cli-chat-proxy.grok.com/v1/billing?format=credits`
  (근거 `scratch/reports/yoroi-preflight-xai-official-w2.json`·`-synthesis-w3.json`).
  판정: 인증 수락(HTTP 상태), `creditUsagePercent`·`currentPeriod.type/start/end` 존재·타입·주간 여부.
- Zen 쟁점: `time.completed`/`finish==='stop'`가 V2 공식 계약인지. 근거
  `yoroi-preflight-zen-final-audit-w2.json`(OpenAPI) vs `yoroi-preflight-zen-completion-w3.json`(문서).
  판정: 필드 실재 위치(스키마 경로), 문서 미기재와 계약 부재의 구분, 성공 해제에 쓸 수 있는 신호 후보.

## 단계2 (단계1 보고 확인 후 배정)

- xAI: 응답 판정 결과로 수집기 계약(필드 매핑·주간 reset·실패 처리) 설계·합성 fixture 범위 정리.
- Zen: V2 판정 오류(model 객체·error.type·429 scope) 수정과 해제 경로 설계. 구현자와 리뷰어 분리.

## 진행 기록

- 단계1 xAI(w1): 1회 GET → HTTP 200, OpenCode OAuth 수락. 최상위 키 `config`, `creditUsagePercent` float 0–100,
  `currentPeriod.type`=WEEKLY·7일 간격 확인. 남은 것: 웹 구독 풀 일치 비교·채택 정책(사용자 결정).
- 단계2 xAI → w3-gemini: 수집기 계약 설계안(`scratch/reports/yoroi-013-xai-contract-w3.json`), 실호출 금지.
- 단계2 xAI(w3) 설계: `config.creditUsagePercent`→window `weekly` percent, `currentPeriod.end`→resetAt,
  헤더 Bearer+`X-XAI-Token-Auth`, 401/403 auth·5xx/429 network·schema 결손 parse, 기본 목록 제외(opt-in) 유지.
  `prepaidBalance` 창은 단계1에서 검증되지 않아 보류. 구현은 사용자 채택 정책 결정 후 배정한다.
- 단계1 Zen(w4): `time.completed`(optional number)·`finish` enum은 OpenAPI `Session.Message.Assistant`에 실재.
  w3 '문서 미기재'는 HTML 페이지 기준 사실이나 계약 부재가 아니다. 공식 완료 경로는 `ctx.session.wait()`→`context()`.
  http.response 훅은 완료 시점 미보장 → 200 단독 해제 금지 유지. 이벤트 스트림은 비타입이라 미확인.
- 단계2a Zen → w2-codex: V2 판정 오류(model 객체·error.type·429 scope)만 수정, 해제 경로는 2b로 분리.
  소유 `integrations/opencode-v2/yoroi-zen-free.js`·`tests/opencode-v2-plugin.test.ts`. 리뷰는 구현자 외 워커.
- 사용자 결정(2026-10-15): 공식 문서에 없는 billing 엔드포인트 채택. 웹 Usage 풀 일치 비교는 미완(사용자 측).
- 단계3a xAI → w4-opencode: auth·parser·client 신규 모듈과 합성 테스트만. 3b(sources 배선·stats 소스 정리)는 보고 후.
- 단계2a Zen(w2) 완료 보고: model 객체 정규화·V2 error.type 판정·provider 게이트. 회귀 6건, zen 관련 47/47,
  validate PASS. 플러그인 96줄. 리뷰 → w1-claude(유료 opencode 429·문구 배제·2b 분리 가능성·V1 영향).
- 2a 리뷰(w1) approve. 잔여: (a) 유료 opencode 429도 기록 (b) 'Rate limit exceeded' 문구 단독 신호 누락
  (c) 96줄이라 해제 경로 수용 불가·설치기 단일 파일 전제 (d) V1/V2 판정 차이. → 2b 설계 w3-gemini.
- 2b 설계(w3): entry+`yoroi/signals.js`+`yoroi/release.js` 3분할, 설치기 V2 다중 파일, 해제=200→wait(15s)→context
  검증→`--ok` 1회. free 판정은 접미사+근거 목록, 문구는 opencode free 세션 한정. 단위1 → w2, 단위2는 보고 후.
- 3a xAI(w4) 완료: auth·parser·client 신규 6파일, 합성 7/7·typecheck·validate PASS. 리뷰 → w1-claude.
- 3a 리뷰(w1) approve. 보완: DB 실패 시 auth.json 무경고 폴백→fail-closed, 비WEEKLY 'usage' 창 렌더 확인.
- 3b xAI → w3-gemini: billing 소스 배선·stats 기반 xai 소스 제거·보완 2건. 리뷰는 구현자 외 워커.
- 3b xAI(w3) 완료: billing 소스 배선·stats 소스 4파일 제거·fail-closed. 983 tests·BDD 45·validate PASS.
  삭제가 index staged 상태(Git 변경 금지 위반 여부 판정 필요). 리뷰 → w1-claude.
- 3b 리뷰(w1) approve(staged 삭제는 소유 범위 내, 이력 위반 아님). xAI 커밋 → w4(10-15 커밋 지시, Refs #147, push 금지).
  #147은 웹 Usage 풀 일치 비교(사용자 측)가 남아 open 유지.
- xAI 커밋 `34e6eb5`(w4, 16파일, Refs #147). push 없음, dev ahead 1. Zen 변경·미커밋 docs 보존 확인.
- 2b 단위1(w2) 완료: `yoroi/signals.js` 분리·설치기 V2 다중 파일·free 판정(-free·big-pickle·grok-code, 근거 없는
  free·minimax-01·-preview 미채택)·문구 free 세션 한정. zen 51/51·BDD 45·validate PASS. 리뷰 → w1-claude.
- 2b 단위1 리뷰(w1) approve: 잔여 (a)(b) 해소, 설치기가 `yoroi/` 동적 포함. Zen 판정 수정 커밋 → w3, 이후 단위2 → w4.
- Zen 판정 수정 커밋 `b8ef7b1`(w3, 5파일, --ok 경로 미포함 명시). 2b 단위2(해제 경로) → w4-opencode.
- 2b 단위2(w4) 완료: `yoroi/release.js` 70줄, wait 15s→context 검증→`--ok` 세션당 1회. 17/17·BDD 45·validate PASS.
  리뷰 → w2-codex(훅 내 wait 교착·대상 턴 일치·타이머 정리·설치 마커).
- 단위2 리뷰(w2) approve: 훅 비동기 분리(교착 없음)·턴 레이스는 미해제 방향·타이머 정리·v2 마커 설치 확인.
  비차단 보완(settled 상한·report 실패 재시도 회귀) → w4, 이후 독립 확인·커밋은 다른 워커.
- 보완(w4) 완료: settled 256 FIFO 상한·재시도 회귀 신규 파일. 19/19·validate PASS. 확인·커밋 → w2.
- Zen 해제 커밋 `d30f6ee`(w2 확인·커밋). 전체 검증·dev push·dev→main PR(Refs #147) → w1-claude. 머지는 사용자 승인.
- PR [#150](https://github.com/qus0in/yoroi/pull/150) 발행(w1): HEAD d30f6ee, unit 993/993·BDD 45·build·validate PASS,
  dev fast-forward push. 남은 사용자 조치: 머지 승인, #147 웹 풀 일치 비교, 0.13.0 버전 승격 여부.
- 사용자 지시(2026-10-15 14:5x): "커밋에 넣어줘 / 그리고 승인 알아서." → 이 분배 기록은 커밋, 인계·조사 3건은 미커밋 유지.
  승인 위임 해석: PR #150 머지(CI 통과 조건)까지 위임으로 읽는다. 버전 승격·tag·Release는 위임 범위 밖으로 두고 별도 보고.
- 사용자 지시: 위키 갱신 필요 이슈 1건 생성(라벨·마일스톤·위키 게시는 범위 밖).
