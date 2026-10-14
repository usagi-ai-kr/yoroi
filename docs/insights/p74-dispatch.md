# p74 분배: 레터 재발행 (2026-10-14 사용자 지시 "레터 재발행 후 나에게 보고")

o(`w12:p13`)는 분배만 맡는다. 렌더·검증은 w3, 본문 리뷰·발행은 w4가 한다. 최종 요약: `scratch/reports/yoroi-p74-letter-republish.md`(o).

## 결정 (o)

- 발행 방식은 **#138 본문 갱신 + 변경 댓글 한 줄**이다. 같은 날 같은 제목 이슈를 또 만들면 중복이 늘고 `insights publish`의 중복 판정이 복잡해진다.
- 생성 기준은 **전역 CLI 0.10.0 스냅샷**(`yoroi insights once --markdown`)이다. 릴리스된 코드와 같고, 워킹트리 미커밋분이 섞이지 않는다.
- `--refresh`는 쓰지 않는다(캐시·SQLite 기준, 외부 재수집 없음).

## A. w3 — 렌더·검증

1. `yoroi --version`이 0.10.0인지 확인한다.
2. `yoroi insights once --markdown > scratch/reports/letter-2026-10-14-v0100.md`를 실행해 rc 0을 확인한다.
3. 본문 확인 항목:
   - 가중치 줄이 70%·5%·10%·15% / 30%·20%·10%·40%인지
   - 오케 표에 사용량 차원(성능/사용량/속도/가성비)이 들어갔는지
   - 시크릿·로컬 경로·개인 사용량 원본이 없는지
4. `c-5h` 라벨과 `한도 도달`/`한도 임박`은 사용량 보고(`yoroi once`·usage-hourly)의 표시 규칙이다.
   레터에 해당 항목이 없으면 "해당 없음"으로 보고한다. 억지로 넣지 않는다.
5. 레터 관련 테스트를 실행한다: `node --import tsx --test tests/insights-letter*.test.ts tests/insights-markdown*.test.ts tests/insights-render-markdown.test.ts`.
   이어서 `python3 scripts/validate-repo.py`를 실행한다.
6. 직전 #138 본문(`scratch/reports/letter-2026-10-14.md`)과 비교해 바뀐 점을 1~3줄로 보고한다.

## A 결과 (o 확인)

- w3 PASS: 0.10.0 rc 0, 가중치·오케 사용량 차원 확인, 시크릿 없음, c-5h·한도 표시는 레터 해당 없음, 레터 테스트 30 pass, validate PASS.
- 새 본문은 #138과 **동일**(o diff 확인, 끝 개행 1자만 다름). 같은 캐시·같은 코드라서다.
  댓글에 "0.10.0 릴리스 기준 재생성, 내용 변경 없음(같은 수집 캐시)"을 명시한다.

## B. w4 — 리뷰·발행 (A PASS 후)

1. A 산출 파일을 3번 항목 기준으로 다시 대조한다. 문제가 있으면 발행하지 않고 보고한다.
2. 본문을 갱신한다: `gh issue edit 138 --body-file scratch/reports/letter-2026-10-14-v0100.md`.
3. 변경 댓글 한 줄을 단다: `gh issue comment 138`(0.10.0 기준 재생성, 바뀐 점 요약).
4. 보고: 이슈 번호·URL·갱신 시각(KST).

## 공통 금지

커밋·push, `--refresh`·외부 재수집, 다른 이슈 수정·생성, 모델·세션 변경, 시크릿 노출.
