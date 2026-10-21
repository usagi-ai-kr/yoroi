# 웹 PostgreSQL 이관 구현 — #263 (2026-10-21)

- 사용자: 레터 지정을 유지하며 SQLite 관련 사항을 기존 이슈처럼 웹 PostgreSQL로 이관 구현.
- 사용자 조치가 필요한 사항은 한 handle 이슈로 묶고 qus0in에게 assign한다.
- 기준: GitHub #263 본문. 실제 원격 원본을 읽고 요구를 확인한다. 메모 이슈는 읽기 전용.
- 범위: 인사이트 공개 가능 근거·source snapshots·수집 run·레터 발행 상태.
- 개인 사용량·OAuth/토큰·로컬 인증 저장소는 이관하지 않는다.
- PostgreSQL 표준 연결 기반으로 Neon/Prisma와 독립적인 구현을 우선한다.
- 공급자·리전·실계정 자원 생성은 사용자 결정/조치다. 가격·API 사실은 공식 문서 확인.
- 실제 DB 비밀값은 환경/Secrets로만 받으며 이슈·문서·로그에 출력하지 않는다.
- 사용자 승인 전 커밋·push·PR·레터 재발행 금지. 기존 데이터 삭제·실데이터 업로드 금지.
- 기존 08:00 KST·발행 멱등성·표/댓글 계약 유지. 원격 DB 실패를 memory 성공으로 위장하지 않는다.

## 분담

- w2(p4): SQLite/발행 경계 조사 → PostgreSQL 저장소·버전 SQL·연결 설정·마이그레이션 구현.
- 레터 WIP 8파일 및 그 테스트는 읽기 전용. package.json/lock은 w2 단독 소유.
- r: 레터 우선 최종 리뷰, 이후 PostgreSQL 독립 리뷰. w1/w3는 레터 단위 종료 후 추가 분담.
- 각 단위는 5분 이내 검증 가능하게 나누고 다음 단위 패킷 초안·필요 소유파일을 보고한다.
- 첫 단위에서 사용자 조치와 전체 구현 경계·SQL/포트·테스트 명령을 정리한 후 구현을 계속한다.
- 실제 DB가 없어도 fake SQL client·계약 테스트로 실패/트랜잭션/중복/부분 snapshot을 검증한다.
- 이후 발행 읽기 전용 snapshot 경로·수집/발행 workflow 분리는 독립 단위로 이어간다.
- 새 수집 소스 #262 구현은 본 범위에서 강제로 결합하지 않는다.

## 보고·검증

- docs/insights/postgres-migration-progress-20261021.md에 주요 진행을 기록한다(≤100줄).
- tmp/yoroi-263-postgres-impl-report.json에 modified_files·검증·미완료·다음 패킷을 기록한다.
- 사용자 조치 초안: tmp/yoroi-263-user-actions.md. o가 하나의 handle issue로 생성/assign한다.
- 사용자 조치 초안에는 공급자/리전, 최소 권한 DB 접속 Secrets 이름, 콘솔 한도·백업·실측 등
  사람만 할 수 있는 조치와 에이전트 구현·테스트를 구분한다. 추측한 비밀값/한도는 기록하지 않는다.
- 신규 파일/직접 작성 파일은 100줄 이하. README·AGENTS 변경 금지.
- 전체 check·validate-repo·diff-check 필요. 실DB 검증 미실행은 명확히 표시한다.
