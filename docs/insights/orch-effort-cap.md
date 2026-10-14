# 오케 대표 effort 상한 high (p63, 2026-10-14 사용자 결정)

> **p64 폐기 (2026-10-14 사용자 확정):** 이 문서의 상한(high 이하, xhigh·max 제외)은 구현하지 않는다.
> 대신 오케 가중치를 70/0/15/15로 바꿔 속도·가성비가 대표 effort를 바꾸게 하고, Cognition USD/task를
> 오케 가성비 차원에 넣는다. max·xhigh는 후보로 유지한다([four-source-score.md](four-source-score.md)).
> 아래 p63 결정·해석·배정은 이력으로 보존한다.

## 결정 (메신저 코테츠 전달, 사용자 확정)

- 오케스트레이터·리뷰어의 대표 effort 후보에서 **max를 제외하고 high 이하만** 쓴다. 사용자는 오케에 medium·high까지만 쓴다.
- 이유: max는 사용량을 너무 빨리 소모한다. 현 규칙(p58 변형별 P1 점수 최고)은 성능 가중 95%라 대부분 max가 뽑혔다.
- 워커·메신저 역할은 범위 밖이다. 워커 effort 규칙·점수·Top10은 바꾸지 않는다.

## 해석 (o 적용, 이견은 메신저 확인 항목으로 보고)

- 허용 effort: `minimal`·`low`·`medium`·`high`, 그리고 effort 개념이 없는 `default`. **`xhigh`도 high 초과라 제외**한다.
- 표준화 풀: 상한 적용 후 남은 변형만으로 표준화한다(제외 변형은 풀에서도 빠진다). 동점은 낮은 effort 유지.
- 허용 변형이 하나도 없는 모델(관측 effort가 xhigh/max뿐)은 오케 후보에서 제외한다. 해당 모델 목록을 보고서에 적어 메신저 확인으로 올린다.
- 상한은 정책 상수 하나로 둔다(예: `ORCHESTRATOR_EFFORT_CAP = 'high'`). 하드코딩 분산 금지.

## 배정

| 담당 | 패킷 | 범위 |
| --- | --- | --- |
| w3 `w12:p11` | scratch/packets/yoroi-p63-w3.json | 제품 구현·단위 테스트·top10-scoring 문서 |
| w4 `w12:pV` | scratch/packets/yoroi-p63-w4.json | p61-w4b 완료 뒤 독립 재계산·대조·주 보고 append |

### w3 구현

- `src/insights/letter-top10-score-policy.ts`: 상한 상수 추가, 주석에 p63 결정 기록.
- `src/insights/letter-top10-score-raw.ts` `orchestratorVariants`: 상한 초과 effort 제외. 허용 변형이 없으면 빈 배열을 돌려
  `letter-top10-score.ts`에서 그 모델 행을 만들지 않게 한다(`['default']` 대체 금지, 실제 default 관측일 때만 default).
- `src/insights/letter-top10-score.ts`: 필요한 최소 수정·주석만.
- `tests/insights-orchestrator-effort.test.ts`: max 성능이 가장 높아도 high 이하가 대표가 되는 경우, xhigh 제외,
  max-only 모델 오케 제외, 워커 결과 불변, default 단일 모델 유지 케이스를 추가.
- `docs/insights/top10-scoring.md`: 오케 대표 effort 규칙에 상한 1~3줄. 파일 100줄 이하 유지.
- 검증: 관련 node:test(orchestrator-effort·top10-unified·gpt-sol-independence·top10-rank), `pnpm exec tsc --noEmit`, `validate-repo.py`.
  전체 931 반복 금지. 실 API 금지.

### w4 재계산 (w3 코드와 독립)

- 입력 `/tmp/yoroi-p56-runtime-input.json`(2026-10-13 사본)·`scratch/reports/p60-candidate-pool.json`. 신선도를 현재로 꾸미지 않는다.
- 본인 스크립트(`scratch/tmp-p63-w4/`)로 상한 적용 오케 Top10을 독립 계산: 모델·추천 effort·점수·4차원.
  w3 구현 완료 후 제품 `computeRoleTop10` 출력과 20행(오케10+워커10) 대조, 워커 10행은 p58·p60 값과 동일해야 한다.
- 변화 표: 이전(p60) 오케 Top10·effort 대비 순위·effort 변화, 제외된 모델, 두 Sol 위치.
- 주 보고 `scratch/reports/yoroi-worker-cognition-openrouter.md`에 p63 절 append(100줄 초과 시 p61-w4b 관례로 분리).

## 공통

커밋·stage·push 금지, 기존 변경 보존, 모델·세션 변경 금지, 비소유 파일 읽기 전용, 5분 단위 진척, report_path JSON.
