# p68 분배 (2026-10-14 사용자 승인)

라벨 `o`·`w1`~`w4`가 w12(yoroi)와 w15(smallb)에 둘 다 있다. 라벨만으로 고르면 오배송된다. 실측: 라벨 `o` 확인이 `w15:p1`을 봤고, 전송은 `w12:p13`에 갔다. usage 격자와 가성비 결합은 이 패킷으로 되돌리지 않는다.

## 계약

- 기본 워크스페이스는 로스터 pane의 `:` 앞 접두가 하나일 때의 그 값이다. 접두가 여러 개이거나 cwd로 하나를 확정할 수 없으면 오류.
- 같은 라벨이 둘 이상의 워크스페이스에 있으면 첫 번째를 고르지 말고 멈춘다. 예: `ambiguous label 'o': w12/w15`.
- `--workspace <id>`로 지정한다. status·packet·send·audit·watch가 같은 규칙을 쓴다.
- 확인·대기는 pane id로만 한다. 다른 워크스페이스의 같은 라벨을 보지 않는다.
- 해석 로그에 workspace_id를 라벨·pane과 함께 남긴다.
- 각 파일 100줄 이하. 넘으면 모듈을 나눈다. 기존 단일 라벨 동작과 test_coord.py는 유지한다.
- 가짜 herdr로 시험한다. 실 herdr 호출은 status 1회 이하. 실 API 금지.

## 담당

| 라벨 | pane | 범위 | 보고 |
| --- | --- | --- | --- |
| w2 | 로스터 w2 | coord.py·coord_herdr.py·테스트 | `scratch/reports/yoroi-p68-w2-report.json` |
| w3 | 로스터 w3 | coord-cli.md·orchestration.md 주의 문장 | `scratch/reports/yoroi-p68-w3-report.json` |
| w4 | 로스터 w4 | w2·w3 리뷰. 재구현 금지 | `scratch/reports/yoroi-p68-review.md` |

주 보고 파일은 수정하지 않는다. 커밋·모델 변경 금지. w15 pane에는 보내지 않는다.
