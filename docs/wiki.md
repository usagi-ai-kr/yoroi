# Wiki 운영

- 게시 대상: [Yoroi Wiki](https://github.com/qus0in/yoroi/wiki). Wiki는 private 저장소에서 활성화되어 있다.
- 상태: 사용자가 초기 Home을 생성해 clone 가능 상태다. clone `master`의 초기 commit은 `b8472a2`; 기존 페이지는 Home 한 개이며 `Welcome to the yoroi wiki!` 문구를 원본에 보존했다.
- 원본 초안: [`docs/wiki-pages/`](wiki-pages/). Home 및 새 5개 안내 페이지, `_Sidebar.md`를 관리한다.
- Home은 저장소의 `docs/assets/yoroi-haunted-armor.jpg` 마스코트를 참조한다. root는 PR #62에서 같은 이미지의 최종본을 main에 포함하고 눈으로 확인했다고 보고했다.
- 최초 clone: `git clone https://github.com/qus0in/yoroi.wiki.git /tmp/yoroi-wiki-checkout`
- 기존 clone 갱신: `git -C /tmp/yoroi-wiki-checkout pull --ff-only`
- 게시 전 `diff -u /tmp/yoroi-wiki-checkout/Home.md docs/wiki-pages/Home.md`로 Home을 비교하고 같은 이름의 다른 페이지도 병합한다. 초안에 없는 기존 페이지는 삭제하지 않는다.
- 비교·병합 후에만 `cp docs/wiki-pages/*.md /tmp/yoroi-wiki-checkout/`를 실행한다.

## 게시 게이트

- PR #62 구현은 `1b3b02745ba2f1fe8c8e2f3b7ef05e856ada69ee`로 main에 병합됐고 PR CI run `37720540457`은 성공했다. root 보고: 단위 136, BDD 25시나리오/144 step, Python script 19, pretty 9 cases 통과; 5개 공급자 pretty smoke 확인.
- Wiki 원본에는 coordination skill/scripts, P3 CI classifier/`validate-repo.py --ci`, version dry-run/apply·검증 SHA, pretty 호출/표 계약을 반영했다. docs-only는 app install/check를 생략하되 `ci` status는 유지하고 skill 변경은 full check다.
- 이 안내 초안은 0.3.0 병합 후 root가 remote Wiki에 게시한다. 이번 작업에서는 로컬 문서만 수정하며 push하지 않는다.
- 이후 게시 명령:
  ```bash
  git -C /tmp/yoroi-wiki-checkout add Home.md Getting-Started.md Providers-and-Authentication.md Worker-Operations.md Usage-Cache-and-Zen-Free.md Checks-and-Troubleshooting.md _Sidebar.md
  git -C /tmp/yoroi-wiki-checkout commit -m "docs: publish Yoroi wiki guides"
  git -C /tmp/yoroi-wiki-checkout push origin master
  ```
- Wiki 첫 페이지 생성은 해결됐다. GitHub 공식 절차는 첫 페이지를 웹에서 저장한 뒤 Wiki Git 저장소를 clone하는 순서다.
- Wiki를 게시한 뒤 remote commit SHA와 여섯 페이지/Home 보존 확인 결과를 [#58 결과 이슈](https://github.com/qus0in/yoroi/issues/58)에 기록하고 확인한다. 게시 증거가 확인되기 전에는 완료로 표시하지 않는다.
