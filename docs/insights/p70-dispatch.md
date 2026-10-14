# p70 분배 (2026-10-14 사용자 확정)

오케 가중치를 70/5/10/15로 확정한다. 워커 30/20/10/40은 유지한다. 이전 추천(속도 0.15)은 이 결정으로 대체한다.

## 계약

- `config/score-weights.json` orchestrator: performance 0.70, usage 0.05, speed 0.10, price 0.15.
- 코드 기본값도 같다. 파일이 없어도 이 값. 잘못된 설정은 예외.
- 오케 usage 소스를 켠다(OR·OCD, 워커와 같은 토큰). 가중만 가볍다. 가성비 결합(소스별 min-max 후 max)은 유지.
- 옛 95/2.5/2.5·70/0/15/15 단언은 새 값으로 고친다. 기대값을 완화하지 않는다.
- 사용량 열을 오케 레터 표에 되돌린다. 형식은 워커 표와 맞춘다.
- 실패 중인 insights 6건을 포함해 `pnpm test` 전체 실패 0. typecheck·validate-repo.py도 통과.
- 100줄 초과면 쪼개지 말고 경로를 보고하고 멈춘다. 커밋·실 API 금지.
- 결과 `scratch/reports/yoroi-p70-weights-70-5-10-15.md`: Top10(effort·4차원)과 사용량 열 예시, 테스트 수.

## 담당

| 라벨 | 범위 | 보고 |
| --- | --- | --- |
| w2 | 설정·기본값·테스트·사용량 열 | 위 md와 `scratch/reports/yoroi-p70-w2-report.json` |
| w4 | w2 리뷰. 재구현 금지 | `scratch/reports/yoroi-p70-review.md` |

labels.ts와 coord 스크립트는 소유 밖이다.
