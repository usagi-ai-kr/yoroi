# 하네스 스킬·규칙 독립 리뷰 (w1, `yoroi-harness-skill-review-w1`, 2026-10-16)

- 대상: w2 보고 `/tmp/yoroi-harness-skill-rules-w2-report.json` + **직접 diff**(스킬 3종·AGENTS·docs/skills·policy·coord-cli 읽기 전용 대조). 구현자(w2)와 다른 에이전트가 리뷰.
- 방법: 자기보고 신뢰 없이 diff·구조 검증·portability 확인. 권한 확대·규칙 삭제·계약 오단정 여부 점검.

## 판정: PASS (경미 문구 2건 직접 교정, 잔여 1건 안내)

### 1. AGENTS.md (64줄) — 승인 범위·기준 명확
- **추가만**: (a) "규칙 변경은 사용자 요청 시"+ "단, 하네스 문제 해결을 위한 규칙 개선은 사용자의 상시 요청 및 승인 범위 내" 근거 (b) 관측 문제 시 `harness-improvement` 즉시 적용·메타 무한 루프 금지 (c) 정책 문서·스킬 링크. **다른 규칙 삭제·변경 없음** ✓

### 2. 스킬 등록·배포 관행
- `docs/skills.md`: `coordination-rules`(누락분)·`harness-improvement` 행 추가, 표 형식 일치 ✓
- 배포: `.claude/skills`는 **tracked 상대 symlink**(`../.agents/skills`, mode 120000) — harness-improvement 자동 공유 확인(inode 동일). 새 링크 작업 불필요.
- `.codex`·`.opencode`: 저장소에 부재(추적 0) — **새 불필요 폴더 생성 금지 원칙에 따라 미생성**. 호스트가 관행을 도입하면 그때 링크만 추가.

### 3. 동작 규칙 (실사례 대조: done·JSON 누락·실제 CI success)
- `agent-coordination` SKILL 6항·`coordination-rules` 8항: `done + missing report` 시 추가 sleep 대신 실제 산출물·CI·외부 상태 즉시 대조, `no_report`↔미완료 구분, 자동 재전송 금지, 누적 대기 상한(최초 send 기준) — 사건 요구와 일치 ✓
- `coord-cli`(w2): 완료판정 불변 원칙 + "w1 contract 확정 전 확정값 임의 단정 금지·후속 연동" 기록 — 스크립트 소유권 보존, 허위 단정 없음 ✓

### 4. 직접 교정 (소유 파일 · 문구 2건)
- harness SKILL §2.2: "단위 테스트 반드시" → "**코드·스크립트 행동 변경은 단위/회귀 포함, 문서 전용 변경은 구조·링크 검증만**" (doc-only 불필요 unit 강제 방지) ✓
- harness SKILL §3 1회 루프: "같은 장애의 검증 실패 교정용 **bounded 수정·재검증은 루프 내 허용**(새 장애·범위 확장 금지)" 추가 — 1회 제한이 정당한 교정까지 금지하지 않도록 ✓

### 5. 잔여 (소유 밖)
- `docs/insights/harness-improvement-policy.md`에 동일한 "1회 루프" 문구가 교정 허용 단서 없이 남아 있음 → w2/문서 담당 정합 권고(이 단위에서는 미수정).
- coord-cli의 신호·exit 4/5/6·1800s 상수 문서 반영은 w1 스크립트 계약 확정 후 w2 몫(해당 문서 수정 금지 준수).

### 6. auto-trigger 근거
- 상시 규칙(AGENTS 로드) + 스킬 목록·설명(트리거 문구 포함) + **실제 사례**: 이번 세션 done/report 누락 사건에서 별도 사용자 지시 없이 코드(`coord_completion`)·규칙 개선이 적용됨. 추측성 확장·권한 확대·커밋/배포 없음.

## 검증

- skill validate PASS(harnss-improvement·coordination-rules) · portability 위반 0 · validate-repo PASS. 전 파일 ≤100줄(27·64·89·38·28·24).
- 이 단계 커밋·push·PR·merge·Release·global·letter 없음. ROOT 스크립트·coord-cli 수정 없음(동시 리뷰 소유 보존).
