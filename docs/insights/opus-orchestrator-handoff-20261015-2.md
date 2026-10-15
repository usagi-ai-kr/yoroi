# Opus 오케스트레이터 인계 2 (2026-10-15 17:2x KST, o-opus 작성)

이전 인계: [opus-orchestrator-handoff-20261015.md](opus-orchestrator-handoff-20261015.md). 분배 기록: [013-xai-zen-dispatch.md](013-xai-zen-dispatch.md).
보고서 `scratch/reports/yoroi-{013,0130,0131,0132,…}-*.json`, 패킷 `/tmp/yoroi-*-packet.json`.

## 오늘 완료 (전부 main 반영·발행)

| 버전 | PR · merge SHA | Release | 내용 |
| --- | --- | --- | --- |
| 0.13.0 | #150·#152 `e9ce512` | [v0.13.0](https://github.com/qus0in/yoroi/releases/tag/v0.13.0) | xAI billing 수집, Zen V2 판정·성공 해제 |
| 0.13.1 | #153 `a1477d0` | [v0.13.1](https://github.com/qus0in/yoroi/releases/tag/v0.13.1) | 레터 전일 AA 비교에 partial 저장본 허용 |
| 0.13.2 | #155 `0034b85` | [v0.13.2](https://github.com/qus0in/yoroi/releases/tag/v0.13.2) | xAI 재로그인 안내, grok-build-0.1 SuperGrok 후보, AA 거절 진단 집계·저장 |

- 전역 CLI 0.13.2(merge SHA 빌드, check exit0). Zen V2 플러그인 재설치 후 Free 1회 완료로 locked→clear 실측.
- #147 사용자 일치 확인 후 close·milestone 0.13.0 close. #146 close·레터 [#154](https://github.com/qus0in/yoroi/issues/154) 재발행.
- 위키 게시 원격 `4495d75`, [#151](https://github.com/qus0in/yoroi/issues/151) close. 구성 표 `aff156c`(dev, 미머지 docs).

## 진행 중 (인계 시점)

- w4(Codex): 0.13.2 docs 정정은 w1 리뷰 승인 후 w2가 `f5f9772`로 커밋·dev push 완료. 이 인계문서의 이번 상태 갱신은 w1 리뷰·착륙 대기.
- w3(LongCat Free): v0.13.2 Release가 이미 발행되어 중복 Release 검증은 종료 필수 의존성에서 제외.
- dev는 main보다 `aff156c`(구성 표)·`f5f9772`(발행 기록 정정) 2커밋 앞섬 → 다음 패치 PR에 동봉.
- 레터 사전점검 완료: 10-15 09:00 자동 발행 성공. 10-16 09:00 실발행·AA 진단 저장·전일 비교 결과는 아직 미검증.

## 남은 결정·작업

1. **xAI `[parse]` 오류(17:07~)**: 서버 응답 스키마 변경 — `config.creditUsagePercent` 사라짐, `prepaidBalance`·`isUnifiedBillingUser`·`topUpMethod`·`billingPeriodStart/End` 추가, `currentPeriod`는 WEEKLY 유지. 코드 회귀 아님(`yoroi-xai-parse-diag-w2.json`).
   사용자 결정 필요: percent 부재 시 표시 정책(잔액 창 `credits:purchased` 노출 vs 오류 유지), `prepaidBalance.val` 단위 실측 1회 허용.
   구현 1~2단위(parser 분기+fixture+테스트) → 0.13.3 패치.
2. **`yo` 기본에 xAI 재포함**: 0.12.1 사용자 지시(기본 제외)를 뒤집는 것이라 사용자 확인 대기. 1번 해결 전엔 넣지 않는다.
3. **레터**: PM2 `yoroi-letter` `0 9 * * *` 자동(stopped 표시는 정상). 10-16 09:00 발행에서 확인: 이슈 생성·전일 비교 정상·AA `rejectionDiagnostics` 저장 여부. 이를 근거로 partial 경고 축소(파서 완화) 여부 판단.
4. #141(1.1 후보)은 범위 밖 open 유지.

## 운영 주의

- 위임: PR 머지(리뷰 approve·head 일치·CI 전부 pass·MERGEABLE), tag·Release 자동. 버전 승격·새 milestone은 사용자 결정.
- 분배: 직렬 단계 중에도 idle 워커 전원에 준비 작업 병렬 배정(10-15 사용자 불평). 보고마다 워커별 담당 표.
- w4는 Codex 샌드박스로 pnpm fetch 실패 → 설치·빌드·push는 OpenCode 워커(w1·w2)에.
- PR CI의 SQLite `database is locked`는 docs/flaky-tests.md 계열 — 전체 job 재실행 1회 후 판단.
- 버전 승격 시 문서 줄 정리로 이력 삭제 금지 — 이관은 docs/tasks-archive-2.md.
- 개인 사용량·토큰은 이슈·로그·커밋에 쓰지 않는다(일치/불일치만).

## 회고

- 병렬 준비 후 리뷰 승인된 변경을 착륙하고, 마감 담당이 완료·미검증 경계를 인계하면 병렬 마감 누락을 줄일 수 있었다.
