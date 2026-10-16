# R 1.0.2 staging 계획

## 상태
- real repo: staged 0(사전 stage 없음). dev `3fd5549` tree == origin/main `69889876` tree, dev가 main의 조상 → ff 가능.
- base origin/main `698898767`. clean `/tmp/yoroi-r-clean` 버전 1.0.2, manifest 50파일 해시.

## staging 설계 (HEAD·real index·branch 무변경)
- 별도 index `/tmp/yoroi-r-stage-index/index`를 `git read-tree origin/main`으로 초기화.
- `GIT_INDEX_FILE=… GIT_WORK_TREE=/tmp/yoroi-r-clean git add -- <manifest 50파일>` → staged 49(=letter-top10.test는 main과 동일해 무변경).
- worker hunk(score.ts effort fallback·four-source 워커행) staged diff 0 확인. secret/raw/orchestration/worker-effort 제외 확인.
- temp index sha256 `0c5c09ca…`. real repo staged 0 유지.

## dirty 5 보존 (미커밋, 해시)
- four-source-score `2ec2f113…`·orchestration `f6ff5155…`·score.ts `0f766be8…`·takeover `bcbb80d2…`·worker-effort test `303ced25…`.

## 후속 (금지 유지)
- commit·dev push·PR은 다음 단계. release-status/tasks는 w1 소유(완료 보고 후 포함).
