# p71 분배 (2026-10-14)

w2(`w12:p0`)에는 보내지 않는다. 가중치 파일·labels.ts·coord 스크립트는 소유 밖이다.

## A. agy 5시간 창 조사 (w1, 수정 금지)

- once에서 agy는 `g-w`·`c-w`·5시간 1개만 온다. 그 id는 `claude-and-gpt-models:five-hour-limit-remaining`이라 표시가 `c-5h`다.
- `src/infra/agy-source.ts` 파싱과 캐시·fixture·DB만 본다. 실 API 금지.
- 결론 하나: (i) 원래 없음 (ii) 파싱에서 탈락 (iii) 다른 창에 합쳐짐. 근거는 파일:줄과 캐시 키.
- 고칠 점이 있어도 고치지 말고 제안만. 사용자 결정으로 올린다.
- 산출 `scratch/reports/yoroi-p71-agy-5h-investigation.md`.

## B. 이슈 #119만 (w3)

- https://github.com/qus0in/yoroi/issues/119 본문·댓글을 읽고 남은 작업만 한다. 이미 된 부분은 반복하지 않는다.
- #133·#134·#135·#136·#137·#118·#127은 하지 않는다.
- 요금제 데이터는 `plan-catalog.ts`와 `docs/insights/sources-*.md` 규칙을 따른다. URL과 확인 날짜를 남긴다.
- 소유 밖 파일이 필요하면 고치지 말고 경로를 보고한다.
- 커밋·이슈 close 금지. 본문 갱신이 필요하면 제안만.

## 담당

| 라벨 | 범위 | 보고 |
| --- | --- | --- |
| w1 | 조사만 | 위 md와 `scratch/reports/yoroi-p71-w1-report.json` |
| w3 | #119 남은 구현 | `scratch/reports/yoroi-p71-issue-119.md` |
| w4 | w3 리뷰·w1 결론 대조. 재구현 금지 | `scratch/reports/yoroi-p71-review.md` |
