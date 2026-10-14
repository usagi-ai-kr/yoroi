# p69 분배 (agy c-5h 라벨)

coord·usage 격자와 파일을 공유하지 않는다. 그 작업을 되돌리지 않는다.

## 계약

- `yoroi once`의 agy 5시간 창이 `5h`만 나온다. 계열이 둘 이상이면 길이 1 그룹도 stages가 있을 때 접두어를 붙인다. 목표는 `c-5h`.
- 유지: claude `5h`·`w`, codex `5h`, opencode-go `m`·`w`·`5h`, agy `g-w`·`c-w`.
- id가 `claude:five-hour`가 아니면 실제 id로 같은 목적을 달성하고 근거를 적는다.
- 소유는 `src/ui/cli/labels.ts`와 `tests/window-labels.test.ts`뿐. 다른 파일 추가·수정 금지. 100줄을 넘기면 쪼개지 말고 멈추고 보고한다.
- 테스트: agy → `g-w`, `c-w`, `c-5h`. claude → `5h`, `w`. 기존 라벨 테스트 통과.
- 결과 `scratch/reports/yoroi-p66-agy-5h-label.md`에 예시 출력을 남긴다. 커밋·실 API 금지.

## 담당

| 라벨 | 범위 | 보고 |
| --- | --- | --- |
| w1 | 구현·단위 테스트·예시 보고 | `scratch/reports/yoroi-p69-w1-report.json` |
| w4 | w1 리뷰. 재구현·파일 수정 금지 | `scratch/reports/yoroi-p69-review.md` |
