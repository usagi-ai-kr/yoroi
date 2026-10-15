# Grok 4.6·4.7 레터 비교 (2026-10-15)

## 요청과 범위

- 사용자: Grok 4.6 포함, 4.7과 버전 제한 해제, 레터에 데이터를 넣어 비교.
- 두 모델만 세대 제외 예외로 처리한다. 4.5 정책과 다른 모델 정책은 유지한다.
- xhigh 접근 상한 및 기존 effort 미커밋 변경은 1.1 이월 상태로 보존한다.
- 이전 단위: 구현·검증·비교까지. 그때는 커밋·push·레터 발행이 없었다.
- 새 milestone·xhigh 기능은 없다. 1.1 effort 미커밋은 이월 보존한다.
- 원본 개인 사용량·시크릿·토큰을 출력하거나 저장하지 않는다.

## 1단계 분담 (5분 단위)

| 담당 | 작업 | 소유 범위 |
| --- | --- | --- |
| w1 / p17 | dev 동기화, 명시 예외 구현, 회귀 검증·정책 기록 | filter·candidates·unified, 관련 테스트, top10-scoring |
| w2 / p18 | 저장된 공개 지표의 고정 입력·변경 전 기준선 준비 | 비교 보고 문서 및 scratch 공개 비교 산출물 |

- w1 패킷·보고: `/tmp/yoroi-grok46-impl-w1-{packet,report}.json`.
- w2 패킷·보고: `/tmp/yoroi-grok46-baseline-w2-{packet,report}.json`.
- 본 문서는 오케스트레이터 소유. 기존 사용자 파일은 변경하지 않는다.
- w1은 원격 상태를 확인하고 안전한 ff-only 동기화만 수행한다. 경합 시 멈추고 보고한다.
- w2는 원본 DB를 읽기 전용으로 열고 공개 insight 자료만 사용한다. 전체 DB 복사는 하지 않는다.

## 2단계 완료 기준

- 구현자가 아닌 w2가 실제 diff와 요구·4.5 제외·기존 Sol 예외를 대조한다.
- 동일한 저장 입력·설정·렌더 옵션에서 1.0 기준과 Grok 예외 적용 결과를 비교한다.
- 4.6·4.7 후보 유지, 대표 effort, 점수·역할별 순위, Top10 포함 여부와 주요 변화 이유를 기록한다.
- 4.6이 후보에 남는 것과 Top10에 오르는 것은 구분한다. 실제 렌더와 근거 산출을 대조한다.
- 변경에 맞는 테스트와 validate-repo를 통과하고 발행·재발행 판단을 보고한다.
- 이전 단위에서는 커밋·push·레터 발행을 하지 않았다. 중단 시 graceful-stop을 적용한다.

## 1단계 결과와 후속 분배

- 원격 실측: dev `778d619`는 main `5111378`을 포함한다. 동기화 불필요, PR #159는 open이다.
- w1: filter의 독립 쌍 예외에 Grok 4.6/4.7 추가, 회귀 테스트·정책 기록 완료.
- targeted 26/26·typecheck·validate PASS. 4.5 제외와 기존 Sol 예외 유지.
- w1 후속: 기존 effort 작업을 제외한 격리본에서 전체 check. `/tmp/yoroi-grok46-check-w1-report.json`.
- w2: 공개 저장 자료 기준선·effort 변형 집계 완료. 실제 렌더 비교와 독립 리뷰를 배정했다.
- w2 후속: `/tmp/yoroi-grok46-compare-w2-report.json`, 프리뷰는 scratch의 레터 비교 산출물에 보관한다.
- 기준선과 기발행 #157의 미세 차이는 확인 전 원인을 단정하지 않으며 재현 한계를 구분한다.

## 격리 전체 검증

- 기준 HEAD `778d619`에 이번 filter·Grok 회귀 테스트·정책 기록 3파일만 적용했다.
- 기존 effort 수정·신규 effort 테스트·개인 DB·환경 설정은 포함하지 않았다.
- typecheck·unit 1019/1019·BDD 45/45(632 step)·build PASS.
- 원본 validate-repo PASS(630 files, 7 skills). 독립 리뷰와 실제 레터 비교는 w2에서 진행 중이다.

## 완료와 보류

- w2 독립 코드 리뷰 APPROVE, 회귀 26/26 직접 실행 PASS.
- 공개 insight 스냅샷을 읽기 전용 트랜잭션으로 고정해 기준선과 예외 적용본을 비교했다.
- 실제 full markdown 렌더와 점수 근거 일치: 4.6 high 오케 9위 69.7점, 4.7 high 7위 70.8점.
- 4.6 워커 40.4점·Top10 밖, 4.7 워커도 Top10 밖. 4.5 제외·Sol 예외 유지.
- 오케 mimo-v2-6-pro가 Top10에서 빠졌다. 워커 가격 차원은 풀 변화로 달라졌으나 순위는 유지됐다.
- 기존 #157 완전 재현은 미해결이며, 이번 고정 입력 전후 비교 결과와 구분한다.
- 결과 문서: [grok46-comparison.md](grok46-comparison.md), 프리뷰는 scratch/reports/yoroi-grok46-letter-preview.md.
- 이전 단위에서는 커밋·push·레터 발행을 하지 않았다. xhigh와 기존 effort 작업은 1.1 이월·보존 상태다.

## 사용자 갱신 승인 (2026-10-15, 현재)

- 승인 A: 레터 갱신. 승인 B: 지금까지 작업의 1.0.x 커밋·push·PR·머지·발행 마무리.
- 1.0.0 기발행이므로 1.0.1 patch. 기존 [PR #159](https://github.com/qus0in/yoroi/pull/159)에 1.0.0 기록 문서와 Grok 예외를 묶는다.
- 레터 경로: 발행된 1.0.1 clean SHA로 검증한 뒤 게시. 이 준비 단계는 편집만이며 커밋·push·PR 편집·머지·tag·Release·전역·레터 게시는 다음 단계다.
- 제외 보존: score.ts·four-source-score·effort 테스트·orchestration·takeover. scratch 공개 JSON은 커밋하지 않는다.
