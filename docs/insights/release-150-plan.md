# yoroi v1.5.0 릴리스 계획서

## 1. 버전 및 SemVer 근거
- **판올림**: `1.4.0` → `1.5.0` (Minor)
- **근거**: 하위 호환을 유지하며 #168(모델 자동감지), #190(Arena 코딩 연동), #195(3역할 체계), #194(Actions 레터 발행) 등 신규 기능 아키텍처 추가.

## 2. 모듈별 격리 및 기본 꺼짐(Default-Off) 상태
- **#168 (모델 자동감지)**: `enabled: false` 유지. 자동 활성화 미실행, CLI/공개 제공자 격리.
- **#190 (Arena 코딩 지표)**: 수집 정책 미결 상태. `policyReady: false` fail-closed 차단 유지.
- **#195 (3역할 선발 체계)**: 발행 기본 off. 리뷰어 가중치는 확정(50/20/30) 반영, JSON 패키징 포함.
- **#194 (Actions 레터 발행 전환)**: 사용자 검증 후 전환 허가는 기지시로 승인 완료. 저장소 Secrets 설정 확인, 로컬 PM2 yoroi-letter 중지(stopped) 확인 완료. 기존 워크플로우 dry-run 중복 경로만 안전하게 검증 완료.

## 3. 이슈 종료(Closes) 관리
- 본 릴리스 PR 본문에는 `Closes #194`, `Closes #195`를 포함하지 않음 (AGENTS 규칙 준수: 머지 및 외부 발행 확인 후 종료).
- #168, #190 등 단위 기능 구현 완료 이슈 위주로 연계.

## 4. 검증 및 릴리스 상태
- **현재 상태**: dev 브랜치 준비 중. `package.json` 1.5.0 갱신, main `1.4.0` 유지, tag/Release 미발행.
- **빌드·CLI 검증**: `pnpm run build` 후 `node dist/src/main.js --version` 출력 1.5.0 일치 확인.
- **배포 순서**: dev → main PR 생성/통과 → 머지 → main workflow_dispatch CI → tag/Release 생성 → 전역 CLI 갱신.
