# #195 단위3 — 세 역할 목록 Markdown 렌더러 (2026-10-20)

- 범위: 오케스트레이터·리뷰어·워커 3역할 목록을 그리는 **독립 렌더러**. **단위3이며 #195 전체 완료를 뜻하지 않는다.**
- 소유: `src/insights/letter-three-role-render.ts`·`tests/insights-letter-three-role-render.test.ts`·본 문서.
- **기본 꺼짐(default-off)**: 기존 레터 출력·렌더러·CLI·카탈로그를 건드리지 않고 publish에도 연결하지 않는다(신규 파일 2개 + 본 문서만 추가).

## 1. 입력·출력 계약

- 입력: 단위2 선택 결과(`RoleSelectionResult`)와 호환되는 형태 —
  `orchestrator`·`reviewer`·`worker` 항목 배열 + 선택적 `depth`(7 기본 / 15) + 선택적 `publicationDate`.
- 항목 필드: `modelId`(필수)·`rank`·`score`·`effort`·`isPareto`·`unconfirmed`·`weightOpen`(모두 선택).
- 출력: `# 3역할 리포트` 제목 + 역할별 섹션 3개(오케스트레이터·리뷰어·워커) + compact 범례.
- 표 열: `순위 | 파레토 | 모델 | 스코어 | effort | 비고` — 기존 레터 표 관례(파레토 👍 표기·effort 열·비고)를 따른다.

## 2. 규칙

- **가중치·점수를 새로 만들지 않는다.** 전달된 값을 그대로 그린다(리뷰어 가중치도 미도입). 값이 없으면 `-`.
- 목록이 비면 `- (목록 없음)` 한 줄. 짧으면 있는 행만.
- depth 7/15에 맞춰 행을 자르고 제목에 `Top7`/`Top15`를 붙인다(기본 7).
- **결정성**: 같은 입력 → 같은 출력(정렬·무작위·시각 의존 없음).
- **이스케이프·제어문자**: 기존 레터 렌더러(`letter-top10-render.ts`)의 `clean` 규칙과 동일하게 제어·양방향 문자를 공백으로 바꾸고
  ANSI를 제거하며 자격정보 패턴(`Bearer …`, `api_key=…`, `sk-`/`hf_`/`gh?_` 토큰)을 `[redacted]`로 마스킹한다.
  해당 헬퍼는 비공개이며 기존 렌더러를 수정하지 않으므로 **규칙만 재현**했다(비밀값 미포함). 파레토 표기는
  기존 `letter-top10-legend.js`의 `PARETO_MARK`를 가져다 쓴다(복사 없음).

## 3. 검증 (합성, 네트워크 0)

`tests/insights-letter-three-role-render.test.ts` 7건: 세 섹션 존재·표 머리 3개 / Top7 vs Top15 행 수와 기본 depth /
빈 목록·짧은 목록 / 선택 필드 누락(`-`)·가중치 미생성 / 제어문자·자격정보 제거 / 결정성(반복 동일) /
**기존 레터 출력 불변**(기존 렌더 출력에 `🔍 리뷰어`·`3역할 리포트`가 섞이지 않고 기존 표기가 그대로).

- `node --import ./tests/harness-setup.mjs --import tsx --test tests/insights-letter-three-role-render.test.ts` → **7 pass / 0 fail, exit 0**
- `pnpm run typecheck` → 내 파일 오류 0건(잔여 1건은 `src/insights/model-discovery-runner.ts:64` — 타 워커 진행분)
- `python3 scripts/validate-repo.py` → PASS(894 files) · `git diff --check` → clean
- 작성 파일 100줄 이하(렌더러 77줄·테스트 58줄·본 문서)

## 4. 남은 범위(#195 미완료)

1. 실제 데이터 연결(단위2 선택 결과를 이 렌더러에 넘기는 경로) — 미구현.
2. publish 연결·기본 켜기 — 미구현(단위3은 독립 렌더러만).
3. 리뷰어 가중치·점수 산식 정의 — 미도입(단위2의 역할 선택이 전달하는 값만 그림).
4. 레터 본문 레이아웃과의 병합·헤더 정합 — 미구현.
