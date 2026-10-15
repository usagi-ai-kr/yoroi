# Grok 4.6·4.7 레터 비교 (2026-10-15)

## 날짜 기준·입력 출처
- 기준일 2026-10-15, 전일 2026-10-14. 저장 DB 읽기 전용 스냅샷 18000행(4원×2일).
- 기준 코드 v1.0.0 clean `5111378`, 예외본은 filter 1파일 overlay(bare preview). 아래 표는 이 전후 비교이며 Free catalog를 넣지 않았다.

## 전후 결과

| 모델 | 변경 전 | 변경 후 |
| --- | --- | --- |
| 4.6 오케 | 풀 밖 | ▽9 high 69.7 (지수 44.3) |
| 4.6 워커 | 풀 밖 | Top10 밖 (high 40.4) |
| 4.7 오케 | ▽7 high 70.8 | 변동 없음 |
| 4.7 워커 | Top10 밖 | 변동 없음 |
| 4.5·Sol | 제외·유지 | 동일 |

- w1 구현 독립 리뷰 APPROVE (26/26). 파레토·후속 표시 없음.
- #157과 grok 소속·effort 일치. 순위·소수점 차이의 원인은 미확정이다. 이번 결과는 같은 공개 스냅샷과 1.0 기준의 전후 비교이며 #157 완전 재현은 아니다.

## 재발행 판단·보존
- [완료] 레터 [#160](https://github.com/qus0in/yoroi/issues/160): 재현=`c7c403ee` 별도 clean repo + 10-15/14 공개 snapshot + Free 가드 `opencode models` 1회(12 free/2 plans). Free catalog를 넣은 발행본을 위 bare preview와 동일하다고 단정하지 않는다. GET 4.6 high 69.7 ▽9. #157 close, 차이 원인 미확정.
- 1.0.1 patch로 PR #159에 묶음. 새 milestone 없음.
- xhigh 상한과 기존 effort 작업은 1.1 이월. 미커밋 5파일 보존. scratch JSON은 커밋하지 않는다.
