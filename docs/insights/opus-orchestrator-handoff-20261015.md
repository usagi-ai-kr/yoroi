# Opus 오케스트레이터 인계 (2026-10-15, w2-codex가 작성)

새 오케스트레이터에게 0.12.1 마감 현황과 다음 행동을 인계한다. 모든 값은 기존 문서·보고서에서만
가져왔다(추정 없음). 0.12.1 마감 체인(머지·CI·Release·전역 설치·독립 검증)은 전부 완료다.

## 현재 역할·배정 방법

- 메신저: 코테츠(사용자 직통). 오케스트레이터: `w12:p13` o-opus. 워커: `w12:p12` w1-claude,
  `w12:p14` w2-codex, `w12:pV` w3-gemini, `w12:p16` w4-opencode(모델은 화면 확인값, 변경 금지).
- 라벨·pane id는 세션마다 바뀔 수 있다. 배정 전 coord CLI `status`로 재확인한다(로스터는
  docs/orchestration.md의 1열 백틱 pane·2열 라벨 계약). 모델·세션 변경은 사용자 결정, 금지.
- 분배·상태·전송·감시는 `python3 .agents/skills/agent-coordination/scripts/coord.py`만 사용.
  herdr 원시 명령·키 입력·화면 직접 조작은 금지, CLI 미지원 조작은 메신저에게 요청.
- 워커 패킷은 `/tmp/<task_id>-packet.json`, 보고는 패킷 `report_path`(현재 `scratch/reports/`).
  리뷰는 구현자가 아닌 w1-claude가 원칙(자기 구현 자기 리뷰 금지).

## 0.12.1 마감 상태 (완료 구분)

- **PR #149 머지 완료**: merge SHA `dd589e5a97ca9a980c1543aee46ca9dcddc8d953`, origin/dev `70cb850` 보존
  (scratch/reports/yoroi-0121-merge-w1.json).
- **main CI 성공 확인**: workflow_dispatch run 38680686665, conclusion=success, headSha가 merge SHA와
  일치(yoroi-0121-release-w3.json).
- **v0.12.1 tag·Release 발행 완료**: target=tag SHA=merge SHA 완전 일치 사후검증.
  https://github.com/qus0in/yoroi/releases/tag/v0.12.1 (npm publish 없음).
- **전역 CLI 갱신 완료(2026-10-15 13:23)**: merge SHA `dd589e5`의 격리 worktree 빌드로 전역 재설치 완료.
  `yoroi --version`=0.12.1, `pnpm run update:global --check`=repository 0.12.1/global 0.12.1 exit 0,
  활성 설치 dist가 해당 SHA 빌드와 파일 해시 일치(518d58f8a061e540). 설정 .env는 0600 사본 보존
  (다이제스트 일치, 값 미출력), 자기 생성 worktree/temp 정리 완료(yoroi-0121-global-w4.json).
  독립 검증: PR149 merged·main CI success·tag/Release SHA 일치·활성 CLI 0.12.1/check exit 0 확인,
  validate-repo PASS 600 files(yoroi-0121-final-review-w1.json). **동일 설치 재배정 금지(중복 금지)**.
- **0.12.1 milestone은 없다**: 미생성 유지(생성 금지 준수, yoroi-0121-status-w4.json).
  0.12.0(#22) closed/open 0, 1.0.0(#23) open 유지.

## 0.13 유지 지시 (변경 없음)

- #147 OPEN·milestone 0.13.0(#24) open 유지. 새 issue/milestone 생성 금지, main 직접 push 금지.
- 0.12 마감 완료 확인 후 0.13 착수. 착수 순서는 실계정 경로 검증부터 2단계 워커 순환
  (docs/insights/xai-013-zen-preflight.md의 단계1→단계2 흐름 유지).
- 로컬 opencode stats 누계는 구독 사용량 근거로 채택하지 않는다(사용자 지시).

## Zen 감사 상태 (검증 대기 쟁점)

- 3결함은 합의: ① V2 model/error shape 미대응 ② 모든 429의 zen 오탐 ③ 성공 --ok 경로 누락(치명,
  잠금 영구 잔존). 상세는 scratch/reports/yoroi-preflight-zen-final-audit-w2.json(w2),
  yoroi-preflight-zen-completion-w3.json(w3), yoroi-preflight-zen-state-w4.json(w4).
- **미확정 쟁점(자료 범위 차이)**: 완료 판정 필드(`time.completed`/`finish==='stop'`)의 공식 계약 실재.
  w2는 공식 V2 OpenAPI 스키마(dev.opencode.ai/openapi.json)에서 필드 실재·공식 경로는
  `ctx.session.wait()` 대기 후 context 완료 검증이라 보고, w3는 plugins 문서 페이지 표면에서 스키마를
  재확인하지 못했다고 보고(release-0121-close.md 18행). 재대조가 다음 Zen 검증 단위다.
- 이전 "Zen 사용증거 없음" 단정은 철회됨(오늘 V2 저장소에 free 모델 활동이 실재). 단 이는 활동
  (activity) 근거일 뿐이며, 확정 성공 완료(success, ok 경로 부재로 저장 lock의 정확한 해제)나 quota
  완전 해제를 입증하지 않는다. 저장 200행의 공급자 귀속 단정도 금지 — 활동/확정 성공/quota 해제를
  항상 구분해 서술한다.
- Zen 수정 시 보수적 방향·소유 파일·합성 회귀 계약(신규 A~D)은 w2 감사 보고서를 따른다.

## 보존·금지

- 미커밋 docs 3건을 보존한다(덮어쓰기·삭제 금지): docs/insights/release-0121-close.md,
  docs/insights/xai-013-zen-preflight.md, docs/insights/opus-orchestrator-handoff-20261015.md(본 문서).
- PR 머지 승인·권한·요금제·환경변수는 사용자 조치, 메신저가 전달한다. 오케스트레이터 임의 승인 금지.
- 토큰·설정 값·대화·개인 사용량 원본·개인 경로를 이슈·로그·보고에 노출하지 않는다.
- memo 이슈는 읽기만. 커밋·push는 사용 요청 시만, main 직접 push 금지(dev→main PR 사용).

## 다음 Opus 최초 명령 (예시)

1. `coord status`로 워커 4명 상태 확인(모델 변경 금지, 라벨 재확인).
2. 기존 미커밋 docs 3건 보존을 분배 지시에 포함(위 보존·금지 항목).
3. 0.13 착수: #147 인증 응답 검증 단위를 워커에게 배정(0.12 마감 완료로 선행조건 충족, 실계정
   경로 검증부터 2단계 워커 순환).
4. 병렬로 Zen 계약 대조 단위 배정: 완료 필드(`time.completed`/`finish==='stop'`) w2 OpenAPI vs
   w3 문서 페이지 자료 범위 차이 재대조.
5. 전역 설치 재배정 금지(이미 merge SHA 기준 재설치·검증 완료).
