# 인사이트 레터 (AI 추천)

수집된 데이터를 바탕으로 모델 추천을 정리한 일일 레터입니다.

```bash
yoroi insights once --pretty              # 화면용 렌더
yoroi insights once --pretty --full       # 전체 근거 포함
yoroi insights publish --dry-run          # 발행 미리보기(쓰기 없음)
yoroi insights publish --not-before 08:00 # 08:00 KST 이후 발행
```

## 구성 (3역할)

- 본문 Top7: 오케스트레이터·리뷰어·워커 각 7개 추천.
- 모델명은 base id + effort 별도 열로 표시합니다.
- effort 상한: Sonnet high, Spark xhigh 등 관측 cap을 적용합니다.
  cap이 없는 모델은 관측된 effort를 그대로 사용합니다. 미확인 표기는 두지 않습니다.
- 댓글 Top15: 본문 Top7을 접두로 유지하고, 8위 이후는 역할별 독립 후보라
  오케스트레이터와 리뷰어에 같은 모델이 겹칠 수 있습니다.
- 리뷰어 후보는 보유 플랜 catalog에 접근 가능한 모델만 씁니다
  (AA 전용 미보유 모델 제외).
- usagi 정성 비고는 출처와 함께 표시하며 점수가 아닙니다.
- Free 티어: `-free` 접미사를 뗀 이름으로 접근 가능 목록을 보입니다
  (가격이 아닌 접근 근거).

## 발행 흐름

- GitHub Actions가 UTC 23:00 (= 다음 날 08:00 KST)에 정기 발행합니다.
- 발행은 날짜별 이슈 1개 + 댓글 3개로 게시됩니다.
- 같은 날짜 OPEN 이슈가 있으면 건너뛰거나 댓글을 복구합니다.
- CLOSED만 있으면 같은 제목으로 새로 발행합니다 (기존 레터 보존).
- PM2 정기 발행은 중지 상태입니다.
- 예시: [2026-10-20 레터 #215](https://github.com/usagi-ai-kr/yoroi/issues/215).

## 데이터 주의

- 점수는 수집 시점의 스냅샷 기준이며 실시간 가격이 아닙니다.
- 일부 소스가 빠지면 부분 수집으로 표시됩니다.
- 개인 사용량 원본·토큰은 레터·이슈에 기록하지 않습니다.
