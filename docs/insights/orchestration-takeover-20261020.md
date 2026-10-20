# 오케스트레이션 인수 기록 (2026-10-20)

- 사용자가 현재 오케스트레이션 인수를 받아서 진행하도록 지시했다. 패킷 ID는 운영 참조용이며 사용자 발언이 아니다.
- `docs/insights/stop-checkpoint-20261020.md`는 과거 기록이며 재실행 근거가 아니다.
- 완료된 wiki 작업(위키 242ed98·dev 531dba1)은 재실행하지 않는다.
- 이전 조회 단위의 금지사항(외부 쓰기·커밋·push 금지 등)은 해당 단위 범위였으며 현재 상태에 대한 상시금지가 아니다. 본 단위는 커밋·push·외부쓰기 없이 기록만 한다.
- 미래 상태 선반영 금지. 아래는 읽기 전용 `gh`·`git`·리포트 실측이다.

## 원격 상태

- dev: `531dba1` (origin/dev와 동일).
- origin/main: `ff831c6` (PR #191 병합). 로컬 main(`1edb086`)은 구버전이라 참고만 한다.
- 열린 dev→main PR 없음. 직전 병합 PR #191 (MERGED).
- 최신 CI: dev push 성공 (runs 39372854997·39372684060).
- letter-publish `workflow_dispatch` 성공 (run 39371356308).
- dev는 origin/main보다 19커밋 앞섬 (wiki·canonical·installer 포함).

## 검증 갱신 (완료됨)

- 전체 검증 PASS: unit/integration 1289/1289, BDD 45 scenarios / 635 steps, typecheck·build 통과.
- `validate-repo.py` PASS, `git diff --check` clean.
- 단위5 독립리뷰 PASS: 기본 꺼짐 deep-equal·활성화 시 selection/markdown/sections·리뷰어 잠정치 격리·기존 소스·스코어링·publish 무영향 확인. 차단 아닌 관찰 2건(이중 렌더 여지·오케/워커 후보 중복 허용) 기록.
- 위 "검증 대기·중" 표현은 쓰지 않는다. 검증·리뷰는 완료된 일이다.

## 이슈·연결 실측

- #168: once 기본꺼짐 합성은 `89f1f6a`로 이미 연결됐다. 이슈 본문에 오래된 "미연결" 상태가 남아 있어도 현상으로 복사하지 않는다.
- #195 단위4 및 단위5: 현재 구현·검증 통과 상태다. #195 전체 완료를 뜻하지 않는다.
- #190: 소스·진단 완료, transport·연결 미결. #194: 초안·게이트 완료, 시크릿·시험·PM2 대기.
- #193 CLOSED. `/tmp/yoroi-v150-release-plan.md`는 계획서이며 v1.5.0 미발행·PR 미생성이다.

## 완료 / 남은 결정 / 미실행

- 완료: v1.4.0 병합·CI·tag·Release, wiki 발행, #194 installer·canonical 수정, 단위5 검증·독립리뷰.
- 남은 결정(사용자): v1.5.0 범위·버전, 리뷰어 가중치 확정, Actions 실제 발행 여부, Secrets·PM2.
- 미실행: unit5 4파일 로컬커밋, dev→main PR, v1.5.0 tag·Release.

## 현재 소유

- w1: 본 문서 소유. r: 최종 기록 검토 담당.
- w3: unit5 4파일 로컬커밋 담당. SHA는 보고서가 오기 전 미리 적지 않는다.
  - `src/composition/insights.ts` (M)
  - `src/insights/letter-three-role-pipeline.ts` (M)
  - `tests/insights-composition.test.ts` (M)
  - `docs/insights/letter-three-role-unit5.md` (신규)

## 다음

- r에게 본 문서 읽기전용 최종리뷰 + 통과 시 문서 1개 로컬커밋 패킷 초안을 작성했다.
  경로: `/tmp/yoroi-takeover-record-review-packet.json`. 직접 전송은 하지 않는다.
