# 0.2.0 빌드 기반 설계 (#32, 설계 초안)

> 준비 단계: 설치·구현 금지. 근거: #31 `architecture-contract.md`, #30 계획.

## 1. 현행 유지 (인용)

- `package.json`: Node `24.13.1`·`pnpm@12.10.1` 고정, `bin: dist/src/main.js`.
- 스크립트: `dev` (tsx 실행) · `build` (tsc) · `typecheck` · `test` · `test:bdd` · `check`.
- `tsconfig.json`: NodeNext ESM strict, `rootDir .`·`outDir dist`,
- `include: src/**, tests/**, features/**`. 서버·웹 추가 시 include 확장만.
- `.nvmrc`·`pnpm-workspace.yaml`·`.npmrc(engineStrict)` 유지. 버전 변경 없음.
- CLI `once`/`watch` 동작·종료코드·60초 완료-후-대기는 그대로 둔다.

## 2. 진입점·디렉터리 구조 (설계)

- `src/server/main.ts`: Hono(Node) REST + Zod + WS 알림 진입점. 단일 프로세스 기동.
- `src/server/*`: 라우트·WS·정적 서빙. 수집 호출 금지(조회·구독만, #31 §2).
- `web/`: Vite + React 진입점 (`web/src/main.tsx`). ky·TanStack Query·Zustand,
- Tailwind + daisyUI + Pretendard, ECharts. 빌드 산출물은 `web/dist/`.
- `src/app/collect-once.ts`·`watch-usage.ts`: 서버 수집기가 재사용하는 단일 주체.
- 정적 서빙 경로: 서버가 `web/dist/`를 서빙. API(`/api/*`)·WS와 경로 충돌 금지.
- `src/domain`·`infra/*-source`·`composition/sources.ts`는 서버·CLI 공용, 복제 금지.

## 3. 스크립트 계획 (이름만, 구현은 별도 승인)

- `dev:server` (tsx 서버 실행) · `dev:web` (Vite 개발 서버) · `dev` (CLI, 현행 유지).
- `build:server` (tsc 서버) · `build:web` (Vite 빌드→`web/dist`) · `build` (전체 순차).
- `typecheck` (루트 + 서버 + 웹) · `smoke` (빌드 산출물 기동·`once` 회귀·헬스 확인).
- `check` 확장: typecheck → test → test:bdd → build → smoke. CLI 단독 실행 경로 보존.

## 4. CI 확장 계획 (현행 `ci.yml`·`ci-scope.py` 인용)

- 현행: docs-only 변경은 fast pass (`docs/**`·루트 문서). 본 문서도 fast pass 대상.
- full 실행 시 순서 유지: `validate-repo.py --ci` → 스킬/회귀 검증 →
- `pnpm install --frozen-lockfile` → `pnpm run check` (확장된 check).
- 추가분: 서버·웹 typecheck 분리 표시, 빌드 산출물 존재 확인, smoke(헬스+`once`).
- `ci-scope.py` 분류 규칙 변경 없음. 서버·웹 파일은 full 경로로 자동 포함됨.

## 5. 검증 계획

- 합성 데이터: fake source·스케줄러로 수집→저장→REST→WS→웹 표시 흐름 확인.
- CLI 회귀: `once` 종료코드·`watch` non-overlap 기존 테스트 그대로 통과.
- smoke: 빌드 후 서버 기동, `web/dist` 서빙·API 헬스·WS 재접속 1회씩.
- 결과는 본 문서 검증란에 날짜와 함께 기록. 설치·구현은 별도 이슈 승인 후.
