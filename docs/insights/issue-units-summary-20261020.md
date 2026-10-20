# 이슈별 구현 단위 종합 현황 및 리뷰 요약 (2026-10-20)

- 작성: w2. 근거: `docs/insights/issue-followup-20261020.md` 및 작업 패킷.
- 원칙: 완료·진행·미검증을 정확히 구분하고, 순수 단위와 이슈 전체 범위를 분리 기록한다.

## 1. 이슈별 현황 요약 (완료 / 진행 / 미완료)

| 이슈 | 순수 단위 상태 | 이슈 전체 현황 및 미완료 범위 |
| --- | --- | --- |
| **#180** (Free 캘리브레이션) | **[완료]** w1 CI 테스트 ENOTDIR 대체 및 child fail-fast 격리 (`58f5524`) | **[진행/미반영]** 원격 `origin/dev` push 및 PR #191 재실행·머지 대기 중 |
| **#190** (Arena 코딩 단위A) | **[완료]** 순수 파서·타입·모델·테스트 7/7, 최종리뷰 PASS ([보고서](arena-final-review-20261020.md)) | **[미착수]** 실제 HF transport(수집), DB 저장소, `full` split 키 중복 방지, once·레터 연결 |
| **#168** (모델 자동 감지) | **[완료/READY]** 순수 핵심 diff·eligibility·snapshot·render 구현, 테스트 4파일 24/24 PASS, 리뷰 READY·중복 diff 최종 검토 PASS ([보고서](model-discovery-review-20261020.md)·[최종](discovery-duplicate-review-20261020.md)) | **[미착수]** 실제 provider 어댑터(수집), 저장소 구현체, 설정 파일(`letter-model-lists.json`) 확장, catalog/once/레터 연결 |
| **하네스** (학습·검증) | **[완료]** `skill-authoring/SKILL.md` 외부 사실 교차검증 항목 보강 | **[완료]** CI docs-only 항상-validate 분리 (`e3abe25`) |

## 2. 외부 사실 및 단정 배제 점검

1. **Arena 출처 및 수치 의미론**:
   - 공식 URL `https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset` 직접 확인.
   - `webdev`=Bradley-Terry Arena Score, `agent`=IPS 추정치(음수 포함 실측). 0~1 성공률 단정 완전 철회.
   - `agent` aggregate 전체의 코딩 데이터 여부는 미확인(비코딩 혼합 가능성).
   - `agent_bash_reliability` 계열은 뷰어(Subset 24) 실재 확인되었으나 코딩 적격/행 스키마 미확인으로 allowlist 거부 유지.
2. **CI procfs 원인**:
   - Linux runner 타임아웃은 확정 사실이나, `/proc` 프리즈 원인은 미재현 가설(추정)로 명확히 분리.
3. **공식 API 인증**:
   - 상용 클라우드 벤더(OpenAI 등)와 로컬/오픈 엔드포인트(Ollama, HF Hub 등) 인증 요구사항 분리.

## 3. 그룹별 파일 목록 (워커는 원격 쓰기/커밋 금지)

- **그룹 1: 하네스 및 규칙 보강 (커밋 가능)**
  - `.agents/skills/skill-authoring/SKILL.md`
  - `docs/orchestration.md`, `docs/tasks.md`, `docs/flaky-tests.md`
- **그룹 2: #190 Arena 단위A (최종 리뷰 PASS, 커밋 가능)**
  - `src/insights/arena-coding-{types,parser,model}.ts` (3파일)
  - `tests/insights-arena-coding-parser.test.ts` (1파일)
  - `docs/insights/arena-coding-unit1.md`, `docs/insights/arena-final-review-20261020.md`
  - `docs/insights/arena-source-check-20261020.md`, `docs/insights/arena-discovery-review-20261020.md`
- **그룹 3: #168 모델 감지 단위1/2 (최종 리뷰 READY·PASS, 커밋 가능)**
  - `src/insights/model-discovery-{types,diff,eligibility,render,snapshot}.ts` (5파일)
  - `tests/insights-model-discovery*.test.ts` (4파일)
  - `docs/insights/model-discovery-unit{1,2}.md`, `docs/insights/model-discovery-review-20261020.md`, `docs/insights/discovery-duplicate-review-20261020.md`
- **공통 점검 문서**: `docs/insights/issue-dispatch-20261020.md`, `docs/insights/issue-followup-20261020.md`, 본 문서.

## 4. 검증 결과

- 전체 `pnpm run check`: 1회차 단위 1165/1166 통과(usage-history-store.test.ts:84 시간단언 1278ms 실패).
  단독 3회 순차 통과(각 6/6 pass, 788.8/794.3/813.2ms, 코드 미변경) 후 재실행 결과 단위 1166/1166, BDD 45/635, typecheck, build 모두 exit 0 완료.
- `python3 scripts/validate-repo.py`: PASS. `git diff --check`: PASS. 모든 문서 파일 줄 수 ≤ 100줄 준수.
- #168 최종 검토(중복 diff 최소수정 독립판정, 2026-10-20): discovery 집중 **24/24 PASS exit 0**,
  `pnpm run typecheck` exit 0, `validate-repo.py` PASS exit 0, `git diff --check` exit 0. 전체 check는 중복 실행하지 않았고
  최종 root 전체 check 추가 실행은 총괄 기록을 따른다. 상세는 [discovery-duplicate-review-20261020.md](discovery-duplicate-review-20261020.md).

- 최종 상태: [최종 검증](final-validation-20261020.md). 기본 병렬 1166/1167(기존 시간 단언 실패), 직렬 1167/1167·BDD45/635·타입·빌드 통과.

- 로컬 커밋: CI 수정 58f5524, Arena d0ace75, 자동감지 핵심 5eccc2b. #168·#190 전체 통합과 원격 갱신은 미완료다.
