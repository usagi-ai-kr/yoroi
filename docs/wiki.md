# Wiki 운영

- 게시 대상: [Yoroi Wiki](https://github.com/usagi-ai-kr/yoroi/wiki).
  canonical 저장소는 `usagi-ai-kr/yoroi`이며 이전 주소 `qus0in/yoroi`는 리다이렉트로만 남는다.
- 상태: 활성화되어 있고 clone 가능하다. Wiki 저장소는 `https://github.com/usagi-ai-kr/yoroi.wiki.git`
  (`master` 브랜치). 원본 초안은 [`docs/wiki-pages/`](wiki-pages/).
- 원본 규칙: Home은 저장소 `docs/assets/yoroi-haunted-armor.jpg` 마스코트를 참조한다.
  기존 Wiki에 없는 페이지는 삭제하지 않는다.
- 게시 절차:
  1. clone(없으면) 또는 갱신
     ```bash
     WIKI=/private/var/folders/6f/b2z9tlm92811sfkbvb3__76c0000gn/T/opencode/yoroi-wiki
     git clone https://github.com/usagi-ai-kr/yoroi.wiki.git $WIKI
     git -C $WIKI pull --ff-only
     ```
  2. 같은 이름의 페이지를 원본과 비교한다. 기존 Wiki 본문 가운데 원본에 없는 내용이 있으면 병합한다.
     ```bash
     diff -u $WIKI/Home.md docs/wiki-pages/Home.md
     ```
  3. 비교·병합이 끝난 뒤에만 원본을 복사한다.
     ```bash
     cp docs/wiki-pages/*.md $WIKI/
     ```
  4. 게시
     ```bash
     git -C $WIKI add -A
     git -C $WIKI commit -m "docs: <페이지별 요약>"
     git -C $WIKI push origin master
     ```
- 게시 후 기록: 원격 커밋 SHA, 변경 페이지, 확인 결과를 이 문서에 남긴다.

## 게시 기록

- 2026-10-21: `Usage-Cache-and-Zen-Free.md` 동기화.
  원격 커밋 `2db1615`(이전 `c931cc8`).
  #271 변경(quota 표식 없는 429는 락 미기록, `retry-after` 유무 확인, `ctx.session.wait()`
  15초 타임아웃 후 정상 완료 확인 시 해제, `retryAt` 경과는 `retry passed (unverified)`
  표시만)을 페이지에 반영했다. 나머지 9개 페이지는 원본과 동일해 변경하지 않았다.
  저장소 쪽 근거: `docs/insights/zen-free-271-relations-20261021.md`,
  `docs/insights/zen-free-271-review-r-20261021.md`.
- 그 이전 게시 이력은 `git -C $WIKI log` 로 확인한다.
