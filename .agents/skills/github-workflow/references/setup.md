# 원격 초기 설정

설정 요청에 포함된 대상 레포·원격·인증·기존 설정부터 확인한다.
아래 자리표시자는 실제 값으로 바꾸고 요청 범위에서만 실행한다.

## 브랜치와 머지

- 빈 레포는 첫 커밋·main 연결 후 dev를 만든다.
- 장기 dev는 merge commit, 머지 후 브랜치 유지, 지원 시 자동 머지를 사용한다.
- 자동 머지 기능 활성화와 실제 PR 머지의 허가는 구분한다.

```bash
gh api -X PATCH repos/<owner>/<repo> \
  -F allow_auto_merge=true -F allow_merge_commit=true \
  -F allow_squash_merge=false -F allow_rebase_merge=false \
  -F delete_branch_on_merge=false
```

## main 보호

필수 체크는 workflow가 아닌 job 이름이며 먼저 실제 성공 여부를 확인한다.
기존 보호 규칙은 조회하고 요청받은 항목만 변경한다.
아래는 새 1인 레포 예시다. 기존 설정을 이 본문으로 덮어쓰지 않는다.

```json
{
  "required_status_checks": {"strict": true, "contexts": ["ci"]},
  "enforce_admins": true,
  "required_pull_request_reviews": {"required_approving_review_count": 0},
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

JSON을 파일로 저장하고 허가된 요청에서
`gh api -X PUT repos/<owner>/<repo>/branches/main/protection --input <파일>`을 실행한다.
기능·요금제 제한이 있으면 미적용 항목을 기록한다.

## 라벨

호스트의 `.github/labels.json`과 기존 라벨을 비교해 요청된 항목만 생성·갱신한다.
명령 예시: `gh label create <이름> --repo <owner>/<repo> --color <색상> --description '<설명>'`.
기존 라벨 갱신이 허가된 경우에만 `--force`를 추가한다. 일괄 삭제하지 않는다.

## 확인

`gh api repos/<owner>/<repo>`, `gh api repos/<owner>/<repo>/branches/main/protection`,
`gh label list --repo <owner>/<repo>`로 실제 값을 확인하고 호스트 문서에 기록한다.
