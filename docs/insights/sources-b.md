# 인사이트 소스 조사 B — Vals AI · Arena

이슈 #70 완료 기준 1번 중 Vals AI·Arena 항목이다. 공개 문서·약관·robots.txt·Hugging Face 데이터셋
카드만 읽었다. API 키·로그인·대량 크롤링·우회 없음, 실제 수집 호출도 없다. 조사일: 2026-10-10.

## Vals AI (www.vals.ai)

| 항목 | 내용 | 근거 URL |
| --- | --- | --- |
| 공식 API/데이터셋 | 공개 벤치마크 데이터 API 없음. 공개 HTML 리더보드가 유일한 공식 경로. docs.vals.ai의 API/CLI/SDK(`pip install valsai`)는 자체 앱 평가 실행용 플랫폼이라 리더보드 조회 대상이 아님 | https://www.vals.ai/benchmarks, https://docs.vals.ai/cli/cli |
| 인증 | 공개 리더보드 무인증. 플랫폼은 계정 + `VALS_API_KEY` 필요 | https://docs.vals.ai/sdk/setup |
| 비용 | 공개 페이지 무료. 플랫폼은 미공개 가격(데모 상담) | https://www.vals.ai/product |
| 재사용·인용 | 사이트 약관 링크 없음(푸터: About/Methodology/News/Blogs/Government/Security). 저작권 "© 2026 Vals AI. All rights reserved." → 출처 링크·인용만, 원문 대량 복제 금지 | https://www.vals.ai/about, https://docs.vals.ai/get_started/introduction |
| robots.txt | `User-agent: *` `Allow: /`. Disallow: `/api/MailingList`, `/api/DemoNotifcation`, `/api/ApplicationDownload`. 리더보드 경로 허용 | https://www.vals.ai/robots.txt |
| 수집 가능 필드 | 벤치마크별 Top-N 모델명·점수(%)·`Updated` 갱신일·`Models Tested`. 모델 단가($/M in·out)·평가 설정·컨텍스트·지연·토큰 사용은 모델 리포트와 블로그 본문에 산재 | https://www.vals.ai/benchmarks/vals_index, https://www.vals.ai/models/anthropic_claude-sonnet-5-5 |
| 미확인 | 공개 약관·재배포 정책 미게시 / 허용된 비공식 JSON 엔드포인트 공식 확인 불가 / 일별 스냅샷 이력 부재 → 전일 대비 변화는 `Updated` 일자 기반 추정만 가능 | https://www.vals.ai/methodology |

수집 메모: 1일 1회·단일 페이지만, 캐시 유지가 상한. `/api/*` Disallow 3개 경로는 호출 금지.
개인키·사용자 응답 무관. 타 소스와 지표 정의(점수·비용 단위) 혼합 금지, 원출처 링크 명시.

## Arena (arena.ai)

| 항목 | 내용 | 근거 URL |
| --- | --- | --- |
| 공식 API/데이터셋 | 공식 HF 데이터셋 `lmarena-ai/leaderboard-dataset`(parquet)이 1순위. 웹 페이지는 미수록 최신 확인용 보조. 공개 REST API는 없음 | https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset, https://arena.ai/blog/arena-leaderboard-dataset |
| 인증 | HF 공개 데이터셋 무인증(비게이트). 웹 페이지도 무인증 | https://huggingface.co/api/datasets/lmarena-ai/leaderboard-dataset |
| 비용 | 무료(HF 공개 스토리지, 약 124MB / 2,480,250행) | https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset |
| 재사용·인용 | 데이터셋 라이선스 CC-BY-4.0 → 재배포·2차 활용 가능, 저작자 표시 필수. 반면 arena.ai 사이트 자동 쿼리·스크래핑은 Terms of Use §5(vi)(vii) 금지(검색엔진 예외). 사이트 이용은 개인·내부 업무 목적 한정(§1) | https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset, https://arena.ai/terms-of-use |
| robots.txt | `/leaderboard*` Allow. Disallow: `/api/`, `/nextjs-api/`, `/_next/`, `/images/`, `/c/`, `/agent/`, `/history/search` | https://arena.ai/robots.txt |
| 수집 가능 필드 | subset(아레나 14종: text/vision/search/document ±style_control, webdev, text_to_image, image_edit, text_to_video, image_to_video, video_edit, agent + 신호 5종) × split(`latest`/`full`). 컬럼: `model_name`, `organization`, `license`, `rating`(Arena Score)·CI·`variance`·`vote_count`·`rank`·`category`·`leaderboard_publish_date`. 에이전트 아레나는 Bradley-Terry 대신 IPS 점수(`score`, CI, `observation_count`, `session_count`) | https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset |
| 미확인 | HF 외 공식 REST API 부재 확인됨 / 데이터셋 갱신 주기(데일리 여부) 미공지 → `leaderboard_publish_date`로 기준일 판단 / 레터 내 데이터셋 라이선스 표기 문구는 발행 전 확정 필요 | https://arena.ai/blog/arena-leaderboard-dataset |

수집 메모: 레터 기준일은 `leaderboard_publish_date`(YYYY-MM-DD). 텍스트·비전 아레나는 2025-05-16부터
style control 기본값. 웹 페이지 스크래핑은 약관 금지이므로 HF `latest` split만 사용한다.

## 소스 구분 한계

- Arena는 사용자 선호 투표, Vals AI는 벤치마크 정확도다. 두 지표를 단일 점수로 합산하거나
  범용 성능 순위로 혼동하지 않는다. 모델 식별자(`model_name` vs `org_model`)는 어댑터에서 매핑한다.
- Vals AI 점수는 비공개 테스트셋 기반이므로 외부 재현이 불가하고, Arena 점수는 공개 투표 집계다.
- 두 소스 모두 공식 수집 경로 내에서만 일 1회 조회하고 원문 대량 저장은 하지 않는다.

## 2026-10-11 최신 override — Arena overall 상위 20
- Arena coding 카테고리 탐색(`/statistics`+공식 `where` `/filter` 2요청)은 결론 없이 종료(halt)됐고, 수집은 overall rank≤20(20위 동점 포함, 첫 쪽 경계 확인 목표, maxRequests2·재시도 포함)으로 대체됐다. 600행 상한 결정은 불필요해졌다(arena-transport.md §10).
