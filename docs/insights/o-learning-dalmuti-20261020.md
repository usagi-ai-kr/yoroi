# Dalmuti 오케스트레이션 학습 및 비교 분석 (2026-10-20)

- 담당: w18:p3 (dalmuti 학습 전담).
- 대상: `the-great-dalmuti` (w16:p2 o=Claude, w16:pD r=Gemini, w16:pJ/pA/pF w1-3).
- 출처 근거: `the-great-dalmuti` 내 `AGENTS.md`, `.agents/skills/orchestrate/SKILL.md`, `scripts/` (notify, summary, verify 등).
- 비동기 질의 확인: `/tmp/yoroi-o-learning-dalmuti-reply.md` 1회 조회 결과 부재 확인 → **미확인(unconfirmed) 종결, 재전송 없음(no_resend)**.
- 인수인계: w3(w18:p4, 하네스 반영), r(w18:p5, 독립 검증).
- 원칙: 외부 repo 수정 0건, yoroi 제품 소스 수정 0건, git 조작 0건, 100줄 이하.

## 1. Dalmuti 오케스트레이션 핵심 설계 및 후보 평가

| 후보 항목 | Dalmuti 실제 출처 및 근거 | yoroi 현황과의 차이 | 실행/설계 구분 | 판정 |
| --- | --- | --- | --- | --- |
| **A. 콜백 기반 비동기 운영** | `orchestrate/SKILL.md:27` `notify.sh`, `redeliver.sh` | dalmuti는 루프 폴링 금지, 10분 단일 폴백 타이머+콜백 기반. yoroi는 root/오케의 status/read 반복 빈번 | 동작 스크립트 실행 중 | **채택 (최우선)** |
| **B. 요약 헤더 블록 토큰 절감** | `orchestrate/SKILL.md:40` `summary.sh` | 보고서 첫머리 `status:`, `verdict:`, `blocking:`, `summary:`(3줄) 강제. o는 summary만 조회 | 동작 스크립트 실행 중 | **채택** |
| **C. 작업 범위 동결 및 비블로킹 격리** | `AGENTS.md:38` (Scope freeze) | 배분 시 criteria 동결. 리뷰어는 원기준만 채점, 범위 밖/minor 이슈는 블로킹 금지(레저 기록) | 규칙 및 운영 정책 | **채택** |
| **D. 검증 게이트 캐싱** | `orchestrate/SKILL.md:50` `verify.sh` | `verify-<gate>.log` 캐시 활용. green 게이트는 코드 불변 시 재실행 금지. yoroi는 전체 check 다회 반복 | 동작 스크립트 실행 중 | **채택** |
| **E. 리뷰 체인 워커 간 직접 인계** | `orchestrate/SKILL.md:30` (`--then`) | author 완료 시 o 미경유 reviewer 직접 디스패치 체인. yoroi는 매번 o가 재배분 왕복 | 스크립트 구현 중 | **보류** (콜백 안정화 후) |

## 2. 세부 학습 내용 (Root 직접 일 최소화 실례)

1. **오케스트레이터의 엄격한 역할 제한**:
   - dalmuti는 ask/brief/dispatch/wait/review/commit의 6대 행위만 허용함.
   - 스캐폴딩, 문서 수정, prompt-log 기록, git/gh 조작, 게이트 오류 수정 등 일체의 편집 작업은 unrequested 상태여도 무조건 워커에게 위탁함.
2. **폴링 없는 완료 판정 (Event-Driven)**:
   - 워커가 작업 후 `scripts/notify.sh`로 콜백을 남기면 오케스트레이터가 재개됨.
   - 단일 폴백 타이머 만료 시에만 `redeliver.sh`로 누락 콜백을 1회 확인하여 CPU/토큰 낭비를 차단함.
3. **토큰 낭비 방지 요약 헤더**:
   - 오케스트레이터가 수천 줄의 보고서 md/json 전체를 읽지 않고 `summary.sh`로 3~4줄만 스캔함. 블로킹 발견 시에만 전문을 조회하여 컨텍스트 윈도우 보존.

## 3. 후속 제안: 패킷 초안 및 콜백 계약

- **후속 패킷 초안 (`yoroi-harness-callback-summary`)**:
  - yoroi 패킷 규격에 dalmuti의 3줄 요약 헤더(`status`, `verdict`, `summary`) 도입.
  - 워커 완료 시 1줄 콜백 플래그(`tmp/<task>.done`)를 생성하고, 오케스트레이터는 폴링 없이 해당 이벤트 감지 시에만 깨어나도록 계약 정의.
- **인수인계**:
  - w3(w18:p4): DELTA 토큰 절감 규격(`task/files/constraints/done/report`, `status/evidence/result/next`) 및 콜백 요약 헤더 하네스 영속화.
  - r(w18:p5): 본 분석 문서 및 규칙 정합성 검증.
