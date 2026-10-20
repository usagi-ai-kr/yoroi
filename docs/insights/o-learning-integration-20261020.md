# o 학습 통합 기록 (w3, 2026-10-20)

- 범위: 사용자 지시 "root 직접일 최소화 학습"을 수집→하네스 반영→리뷰 인계까지 운영. 구현 소유 w3, 판정 소유 r.
- 근거: r 판정·수용 기준(`docs/insights/o-learning-acceptance-20261020.md`, `/tmp/yoroi-o-learning-review-report.json`),
  w1 moi 조사(`docs/insights/o-learning-moi-20261020.md`), w2 dalmuti 조사(`/tmp/yoroi-o-learning-dalmuti-report.json`).
- 변경 파일(소유): `docs/orchestration.md`·`docs/tasks.md`·`agent-coordination/SKILL.md`·`coordination-rules/SKILL.md`·
  `agent-coordination/references/playbook.md`·본 문서.

## 1. roster 변경

- `docs/orchestration.md`에 사용자 지정 리뷰 전담 **r(`w18:p5`)** 추가. o/w1/w2/w3 유지.
- `coord status`가 r을 해석함을 확인(라벨 `?` → `r`).
- r 모델은 **배정 직전 live 출력 기준**: `coord status` 기준 `w18:p5 = opencode · GLM-5.3-Flash Free Default / OpenCode · max`.
  (root가 r 패킷에 적은 "DeepSeek V4.1 Flash Free"는 live와 불일치 → 배정 시 live 값 사용)

## 2. 조사 결과 구분(실제 응답 / 문서 / 미실행)

| 조사 | 실제 o 응답 | 문서 근거 | 자체 실행 검증 | 미확인 |
| --- | --- | --- | --- | --- |
| w1 moi | w1 시점 미도착 → **10:19 `/tmp/yoroi-o-learning-moi-reply.md` 도착(3378B)** | moi AGENTS·agent-orchestration 스킬 | 질문 1회 접수 + 답변 파일 부재 확인 | o의 곱·값·거시·목표·비전, 콜백·감시·패킷 전송 주체·커밋 분담 |
| w2 dalmuti | **미확인**(질문 1회 전송, 답변 파일 미도착) | dalmuti AGENTS·orchestrate 스킬·scripts | live 확인(w16:p2 Claude working)+질문 전송 | 답변 미도착 항목은 보류 |

- 두 조사 모두 "답변 미도착"을 답변처럼 취급하지 않았다. moi 답변은 r 조건 1건에 따라 **답변 도착 이후** 확보된 근거다.

## 3. 5원인 → 수용기준 충족(하네스 반영 위치)

| 원인(유효) | 수용 기준 | 반영 위치 | 충족 근거 |
| --- | --- | --- | --- |
| ① 단일조회 예외 확장 | 예외는 1회성·단일 조작 한정, 반복·연쇄는 위탁 | `agent-coordination` 10항① | 9항이 1회성 한정을 이미 두고 10항이 반복·연쇄 위탁을 명시 |
| ② 반복 status/read/sleep | 콜백(완료·blocked·failed)+단위 묶음당 폴백 타이머 1개, sleep 루프 금지 | 10항② + `coordination-rules` 8항 | 8항의 "추가 sleep 없이 즉시 대조·자동 재전송 금지"와 결합. 이번 단위는 `coord.py watch` 백그라운드 감시만 사용 |
| ③ root가 모든 패킷 작성 | 패킷 템플릿(목표·소유·금지·검증·보고경로) 재사용, 다음 단위 초안은 워커 작성, o는 AC·소유·금지·검증 명령만 | 10항③ | **이번 단위에서 r 판정요청 패킷을 w3가 작성·전송**(고정·교정만 o 담당) |
| ④ 워커간 인계 부재 | 인계 계약(허가 사용자·임의 승인 금지), r 산출물은 다른 워커가 리뷰 | 10항④ | **w3가 r 최종 리뷰 패킷을 작성·전송**하고 r이 최종 판정 소유 |
| ⑤ 보고/CI 문서 커밋 루프 | 단위 묶음당 1회 커밋, 진행 추적 단일 보고 이슈 | 10항⑤ | 이번 단위 커밋은 r PASS 후 1회. 진행 추적은 #193 단일 이슈 |

## 4. DELTA(메시지 I/O 최소화) 영구화 — r 검증 기준 3항

- **① o 질의·인계 샘플이 요소 형식 + done 산출물 포함**: `playbook.md` §3에 실제 샘플 2개 추가
  (전달=`task/files/constraints/done/report`, 회신=`status/evidence/result/next`).
- **② 회신 4항목 형식**: `coordination-rules` 9항에 규칙 + playbook 샘플.
- **③ 반영 위치 ≥1곳·중복 없음**: 규칙 본체는 `coordination-rules` 9항 **1곳**이고, `agent-coordination`은 참조·강화,
  `playbook`은 샘플, `docs/orchestration.md`는 호스트 적용(1줄)이다. 규칙 중복 없음.
- 적용 범위: o 질의·워커 간 인계. "전체 대화 대신 대상·파일·제약만 전달"(기존 agent-coordination) 강화로 충돌 없음.

## 5. 남은 제약·미확인

- **dalmuti o 답변 미도착** → 콜백·폴백의 구체 설계는 문서 근거까지만 적용, 답변 수신 시 보완 검토.
- moi 답변(10:19 도착)은 r 최종 리뷰에서 답변 근거 포함 여부 판정 대상.
- 커밋은 **r PASS 전 금지**. push·PR·원격 쓰기 없음. PR #191 draft·#180 open·머지 보류 유지.
- 스크립트 신규 동작 없음(문서·규칙 최소 패치) → 검증은 skill 구조·portability·validate-repo·diff·100줄.
