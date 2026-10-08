# Wiki 운영

- 게시 대상: [Yoroi Wiki](https://github.com/qus0in/yoroi/wiki). Wiki는 private 저장소에서 활성화되어 있다.
- 상태: 사용자가 초기 Home을 생성해 clone 가능 상태다. clone `master`의 초기 commit은 `b8472a2`; 기존 페이지는 Home 한 개이며 `Welcome to the yoroi wiki!` 문구를 원본에 보존했다.
- 원본 초안: [`docs/wiki-pages/`](wiki-pages/). Home 및 새 5개 안내 페이지, `_Sidebar.md`를 관리한다.
- Home은 저장소의 `docs/assets/yoroi-haunted-armor.jpg` 마스코트를 참조한다. 게시 전 이미지가 최종 main에 포함됐는지 확인한다.
- 최초 clone: `git clone https://github.com/qus0in/yoroi.wiki.git /tmp/yoroi-wiki-checkout`
- 기존 clone 갱신: `git -C /tmp/yoroi-wiki-checkout pull --ff-only`
- 게시 전 `diff -u /tmp/yoroi-wiki-checkout/Home.md docs/wiki-pages/Home.md`로 Home을 비교하고 같은 이름의 다른 페이지도 병합한다. 초안에 없는 기존 페이지는 삭제하지 않는다.
- 비교·병합 후에만 `cp docs/wiki-pages/*.md /tmp/yoroi-wiki-checkout/`를 실행한다.

## 게시 게이트

- root handoff 기준 coordination skill/scripts, P3 CI classifier/`validate-repo.py --ci`, 버전 dry-run/apply·검증 SHA 절차를 Wiki 원본에 반영했다. docs-only는 app install/check를 생략하되 `ci` status는 유지하고 skill 변경은 full check다.
- P2 `--pretty` once/watch 호출과 표 열·누락값·오류 표시·기본 진단 출력 유지를 Wiki에 반영했다. root 결과에서 5개 공급자 smoke와 pretty 렌더링을 확인했다. 마지막 type/import/watch 테스트 정정은 P2에 남아 있고 CLI 사용법 변경은 없다.
- Wiki 게시 게이트: root의 P2/P3 완료 보고와 후속 PR 최종 merge SHA를 받은 뒤에만 게시한다. 현재는 초안 보존 단계이며 commit/push하지 않는다.
- 이후 게시 명령:
  ```bash
  git -C /tmp/yoroi-wiki-checkout add Home.md Getting-Started.md Providers-and-Authentication.md Worker-Operations.md Checks-and-Troubleshooting.md _Sidebar.md
  git -C /tmp/yoroi-wiki-checkout commit -m "docs: publish Yoroi wiki guides"
  git -C /tmp/yoroi-wiki-checkout push origin master
  ```
- 초기 페이지 생성은 해결됐다. GitHub 공식 절차는 첫 페이지를 웹에서 저장한 뒤 Wiki Git 저장소를 clone하는 순서다.
- 신규 scripts 운용 안내는 P2 handoff 범위에서 반영했다. P3 완료 후 확정된 docs-only 분류만 Wiki에 기록했다.
