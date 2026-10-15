# xAI 행·0.12.0 잔여 운영 정리 (2026-10-15)

- 사용자 위임: 남은 항목 알아서 처리, xAI 수집·새 출력 행 조사·제거 또는 변경 판단.
- yo2 결정: yoroi once --pretty --full. ~/.zshrc 해당 alias만 수정.
- 0.12.0 milestone은 최신 원격 상태를 읽고 open0이면 close한다.
- 미커밋3건은 실제diff와 소유권을 검토해 작업단위 문서 정리에 포함할지 결정한다.
- 추가기능·다른설정·모델세션변경 금지. README·AGENTS 수정 금지.
- 단계1 결과를 확인한 뒤 단계2 구현·독립리뷰·검증·필요한PR을 별도 배정한다.

| 단계1 | 담당 | 소유 및 보고 |
| --- | --- | --- |
| xAI 실제 계약·제거 영향 조사 | w2 | scratch/reports/yoroi-xai-investigation-w2.json |
| xAI 독립 판단·최소변경안 | w3 | scratch/reports/yoroi-xai-options-w3.json |
| 기존 릴리스 문서 정정·잔여검토·milestone 확인 | w1 | roadmap·release-status·tasks 및 scratch/reports/yoroi-012-cleanup-w1.json |
| yo2 alias 수정·검증 | w4 | ~/.zshrc alias한곳 및 scratch/reports/yoroi-yo2-w4.json |

- w1은 사용자 orchestration.md 기존diff를 읽고 검토만 한다. 원본diff 보존.
- 단계1 커밋·push·PR·새공급자API 호출 금지. milestone22 close만 scoped 외부쓰기 허용.
- 보고 task_id·modified_files·verification_results·provenance.worker_actions·conclusion.
- 각 단위5분, 소유밖수정금지·시크릿개인사용량원본미노출·memo수정금지.
- 중단시 새작업을 멈추고 기존변경과 완료외부조치를 보존해 보고한다.


## 운영 정리 결정

- yo2 한줄 수정·문법·실제로드 검증 완료. 다른 설정 불변.
- milestone22는 이미closed(open0) 확인. #119closed·#147open0.13.0 유지.
- roadmap·release-status·tasks 발행완료 표기 정정, 이력보존·validate PASS.
- 기존 사용자 orchestration.md diff 및 PR148 배정문서2개는 독립검토후 문서단위로 커밋한다.
- w4는 문서7개 실제diff·소유·비밀값·100줄·사용자변경보존 독립리뷰를 맡는다.
- 리뷰보고 scratch/reports/yoroi-ops-doc-review-w4.json.
- Git변경은 리뷰완료뒤 한워커에만 별도배정한다. 리뷰중 커밋·push 금지.
