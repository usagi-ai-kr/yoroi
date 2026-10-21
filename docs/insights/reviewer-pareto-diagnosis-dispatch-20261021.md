# 리뷰어 파레토 진단 분배 (2026-10-21)

- 이슈: #239. #233에서 분리. #241 리뷰어 Top7 7행 중 파레토 1행(`claude-haiku 81.5`)의 원인을 진단한다.
- 범위: **읽기 전용 진단** — 코드·테스트·점수·가중치를 바꾸지 않는다.
  실제 실행 입력은 보존되어 있지 않으므로, 코드 경로와 합성 fixture로 확인 가능한 것과
  다음 실행에서 계측해야 할 것을 구분한다.

## 확인 항목

1. `letter-reviewer-pareto.ts`의 지배 규칙(score≥·cost≤, strict, 결측=비파레토) 재확인.
2. `insights-reviewer-candidates.ts`에서 reviewer 후보의 `cost`가 어디서 오는지
   (effectiveCost ?? blendedCost), 어떤 후보가 결측이 되는지.
3. #241 리뷰어 Top7/전체 후보에서 1행만 남는 원인:
   - 비용 결측 후보가 많은가
   - 최고 점수 후보가 최저 비용까지 가져가는 실제 지배인가
4. 합성 fixture로 ① 결측 다수 ② 최고점·최저비용 동일 후보 ③ trade-off 후보를 재현한다.
5. 선택지 비교: 현행 유지 / 결측을 "비교 불가(파레토 아님, 사유 표시)" / tolerance / 비용 구간.
6. 권고안과 다음 계측(예: 후보별 score·cost coverage 로그, 표시 사유)을 제안한다.

## 제약

- 점수·가중치·순위·파레토 계산 변경 금지. 이 단위는 진단·제안만.
- 실제 API 재호출·외부 쓰기·레터 발행·커밋·push 금지.
- 소유 문서 `docs/insights/reviewer-pareto-diagnosis-20261021.md`만 작성.
- `python3 scripts/validate-repo.py`, `git diff --check` 통과.

## 산출

- 진단 문서(100줄 이하) + JSON 보고서.
- 권고가 코드 변경을 요구하면 별도 패킷 초안(파일·테스트·완료 기준)을 보고서에 포함.
