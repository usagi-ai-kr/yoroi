# 0.13 착수 준비·Zen Free 상태 불일치 (2026-10-15 12:40 사용자 지시)

- PR149 head70cb850은승인대기. main머지·새issue/milestone생성 금지.
- 0.12마감후0.13구현. 현재는xAI구독주간사용량 경로조사만진행한다.
- 로컬opencode stats 누계는구독사용량근거로채택하지않는다. #147·milestone0.13.0 유지.
- Zen Free는 사용자가이미잠금해제후사용중인데 locked/free_usage_exceeded/~09:00 표기가남았다고보고했다.
- 사용자보고·실측메타데이터·코드판정을구분하고 아직해제확인없다고잠금/해제를추정하지않는다.
- 원격PR149 head·dev코드·전역CLI·설정·세션/모델은변경하지않는다.

| 단계1 | 담당 | 소유·범위 |
| --- | --- | --- |
| #147 기존근거·인증요건·남은검증 | w1(p12, coord별칭 w1-claude) | 보고서만·기존자료/issue 읽기 |
| 공식xAI 구독주간usage 경로 | w2(p14) | 보고서만·공식원문검색 |
| Zen 잠금판정코드·회복조건 | w3(pV) | 보고서만·코드/합성fixture 읽기 |
| Zen 현재로컬상태·최신성·성공근거 | w4(p16) | 보고서만·비밀값없는상태메타데이터 읽기 |

- 보고 scratch/reports/yoroi-preflight-{xai-local-w1,xai-official-w2,zen-code-w3,zen-state-w4}.json.
- 코드구현·Git변경·GH쓰기·개인API/auth요청·실모델추론은단계1금지.
- Zen수집기는우선읽기전용상태만확인. 전체yoroi once로모든공급자를중복조회하지않는다.
- 토큰·auth원문·대화/세션내용·개인사용량원본·개인경로는로그/보고에기재하지않는다.
- 읽기전용SQLite는상태/오류종류/모델ID/시각만선별. 사용자콘텐츠·usage수치제외.
- 각단위5분, 완료보고확인뒤다른워커로2단계종합/검증을배정한다.
- 단계2후에도0.13실구현은0.12마감선행조건을지킨다. Zen수정필요성은근거로판정한다.
- 중단시새작업을멈추고기존변경을보존해보고한다.


## 단계1 확인·단계2

- xAI 로컬근거: OAuth proxy billing이후보이나인증수락·응답schema·주간풀정합성 미검증.
- Zen 코드: V2성공해제보고누락후보. DB와표시일치는실서비스현재잠금의증명이아니다.
- 로컬레거시DB에는오늘성공메시지없음; 현재V2경로미확정이므로사용자성공관측을부정하지않는다.
- w1에 현재CLI의공식경로·V2메타데이터재대조를인계한다.
- w3는 xAI두조사종합을맡고후보/실검증/필요사용자조치를구분한다.
- 공식자료·SDK계약검증과Zen회귀계약은앞선결과확인뒤작게추가배정한다.


## 단계2 결과·다음 검증

- xAI 후보: GET https://cli-chat-proxy.grok.com/v1/billing?format=credits (공식grok-build billing.rs).
- creditUsagePercent·currentPeriod.type/start/end가구독주간usage/reset근거. API키billing과별개.
- OpenCodeOAuth수락·실JSON·웹/CLI풀일치는아직실계정미검증. 0.12마감후1회읽기검증부터.
- Zen V2실제테이블(session_v2/session_message)에오늘Free활동있음. 레거시0행으로사용자관측부정불가.
- V2어댑터가model객체를문자열로취급·error.type대신V1shape판정·provider게이트없이429기록.
- 성공--ok경로도없음. 저장locked는신뢰가능한현재ZenQuota판정이아니다.
- 수정방향: V2schema정정·ZenFree scope/명시quota오류만잠금·확정된Free성공만해제·중복방지.
- 추정retryAt지났다는이유로자동unlock하거나모든HTTP200으로clear하지않는다.
- session.context의완료필드가실V2공식계약에있는지는추가검증한다. V1필드를가정하지않는다.
- w2는Zen최종판정·완료신호제약을독립검토한다. 아직source구현·캐시수정없음.


## 완료 신호 독립 검토·인계

- w3가 공식 V2 plugins/client 문서만 재대조했다. context 호출은 있으나 반환 메시지 완료 필드는 문서에서 확인되지 않았다.
- time.completed/finish=stop을 V2 계약으로 가정한 w4의 해제안은 채택하지 않는다.
- http.response가 스트림 완료 후 호출된다는 보장도 확인되지 않았다. 성공 해제 구현 전 실제 V2 완료 신호 검증이 필요하다.
- 오늘 V2 활동과 실제 quota 해제 증명은 구분한다. 사용자 성공 관측을 레거시 DB 0행으로 부정한 판단은 철회한다.
- 저장 이벤트의 model 누락으로 원래 공급자 귀속은 불명이다. 전부 타 공급자 오류였다고 단정하지 않는다.
- 0.13 구현은 PR149 승인·0.12 마감 후 시작한다. 다음 단위는 인증 호환성·billing 응답의 주간 풀 정합성 확인이다.
- Zen 다음 단위는 V2 이벤트 계약·scope 오류 교정과 합성 회귀 검증이다. 성공 해제는 완료 신호 확인 뒤 별도 단위로 넘긴다.
- 소스·캐시·전역 CLI·원격 PR 변경 없음. 로컬 조사 문서만 추가했고 신규 issue/milestone은 만들지 않았다.
- 회고: 레거시 DB의 무활동을 V2 활동 부재로 일반화하지 않으며, V1 완료 필드를 V2 계약에 대입하지 않는다.
- 필수 검증: python3 scripts/validate-repo.py — PASS(598 files, 7 skills).
