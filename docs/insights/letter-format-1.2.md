# 1.2.0 레터 형식 개편: 본문 Top7 + 댓글 Top15·Free (2026-10-16)

## 사용자 요구

> 인사이트 레터를 본문에 Top7·Top7을 각각 적고, 그다음 댓글로 Top15·Top15·free tier를 각각 달아주는 것으로 개편.

## 설계 (o 확정)

- **선발 범위**: `TOP_N` 10 → **15**. 존 통과 행을 먼저 놓고 ▽ 보충·밴·임계·표시 점수 보정 규칙은 그대로 15개에 적용한다. 본문은 같은 목록의 **앞 7개**만 쓴다(재계산 없음).
- **이력·변동**: 순위 이력(`previousRanks`)과 진입/🚪 판정은 Top15 기준이다. 본문 Top7의 변동 칸은 같은 값을 쓰고, 🚪 퇴장 목록은 Top15 댓글에만 둔다.
- **본문(issue body)**: 제목 헤더, 배지, 요약, 🧭 오케 **Top7**, 🛠 워커 **Top7**, 범례, `<details>` 출처·산출 공식. Free 섹션은 본문에서 뺀다.
- **댓글(순서 고정, 3개)**:
  1. `## 🧭 오케스트레이터·리뷰어 Top15` 표와 🚪 퇴장
  2. `## 🛠 워커·메신저 Top15` 표와 🚪 퇴장
  3. 기존 Free tier 섹션 전체(측정·미측정 포함)
- 각 부분은 `MARKDOWN_LIMIT` 안에서 행 경계 기준으로 자른다. 표 머리·열은 기존과 같다.

## 인터페이스 계약

- `src/insights/letter-markdown.ts`: `renderLetterParts(data) → LetterParts`, `type LetterParts = { body: string; comments: readonly [string, string, string] }`
  - `renderTop10Markdown(data)`는 `joinLetterParts(parts)`를 돌려준다. 이 값은 `insights once --markdown` 미리보기용이다.
  - `joinLetterParts` 형식: body 뒤에 각 댓글을 `\n\n<!-- yoroi:comment N -->\n` 구분자로 붙인다.
- `renderTop10MarkdownFromRecords`와 짝을 이루는 `renderLetterPartsFromRecords(input) → LetterParts`를 추가한다.
- `src/composition/insights-publish.ts`: `PublishLetterOptions.render: () => Promise<LetterParts>`
  - 이슈를 만든 뒤 댓글 3개를 순서대로 `gh issue comment <n> --body-file`로 단다.
  - Free 가드(`freeSectionProblem`)는 댓글 3에 적용한다.
  - 댓글이 하나라도 실패하면 이전 레터 close를 하지 않고 실패 코드로 끝낸다. 이미 만든 이슈는 그대로 둔다.
  - dry-run에는 `comments=3`을 표시한다.
- `src/composition/insights-cli.ts`: publish에는 `renderLetterPartsFromRecords`를 넘기고, `once --markdown`은 `joinLetterParts`를 그대로 출력한다.

## 분배

| 담당 | 범위 | 소유 |
| --- | --- | --- |
| w3 (p19) | 렌더: TOP_N 15, 본문 Top7/댓글 Top15·Free 분리, `renderLetterParts`·`joinLetterParts`·`renderLetterPartsFromRecords`, 렌더 테스트 기대값 갱신 | `src/insights/letter-markdown*.ts`, `src/insights/letter-top10-{unified,render,legend,history}.ts`, 새 렌더 파일, 렌더 관련 `tests/insights-letter*.test.ts` |
| w1 (p17) | 발행: 이슈 생성 후 댓글 3개, 실패 처리, Free 가드 이동, CLI 연결, 발행 테스트 | `src/composition/insights-{publish,cli}.ts`, `src/insights/letter-free-guard.ts`, `tests/*publish*.test.ts` |
| w2 (p18) | 잡무: milestone `1.2.0`과 추적 이슈 생성, `docs/insights/letter-issue.md` 형식 절 갱신, roadmap 한 줄 | `docs/insights/letter-issue.md`, `docs/roadmap.md` |

- 서로의 소유 파일은 읽기 전용이다. 계약 타입이 필요하면 w1은 `LetterParts`를 import만 한다(w3가 export).
- 상대 구현이 아직 없어 생기는 typecheck 실패는 보고에 적고, o가 통합한다.
- 끝나면 교차 리뷰한다(w1 ↔ w3).

## 완료 기준

- 본문에 오케·워커 표가 각각 정확히 7행이고, 댓글 1·2는 각각 최대 15행, 댓글 3은 Free 섹션이다.
- 1–7위 모델·순서·점수가 같은 스냅샷의 1–7위와 같다. 15로 늘려도 앞 순위는 바뀌지 않는다.
- 발행 테스트: 생성 → 댓글 3개 순서 → 이전 레터 close. 댓글 실패 시 close하지 않는다.
- typecheck, 전체 unit, validate PASS. 파일당 100줄 이하. 커밋·버전·PR·발행은 o가 통합한다.
