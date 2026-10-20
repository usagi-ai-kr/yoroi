# MiniMax M3.1 Flash 반영 기록 (w1, 2026-10-20)

근거: `docs/insights/letter1020-model-triage.md` §2 (직접 조회 공식 근거).
w3 운영 패널 표시 자체는 점수 근거로 쓰지 않았다. 실모델 호출 없음.

## 공식 근거 (triage §2 인용)

- MiniMax 블로그(2026-10-19 M3.1 Flash 정식 롤아웃): Space Bunny는
  초기 버전이며 별개 id 유지, 자동 병합 금지.
- OpenCode Go 문서: "MiniMax M3.1 Flash Free" (limited time),
  Model ID `minimax-m3.1-flash-free`, Free·Unlimited. 확인된 제공은
  OpenCode Go·Go Plus뿐,他 계획 추가 금지. 무료 한정 제공이다.

## 변경 (소유 파일만)

- `plan-catalog.ts` opencode-go-plus에 `minimax-m3-1-flash-free` 추가
  (verified·free·limited time note, 2026-10-20). Space Bunny는 별도
  항목으로 분리하고 초기 버전 관계 note만 둔다.
- `model-aliases.ts`에 `minimax-m3-1-flash-free` → `minimax-m3-1-flash`
  명시 alias (접미 -free 차이, sourceUrl·checkedOn 포함).
- AA `-free` 접미 연결: effort 접미어가 아니라 base에 남음을 확인.
- 벤치마크 점수 이식 없음. Free 전용 판정 결과는 회귀로 확인.

## 검증

- 집중 3/3 통과. 전체 `pnpm run check` 백그라운드 결과: 기존
  `insights-plan-catalog.test.ts` 1건 실패(소유 밖, 미수정).
  `freeOnlyModelIds() []` 가정이 `free: true` 신규 항목과 충돌.
  triage §2가 예견한 확인 항목으로, 기대값 갱신 여부는 총괄 결정 필요.
- 100줄 이하(테스트 38줄). 커밋·원격 금지, w2 리뷰 대기.
- store 독립 리뷰는 w3에 요청할 것이므로 직접 수정하지 않는다.
