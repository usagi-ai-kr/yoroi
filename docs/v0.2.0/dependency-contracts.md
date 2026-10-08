# v0.2.0 기술 스택 의존성 계약 및 호환성 분석 (#30)

Node 24.13.1 및 pnpm 12 환경을 기준으로 공식 문서 및 레지스트리 메타데이터를 실측 검증한 결과입니다. (준비 단계로 실제 패키지 설치는 수행하지 않음)

## 1. SQLite 드라이버 비교 및 선정 (Drizzle 연계)

| 구분 | `better-sqlite3` (13.0.3) | `node:sqlite` (Node 24 내장 `DatabaseSync`) |
| :--- | :--- | :--- |
| **Drizzle 지원** | 공식 1급 지원 (`drizzle-orm/better-sqlite3`) | 공식 드라이버 없음 (`sqlite-proxy` 수동 구현 필요) |
| **마이그레이션** | `drizzle-kit` push/migrate 네이티브 지원 | `drizzle-kit` 직접 지원 불가 |
| **캐시 호환** | `@keyv/sqlite`가 `better-sqlite3`를 직접 의존 | `@keyv/sqlite`와 직접 연동 불가 |
| **특징 및 한계** | 고성능 C++ 애드온 (사전 빌드 바이너리 제공) | 표준 내장(무설치/컴파일 불필요), 단 실험적 API |
| **추천 결론** | **[선택]** Drizzle 생태계 안정성 및 @keyv 일관성 확보 | 향후 Drizzle 공식 드라이버 채택 시 전환 검토 |

## 2. 의존성 스택 상세 계약 표

| 패키지 | 최신 버전 | Node 24 / pnpm 12 | ESM / TS | 주의점 및 계약 요구사항 | 공식 문서 링크 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [`hono`](https://hono.dev) | 4.13.13 | 호환 (`>=16.9`) | ESM / TS 내장 | Node HTTP 구동 시 `@hono/node-server` 연계 필요 | [Hono Docs](https://hono.dev/docs) |
| [`zod`](https://zod.dev) | 4.6.5 | 호환 | ESM / TS 내장 | REST/WebSocket 요청 페이로드 런타임 스키마 검증 | [Zod Docs](https://zod.dev) |
| [`vite`](https://vite.dev) | 8.3.3 | 호환 (`>=22.12`) | ESM / TS 내장 | 프런트엔드 번들러 및 개발 HMR 서버 | [Vite Guide](https://vite.dev/guide/) |
| [`react`](https://react.dev) | 19.3.0 | 호환 | CJS/ESM (`@types`) | `@types/react`, `@types/react-dom` 19 설치 필요 | [React Docs](https://react.dev) |
| [`ky`](https://github.com/sindresorhus/ky) | 2.1.0 | 호환 (`>=22`) | 순수 ESM / TS 내장 | Fetch 기반 브라우저 HTTP 클라이언트 | [ky GitHub](https://github.com/sindresorhus/ky) |
| [`@tanstack/react-query`](https://tanstack.com/query) | 5.104.1 | 호환 | ESM / TS 내장 | 대시보드 비동기 데이터 캐싱 및 주기적 갱신 | [Query Docs](https://tanstack.com/query/latest) |
| [`zustand`](https://zustand.docs.pmnd.rs) | 5.0.15 | 호환 (`>=12.20`) | ESM / TS 내장 | React 19 호환 클라이언트 전역 상태 관리 | [Zustand Docs](https://zustand.docs.pmnd.rs) |
| [`tailwindcss`](https://tailwindcss.com) | 4.3.3 | 호환 | ESM / TS | Tailwind v4 Vite 플러그인(`@tailwindcss/vite`) 구성 | [Tailwind Docs](https://tailwindcss.com/docs) |
| [`daisyui`](https://daisyui.com) | 5.7.47 | 호환 | ESM / CSS | Tailwind v4 호환 daisyUI v5 설정 규칙 적용 | [daisyUI Docs](https://daisyui.com/docs) |
| [`echarts`](https://echarts.apache.org) | 6.1.0 | 호환 | ESM / TS 내장 | 사용량 추이 차트 (Canvas/SVG 렌더링) | [ECharts Docs](https://echarts.apache.org/en/option.html) |
| [`drizzle-orm`](https://orm.drizzle.team) | 0.45.3 | 호환 | ESM / TS 내장 | `better-sqlite3` 드라이버 어댑터로 영구 저장소 구성 | [Drizzle Docs](https://orm.drizzle.team/docs/overview) |
| [`drizzle-kit`](https://orm.drizzle.team/kit-docs/overview) | 0.31.11 | 호환 | CJS / devDep | 스키마 마이그레이션 CLI 도구 | [Drizzle Kit](https://orm.drizzle.team/docs/kit-overview) |
| [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) | 13.0.3 | 호환 (`>=22`) | CJS (`@types` 필요) | `@types/better-sqlite3` 필요, Node 24 prebuild 확인 | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| [`@keyv/sqlite`](https://keyv.org) | 6.1.0 | 호환 (`>=22.19`) | ESM / TS 내장 | TTL 캐시 저장소, `keyv` 6.1.0과 페어링 | [Keyv Docs](https://keyv.org/docs/) |
| [`lru-cache`](https://github.com/isaacs/node-lru-cache) | 11.5.3 | 호환 (`>=22`) | 순수 ESM / TS 내장 | 빠른 프로세스 인메모리 캐시 (비동기 I/O 분리) | [lru-cache](https://github.com/isaacs/node-lru-cache) |
| [`pino`](https://getpino.io) | 10.4.0 | 호환 | CJS / TS 내장 | 고성능 구조화 JSON 로거 | [Pino Docs](https://getpino.io/docs/api/) |
| [`pino-roll`](https://github.com/pinojs/pino-roll) | 4.0.0 | 호환 | CJS | 워커 스레드 기반 프로세스 내부 일 단위 로그 회전 | [pino-roll](https://github.com/pinojs/pino-roll) |
| [`pm2`](https://pm2.keymetrics.io) | 7.0.4 | 호환 (`>=18.0`) | CJS / TS 내장 | `instances: 1`, `exec_mode: 'fork'` 단일 인스턴스 운영 | [PM2 Docs](https://pm2.keymetrics.io/docs/usage/quick-start/) |
