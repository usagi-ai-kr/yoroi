# 1.0.3 발행 준비 (w3)

- 기준: `release-103-effort-fix-task.md`. 1.0.2 tag `adea4d3` 불변.
- w1 후보 수정 중(AA effort 실측값·라벨 일치만). raw·순위 불변 필수.
- 수정 0·diff 리뷰 별도 패킷. 준비 보고만.

## global 스크립트 (`/tmp/yoroi-103-update-global.sh`, 88줄)

- 102 원본 그대로 읽고 최소 변경: 버전 pin 2→3, tmp 경로 102→103.
- env 0600·trap 복원·dist diff 보호 그대로 보존.
- `aaFallback` 문자열 금지 제거: 승인된 라벨 수정 식별자와 충돌 가능.
- 대신 clean commit SHA 전체 dist 일치 + 마커 검증:
- R(`orchValue`·70/5/10/15)·normal·argon·muse·warn(`yellowBright`).
- npm publish 없음.

## mock 검증 (`/tmp/yoroi-103-global-mock/`, 실global·실env 접촉 없음)

- `bash -n` 통과. 실제 함수 기계 추출 후 합성 temp 검증:
- 부재 시 복원(0600)·존재 시 불변·백업없음 noop·쓰기불가 실패.
- 실패 시 cleanup 복원+비0 종료. 전수 통과(exit 0).

## 릴리스 노트 (`/tmp/yoroi-103-release-notes.md`)

- 1.0.2 전체 반복 없음. 표기 정합 버그·max 제한 아님·1.1 제외·레터 관계만.
- 레터는 수정본 재게시, 점수·순위 동일.

## 금지 준수

- Git·GH·tag·global·레터·commit·PR 없음. 소유 docs·tmp만. 보고 후 대기.
