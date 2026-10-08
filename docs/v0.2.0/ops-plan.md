# 0.2.0 운영·배포 계획 (#52·#53·#55, 설계 초안)

> 준비 단계: 설치·구현 금지. 근거: 이슈 #52·#53·#55 완료 기준. 정합: `architecture-contract.md` §2–3,
> `api-contract.md` §1(health), `failure-policy.md` §3–4, `sqlite-schema.md` §2·§6, `dependency-contracts.md`(pm2 7.0.4·pino 10.4.0·pino-roll 4.0.0).

## 1. PM2 단일 fork 인스턴스 (#52)

- ecosystem 설정: `instances: 1`, `exec_mode: 'fork'`, 앱 이름 고정. 모드·인스턴스 수는 설정에 명시한다.
- 이중 실행 방지: PM2 동일 앱 중복 start 금지 + 서버 listen 잠금(PID/lockfile)으로 외부 중복 기동을 차단한다.
- 생명주기: `architecture-contract.md` §3 순서 그대로. 시작은 config→저장 연결→수집 1회→리슨,
  종료는 SIGTERM·SIGINT 동일 경로로 스케줄러 중단→수집 완료 대기→WS 종료→플러시·연결 닫기.
- 장애·배포 복구: 크래시 auto-restart와 `pm2 restart` 후 기동 시 `running` 잔존 run을 마감(`sqlite-schema.md` §2).
- SQLite 파일: 실행 계정 전용 경로·권한(디렉터리 0700·DB/WAL/SHM 파일 0600).
- 인증 환경: 공급자 CLI 인증은 서버 실행 계정에서 점검한다. #29 해결 전 Claude 자동 수집은 `failure-policy.md` §3 안전 정책을 따른다.

## 2. Pino 구조화 로그·프로세스 내부 회전 (#53)

- 형식: Pino JSON. 공통 필드 `time`·`level`·`msg`·`provider`·`run_id`(상관 ID, `collection_runs.id`)·`errorCode`.
- 기록 대상: 수집 시작/종료, 공급자 오류, 인증 만료, DB·WS 장애.
- 금지: 비밀값·개인 응답 원문·CLI 표준출력 저장. 오류 메시지는 고정 문구 코드만(`failure-policy.md` §4).
- 회전: pino-roll이 파일 회전의 단일 주체. 일 단위(`frequency: 1d`) 기본 + 크기 상한·보존 기간·최대 개수 정의.
  PM2 logrotate 사용 금지 → 중복 회전·무제한 축적 방지.
- 책임 분리: PM2 stdout/stderr는 시작·치명 오류·미처리 예외만 출력, 앱 로그는 pino 파일로 직행.
- 권한: 로그 파일 0600. 회전 1사이클·권한·재시작 후 재생성을 테스트로 확인한다.

## 3. 배포·백업·로그인 복구 절차 (#55)

- 설치: Node 24.13.1·pnpm 12.10.1 고정 → `pnpm install --frozen-lockfile` → `pnpm build` → ecosystem으로 PM2 기동.
- 환경변수: `.env`는 gitignore + 0600(실행 계정만). 토큰·키는 로그·DB·WS에도 금지.
- 헬스체크: `GET /api/v1/health`(`ok`|`degraded`, `api-contract.md` §1)로 기동·DB 연결을 확인한다.
- 백업: WAL 일관 핫백업(`VACUUM INTO`/백업 API)으로 실행 중 백업, 원본 파일 직접 복사 금지.
  보관: 일 단위 + 개수 상한. 복원 훈련(백업→삭제→복원) 1회 검증.
- 마이그레이션 실패 복구: 백업 복원 → 저널 확인 후 재실행(`sqlite-schema.md` §6, 재실행 가능 마이그레이션).
- 로그인 만료 복구: 서버 실행 계정에서 `authentication` 확인 → 토큰·키 재설정 → CLI `once` 1회 확인 → 수집 재개
  (`failure-policy.md` §3, 자동 로그인 명령 실행 금지).
- 릴리스 체크리스트: #29 안전 확인, 최신 PR CI, #54 E2E 결과, 미해결 이슈 목록.

## 4. 검증 계획

- PM2: 이중 기동 차단·SIGTERM 정상 종료·크래시 재시작·DB 파일 권한을 확인한다.
- 로그: 회전·권한·재시작 재생성 + 시크릿·원문 미포함 스캔.
- 운영: 백업 복원 훈련, health `degraded` 시나리오, 마이그레이션 실패 복구 훈련.
- 결과는 해당 이슈(#52·#53·#55)의 검증란에 근거와 함께 기록한다.
