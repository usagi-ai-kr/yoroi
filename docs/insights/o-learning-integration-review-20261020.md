# o 학습 통합 판정 (r, 2026-10-20, integration-review)

- 판정 대상: w1 moi(보고서+문서 38줄)·w2 dalmuti(보고서+문서 36줄). 소유: 본 문서. w3·root는 읽기 전용.
- 근거 구분: [응답] moi 답변 파일 도착(`/tmp/yoroi-o-learning-moi-reply.md`, 3,378B, 10:19)은 직접 실제 응답.
  dalmuti 회신 부재 → dalmuti 후보는 [문서] 근거만(소스 원본 문장 대조, 답변 추정 없음·미확인 표기).
  [실행] r 독립 원본 대조. [미실행] dalmuti 스크립트 실행 안 함(외부 repo 쓰기 금지 — 존재 확인만).

## 인용 신뢰도 (w3 문구 참고)

- w1 인용(moi SKILL 14·16·26–29·33–34·38줄): 원본·라인 일치 — 유지.
- w2 인용 라인 오류 5건: 콜백·폴링금지·`--then`은 실제 SKILL 17줄, 요약 헤더 23줄, 게이트 재사용 28줄,
  scope freeze는 AGENTS 36줄(SKILL 전체 30줄이라 "27·40·30·50줄" 인용 자체 불가). 내용은 원본 문장과
  전부 부합 — 판정은 유지. 단 w3는 채택 문구를 라인번호 없이 문장으로 인용한다.

## 후보 판정 (8건)

| 후보 | 출처 문장 | 근거 | 판정 |
| --- | --- | --- | --- |
| 1. 콜백+폴백타이머 1개 | dalmuti "no polling/watch loops; act on callbacks via `notify.sh`; one fallback timer per unit 10-min; missed → `redeliver.sh`" + moi "워커가 `[callback]` 전송, o는 폴링하지 않음, 폴백 타이머 1개" | [문서]/[응답] | **채택 최우선**(원인 2) |
| 2. 보고서 요약 헤더 | dalmuti "header block first: `status:`, `verdict:`, `blocking:`, `summary:` ≤3; o는 블록만 읽음, 전문은 막힌 경우만" | [문서] | **채택**(원인 3·DELTA 부합) |
| 3. scope freeze(부분) | dalmuti "Scope frozen… outside findings are out-of-scope observations, never blocking" | [문서] | **채택(부분)** — yoroi 리뷰어 작은문제 직접개선 권한은 유지 |
| 4. 차단 수정 라운드 ≤2회 | dalmuti "fix rounds carry blocking only, max 2" + moi "작성자 수정 라운드(최대 2회), o는 수락만" | [문서]/[응답] | **채택**(원인 5) |
| 5. `--then` 리뷰체인 | dalmuti "review chain author → reviewer (`--then`) → orchestrator" + moi "도입 예정, 리뷰 패킷 전송은 워커가" | [문서]/[응답·의향] | **보류** → 콜백 계약 안정화 뒤 후속 단위. 워커간 전송 허가는 메신저 경유 사용자 결정(원인 4) |
| 6. green 게이트 재사용 | dalmuti "reuse passed evidence, never failures" | [문서] | **기존충족(운영)** — "소스 불변 시 전체 check 중복 실행 안 함" 기록과 동일. 문구화는 보류 |
| 7. 단위 컨텍스트 리셋(부분) | moi "단위마다 컨텍스트를 리셋/컴팩트하고 재사용하지 않는다" | [문서] | **채택(부분)** — 독립 판정 단위만 맥락 혼입 금지. yoroi "연속 단계 이어주기" 규칙은 유지 |
| 8. 산출물 검사 스크립트 | moi "수락 전 검증 4종, `check-worker-output.sh`, 오염 시 병합 금지·워크트리 폐기" | [문서] | **보류** — yoroi는 `report_audit.py` 신고 대조 이미 존재. 제품 코드 패킷 단위에서 후속 검토 |

- 스크립트 존재 실측: dalmuti `orchestrate/scripts/`에 notify·redeliver·summary·verify 모두 존재([실행]).
- 동일 항목 합치: 원인 2(콜백)는 w2 후보 A+moi 응답, 원인 5(커밋 루프)는 w2 후보 C+D·moi 응답과 상호 강화.

## w3 구현 제안 (최소 3건 + 관행 1건, r PASS 전 커밋 금지)

1. `docs/orchestration.md` "패킷·보고서 경로" watch 문단 앞 문구 추가:
   "긴 대기 기본은 워커 콜백(herdr agent prompt `[callback] task=… status=… report=…`)과
   단위당 폴백 타이머 1개(15분). coord/watch는 백그라운드 예외·콜백 누락 1회 확인용이다."
   검증: validate-repo.py + 문구 대조(실동작은 다음 통합에서 실측).
2. `.agents/skills/agent-coordination/SKILL.md` §2 워커 보고서 문단 뒤 1문장:
   "보고서 첫머리에 `status: in-progress|done|blocked` 1줄(리뷰는 `verdict: accept|block`)을
   요구하며, root는 이 줄로 판정하고 전문은 막힌 경우만 읽는다."
   검증: 기존 `report_format` 계약 유지 대조 + 첫 실전 보고서에서 헤더 확인.
3. `docs/orchestration.md` 리뷰어 역할 1문장 추가:
   "판정은 원기준·소유 범위만 하며 범위 밖 관찰은 기록(비블로킹), 차단 해소는 작성자 수정
   라운드(최대 2회)로 반환하고 원기준만 재판정한다. 작은 문제 직접 개선 권한은 유지."
   검증: 기존 문단과 충돌 없음 대조.
- (문서 수정 없음) 이후 독립 판정 단위 패킷에 "이전 맥락 혼입 금지" 문구를 패킷 작성 시 삽입(후보 7).

## 다음 단계 규칙 (r → w3)

- 위 3건+관행 1건만 구현. 범위 확대·서브에이전트 도입·모델/세션/승인 흐름 변경 금지.
- w3 완료 후 최종 독립 리뷰는 r 후속 패킷 기준판정으로 PASS를 내도록 판단한다. PASS 전 커밋·원격 쓰기 없음.
- dalmuti 회신이 도착하면 후보 2·5·6은 [응답] 근거로 격상 가능. 그 전까지 미확인 표기 유지.
- PR #191 draft·#180 open·머지 보류 유지. git/머지 위험이 없는 한 검증은 validate-repo.py 충분.
