# Ollama Muse 공식 metadata (직접 페이지 확인)

- 조회일: 2026-10-16 UTC. 방식: webfetch 직접 확인. pull/서빙/API 호출 없음.
- 공식 출처만: `ollama.com/library`, `docs.ollama.com`, Meta 제공자 블로그.

## 직접 확인 URL

- https://ollama.com/library/muse-spark-open (slug 본문·설명·요금·라이선스)
- https://ollama.com/library/muse-spark-open/tags (태그 1개 직접 확인)
- https://ollama.com/library/muse-spark-open:cloud (cloud 태그 상세)
- https://docs.ollama.com/cloud (cloud 명명·API key 규칙)
- https://ai.meta.com/blog/introducing-muse-spark-msl/ (base Muse Spark, Open 아님)

## slug / tag

- slug: `muse-spark-open` (URL·제목 직접 확인).
- tag: `muse-spark-open:cloud` 단일 (Tags 페이지 1 model).
- digest: `de22cf2fe991` · High Usage · 19 hours ago.
- Downloads 497 · Updated 19 hours ago (조회 시점 표기).

## cloud / local 지원

- cloud: 지원. 뱃지 `cloud`, `ollama run muse-spark-open:cloud`.
- API: `curl https://ollama.com/api/chat` + `Bearer $OLLAMA_API_KEY`.
- docs 규칙: API는 목록 이름, App/CLI는 `모델:cloud`, 다운로드 불필요.
- local: 미확인. Tags에 local 태그·GGUF·용량 없음. Size 표기는 cloud 스펙.

## 모델 정체성 (공식 문구 그대로)

- 표시명: `Muse Spark Open`.
- 설명: natively multimodal, 816B total (42B active), 1M-token context.
- 용도: coding·agentic, long-horizon·complex SWE·multi-step reasoning.
- 뱃지: vision·tools·thinking·cloud. 입력: Text, Image. Context: 1M.
- 주의: Cost 블록 Size는 `822B parameters`로 본문 816B와 수치 상이. 공식 페이지 그대로 기록, 임의 통일 금지.

## 공식 동의어

- 확인된 동의어 없음. `Muse Spark Open` = `muse-spark-open`만 확인.
- `muse-glimmer`, Muse Spark (base), 1.1/1.2/1.3과 동일 추정 금지.
- Meta 2026-04-08 블로그는 base Muse Spark 설명이며 Open 연결 문구 없음.

## 접근 조건

- API key 필요: `ollama.com/settings/keys`, `export OLLAMA_API_KEY`.
- App/CLI sign-in 후 cloud 사용. 사용량·요금은 plans/pricing 따름.
- 라이브러리 요금: input $1.25 / cached $0.15 / output $4.25 per 1M.
- License: Muse Model License, limited commercial terms, many developers free.
- 라이선스 원문 링크는 공식 페이지 인용만 (직접 fetch 미수행):
- https://huggingface.co/meta-models/Muse-Spark-Open-816B-A42B/blob/main/LICENSE.md

## 공개 benchmark ID 연결

- 미확인. 라이브러리 3개 페이지에 benchmark ID·점수 없음.
- Meta 블로그 HLE 58% 등은 base Muse Spark 수치라 Open 연결 근거 아님.
- 검색 결과뿐인 항목은 미확인으로 둠. 직접 확인 불가 항목 없음(핵심은 직접 확인).

## 준수

- 다운로드/pull/서빙/API 사용/실계정/env/secret 접근 없음.
- 레포 코드·설정·Git/GH 변경 없음. 소유 docs/JSON만 작성.
