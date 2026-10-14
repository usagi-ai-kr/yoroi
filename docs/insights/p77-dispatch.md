# p77 분배: 레터 표기·점수 결측 3건 (2026-10-14 사용자 지적)

o(`w12:p13`)는 분배만 맡는다. 1단계 조사·작은 수정 → o 확인 → 2단계 수정 → 리뷰 → 렌더 → #138 반영.
결과 요약: `scratch/reports/yoroi-p77-letter-fixes.md`(o). push·머지·커밋 금지(PR #140은 메신저 처리).
대상 발행본: #138(15:27 KST), `scratch/reports/letter-2026-10-14-v0110.md`.

## 1단계

| 단계 | 워커 | 범위 | 보고 |
| --- | --- | --- | --- |
| F1 | w3 | 세션 헤더 표기 숨김(아래) — 구현 | yoroi-p77-w3f-report.json |
| I2 | w1 | mimo-v2-6-flash 결측 조사 — 읽기 전용 | yoroi-p77-w1i-report.json |
| I3 | w2 | cat-jam 누락 조사 — 읽기 전용 | yoroi-p77-w2i-report.json |

### F1 세션 헤더 표기 숨김 (w3)

- Free 표 `Free 경로` 열에서 `⚠️세션 헤더 필요`를 뺀다(예: `OpenCode Zen Free+OpenCode Go Free`).
- 티어 설명의 `OpenCode Go Free: … x-opencode-session 헤더 필수로 OpenCode 클라이언트 세션에서만 사용.` 문구를 레터에서 지운다.
  Go Free 줄이 필요하면 헤더 언급 없이 남기고, 내부 사실은 `docs/insights/letter-issue.md`의 Free 절에 한 줄로 남긴다.
- 표시 안내의 ⚠️ 의미 줄은 다른 용도가 남아 있으면 유지한다.
- 소유: `src/insights/letter-markdown-free*.ts`, `src/insights/letter-markdown.ts`(티어 설명이 여기면), Free 테스트, `docs/insights/letter-issue.md`.
  그 밖의 파일에서 문구를 찾으면 고치지 말고 보고한다.

### I2 mimo-v2-6-flash (w1, 읽기 전용)

- 사실(메신저): `~/.local/share/yoroi/yoroi.db` `insight_daily`의 `artificial-analysis`/`2026-10-14`/`aa-v2:free:language-models:all` payload에 `mimo-v2-6-flash` 문자열이 있다.
- AA 슬러그 ↔ 모델 id 매칭(`AA_METRICS`·`EVIDENCE_METRICS`·`letter-top10-*`·이름 정규화)을 따라가 (i) 매칭 실패인지 (ii) 임계·성능 하한으로 정당한 미달인지 파일:줄로 구분한다.
- 정당한 미달이면 AA 지수가 표에 보여야 하는데 왜 안 보이는지도 구분한다. 고칠 위치와 최소 수정안을 제안만 한다.
- 사용자 확인: `mimo-v2-6-flash`와 `mimo-v2-6-pro`는 다른 모델이다(합치지 않는다). `mimo-v2-5` 배제는 맞다(건드리지 않는다).

### I3 cat-jam (w2, 읽기 전용)

- 사실(메신저): 저장된 payload 어디에도 `cat-jam`이 없다. 단서(o): 워커 화면 모델 표시줄이 `Cat Jam Free OpenCode Go`다.
- `src/insights/opencode-free-models.ts`·`opencode-models-source.ts`의 Free 목록 수집 경로(Zen·Go), 로컬 캐시·설정에서 `cat`/`jam`을 찾는다.
  새 네트워크 호출은 하지 않는다. 로컬 `opencode` 설정·캐시 파일 읽기는 허용한다.
- 결론: 목록에 있는데 필터·이름 규칙으로 빠졌는지(파일:줄), 아니면 수집 경로(Go Free 카탈로그)가 아예 없는지 구분하고 최소 수정안을 제안한다.

## 별도 단위 R (메신저 전달: 1.0 계획, p77과 무관)

- w4: `docs/roadmap.md`에 ① "0.12.0 완료 후 그 기준을 1.0으로 가져간다(마일스톤 1.0.0 #23)" 한 줄
  ② 릴리스 상태: 0.10.0 발행 완료(tag `v0.10.0`, main `245d538`), 0.11.0 PR #140 진행 중, 다음 0.12.0(xAI/Cursor, #119·#132).
  최소 줄, 100줄 이하(자리가 없으면 기존 줄 대체), validate PASS. 소유 `docs/roadmap.md`만. 보고 yoroi-p77-w4r-report.json.

## 공통 금지

커밋·push·머지, 실제 API·네트워크 호출, `--refresh`, 모델·세션 변경, 시크릿·개인 사용량 원본 노출, 소유 밖 수정, 파일당 100줄 초과.
